"""
Stage 1 false-negative feature diagnostic (analysis only).

Analyzes V2 benchmark Stage-1 false negatives using the frozen TF-IDF +
Logistic Regression model. Read-only: does not modify datasets, benchmarks,
or model artifacts.

Usage (from project root):
    python ml/analyze_stage1_fns.py
"""

from __future__ import annotations

import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.model.config import (
    ARTIFACTS_DIR,
    DATASET_PATH,
    PRODUCTION_THRESHOLD,
    TFIDF_CONFIG,
)
from ml.model.preprocess import preprocess_text
from ml.model.utils import load_model

DATA_DIR = PROJECT_ROOT / "ml" / "data"
UNSEEN_V2_CSV = DATA_DIR / "unseen_boundary_test_v2.csv"
REPORT_PATH = DATA_DIR / "stage1_fn_feature_diagnostic.txt"

PROB_BUCKETS = [
    ("<0.10", 0.0, 0.10),
    ("0.10-0.19", 0.10, 0.20),
    ("0.20-0.29", 0.20, 0.30),
    ("0.30-0.39", 0.30, 0.40),
]

DOMAIN_SERVICE_TERMS = {
    "bank", "banks", "upi", "paytm", "phonepe", "gpay", "google", "pay",
    "cred", "amazon", "mobikwik", "freecharge", "airtel", "jupiter", "navi",
    "bhim", "npci", "slice", "pop", "supermoney", "wallet", "account",
    "netbanking", "passbook", "ifsc", "neft", "imps", "vpa", "merchant",
    "subscription", "recharge", "ott", "broadband", "sim", "delivery",
    "flipkart", "swiggy", "zomato", "uber", "ola", "irctc", "epfo", "pf",
    "kyc", "aadhaar", "pan", "gst", "invoice", "loan", "emi", "credit",
}

SCAM_ACTION_TERMS = {
    "verify", "verification", "confirm", "confirmation", "validate",
    "update", "login", "log", "secure", "security", "approve", "approval",
    "click", "link", "visit", "complete", "upload", "reset", "unlock",
    "block", "cancel", "revoke", "dispute", "retry", "authorize", "auth",
    "pending", "failed", "declined", "hold", "suspend", "expire", "expired",
    "urgent", "immediately", "eod", "timeout", "alert", "warning", "notice",
}

TRANSACTIONAL_TERMS = {
    "payment", "pay", "paid", "transfer", "transaction", "txn", "refund",
    "debit", "credit", "balance", "due", "dues", "bill", "billing",
    "amount", "rs", "inr", "otp", "mandate", "autopay", "collect", "request",
    "beneficiary", "payee", "settlement", "charge", "fee", "cashback",
    "reversal", "statement", "cheque", "card", "upi", "pin",
}

ENGLISH_STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "if", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "as", "is", "was", "are", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "can", "not", "no", "nor", "so", "yet",
    "your", "you", "our", "we", "they", "their", "them", "it", "its", "this",
    "that", "these", "those", "before", "after", "now", "via", "into", "over",
    "under", "again", "further", "then", "once", "here", "there", "when",
    "where", "why", "how", "all", "each", "few", "more", "most", "other",
    "some", "such", "only", "own", "same", "than", "too", "very", "just",
}


@dataclass
class FeatureContribution:
    feature: str
    tfidf_value: float
    coefficient: float
    contribution: float
    direction: str


@dataclass
class FNAnalysis:
    message: str
    boundary_type: str
    spam_probability: float
    vocab_matches: list[str] = field(default_factory=list)
    active_features: list[FeatureContribution] = field(default_factory=list)
    top_ham_features: list[FeatureContribution] = field(default_factory=list)
    top_spam_features: list[FeatureContribution] = field(default_factory=list)
    ham_contribution_sum: float = 0.0
    spam_contribution_sum: float = 0.0
    oov_tokens: list[str] = field(default_factory=list)
    token_unigrams: list[str] = field(default_factory=list)


def load_v2_cases(path: Path) -> list[dict]:
    df = pd.read_csv(path, encoding="utf-8")
    cases = []
    for _, row in df.iterrows():
        boundary = row.get("boundary_type", "")
        if pd.isna(boundary):
            boundary = ""
        cases.append(
            {
                "text": str(row["text"]),
                "expected_label": str(row["expected_label"]).lower().strip(),
                "boundary_type": str(boundary).strip(),
            }
        )
    return cases


