"""
Read-only sanity validation for the trained two-stage Python ML pipeline.

Loads existing Stage 1 and Stage 2 artifacts from ml/model/artifacts/ and runs
representative/adversarial SMS test cases. Does NOT retrain, modify artifacts,
or apply any correction heuristics.

Usage (from project root):
    python ml/validate_model_sanity.py
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Ensure project root is on sys.path when run as a script.
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from ml.model.config import ARTIFACTS_DIR, HAM_CATEGORIES
from ml.model.preprocess import preprocess_text
from ml.model.stage2.train import load_stage2_pipeline
from ml.model.utils import load_model

FROZEN_STAGE2_CATEGORIES = list(HAM_CATEGORIES)


@dataclass(frozen=True)
class TestCase:
    number: int
    group: str
    message: str
    expected_stage1: str  # "HAM" or "SPAM"
    expected_stage2: Optional[str]  # personal | otp | banking | subscription | recharge_data | None for spam
    manual_review: bool = False


TEST_CASES: list[TestCase] = [
    # GROUP 1 — PERSONAL
    TestCase(1, "GROUP 1 — PERSONAL", "Hey bro, call me when you reach home.", "HAM", "personal"),
    TestCase(2, "GROUP 1 — PERSONAL", "Meeting at 3pm tomorrow.", "HAM", "personal"),
    TestCase(
        3,
        "GROUP 1 — PERSONAL",
        "Ananya, I reached the bus stop. Let me know when you reach.",
        "HAM",
        "personal",
    ),
    # GROUP 2 — LEGITIMATE OTP
    TestCase(4, "GROUP 2 — LEGITIMATE OTP", "Your OTP for login is 483921.", "HAM", "otp"),
    TestCase(5, "GROUP 2 — LEGITIMATE OTP", "Your OTP is 847291.", "HAM", "otp"),
    TestCase(
        6,
        "GROUP 2 — LEGITIMATE OTP",
        "Use 483921 to verify your login. Do not share this OTP.",
        "HAM",
        "otp",
    ),
    # GROUP 3 — LEGITIMATE BANKING
    TestCase(7, "GROUP 3 — LEGITIMATE BANKING", "Your account balance is Rs 4,500.", "HAM", "banking"),
    TestCase(
        8,
        "GROUP 3 — LEGITIMATE BANKING",
        "Your account has been credited with Rs 5,000.",
        "HAM",
        "banking",
    ),
    TestCase(
        9,
        "GROUP 3 — LEGITIMATE BANKING",
        "Rs 2,000 has been debited from your account.",
        "HAM",
        "banking",
    ),
    TestCase(
        10,
        "GROUP 3 — LEGITIMATE BANKING",
        "Your monthly account statement is ready.",
        "HAM",
        "banking",
    ),
    TestCase(
        11,
        "GROUP 3 — LEGITIMATE BANKING",
        "Your transaction of Rs 850 was completed successfully.",
        "HAM",
        "banking",
    ),
    TestCase(
        12,
        "GROUP 3 — LEGITIMATE BANKING",
        "Your bank account balance is Rs 8,450.",
        "HAM",
        "banking",
    ),
    # GROUP 4 — CLEAR SPAM
    TestCase(
        13,
        "GROUP 4 — CLEAR SPAM",
        "Your bank account has been blocked. Verify immediately.",
        "SPAM",
        None,
    ),
    TestCase(
        14,
        "GROUP 4 — CLEAR SPAM",
        "Congratulations! You have won a cash prize. Claim now.",
        "SPAM",
        None,
    ),
    TestCase(
        15,
        "GROUP 4 — CLEAR SPAM",
        "URGENT! Your account will be suspended. Verify your details immediately.",
        "SPAM",
        None,
    ),
    TestCase(
        16,
        "GROUP 4 — CLEAR SPAM",
        "Click this link immediately to claim your reward.",
        "SPAM",
        None,
    ),
    # GROUP 5 — BANKING / OTP BOUNDARY
    TestCase(
        17,
        "GROUP 5 — BANKING / OTP BOUNDARY",
        "Your OTP for online purchase is 483921.",
        "HAM",
        "otp",
    ),
    TestCase(
        18,
        "GROUP 5 — BANKING / OTP BOUNDARY",
        "Your account has been debited for Rs 2,500.",
        "HAM",
        "banking",
    ),
    TestCase(
        19,
        "GROUP 5 — BANKING / OTP BOUNDARY",
        "Your transaction OTP is 483921.",
        "HAM",
        "otp",
    ),
    TestCase(
        20,
        "GROUP 5 — BANKING / OTP BOUNDARY",
        "Your card payment of Rs 1,250 was successful.",
        "HAM",
        "banking",
    ),
    TestCase(
        21,
        "GROUP 5 — BANKING / OTP BOUNDARY",
        "Do not share your password, PIN, OTP or CVV with anyone.",
        "HAM",
        None,
        manual_review=True,
    ),
    # GROUP 6 — SAME VOCABULARY, DIFFERENT INTENT
    TestCase(22, "GROUP 6 — SAME VOCABULARY, DIFFERENT INTENT", "Your OTP for login is 123456.", "HAM", "otp"),
    TestCase(
        23,
        "GROUP 6 — SAME VOCABULARY, DIFFERENT INTENT",
        "Your bank account balance is Rs 3,200.",
        "HAM",
        "banking",
    ),
    TestCase(
        24,
        "GROUP 6 — SAME VOCABULARY, DIFFERENT INTENT",
        "Your bank account has been blocked. Verify immediately.",
        "SPAM",
        None,
    ),
    TestCase(
        25,
        "GROUP 6 — SAME VOCABULARY, DIFFERENT INTENT",
        "Please check your bank account statement.",
        "HAM",
        "banking",
    ),
    TestCase(
        26,
        "GROUP 6 — SAME VOCABULARY, DIFFERENT INTENT",
        "Please verify your account immediately to avoid suspension.",
        "SPAM",
        None,
    ),
    # GROUP 7 — SUBSCRIPTION
    TestCase(
        27,
        "GROUP 7 — SUBSCRIPTION",
        "Your Spotify Premium membership has been renewed for Rs 119/month.",
        "HAM",
        "subscription",
    ),
    TestCase(
        28,
        "GROUP 7 — SUBSCRIPTION",
        "Netflix subscription trial ends in 3 days. Renew to continue access.",
        "HAM",
        "subscription",
    ),
    TestCase(
        29,
        "GROUP 7 — SUBSCRIPTION",
        "Prime Video annual membership activated. Valid till 12-Jan-2027.",
        "HAM",
        "subscription",
    ),
    TestCase(
        30,
        "GROUP 7 — SUBSCRIPTION",
        "Your Zomato Gold membership renewal of Rs 30 is successful.",
        "HAM",
        "subscription",
    ),
    # GROUP 8 — RECHARGE / DATA
    TestCase(
        31,
        "GROUP 8 — RECHARGE / DATA",
        "Vi: Rs 299 recharge successful. 1.5GB/day + unlimited calls for 28 days.",
        "HAM",
        "recharge_data",
    ),
    TestCase(
        32,
        "GROUP 8 — RECHARGE / DATA",
        "BSNL: your prepaid balance is Rs 45. Recharge to avoid service interruption.",
        "HAM",
        "recharge_data",
    ),
    TestCase(
        33,
        "GROUP 8 — RECHARGE / DATA",
        "Airtel Thanks: 2GB data booster added. Valid for 24 hours.",
        "HAM",
        "recharge_data",
    ),
    TestCase(
        34,
        "GROUP 8 — RECHARGE / DATA",
        "Jio: plan validity extended till 05-Sep-2026 after Rs 666 recharge.",
        "HAM",
        "recharge_data",
    ),
    # GROUP 9 — SUBSCRIPTION / RECHARGE BOUNDARY
    TestCase(
        35,
        "GROUP 9 — SUBSCRIPTION / RECHARGE BOUNDARY",
        "Your monthly JioPostPaid plan bill of Rs 599 is due on 20-Aug.",
        "HAM",
        "subscription",
    ),
    TestCase(
        36,
        "GROUP 9 — SUBSCRIPTION / RECHARGE BOUNDARY",
        "Prepaid pack Rs 155 activated on 9876543210. Data benefit starts now.",
        "HAM",
        "recharge_data",
    ),
]


def load_stage1_artifacts():
    """Load Stage 1 model, vectorizer, and tuned threshold from artifacts."""
    model, vectorizer, threshold = load_model(ARTIFACTS_DIR, use_bundle=True)
    return model, vectorizer, threshold


def load_stage2_model():
    """Load Stage 2 sklearn pipeline (TF-IDF + LightGBM) from artifacts."""
    return load_stage2_pipeline(ARTIFACTS_DIR / "stage2_model.pkl")


def run_stage1(message: str, model, vectorizer, threshold: float) -> dict:
    """Run Stage 1 inference using the same logic as SpamDetector."""
    text_clean = preprocess_text(message)
    features = vectorizer.transform([text_clean])
    spam_prob = float(model.predict_proba(features)[0, 1])
    is_spam = spam_prob >= threshold
    stage1_label = "SPAM" if is_spam else "HAM"
    confidence = spam_prob if is_spam else (1.0 - spam_prob)
    return {
        "label": stage1_label,
        "spam_probability": spam_prob,
        "confidence": confidence,
        "is_spam": is_spam,
    }


def run_stage2(message: str, pipeline) -> dict:
    """Run Stage 2 inference on HAM text."""
    text_clean = preprocess_text(message)
    prediction = pipeline.predict([text_clean])[0]
    probabilities = pipeline.predict_proba([text_clean])[0]
    classes = list(pipeline.named_steps["classifier"].classes_)
    prob_map = {cls: float(prob) for cls, prob in zip(classes, probabilities)}
    confidence = prob_map.get(prediction, max(prob_map.values()))
    return {
        "label": str(prediction),
        "confidence": confidence,
        "probabilities": prob_map,
    }


def format_expected(case: TestCase) -> str:
    lines = [f"Stage 1 = {case.expected_stage1}"]
    if case.expected_stage1 == "SPAM":
        lines.append("Stage 2 = MUST NOT RUN")
    elif case.manual_review:
        lines.append("Stage 2 = banking OR otp (manual review)")
    else:
        lines.append(f"Stage 2 = {case.expected_stage2}")
    return "\n".join(lines)


def format_expected_summary(case: TestCase) -> str:
    if case.expected_stage1 == "SPAM":
        return "SPAM (no Stage 2)"
    if case.manual_review:
        return "HAM → banking OR otp (review)"
    return f"HAM → {case.expected_stage2}"


def format_actual(stage1: dict, stage2_ran: bool, stage2: Optional[dict]) -> str:
    lines = [
        f"Stage 1 = {stage1['label']}",
        f"Stage 1 spam probability = {stage1['spam_probability']:.4f}",
        f"Stage 1 confidence = {stage1['confidence']:.4f}",
        "",
    ]
    if stage2_ran and stage2 is not None:
        lines.extend(
            [
                f"Stage 2 = {stage2['label']}",
                f"Stage 2 confidence = {stage2['confidence']:.4f}",
            ]
        )
        for category in sorted(stage2["probabilities"]):
            value = stage2["probabilities"][category]
            lines.append(f"Stage 2 P({category}) = {value:.4f}")
    else:
        lines.append("Stage 2 = NOT RUN")
    return "\n".join(lines)


def format_actual_summary(stage1: dict, stage2_ran: bool, stage2: Optional[dict]) -> str:
    if not stage2_ran:
        return stage1["label"]
    return f"{stage1['label']} → {stage2['label']}"


def evaluate_case(case: TestCase, stage1: dict, stage2_ran: bool, stage2: Optional[dict]) -> str:
    """Determine PASS / FAIL / REVIEW without auto-correcting predictions."""
    if stage1["is_spam"] and stage2_ran:
        return "FAIL"

    if case.manual_review:
        if stage1["label"] != case.expected_stage1:
            return "FAIL"
        return "REVIEW"

    if case.expected_stage1 == "SPAM":
        if stage1["label"] == "SPAM" and not stage2_ran:
            return "PASS"
        return "FAIL"

    if stage1["label"] != "HAM":
        return "FAIL"
    if not stage2_ran or stage2 is None:
        return "FAIL"
    if stage2["label"] != case.expected_stage2:
        return "FAIL"
    return "PASS"


def prediction_differs(case: TestCase, stage1: dict, stage2_ran: bool, stage2: Optional[dict]) -> bool:
    if case.manual_review:
        return stage1["label"] != case.expected_stage1
    if case.expected_stage1 == "SPAM":
        return stage1["label"] != "SPAM" or stage2_ran
    if stage1["label"] != "HAM":
        return True
    if not stage2_ran or stage2 is None:
        return True
    return stage2["label"] != case.expected_stage2


def main() -> int:
    print("=" * 70)
    print("NEXALERT TWO-STAGE PYTHON PIPELINE SANITY VALIDATION")
    print("=" * 70)
    print(f"Artifacts directory: {ARTIFACTS_DIR}")
    print()

    stage1_model, stage1_vectorizer, stage1_threshold = load_stage1_artifacts()
    stage2_pipeline = load_stage2_model()
    loaded_stage2_classes = list(stage2_pipeline.named_steps["classifier"].classes_)

    print(f"Loaded Stage 1 threshold: {stage1_threshold:.3f}")
    print(f"Loaded Stage 2 classes: {loaded_stage2_classes}")
    print(f"Frozen Stage 2 categories: {FROZEN_STAGE2_CATEGORIES}")

    five_category_mapping_pass = set(loaded_stage2_classes) == set(FROZEN_STAGE2_CATEGORIES)
    print(
        "Five-category mapping: "
        + ("PASS" if five_category_mapping_pass else "FAIL")
    )
    print()

    results: list[dict] = []
    stage2_called_for_spam = False

    current_group = None
    for case in TEST_CASES:
        if case.group != current_group:
            current_group = case.group
            print("\n" + "=" * 70)
            print(current_group)
            print("=" * 70)

        stage1 = run_stage1(case.message, stage1_model, stage1_vectorizer, stage1_threshold)
        stage2 = None
        stage2_ran = False

        if not stage1["is_spam"]:
            stage2_ran = True
            stage2 = run_stage2(case.message, stage2_pipeline)

        if stage1["is_spam"] and stage2_ran:
            stage2_called_for_spam = True

        status = evaluate_case(case, stage1, stage2_ran, stage2)

        print("-" * 50)
        print(f"TEST #{case.number}")
        print("Message:")
        print(case.message)
        print()
        print("Expected:")
        print(format_expected(case))
        print()
        print("Actual:")
        print(format_actual(stage1, stage2_ran, stage2))
        print()
        print(f"Status:\n{status}")

        if stage1["is_spam"] and stage2_ran:
            print()
            print("CRITICAL PIPELINE ERROR:")
            print("Stage 2 was executed for a SPAM message.")

        if status == "FAIL" and prediction_differs(case, stage1, stage2_ran, stage2):
            print()
            print("MODEL PREDICTION DIFFERS FROM EXPECTED RESULT")
            print(f"Message: {case.message}")
            print(f"Expected: {format_expected_summary(case)}")
            print(f"Actual: {format_actual_summary(stage1, stage2_ran, stage2)}")
            if stage2 is not None:
                print(f"Stage 2 probabilities: {stage2['probabilities']}")

        print("-" * 50)

        results.append(
            {
                "number": case.number,
                "expected": format_expected_summary(case),
                "actual": format_actual_summary(stage1, stage2_ran, stage2),
                "status": status,
                "stage1_correct": (
                    stage1["label"] == case.expected_stage1
                    and not (stage1["is_spam"] and stage2_ran)
                ),
                "stage2_correct": (
                    case.expected_stage1 == "SPAM"
                    and not stage2_ran
                    and stage1["label"] == "SPAM"
                )
                if case.expected_stage1 == "SPAM"
                else (
                    case.manual_review
                    and stage1["label"] == "HAM"
                    and stage2_ran
                )
                if case.manual_review
                else (
                    stage1["label"] == "HAM"
                    and stage2_ran
                    and stage2 is not None
                    and stage2["label"] == case.expected_stage2
                ),
            }
        )

    total = len(results)
    passes = sum(1 for r in results if r["status"] == "PASS")
    failures = sum(1 for r in results if r["status"] == "FAIL")
    reviews = sum(1 for r in results if r["status"] == "REVIEW")
    stage1_correct = sum(1 for r in results if r["stage1_correct"])
    stage1_incorrect = total - stage1_correct
    stage2_correct = sum(1 for r in results if r["stage2_correct"])
    stage2_incorrect = total - stage2_correct

    print("\n" + "=" * 70)
    print("FINAL SUMMARY")
    print("=" * 70)
    print(f"TOTAL TESTS: {total}")
    print(f"EXPECTED PASSES: {passes}")
    print(f"FAILURES: {failures}")
    print(f"REVIEW CASES: {reviews}")
    print()
    print("Stage 1:")
    print(f"Correct: {stage1_correct}")
    print(f"Incorrect: {stage1_incorrect}")
    print()
    print("Stage 2:")
    print(f"Correct: {stage2_correct}")
    print(f"Incorrect: {stage2_incorrect}")
    print()
    print(f"Stage 2 incorrectly called for SPAM: {'YES' if stage2_called_for_spam else 'NO'}")
    print()
    stage1_pass = failures == 0 and not stage2_called_for_spam and stage1_incorrect == 0
    stage2_pass = failures == 0 and stage2_incorrect == 0 and not stage2_called_for_spam
    print(f"Stage 1 sanity check: {'PASS' if stage1_pass else 'FAIL'}")
    print(f"Stage 2 sanity check: {'PASS' if stage2_pass else 'FAIL'}")
    print(
        "Five-category mapping: "
        + ("PASS" if five_category_mapping_pass else "FAIL")
    )
    print()
    print("Test | Expected | Actual | Status")
    print("-" * 70)
    for row in results:
        print(f"{row['number']} | {row['expected']} | {row['actual']} | {row['status']}")

    return (
        1
        if failures > 0
        or stage2_called_for_spam
        or not five_category_mapping_pass
        else 0
    )


if __name__ == "__main__":
    raise SystemExit(main())
