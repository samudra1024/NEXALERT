# Stage 2 Quick Reference Card

## 🚀 Quick Start

### Train Model
```bash
cd model
python train_stage2.py
```

### Load Model
```python
import pickle
with open('artifacts/stage2_model.pkl', 'rb') as f:
    model = pickle.load(f)
```

### Predict Category
```python
category = model.predict(["Your OTP is 123456"])[0]
print(f"Category: {category}")  # Output: otp
```

---

## 📊 System Overview

```
User Message → Already classified as HAM
    ↓
Stage 2: HAM Categorization (TF-IDF + LightGBM)
    ↓
Predict Category:
  • Personal
  • Banking
  • OTP
  • Subscription
  • Promotional
  • Unknown
    ↓
Display in respective section
```

---

## 🎯 Model Configuration

### TF-IDF Vectorizer
- max_features = 15000
- ngram_range = (1, 2)
- min_df = 2
- max_df = 0.9
- sublinear_tf = True

### LightGBM Classifier
- objective = "multiclass"
- num_class = 6
- n_estimators = 300
- learning_rate = 0.05
- num_leaves = 31

### Class Weights
- Personal: 1.0
- Unknown: 1.2
- Banking: 1.5
- Promotional: 1.5
- OTP: 2.0
- Subscription: 2.0

---

## 📦 Model Artifact

**File:** `model/artifacts/stage2_model.pkl`

**Contents:**
- TF-IDF vectorizer
- LightGBM classifier
- Complete sklearn pipeline

**Size:** ~5-10 MB

---

## 📊 Training Results

### Dataset Statistics
- **Total HAM messages:** 11,332
- **Training samples:** 9,065 (80%)
- **Test samples:** 2,267 (20%)
- **Number of classes:** 6

### Performance
- **Overall Accuracy:** 94.35% ✅
- **Weighted Precision:** 93%
- **Weighted Recall:** 94%
- **Weighted F1-Score:** 93%

### Per-Class Performance
| Category | F1-Score | Status |
|----------|----------|--------|
| OTP | 100% | ✅ Perfect |
| Promotional | 100% | ✅ Perfect |
| Banking | 99% | ✅ Excellent |
| Subscription | 96% | ✅ Excellent |
| Personal | 95% | ✅ Excellent |
| Unknown | 31% | ⚠️ Low recall |

---

## 🗂️ Category Distribution

| Category | Count | Percentage |
|----------|-------|------------|
| Personal | 6,106 | 53.9% |
| Banking | 1,405 | 12.4% |
| OTP | 1,165 | 10.3% |
| Subscription | 1,124 | 9.9% |
| Promotional | 1,000 | 8.8% |
| Unknown | 534 | 4.7% |

---

## 🔧 Key Files

| File | Purpose |
|------|---------|
| `train_stage2.py` | Training script |
| `config.py` | Configuration settings |
| `stage2_model.pkl` | Trained model artifact |
| `STAGE2_IMPLEMENTATION_COMPLETE.md` | Full documentation |

---

## ⚠️ Important Rules

### DO NOT Modify
- ❌ Stage 1 (Spam Detection) logic
- ❌ Model 1 artifacts
- ❌ Stage 1 training pipeline

### Safe to Modify
- ✅ Stage 2 hyperparameters
- ✅ Class weights
- ✅ Training data filtering
- ✅ Evaluation thresholds

---

## 💡 Usage Examples

### Example 1: Batch Prediction
```python
import pickle
from pathlib import Path

# Load model
model_path = Path("artifacts/stage2_model.pkl")
with open(model_path, 'rb') as f:
    model = pickle.load(f)

# Predict multiple messages
messages = [
    "Hey, are we still on for lunch?",
    "Your bank account balance is $500",
    "Your OTP is 847291",
    "Netflix subscription renewed",
    "50% OFF sale today!"
]

categories = model.predict(messages)
for msg, cat in zip(messages, categories):
    print(f"{msg[:30]:30s} → {cat}")
```

### Example 2: Get Probabilities
```python
# Get prediction and probabilities
prediction = model.predict_proba(["Your OTP is 123456"])[0]

# Show all category probabilities
for category, prob in zip(HAM_CATEGORIES, prediction):
    print(f"{category:15s}: {prob:.2%}")
```

---

## 🎯 Integration Flow

### Current State (Independent)
```
Stage 1: Spam Detection → SPAM or HAM
Stage 2: HAM Categorization → 6 categories

Both models operate independently!
```

### Future Integration (Optional)
```python
# COMMENTED - For reference only
# if stage1_result == "HAM":
#     category = stage2_model.predict(text)
#     display_in_category_section(category)
# else:
#     display_in_spam_section()
```

---

## 📈 Performance Metrics

### Training Time
- Data Loading: < 1s
- TF-IDF Fitting: ~2s
- LightGBM Training: ~10s
- Evaluation: < 1s
- **Total:** ~15 seconds

### Inference Speed
- Single Prediction: < 50ms
- Batch (100 msgs): < 2s
- Memory Usage: ~50-100MB

---

## ✅ Success Criteria

| Criterion | Target | Actual | Status |
|-----------|--------|--------|--------|
| Accuracy | > 85% | 94.35% | ✅ |
| Independence | Yes | Yes | ✅ |
| Clean Code | Yes | Yes | ✅ |
| Documentation | Yes | Yes | ✅ |
| Reproducibility | Yes | Yes | ✅ |

---

## 🆘 Troubleshooting

**Error: Model not found**
→ Run `python train_stage2.py` first

**Error: Wrong category predicted**
→ Check message quality and training data

**Low confidence scores**
→ Consider retraining with more data

**Encoding error**
→ Automatic fallback to latin1 should handle it

---

## 📞 Documentation

- **Full Guide:** STAGE2_IMPLEMENTATION_COMPLETE.md
- **Configuration:** config.py (lines 101-135)
- **Training Script:** train_stage2.py

---

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Date:** March 30, 2026  
**Accuracy:** 94.35%