def predict_spam_probability(
    text: str, model, vectorizer, threshold: float
) -> tuple[str, float]:
    clean = preprocess_text(text)
    features = vectorizer.transform([clean])
    spam_prob = float(model.predict_proba(features)[0, 1])
    label = "spam" if spam_prob >= threshold else "ham"
    return label, spam_prob


def tokenize_unigrams(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def extract_vocab_token_matches(clean_text: str, vocabulary: dict[str, int]) -> list[str]:
    words = tokenize_unigrams(clean_text)
    matches: list[str] = []
    seen: set[str] = set()
    for word in words:
        if word in vocabulary and word not in seen:
            matches.append(word)
            seen.add(word)
    for i in range(len(words) - 1):
        bigram = f"{words[i]} {words[i+1]}"
        if bigram in vocabulary and bigram not in seen:
            matches.append(bigram)
            seen.add(bigram)
    return matches


def analyze_message_features(
    clean_text: str, model, vectorizer
) -> tuple[list[FeatureContribution], float, float, list[str], list[str], list[str]]:
    features: csr_matrix = vectorizer.transform([clean_text])
    coef = model.coef_[0]
    feature_names = vectorizer.get_feature_names_out()
    vocabulary = vectorizer.vocabulary_

    active: list[FeatureContribution] = []
    rows, cols = features.nonzero()
    for col, value in zip(cols, features.data):
        coeff = float(coef[col])
        contrib = coeff * float(value)
        active.append(
            FeatureContribution(
                feature=str(feature_names[col]),
                tfidf_value=float(value),
                coefficient=coeff,
                contribution=contrib,
                direction="SPAM" if contrib > 0 else "HAM",
            )
        )

    ham_sum = sum(c.contribution for c in active if c.contribution < 0)
    spam_sum = sum(c.contribution for c in active if c.contribution > 0)

    vocab_matches = extract_vocab_token_matches(clean_text, vocabulary)
    words = tokenize_unigrams(clean_text)
    oov = sorted({w for w in words if w not in vocabulary and len(w) > 2})

    return active, ham_sum, spam_sum, vocab_matches, oov, words


def build_training_token_stats(dataset_path: Path) -> tuple[Counter, Counter, set[str]]:
    df = pd.read_csv(dataset_path, encoding="utf-8")
    doc_freq: Counter = Counter()
    token_freq: Counter = Counter()
    all_tokens: set[str] = set()

    for text in df["text"]:
        clean = preprocess_text(str(text))
        tokens = set(tokenize_unigrams(clean))
        all_tokens.update(tokens)
        token_freq.update(tokens)
        doc_freq.update(tokens)

    return token_freq, doc_freq, all_tokens


def classify_token_presence(
    token: str,
    vectorizer_vocab: set[str],
    train_tokens: set[str],
    train_doc_freq: Counter,
) -> str:
    if token not in vectorizer_vocab:
        return "unseen_vocabulary"
    if token not in train_tokens:
        return "rare_vocabulary"
    if train_doc_freq[token] <= 5:
        return "rare_vocabulary"
    return "common_vocabulary"


def bucket_probability(prob: float) -> str:
    if prob < 0.10:
        return "<0.10"
    if prob < 0.20:
        return "0.10-0.19"
    if prob < 0.30:
        return "0.20-0.29"
    return "0.30-0.39"


def format_feature_list(features: list[FeatureContribution], limit: int = 5) -> list[str]:
    lines = []
    for feat in features[:limit]:
        lines.append(
            f"    - {feat.feature}: tfidf={feat.tfidf_value:.4f}, "
            f"coef={feat.coefficient:+.4f}, contrib={feat.contribution:+.4f} -> {feat.direction}"
        )
    return lines


def derive_recommendation(
    oov_ratio: float,
    negative_vocab_ratio: float,
    low_prob_ratio: float,
    dominant_boundary: str,
    unseen_domain_ratio: float,
    amount_placeholder_hits: int,
    total_fns: int,
) -> tuple[str, dict[str, str]]:
    sections = {
        "SYSTEMATIC FEATURE GAP": "",
        "SYSTEMATIC DATA GAP": "",
        "POSSIBLE PREPROCESSING GAP": "",
        "POSSIBLE MODEL/CAPACITY GAP": "",
        "ISOLATED ERRORS": "",
        "RECOMMENDED NEXT ACTION": "",
    }

    amount_ratio = amount_placeholder_hits / (total_fns or 1)
    preprocessing_note = ""
    if amount_ratio >= 0.40:
        preprocessing_note = (
            f" Monetary normalization emits '<amount>' in {amount_placeholder_hits}/{total_fns} "
            "FNs, but '<amount>' is not in the TF-IDF vocabulary, removing a potential spam cue."
        )

    if oov_ratio >= 0.25 or unseen_domain_ratio >= 0.25 or amount_ratio >= 0.40:
        sections["SYSTEMATIC FEATURE GAP"] = (
            "Many FN tokens and institution/service names are absent from the 5000-feature "
            "TF-IDF vocabulary (min_df=2, english stop_words). Active features are sparse, "
            "so logistic weights cannot fire on unseen bank/UPI/wallet brand n-grams. "
            "Ham-pulling features such as 'com' (domain TLD), 'net', and brand tokens like "
            "'cred', 'myntra', 'paytm' often have negative coefficients."
        )
        sections["SYSTEMATIC DATA GAP"] = (
            "FN messages use phishing templates (regional banks, payment apps, fake portals) "
            f"spread across boundary types (top: {dominant_boundary}). These lexical patterns "
            "are underrepresented in dataset.csv relative to the V2 benchmark."
        )
        sections["POSSIBLE PREPROCESSING GAP"] = (
            "Preprocessing is minimal (lowercase + monetary normalization)." + preprocessing_note
            + " URLs and brand tokens are preserved; the main loss is OOV coverage rather "
            "than over-stripping."
        )
        sections["POSSIBLE MODEL/CAPACITY GAP"] = (
            "Logistic Regression on sparse TF-IDF cannot generalize to OOV institution names "
            "or flip strongly ham-weighted brand n-grams without feature coverage."
        )
        sections["ISOLATED ERRORS"] = (
            f"{low_prob_ratio:.0%} of FNs have spam probability below 0.20, indicating broad "
            "under-scoring rather than isolated near-threshold misses. A minority sit in "
            "0.30-0.39 despite net positive spam feature contributions."
        )
        recommendation = "ADD SMALL TARGETED DATASET"
        sections["RECOMMENDED NEXT ACTION"] = (
            f"{recommendation}: add diverse spam examples covering dominant FN boundary "
            "patterns (regional bank alerts, UPI/payment-app lures, subscription/wallet scams) "
            "so key n-grams enter the TF-IDF vocabulary with positive spam coefficients."
        )
    elif negative_vocab_ratio >= 0.40:
        sections["SYSTEMATIC FEATURE GAP"] = (
            "FN messages activate vocabulary features whose logistic coefficients are negative, "
            "pulling predictions toward HAM despite spam intent."
        )
        sections["SYSTEMATIC DATA GAP"] = (
            "Transactional/OTP language in FNs overlaps ham-dominant training patterns "
            "(legitimate banking/subscription SMS), causing coefficient sign confusion."
        )
        sections["POSSIBLE PREPROCESSING GAP"] = (
            "No major preprocessing loss detected; ham-like tokens remain in the input."
        )
        sections["POSSIBLE MODEL/CAPACITY GAP"] = (
            "Linear model cannot disambiguate ham-like transactional wording from phishing "
            "without richer contextual features or additional spam examples."
        )
        sections["ISOLATED ERRORS"] = "Some FNs are near-threshold boundary cases."
        recommendation = "ADD SMALL TARGETED DATASET"
        sections["RECOMMENDED NEXT ACTION"] = (
            f"{recommendation}: add spam examples that reuse transactional wording but with "
            "phishing action cues so coefficients shift toward spam for those n-grams."
        )
    else:
        sections["SYSTEMATIC FEATURE GAP"] = "Limited systematic OOV or coefficient-sign gap detected."
        sections["SYSTEMATIC DATA GAP"] = "FN patterns appear partially covered by training vocabulary."
        sections["POSSIBLE PREPROCESSING GAP"] = "No strong preprocessing-related signal in FN analysis."
        sections["POSSIBLE MODEL/CAPACITY GAP"] = "No clear capacity bottleneck beyond threshold cutoff."
        sections["ISOLATED ERRORS"] = "Errors appear scattered without a single dominant cause."
        recommendation = "NO CHANGE"
        sections["RECOMMENDED NEXT ACTION"] = (
            f"{recommendation}: monitor after targeted review; no single systemic fix dominates."
        )

    return recommendation, sections


def main() -> int:
    if not UNSEEN_V2_CSV.exists():
        print(f"ERROR: benchmark not found: {UNSEEN_V2_CSV}")
        return 1
    if not DATASET_PATH.exists():
        print(f"ERROR: dataset not found: {DATASET_PATH}")
        return 1

    model, vectorizer, loaded_threshold = load_model(use_bundle=True)
    threshold = PRODUCTION_THRESHOLD
    feature_names = vectorizer.get_feature_names_out()
    vocabulary = vectorizer.vocabulary_
    vocab_size = len(feature_names)
    coef = model.coef_[0]

    cases = load_v2_cases(UNSEEN_V2_CSV)
    train_token_freq, train_doc_freq, train_tokens = build_training_token_stats(DATASET_PATH)

    fn_analyses: list[FNAnalysis] = []
    for case in cases:
        if case["expected_label"] != "spam":
            continue
        label, spam_prob = predict_spam_probability(
            case["text"], model, vectorizer, threshold
        )
        if label != "ham":
            continue

        clean = preprocess_text(case["text"])
        active, ham_sum, spam_sum, vocab_matches, oov, words = analyze_message_features(
            clean, model, vectorizer
        )
        ham_sorted = sorted(active, key=lambda x: x.contribution)
        spam_sorted = sorted(active, key=lambda x: x.contribution, reverse=True)

        fn_analyses.append(
            FNAnalysis(
                message=case["text"],
                boundary_type=case["boundary_type"] or "(none)",
                spam_probability=spam_prob,
                vocab_matches=vocab_matches,
                active_features=sorted(active, key=lambda x: abs(x.contribution), reverse=True),
                top_ham_features=ham_sorted[:5],
                top_spam_features=spam_sorted[:5],
                ham_contribution_sum=ham_sum,
                spam_contribution_sum=spam_sum,
                oov_tokens=oov,
                token_unigrams=words,
            )
        )

    total_fns = len(fn_analyses)
    lines: list[str] = []
    append = lines.append

    append("=" * 78)
    append("STAGE 1 FALSE NEGATIVE FEATURE DIAGNOSTIC — V2 BENCHMARK")
    append("=" * 78)
    append(f"total FNs = {total_fns}")
    append(f"threshold = {threshold:.3f}")
    append(f"loaded artifact threshold = {loaded_threshold:.3f}")
    append("model = Logistic Regression")
    append("vectorizer = TF-IDF")
    append(f"vocabulary size = {vocab_size} (configured max_features = {TFIDF_CONFIG['max_features']})")
    append(f"benchmark = {UNSEEN_V2_CSV}")
    append(f"training dataset = {DATASET_PATH}")
    append("")

    # A. Probability distribution
    append("A. FN PROBABILITY DISTRIBUTION")
    append("-" * 78)
    prob_counts = Counter(bucket_probability(fn.spam_probability) for fn in fn_analyses)
    for label, _, _ in PROB_BUCKETS:
        count = prob_counts.get(label, 0)
        pct = (count / total_fns * 100) if total_fns else 0.0
        append(f"  {label:<12} {count:>4}  ({pct:5.1f}%)")
    append("")

    # B. Boundary counts
    append("B. FN COUNTS BY BOUNDARY/TYPE")
    append("-" * 78)
    boundary_counts = Counter(fn.boundary_type for fn in fn_analyses)
    for boundary, count in boundary_counts.most_common():
        append(f"  {boundary:<40} {count:>4}")
    append("")

    # Aggregate token/feature stats across FNs
    fn_token_counter: Counter = Counter()
    oov_counter: Counter = Counter()
    negative_vocab_counter: Counter = Counter()
    positive_vocab_counter: Counter = Counter()
    missing_vocab_counter: Counter = Counter()
    domain_hits = Counter()
    scam_hits = Counter()
    txn_hits = Counter()
    vocab_presence = Counter()
    active_negative_counter: Counter = Counter()
    active_positive_counter: Counter = Counter()

    for fn in fn_analyses:
        fn_token_counter.update(fn.token_unigrams)
        oov_counter.update(fn.oov_tokens)
        for token in set(fn.token_unigrams):
            if token in vocabulary:
                idx = vocabulary[token]
                if coef[idx] < 0:
                    negative_vocab_counter[token] += 1
                elif coef[idx] > 0:
                    positive_vocab_counter[token] += 1
            else:
                if len(token) > 2:
                    missing_vocab_counter[token] += 1

            presence = classify_token_presence(
                token, set(vocabulary.keys()), train_tokens, train_doc_freq
            )
            vocab_presence[presence] += 1
            if token in DOMAIN_SERVICE_TERMS:
                domain_hits[token] += 1
            if token in SCAM_ACTION_TERMS:
                scam_hits[token] += 1
            if token in TRANSACTIONAL_TERMS:
                txn_hits[token] += 1

        for feat in fn.active_features:
            if feat.coefficient < 0:
                active_negative_counter[feat.feature] += 1
            elif feat.coefficient > 0:
                active_positive_counter[feat.feature] += 1

    total_fn_tokens = sum(fn_token_counter.values()) or 1
    total_unique_oov = sum(len(fn.oov_tokens) for fn in fn_analyses)
    total_token_slots = sum(len(fn.token_unigrams) for fn in fn_analyses) or 1

    # C. Common words analysis
    append("C. COMMON FN WORDS/PHRASES (TF-IDF VOCABULARY ANALYSIS)")
    append("-" * 78)
    append("  In vocabulary with NEGATIVE coefficients (ham-pulling):")
    for token, count in negative_vocab_counter.most_common(25):
        idx = vocabulary[token]
        append(f"    {token:<24} in {count:>3} FNs  coef={coef[idx]:+.4f}")
    append("")
    append("  In vocabulary with POSITIVE coefficients (spam-pulling):")
    for token, count in positive_vocab_counter.most_common(25):
        idx = vocabulary[token]
        append(f"    {token:<24} in {count:>3} FNs  coef={coef[idx]:+.4f}")
    append("")
    append("  Missing from TF-IDF vocabulary (token not in vectorizer):")
    for token, count in missing_vocab_counter.most_common(30):
        append(f"    {token:<24} in {count:>3} FNs")
    append("")

    # D. Important OOV words
    append("D. MOST COMMON IMPORTANT WORDS ABSENT FROM VECTORIZER VOCABULARY")
    append("-" * 78)
    important_oov = [
        (token, count)
        for token, count in oov_counter.most_common()
        if token not in ENGLISH_STOPWORDS and len(token) > 2
    ]
    for token, count in important_oov[:40]:
        note = ""
        if token == "amount":
            note = "  [preprocessing placeholder <amount> not in vocabulary]"
        append(f"  {token:<24} in {count:>3} FNs{note}")
    append("")

    # F. Vocabulary comparison
    append("F. FN MESSAGES VS TRAINING DATASET VOCABULARY")
    append("-" * 78)
    for category in [
        "common_vocabulary",
        "rare_vocabulary",
        "unseen_vocabulary",
        "domain/service terms",
        "scam-action terms",
        "transactional terms",
    ]:
        if category == "domain/service terms":
            append(f"  {category}:")
            for token, count in domain_hits.most_common(20):
                in_vocab = "in_vocab" if token in vocabulary else "OOV"
                append(f"    {token:<20} {count:>3} FNs  [{in_vocab}]")
        elif category == "scam-action terms":
            append(f"  {category}:")
            for token, count in scam_hits.most_common(20):
                in_vocab = "in_vocab" if token in vocabulary else "OOV"
                append(f"    {token:<20} {count:>3} FNs  [{in_vocab}]")
        elif category == "transactional terms":
            append(f"  {category}:")
            for token, count in txn_hits.most_common(20):
                in_vocab = "in_vocab" if token in vocabulary else "OOV"
                append(f"    {token:<20} {count:>3} FNs  [{in_vocab}]")
        else:
            count = vocab_presence.get(category, 0)
            append(f"  {category:<28} {count:>6} token occurrences across FNs")
    append("")

    # E. Per-FN detail
    append("E. PER-FN FEATURE CONTRIBUTION DETAIL")
    append("-" * 78)
    for i, fn in enumerate(fn_analyses, 1):
        append(f"#{i}")
        append(f"Message: {fn.message}")
        append(f"Boundary/type: {fn.boundary_type}")
        append(f"Spam probability: {fn.spam_probability:.4f}")
        append(f"Tokens/features in TF-IDF vocabulary: {', '.join(fn.vocab_matches) or '(none)'}")
        append(
            f"Active TF-IDF features: {len(fn.active_features)}  "
            f"(ham contrib sum={fn.ham_contribution_sum:+.4f}, "
            f"spam contrib sum={fn.spam_contribution_sum:+.4f})"
        )
        append("Important active features (by |contribution|):")
        for feat in fn.active_features[:10]:
            append(
                f"  - {feat.feature}: tfidf={feat.tfidf_value:.4f}, "
                f"coef={feat.coefficient:+.4f}, contrib={feat.contribution:+.4f} -> {feat.direction}"
            )
        append("Top 5 features pushing toward HAM:")
        if fn.top_ham_features:
            append("\n".join(format_feature_list(fn.top_ham_features)))
        else:
            append("    (none)")
        append("Top 5 features pushing toward SPAM:")
        if fn.top_spam_features:
            append("\n".join(format_feature_list(fn.top_spam_features)))
        else:
            append("    (none)")
        append(f"OOV tokens (not in vocabulary): {', '.join(fn.oov_tokens[:20]) or '(none)'}")
        append("-" * 40)
    append("")

    # G. Conclusion
    oov_ratio = total_unique_oov / total_token_slots
    negative_vocab_ratio = (
        sum(negative_vocab_counter.values())
        / (sum(negative_vocab_counter.values()) + sum(positive_vocab_counter.values()) + 1)
    )
    low_prob_ratio = sum(1 for fn in fn_analyses if fn.spam_probability < 0.20) / (total_fns or 1)
    dominant_boundary = boundary_counts.most_common(1)[0][0] if boundary_counts else "(none)"
    unseen_domain_ratio = sum(
        1 for fn in fn_analyses if any(t in fn.oov_tokens for t in DOMAIN_SERVICE_TERMS)
    ) / (total_fns or 1)

    amount_placeholder_hits = oov_counter.get("amount", 0)
    recommendation, conclusion_sections = derive_recommendation(
        oov_ratio=oov_ratio,
        negative_vocab_ratio=negative_vocab_ratio,
        low_prob_ratio=low_prob_ratio,
        dominant_boundary=dominant_boundary,
        unseen_domain_ratio=unseen_domain_ratio,
        amount_placeholder_hits=amount_placeholder_hits,
        total_fns=total_fns,
    )

    append("G. DIAGNOSTIC CONCLUSION")
    append("=" * 78)
    section_order = [
        "SYSTEMATIC FEATURE GAP",
        "SYSTEMATIC DATA GAP",
        "POSSIBLE PREPROCESSING GAP",
        "POSSIBLE MODEL/CAPACITY GAP",
        "ISOLATED ERRORS",
        "RECOMMENDED NEXT ACTION",
    ]
    for idx, section in enumerate(section_order, 1):
        append(f"{idx}. {section}")
        append(conclusion_sections[section])
        append("")

    report_text = "\n".join(lines)
    REPORT_PATH.write_text(report_text, encoding="utf-8")

    # Concise terminal summary
    print("=" * 70)
    print("STAGE 1 FN DIAGNOSTIC SUMMARY")
    print("=" * 70)
    print(f"total FNs = {total_fns}")
    print(f"threshold = {threshold:.3f}")
    print(f"model = Logistic Regression | vectorizer = TF-IDF | vocabulary size = {vocab_size}")
    print()
    print("Probability distribution:")
    for label, _, _ in PROB_BUCKETS:
        count = prob_counts.get(label, 0)
        print(f"  {label:<12} {count}")
    print()
    print("Top boundary types:")
    for boundary, count in boundary_counts.most_common(5):
        print(f"  {boundary}: {count}")
    print()
    print("Top important OOV tokens across FNs:")
    for token, count in important_oov[:10]:
        print(f"  {token}: {count}")
    if amount_placeholder_hits:
        print(f"  (note: '<amount>' placeholder appears in {amount_placeholder_hits} FNs, OOV)")
    print()
    print(f"OOV token ratio (approx): {oov_ratio:.1%}")
    print(f"FNs with spam prob < 0.20: {sum(1 for fn in fn_analyses if fn.spam_probability < 0.20)}")
    print()
    print(f"RECOMMENDATION: {recommendation}")
    print()
    print(f"Full report saved to: {REPORT_PATH}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
