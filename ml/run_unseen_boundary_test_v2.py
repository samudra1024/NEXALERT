"""
Frozen-model evaluation on unseen boundary SMS test set V2.

Evaluates current Stage 1 + Stage 2 artifacts against ml/data/unseen_boundary_test_v2.csv
without retraining or modifying any training data or model artifacts.

Usage (from project root):
    python ml/run_unseen_boundary_test_v2.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.model.config import ARTIFACTS_DIR, HAM_CATEGORIES
from ml.model.stage2.train import load_stage2_pipeline
from ml.run_unseen_boundary_test import (
    UnseenCase,
    load_stage1_artifacts,
    predict_stage1,
    predict_stage2,
)

DATA_DIR = PROJECT_ROOT / "ml" / "data"
UNSEEN_V2_CSV = DATA_DIR / "unseen_boundary_test_v2.csv"


def load_cases_from_csv(path: Path) -> list[UnseenCase]:
    """Load benchmark cases from unseen_boundary_test_v2.csv."""
    df = pd.read_csv(path, encoding="utf-8")
    cases: list[UnseenCase] = []
    for _, row in df.iterrows():
        category = row.get("expected_category", "")
        if pd.isna(category):
            category = ""
        boundary = row.get("boundary_type", "")
        if pd.isna(boundary):
            boundary = ""
        cases.append(
            UnseenCase(
                text=str(row["text"]),
                expected_label=str(row["expected_label"]).lower().strip(),
                expected_category=str(category).lower().strip(),
                boundary_type=str(boundary).strip(),
            )
        )
    return cases


def boundary_pair(boundary_type: str) -> str | None:
    """Map CSV boundary_type values to human-readable boundary pairs."""
    mapping = {
        "otp_vs_banking": "OTP ↔ Banking",
        "banking_vs_otp": "OTP ↔ Banking",
        "banking_vs_recharge": "Banking ↔ Recharge_Data",
        "recharge_vs_banking": "Banking ↔ Recharge_Data",
        "recharge_vs_subscription": "Subscription ↔ Recharge_Data",
        "subscription_vs_recharge": "Subscription ↔ Recharge_Data",
        "personal_vs_service": "Personal ↔ service categories",
        "personal_vs_banking": "Personal ↔ Banking",
        "personal_vs_recharge": "Personal ↔ Recharge_Data",
        "personal_vs_subscription": "Personal ↔ Subscription",
        "banking_vs_personal": "Personal ↔ Banking",
        "otp_vs_personal": "OTP ↔ Personal",
        "otp_vs_subscription": "OTP ↔ Personal",
        "banking_vs_subscription": "Banking ↔ Subscription",
    }
    if boundary_type in mapping:
        return mapping[boundary_type]
    if boundary_type.startswith("fake_"):
        return None
    if boundary_type:
        return boundary_type.replace("_", " ")
    return None


def main() -> int:
    print("=" * 70)
    print("NEXALERT UNSEEN BOUNDARY TEST V2 — FROZEN MODEL EVALUATION")
    print("=" * 70)
    print(f"Artifacts: {ARTIFACTS_DIR}")
    print(f"Benchmark: {UNSEEN_V2_CSV}")
    print()

    if not UNSEEN_V2_CSV.exists():
        print(f"ERROR: benchmark file not found: {UNSEEN_V2_CSV}")
        return 1

    cases = load_cases_from_csv(UNSEEN_V2_CSV)
    label_counts = Counter(case.expected_label for case in cases)
    cat_counts = Counter(case.expected_category for case in cases if case.expected_category)

    print("BENCHMARK LOADED")
    print("-" * 70)
    print(f"Total messages: {len(cases)}")
    print(f"SPAM: {label_counts.get('spam', 0)}")
    print(f"HAM:  {label_counts.get('ham', 0)}")
    print("HAM category counts:")
    for category in HAM_CATEGORIES:
        print(f"  {category}: {cat_counts.get(category, 0)}")
    print()

    model, vectorizer, threshold = load_stage1_artifacts()
    stage2 = load_stage2_pipeline(ARTIFACTS_DIR / "stage2_model.pkl")
    print(f"Threshold: {threshold:.3f}")
    print()
    y_true_s1 = []
    y_pred_s1 = []
    stage1_rows = []

    for case in cases:
        pred = predict_stage1(case.text, model, vectorizer, threshold)
        y_true_s1.append(case.expected_label)
        y_pred_s1.append(pred["label"])
        stage1_rows.append((case, pred))

    y_true_s1_arr = np.array(y_true_s1)
    y_pred_s1_arr = np.array(y_pred_s1)

    s1_accuracy = accuracy_score(y_true_s1_arr, y_pred_s1_arr)
    s1_precision = precision_score(y_true_s1_arr, y_pred_s1_arr, pos_label="spam", zero_division=0)
    s1_recall = recall_score(y_true_s1_arr, y_pred_s1_arr, pos_label="spam", zero_division=0)
    s1_f1 = f1_score(y_true_s1_arr, y_pred_s1_arr, pos_label="spam", zero_division=0)
    cm_s1 = confusion_matrix(y_true_s1_arr, y_pred_s1_arr, labels=["ham", "spam"])
    false_positives = int(((y_true_s1_arr == "ham") & (y_pred_s1_arr == "spam")).sum())
    false_negatives = int(((y_true_s1_arr == "spam") & (y_pred_s1_arr == "ham")).sum())

    print("STAGE 1 UNSEEN PERFORMANCE")
    print("-" * 70)
    print(f"Messages evaluated: {len(cases)}")
    print(f"Accuracy:        {s1_accuracy:.4f}")
    print(f"Spam precision:  {s1_precision:.4f}")
    print(f"Spam recall:     {s1_recall:.4f}")
    print(f"Spam F1:         {s1_f1:.4f}")
    print(f"False positives: {false_positives}")
    print(f"False negatives: {false_negatives}")
    print("Confusion matrix [rows=true ham/spam, cols=pred ham/spam]:")
    print(cm_s1)
    print()

    false_positive_rows = [
        (case, pred)
        for case, pred in stage1_rows
        if case.expected_label == "ham" and pred["label"] == "spam"
    ]

    print("STAGE 1 FALSE POSITIVES — MISCLASSIFIED HAM")
    print("-" * 70)

    for i, (case, pred) in enumerate(false_positive_rows, 1):
        print(f"#{i}")
        print(f"Message: {case.text}")
        print(f"Expected: {case.expected_label}")
        print(f"Predicted: {pred['label']}")
        print(f"Spam probability: {pred['spam_probability']:.4f}")
        print(f"Category: {case.expected_category}")
        print(f"Boundary/type: {case.boundary_type}")
        print("-" * 40)

    print()

    false_negative_rows = [
        (case, pred)
        for case, pred in stage1_rows
        if case.expected_label == "spam" and pred["label"] == "ham"
    ]

    print("STAGE 1 FALSE NEGATIVES — MISSED SPAM")
    print("-" * 70)
    print(f"Total missed spam messages: {len(false_negative_rows)}")
    print()

    for i, (case, pred) in enumerate(false_negative_rows, 1):
        print(f"#{i}")
        print(f"Message: {case.text}")
        print(f"Expected: spam")
        print(f"Predicted: ham")
        print(f"Spam probability: {pred['spam_probability']:.4f}")
        print(f"Boundary/type: {case.boundary_type}")
        print("-" * 40)

    print(f"Total missed spam messages: {len(false_negative_rows)}")
    print()

    ham_cases = [case for case in cases if case.expected_label == "ham"]
    y_true_s2 = []
    y_pred_s2 = []
    incorrect_stage2 = []

    for case in ham_cases:
        stage1_pred = predict_stage1(case.text, model, vectorizer, threshold)
        if stage1_pred["is_spam"]:
            predicted_category = "__stage1_spam__"
        else:
            predicted_category = predict_stage2(case.text, stage2)
        y_true_s2.append(case.expected_category)
        y_pred_s2.append(predicted_category)
        if predicted_category != case.expected_category:
            incorrect_stage2.append(
                {
                    "message": case.text,
                    "expected": case.expected_category,
                    "predicted": predicted_category,
                    "boundary_type": case.boundary_type,
                    "why_difficult": boundary_pair(case.boundary_type) or case.boundary_type,
                }
            )

    y_true_s2_arr = np.array(y_true_s2)
    y_pred_s2_arr = np.array(y_pred_s2)
    valid_mask = y_pred_s2_arr != "__stage1_spam__"
    if valid_mask.any():
        s2_accuracy = accuracy_score(y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask])
        s2_macro_precision = precision_score(
            y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask], average="macro", zero_division=0, labels=HAM_CATEGORIES
        )
        s2_macro_recall = recall_score(
            y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask], average="macro", zero_division=0, labels=HAM_CATEGORIES
        )
        s2_macro_f1 = f1_score(
            y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask], average="macro", zero_division=0, labels=HAM_CATEGORIES
        )
        cm_s2 = confusion_matrix(y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask], labels=HAM_CATEGORIES)
        report = classification_report(
            y_true_s2_arr[valid_mask], y_pred_s2_arr[valid_mask], labels=HAM_CATEGORIES, zero_division=0
        )
    else:
        s2_accuracy = s2_macro_precision = s2_macro_recall = s2_macro_f1 = 0.0
        cm_s2 = np.zeros((len(HAM_CATEGORIES), len(HAM_CATEGORIES)), dtype=int)
        report = "No HAM messages reached Stage 2."

    print("STAGE 2 UNSEEN PERFORMANCE (expected HAM only)")
    print("-" * 70)
    print(f"HAM messages evaluated: {len(ham_cases)}")
    print(f"Stage 1 misclassified as spam: {int((~valid_mask).sum())}")
    print(f"Accuracy:        {s2_accuracy:.4f}")
    print(f"Macro precision: {s2_macro_precision:.4f}")
    print(f"Macro recall:    {s2_macro_recall:.4f}")
    print(f"Macro F1:        {s2_macro_f1:.4f}")
    print("Per-class report:")
    print(report)
    print("Confusion matrix labels:", HAM_CATEGORIES)
    print(cm_s2)
    print()

    boundary_stats = defaultdict(lambda: {"total": 0, "correct": 0})
    for case in ham_cases:
        pair = boundary_pair(case.boundary_type)
        if not pair:
            continue
        stage1_pred = predict_stage1(case.text, model, vectorizer, threshold)
        if stage1_pred["is_spam"]:
            predicted = "__stage1_spam__"
        else:
            predicted = predict_stage2(case.text, stage2)
        boundary_stats[pair]["total"] += 1
        if predicted == case.expected_category:
            boundary_stats[pair]["correct"] += 1

    print("BOUNDARY ANALYSIS")
    print("-" * 70)
    for pair in sorted(boundary_stats):
        stats = boundary_stats[pair]
        acc = stats["correct"] / stats["total"] if stats["total"] else 0.0
        print(f"{pair}: {stats['correct']}/{stats['total']} correct ({acc:.1%})")
    print()

    if incorrect_stage2:
        print("INCORRECT STAGE 2 PREDICTIONS")
        print("-" * 70)
        for row in incorrect_stage2:
            print(f"Message: {row['message']}")
            print(f"Expected: {row['expected']}")
            print(f"Predicted: {row['predicted']}")
            print(f"Boundary type: {row['boundary_type']}")
            print(f"Why difficult: {row['why_difficult']}")
            print("-" * 40)

    summary = {
        "benchmark": str(UNSEEN_V2_CSV),
        "total_messages": len(cases),
        "ham_count": label_counts.get("ham", 0),
        "spam_count": label_counts.get("spam", 0),
        "stage2_category_counts": dict(cat_counts),
        "stage1": {
            "accuracy": s1_accuracy,
            "spam_precision": s1_precision,
            "spam_recall": s1_recall,
            "spam_f1": s1_f1,
            "false_positives": false_positives,
            "false_negatives": false_negatives,
        },
        "stage2": {
            "ham_evaluated": len(ham_cases),
            "stage1_spam_blocked": int((~valid_mask).sum()),
            "accuracy": s2_accuracy,
            "macro_precision": s2_macro_precision,
            "macro_recall": s2_macro_recall,
            "macro_f1": s2_macro_f1,
        },
        "incorrect_stage2_count": len(incorrect_stage2),
        "boundary_analysis": {
            pair: {"correct": stats["correct"], "total": stats["total"]}
            for pair, stats in sorted(boundary_stats.items())
        },
    }
    print("JSON SUMMARY")
    print(json.dumps(summary, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
