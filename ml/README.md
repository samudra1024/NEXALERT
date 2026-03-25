# SMS Spam Detection ML System

A production-grade, end-to-end machine learning system for SMS spam detection (binary classification: spam vs ham) optimized for **high recall** and **on-device mobile inference**.

---

## 🎯 System Overview

### Objective
- **Binary Classification**: Spam (1) vs Ham (0)
- **Primary Goal**: Maximize recall for spam class (minimize missed spam)
- **Deployment Target**: Mobile devices (offline, on-device inference)

### Model Constraints
- **Algorithm**: TF-IDF Vectorizer + Logistic Regression
- **No deep learning or transformers** (keep it lightweight and fast)
- **Optimized for**: High spam recall with acceptable precision

---

## 📁 Project Structure

```
ml_spam_detection/
│
├── model/
│   ├── train.py              # Training pipeline + threshold tuning
│   ├── evaluate.py           # Test set evaluation (ONCE)
│   ├── preprocess.py         # Data loading and preprocessing
│   ├── config.py             # All hyperparameters and paths
│   ├── utils.py              # Utilities + inference pipeline
│   └── artifacts/
│       ├── vectorizer.pkl    # Fitted TF-IDF vectorizer
│       ├── model.pkl         # Trained Logistic Regression
│       ├── threshold.json    # Optimal decision threshold
│       ├── metrics.json      # Test set performance metrics
│       └── model.onnx        # Mobile-ready ONNX model (optional)
│
├── data/
│   └── dataset.csv           # Your SMS dataset (label, text)
│
├── requirements.txt          # Python dependencies
└── README.md                 # This file
```

---

## 🚀 Quick Start

### 1. Installation

```bash
# Create virtual environment (Python 3.8+)
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### 2. Prepare Your Dataset

Place your dataset in `data/dataset.csv` with the following format:

```csv
label,text
spam,"Congratulations! You've won a $1000 gift card..."
ham,"Hey, are we still on for lunch?"
spam,"URGENT! Call now to claim your reward..."
ham,"Can you pick up some milk?"
```

**Requirements:**
- CSV format with headers: `label,text`
- Labels: `"spam"` or `"ham"` (case-insensitive)
- Text: Raw SMS message content

### 3. Train the Model

```bash
cd model
python train.py
```

**What happens:**
1. Loads and preprocesses data
2. Splits into train (70%), validation (15%), test (15%)
3. Fits TF-IDF vectorizer on training set only
4. Trains Logistic Regression with balanced class weights
5. **Tunes decision threshold** on validation set to maximize spam recall
6. Saves model artifacts to `model/artifacts/`

### 4. Evaluate on Test Set

```bash
python evaluate.py
```

**Important:** Test set is evaluated **ONLY ONCE** after training and threshold tuning. No model adjustments should be made based on test results.

### 5. Make Predictions

```python
from utils import SpamDetector

# Initialize detector
detector = SpamDetector()
detector.initialize()

# Predict single message
result = detector.predict("Congratulations! You've won $1000...")
print(result)
# Output: {'prediction': 'spam', 'confidence': 0.92, 'probability_spam': 0.92, 'is_spam': True}

# Predict multiple messages
results = detector.predict_batch(["Message 1", "Message 2", ...])
```

---

## ⚙️ Configuration

All hyperparameters are defined in [`config.py`](model/config.py):

### Key Parameters

```python
# Data Split
TRAIN_SIZE = 0.70      # 70% training
VAL_SIZE = 0.15        # 15% validation (threshold tuning)
TEST_SIZE = 0.15       # 15% test (held out)

# TF-IDF Vectorizer
TFIDF_CONFIG = {
    'max_features': 5000,      # Vocabulary size
    'ngram_range': (1, 2),     # Unigrams + bigrams
    'stop_words': 'english',   # Remove stopwords
    'min_df': 2,               # Ignore rare terms
    'max_df': 0.95,            # Ignore common terms
}

# Logistic Regression
LR_CONFIG = {
    'class_weight': 'balanced',  # Handle class imbalance
    'max_iter': 1000,            # Convergence iterations
    'solver': 'liblinear',       # Good for small datasets
}

# Threshold Tuning
THRESHOLD_CONFIG = {
    'min_threshold': 0.1,        # Search range start
    'max_threshold': 0.9,        # Search range end
    'step': 0.05,                # Search granularity
    'min_precision': 0.3,        # Minimum acceptable precision
}
```

---

## 🎯 Threshold Tuning (Critical!)

### Why Not Use Default 0.5?

Default threshold (0.5) assumes equal cost for false positives and false negatives. **This is wrong for spam detection:**

- **False Negative (spam → ham)**: User sees unwanted spam ❌
- **False Positive (ham → spam)**: User might miss important message ⚠️

**Missing spam is worse than false alarms!**

### How Threshold Tuning Works

1. Get prediction probabilities on **validation set**
2. Search thresholds from 0.1 to 0.9
3. Select threshold that **maximizes spam recall** while maintaining minimum precision (0.3)
4. Save optimal threshold to `artifacts/threshold.json`

**Example:**
```
Threshold Search Results:
Threshold    Recall       Precision    
0.100        0.9821       0.2145       
0.150        0.9643       0.2876       
0.200        0.9464       0.3421  ← BEST (max recall with precision ≥ 0.3)
0.250        0.9107       0.3892     
0.300        0.8750       0.4321     
...

