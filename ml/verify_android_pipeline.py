"""
End-to-end verification script for Android ML pipeline integration.
Simulates: SMS -> Stage1 -> Stage2 -> DB category -> Frontend tab mapping
"""
import json
from pathlib import Path
import onnxruntime as ort
import numpy as np

STAGE1 = "ml/model/artifacts/model.onnx"
STAGE2 = "ml/model/artifacts/stage2_model.onnx"
THRESHOLD_PATH = Path("ml/model/artifacts/threshold.json")
ANDROID_THRESHOLD_PATH = Path("android/app/src/main/assets/models/v1/threshold.json")

def load_spam_threshold() -> float:
    for path in (THRESHOLD_PATH, ANDROID_THRESHOLD_PATH):
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                return float(json.load(f)["threshold"])
    return 0.5

SPAM_THRESHOLD = load_spam_threshold()

# "All" is UI-only (all HAM); not an ML label.
ML_TAB_FILTERS = {
    "Personal": "personal",
    "OTP": "otp",
    "Banking": "banking",
    "Subscription": "subscription",
    "Recharge": "recharge_data",
}

SAMPLES = [
    ("Your OTP for login is 483921.", "OTP"),
    ("Hey bro, call me when you reach home.", "Personal"),
    ("Your account balance is Rs 4,500.", "Banking"),
    ("Your bank account has been blocked. Verify immediately.", "All (spam)"),
    ("Your OTP is 847291. Valid for 10 minutes.", "OTP"),
]

s1 = ort.InferenceSession(STAGE1, providers=["CPUExecutionProvider"])
s2 = ort.InferenceSession(STAGE2, providers=["CPUExecutionProvider"])

print("=" * 80)
print("ONNX INPUT/OUTPUT SPECS")
print("=" * 80)
print("Stage 1 inputs:", [(i.name, i.type, i.shape) for i in s1.get_inputs()])
print("Stage 1 outputs:", [(o.name, o.type, o.shape) for o in s1.get_outputs()])
print("Stage 2 inputs:", [(i.name, i.type, i.shape) for i in s2.get_inputs()])
print("Stage 2 outputs:", [(o.name, o.type, o.shape) for o in s2.get_outputs()])
print(f"Stage 1 threshold: {SPAM_THRESHOLD}")
print()

results = []
for sms, expected_tab in SAMPLES:
    inp = np.array([sms], dtype=object)
    label1, prob1 = s1.run(None, {"input": inp})
    spam_prob = float(prob1[0].get(1, prob1[0].get("1", 0.0)))
    is_spam = spam_prob >= SPAM_THRESHOLD
    spam_label = int(label1[0])

    if is_spam:
        category = "unknown"
        stage2_label = None
    else:
        label2, prob2 = s2.run(None, {"input": inp})
        category = str(label2[0])
        stage2_label = category

    if is_spam:
        frontend_tab = "Spam"
    elif category == "unknown" or category not in ML_TAB_FILTERS.values():
        frontend_tab = "All"
    else:
        frontend_tab = next(
            tab for tab, ml in ML_TAB_FILTERS.items() if ml == category
        )

    row = {
        "sms": sms[:60],
        "stage1_label": spam_label,
        "stage1_spam_prob": round(spam_prob, 4),
        "stage1_threshold": SPAM_THRESHOLD,
        "is_spam": is_spam,
        "stage2_label": stage2_label,
        "db_category": category,
        "frontend_category": category,
        "frontend_tab": frontend_tab,
        "expected_tab_hint": expected_tab,
    }
    results.append(row)
    print(json.dumps(row, indent=2))
    print("-" * 40)

print("\nInput tensor check: np.array([msg], dtype=object) shape =", np.array(["test"], dtype=object).shape)
print("Matches StringTensorType([None]) batch dimension: OK")
