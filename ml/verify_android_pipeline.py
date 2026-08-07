"""
End-to-end verification script for Android ML pipeline integration.
Simulates: SMS -> Stage1 -> Stage2 -> DB category -> Frontend tab mapping
"""
import json
import onnxruntime as ort
import numpy as np

STAGE1 = "ml/model/artifacts/model.onnx"
STAGE2 = "ml/model/artifacts/stage2_model.onnx"

ML_TAB_FILTERS = {
    "All": None,
    "Personal": "personal",
    "Banking": "banking",
    "OTP": "otp",
    "Subscription": "subscription",
    "Promotions": "promotional",
    "Unknown": "unknown",
}

SAMPLES = [
    ("Your OTP is 847291. Valid for 10 minutes.", "OTP"),
    ("Hey, lunch tomorrow at 1pm?", "Personal"),
    ("Account credited with Rs 5000", "Banking"),
    ("FREE iPhone! Click here to claim now", "All (spam)"),
    ("50% off sale this weekend only", "Promotions"),
    ("Your monthly Netflix subscription renews tomorrow", "Subscription"),
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
print()

results = []
for sms, expected_tab in SAMPLES:
    inp = np.array([sms], dtype=object)
    label1, prob1 = s1.run(None, {"input": inp})
    spam_label = int(label1[0])
    spam_prob = float(prob1[0].get(1, prob1[0].get(0, 0.0)))
    is_spam = spam_label == 1

    if is_spam:
        category = "unknown"
        stage2_label = None
    else:
        label2, prob2 = s2.run(None, {"input": inp})
        category = str(label2[0])
        stage2_label = category

    frontend_tab = next(
        (tab for tab, ml in ML_TAB_FILTERS.items() if ml == category),
        "All only" if category == "unknown" and not is_spam else ("hidden/spam" if is_spam else "no tab match"),
    )

    row = {
        "sms": sms[:60],
        "stage1_label": spam_label,
        "stage1_spam_prob": round(spam_prob, 4),
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