✅ SELECTED THRESHOLD: 0.200
   Spam Recall:    0.9464 (94.64%)
   Spam Precision: 0.3421 (34.21%)
```

---

## 📊 Evaluation Metrics

### Primary Metric: **Spam Recall**

```
Spam Recall = True Positives / (True Positives + False Negatives)
```

**Goal:** Catch as many spam messages as possible (minimize false negatives)

### Secondary Metrics

- **Spam Precision**: Of all messages flagged as spam, how many are actually spam?
- **Spam F1-Score**: Harmonic mean of precision and recall
- **Confusion Matrix**: Detailed breakdown of predictions

### Sample Evaluation Report

```
======================================================================
EVALUATION REPORT
======================================================================

📊 CLASSIFICATION REPORT:
----------------------------------------------------------------------
              precision    recall  f1-score   support

         ham       0.97      0.95      0.96      1450
        spam       0.42      0.94      0.58       350

    accuracy                           0.95      1800
   macro avg       0.70      0.95      0.77      1800
weighted avg       0.88      0.95      0.91      1800


📈 CONFUSION MATRIX:
----------------------------------------------------------------------
                    Predicted Ham   Predicted Spam
Actual Ham                1378             72
Actual Spam                 21            329

🎯 KEY METRICS (FOCUS ON SPAM DETECTION):
----------------------------------------------------------------------
✅ SPAM RECALL (MOST IMPORTANT):  0.9400 (94.00%)
   Spam Precision:                 0.4200 (42.00%)
   Spam F1-Score:                  0.5800
   Total Spam Samples:             350

💼 BUSINESS IMPACT:
----------------------------------------------------------------------
   Total spam messages:            350
   ✅ Spam detected correctly:     329 (94.0%)
   ❌ Spam missed:                 21 (6.0%)
   ⚠️  False alarms (ham→spam):     72
```

---

## 📱 Mobile Deployment (ONNX)

### Why ONNX for Mobile?

**ONNX vs TensorFlow Lite for scikit-learn models:**

| Aspect | ONNX | TensorFlow Lite |
|--------|------|-----------------|
| **Conversion** | Direct via `skl2onnx` | Requires TF intermediate step |
| **Compatibility** | Native sklearn support | Limited sklearn support |
| **Mobile Runtime** | ONNX Runtime (iOS/Android) | TFLite Interpreter |
| **Performance** | Optimized for CPU | Optimized for mobile GPU |
| **Ease of Use** | Simple conversion | Complex workaround needed |

**Winner: ONNX** - It's the native format for sklearn models on mobile.

### Convert to ONNX

Add this to your training script or run separately:

```python
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import pickle

# Load trained model and vectorizer
with open('artifacts/model.pkl', 'rb') as f:
    model = pickle.load(f)

with open('artifacts/vectorizer.pkl', 'rb') as f:
    vectorizer = pickle.load(f)

# Note: For ONNX, you need to export the entire pipeline
# Create a pipeline class or export separately
from sklearn.pipeline import Pipeline

pipeline = Pipeline([
    ('vectorizer', vectorizer),
    ('classifier', model)
])

# Convert to ONNX
initial_type = [('float_input', FloatTensorType([None, 5000]))]
onnx_model = convert_sklearn(pipeline, initial_types=initial_type)

# Save ONNX model
with open("artifacts/model.onnx", "wb") as f:
    f.write(onnx_model.SerializeToString())
```

### Run Inference on Mobile

#### Android (Kotlin/Java)

```kotlin
// Add ONNX Runtime dependency
implementation 'com.microsoft.onnxruntime:onnxruntime-android:1.16.3'

// Load model
val env = OrtEnvironment.getEnvironment()
val session = env.createSession("model.onnx", OrtSession.SessionOptions())

// Preprocess text
val text = preprocess("Your SMS here")

// Vectorize (you need to implement TF-IDF or use pre-computed vocabulary)
val features = vectorize(text)  // Implement TF-IDF logic

// Create input tensor
val input = OnnxTensor.createTensor(env, floatArrayOf(features))

// Run inference
val result = session.run(mapOf("float_input" to input))
val probabilities = result[0].value as Array<FloatArray>

// Apply threshold
val spamProb = probabilities[0][1]
val isSpam = spamProb >= 0.2f  // Use your tuned threshold
```

#### iOS (Swift)

```swift
// Add ONNX Runtime via CocoaPods
pod 'onnxruntime-c'

