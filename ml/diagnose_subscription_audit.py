"""Read-only diagnostic audit for Stage 2 Subscription failures. Do not train or modify artifacts."""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from ml.model.config import (
    ARTIFACTS_DIR,
    DATASET_PATH,
    HAM_CATEGORIES,
    RANDOM_SEED,
    STAGE2_CLASS_WEIGHTS,
)
from ml.model.preprocess import preprocess_text
from ml.model.stage2.train import load_ham_dataset, load_stage2_pipeline
from ml.model.utils import load_model

KEYWORDS = [
    "subscription",
    "membership",
    "renew",
    "premium",
    "trial",
    "cancel",
    "expire",
    "billing",
    "plan",
]


def main() -> None:
    pipeline = load_stage2_pipeline(ARTIFACTS_DIR / "stage2_model.pkl")
    vec = pipeline.named_steps["tfidf"]
    clf = pipeline.named_steps["classifier"]
    classes = list(clf.classes_)

    print("=== CLASS MAPPING ===")
    print("HAM_CATEGORIES:", HAM_CATEGORIES)
    print("LightGBM classes_:", classes)
    print("Set match:", set(classes) == set(HAM_CATEGORIES))
    for idx, label in enumerate(classes):
        print(f"  index {idx}: {label}")

    samples = {
        "personal": "Hey Priya, can you send the rent UPI screenshot tonight?",
        "otp": "Your OTP for login is 483921. Valid 10 minutes.",
        "banking": "Your account balance is Rs 4,500 after debit.",
        "subscription": "Your Spotify Premium membership has been renewed for Rs 119/month.",
        "recharge_data": "Vi: Rs 299 recharge successful. 1.5GB/day for 28 days.",
    }
    print("\n=== PREPROCESSING EXAMPLES ===")
    for cat, raw in samples.items():
        prep = preprocess_text(raw)
        X = vec.transform([prep])
        idx = X.nonzero()[1]
        feats = [(vec.get_feature_names_out()[i], float(X[0, i])) for i in idx]
        feats.sort(key=lambda x: -x[1])
        print(f"--- {cat} ---")
        print("RAW:", raw)
        print("PREPROCESSED:", prep)
        print("TOP FEATURES:", feats[:12])

    print("\n=== SUBSCRIPTION KEYWORD SURVIVAL AFTER PREPROCESS ===")
    prep = preprocess_text(samples["subscription"])
    for word in KEYWORDS + ["auto-renewal", "renewed", "renewal"]:
        print(f'  "{word}" present: {word in prep}')

    df = pd.read_csv(DATASET_PATH, encoding="utf-8")
    ham = df[df["label"].astype(str).str.lower() == "ham"].copy()
    ham["category"] = ham["category"].str.lower().str.strip()
    ham["text_pp"] = ham["text"].apply(preprocess_text)

    print("\n=== KEYWORD COUNTS IN PREPROCESSED HAM DATA ===")
    for cat in ["subscription", "personal"]:
        subset = ham[ham["category"] == cat]
        print(f"\n{cat}: n={len(subset)}")
        for kw in KEYWORDS:
            cnt = int(subset["text_pp"].str.contains(kw, regex=False).sum())
            print(f"  {kw}: {cnt} ({cnt / len(subset) * 100:.1f}%)")

    def top_tokens(series: pd.Series, n: int = 25) -> list[tuple[str, int]]:
        counter: Counter[str] = Counter()
        for text in series:
            counter.update(str(text).split())
        return counter.most_common(n)

    sub_tokens = top_tokens(ham.loc[ham["category"] == "subscription", "text_pp"])
    per_tokens = top_tokens(ham.loc[ham["category"] == "personal", "text_pp"])
    print("\n=== TOP TOKENS (whitespace split) ===")
    print("Subscription:", sub_tokens[:15])
    print("Personal:", per_tokens[:15])
    print("Shared in top25:", sorted({w for w, _ in sub_tokens} & {w for w, _ in per_tokens})[:20])

    ham_df = load_ham_dataset()
    X_all = ham_df["text"].values
    y_all = ham_df["category"].values
    X_train, X_test, y_train, y_test = train_test_split(
        X_all, y_all, test_size=0.20, random_state=RANDOM_SEED, stratify=y_all
    )
    X_train_tfidf = vec.transform(X_train)
    feature_names = vec.get_feature_names_out()

    def mean_tfidf(label: str) -> np.ndarray:
        mask = y_train == label
        return np.asarray(X_train_tfidf[mask].mean(axis=0)).ravel()

    sub_mean = mean_tfidf("subscription")
    per_mean = mean_tfidf("personal")
    diff = sub_mean - per_mean
    print("\n=== TF-IDF MEAN DIFF (subscription - personal) ON TRAIN TEXTS ===")
    print("Higher in subscription:")
    for i in np.argsort(diff)[-20:][::-1]:
        if diff[i] > 0:
            print(
                f"  {feature_names[i]}: diff={diff[i]:.5f}, "
                f"sub={sub_mean[i]:.5f}, per={per_mean[i]:.5f}"
            )
    print("Higher in personal:")
    for i in np.argsort(-diff)[-20:][::-1]:
        if diff[i] < 0:
            print(
                f"  {feature_names[i]}: diff={diff[i]:.5f}, "
                f"sub={sub_mean[i]:.5f}, per={per_mean[i]:.5f}"
            )

    booster = clf.booster_
    imp = booster.feature_importance(importance_type="gain")
    imp_pairs = sorted(zip(clf.feature_name_[: len(imp)], imp), key=lambda x: -x[1])
    print("\n=== TOP 25 LIGHTGBM FEATURES (gain) ===")
    for name, score in imp_pairs[:25]:
        print(f"  {name}: {score:.1f}")
    sub_kw_imp = [
        (n, s)
        for n, s in imp_pairs
        if any(k in n for k in ["subscription", "membership", "renew", "premium", "trial", "billing", "plan", "member"])
    ]
    print("\nSubscription-related features with non-zero importance (top 20):")
    for name, score in sub_kw_imp[:20]:
        print(f"  {name}: {score:.1f}")

    unseen = pd.read_csv(PROJECT_ROOT / "ml" / "data" / "unseen_boundary_test.csv")
    unseen_sub = unseen[
        (unseen["expected_label"].str.lower() == "ham")
        & (unseen["expected_category"].str.lower() == "subscription")
    ]
    print(f"\n=== UNSEEN SUBSCRIPTION PROBABILITIES (n={len(unseen_sub)}) ===")
    sub_probs = []
    per_probs = []
    for _, row in unseen_sub.iterrows():
        prep = preprocess_text(row["text"])
        proba = clf.predict_proba(vec.transform([prep]))[0]
        pred = str(clf.predict(vec.transform([prep]))[0])
        prob_map = {c: float(p) for c, p in zip(classes, proba)}
        sub_probs.append(prob_map["subscription"])
        per_probs.append(prob_map["personal"])
        print("Message:", row["text"][:110])
        print("Expected: subscription | Predicted:", pred)
        for c in classes:
            print(f"  P({c})={prob_map[c]:.4f}")
        print("---")

    print(
        "Unseen subscription P(subscription): "
        f"min={min(sub_probs):.4f} max={max(sub_probs):.4f} mean={np.mean(sub_probs):.4f}"
    )
    print(
        "Unseen subscription P(personal): "
        f"min={min(per_probs):.4f} max={max(per_probs):.4f} mean={np.mean(per_probs):.4f}"
    )
    near_zero = sum(1 for p in sub_probs if p < 0.05)
    loses_to_personal = sum(1 for i in range(len(sub_probs)) if per_probs[i] > sub_probs[i])
    print(f"Cases with P(subscription)<0.05: {near_zero}/{len(sub_probs)}")
    print(f"Cases where P(personal) > P(subscription): {loses_to_personal}/{len(sub_probs)}")

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)
    sub_mask = y_test == "subscription"
    print("\n=== HELD-OUT TEST SPLIT SUBSCRIPTION ===")
    print("Count:", int(sub_mask.sum()))
    print("Correct:", int((y_pred[sub_mask] == "subscription").sum()))
    print(classification_report(y_test[sub_mask], y_pred[sub_mask], zero_division=0))

    correct_idx = np.where((y_test == "subscription") & (y_pred == "subscription"))[0]
    wrong_idx = np.where((y_test == "subscription") & (y_pred != "subscription"))[0]
    print("Correct subscription test examples (up to 5):")
    for i in correct_idx[:5]:
        print(" ", X_test[i][:120])
    print("Wrong subscription test examples (up to 5):")
    for i in wrong_idx[:5]:
        print(" ", X_test[i][:120], "->", y_pred[i])

    if len(correct_idx):
        corr_text = " ".join(X_test[i] for i in correct_idx)
        fail_text = " ".join(unseen_sub["text"].astype(str).str.lower())
        print("\nKeyword presence: correct held-out vs failed unseen")
        for kw in KEYWORDS + ["renewal", "renewed", "member"]:
            print(
                f"  {kw}: correct_test={corr_text.count(kw)} "
                f"failed_unseen={fail_text.count(kw)}"
            )

    print("\n=== CLASS WEIGHTS (STATIC) ===")
    print(STAGE2_CLASS_WEIGHTS)
    print("train.py applies: pipeline.fit(X_train, y_train, classifier__sample_weight=sample_weights)")

    s1_model, s1_vec, threshold = load_model(ARTIFACTS_DIR, use_bundle=True)
    print("\n=== STAGE 1 BRIEF (UNSEEN SPAM) ===")
    print("Threshold:", threshold)
    spam_unseen = unseen[unseen["expected_label"].str.lower() == "spam"]
    fn = []
    fp = []
    for _, row in unseen.iterrows():
        prep = preprocess_text(row["text"])
        prob = float(s1_model.predict_proba(s1_vec.transform([prep]))[0, 1])
        pred = "spam" if prob >= threshold else "ham"
        exp = str(row["expected_label"]).lower()
        if exp == "spam" and pred == "ham":
            fn.append((row["text"], prob))
        if exp == "ham" and pred == "spam":
            fp.append((row["text"], prob))
    print("Spam unseen:", len(spam_unseen), "FN:", len(fn), "FP:", len(fp))
    print("Spam recall:", (len(spam_unseen) - len(fn)) / len(spam_unseen))
    print("Sample false negatives (P(spam) below threshold):")
    for text, prob in fn[:10]:
        print(f"  P(spam)={prob:.4f} thr={threshold} | {text[:95]}")


if __name__ == "__main__":
    main()