// Load model
let env = try OrtEnv()
let session = try OrtSession(env: env, modelPath: "model.onnx", options: OrtSessionSessionOptions())

// Preprocess text
let text = preprocess("Your SMS here")

// Vectorize
let features = vectorize(text)

// Create input tensor
let inputData = try TensorData(
    shape: [1, 5000],
    data: features
)
let input = try OrtValue.tensor(value: inputData, dataType: .float)

// Run inference
let result = try session.run(inputNames: ["float_input"], outputNames: ["output"], values: [input])

// Get probability
let probabilities = try result[0].tensor().data()
let spamProb = probabilities[1]
let isSpam = spamProb >= 0.2  // Use your tuned threshold
```

---

## 🔧 MLOps Best Practices

### ✅ What We Did Right

1. **Stratified Splits**: Maintains class distribution across train/val/test
2. **No Data Leakage**: Test set never touched during training
3. **Threshold Tuning**: Optimized for business metric (spam recall)
4. **Reproducibility**: Fixed random seeds everywhere
5. **Config-Driven**: All hyperparameters in one file
6. **Clean Separation**: Training vs inference pipelines
7. **Comprehensive Logging**: Every step is logged
8. **Metrics Tracking**: All metrics saved to JSON

### ⚠️ Common Pitfalls to Avoid

1. **Using test set during training** → Biased performance estimates
2. **Default threshold (0.5)** → Suboptimal for imbalanced problems
3. **Over-cleaning text** → Removes spam signals (URLs, numbers, symbols)
4. **Not handling class imbalance** → Model biased toward majority class
5. **Hardcoding paths** → Breaks on different machines
6. **No random seed** → Results not reproducible

---

## 🔄 Future Extensibility

### 1. User Feedback Loop

```python
# Collect user corrections
def collect_feedback(message_id: str, predicted_label: str, user_correction: str):
    """Store user feedback for model improvement"""
    feedback_db.insert({
        'message_id': message_id,
        'predicted': predicted_label,
        'actual': user_correction,
        'timestamp': datetime.now()
    })
```

### 2. Retraining Pipeline

```bash
# Scheduled retraining (e.g., weekly)
cron_job:
  schedule: "0 0 * * 0"  # Every Sunday at midnight
  command: "python model/train.py --incremental"
```

### 3. Model Versioning

```bash
# Save models with version info
artifacts/
├── v1.0.0/
│   ├── model.pkl
│   └── metrics.json
├── v1.1.0/
│   └── ...
└── current/  # Symlink to latest version
```

### 4. A/B Testing

Deploy multiple model versions and compare real-world performance before full rollout.

---

## 📝 Dataset Format Examples

### Example 1: String Labels

```csv
label,text
spam,"Win a FREE iPhone! Click here: bit.ly/xyz"
ham,"Mom, I'll be home by 6pm"
spam,"URGENT: Your bank account has been compromised"
ham,"Are we still on for tennis tomorrow?"
```

### Example 2: Numeric Labels

If your dataset uses 1/0 instead of spam/ham, modify `LABEL_MAPPING` in config.py:

```python
LABEL_MAPPING = {
    1: 1,  # Already encoded
    0: 0,
}
```

---

## 🧪 Testing the System

### Unit Tests

```python
# tests/test_preprocessing.py
def test_preprocess_text():
    assert preprocess_text("HELLO WORLD!") == "hello world!"
    assert preprocess_text("Call 555-1234") == "call 555-1234"  # Keep numbers

# tests/test_inference.py
def test_spam_detector():
    detector = SpamDetector()
    detector.initialize()
    
    result = detector.predict("FREE MONEY!!!")
    assert result['is_spam'] == True
    assert result['probability_spam'] > 0.5
```

### Integration Test

```bash
# Full pipeline test
python model/train.py
python model/evaluate.py
python -c "from utils import predict; print(predict('Test message'))"
```

---

## 📚 References

- **Scikit-learn Documentation**: https://scikit-learn.org/
- **ONNX Documentation**: https://onnx.ai/
- **SMS Spam Collection Dataset**: https://archive.ics.uci.edu/ml/datasets/sms+spam+collection
- **Threshold Moving**: https://machinelearningmastery.com/threshold-moving-for-imbalanced-classification/

---

## 🤝 Contributing

This is a production-grade system. Before making changes:

1. Ensure all tests pass
2. Document any new configuration parameters
3. Update README if behavior changes
4. Test on mobile platform if modifying inference

---

## 📄 License

This project is provided as-is for educational and production use.

---

## 💡 Key Takeaways

1. **High Recall Focus**: System prioritizes catching spam over avoiding false positives
2. **Threshold Matters**: Custom threshold tuning is critical for imbalanced problems
3. **ONNX for Mobile**: Best choice for deploying sklearn models on mobile devices
4. **No Shortcuts**: Proper train/val/test splits prevent data leakage
5. **Production-Ready**: Clean code, comprehensive logging, reusable components

---


For questions or issues, please review the code comments and documentation first.
