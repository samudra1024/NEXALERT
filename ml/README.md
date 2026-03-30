# Nexalert - Two-Stage SMS Spam Detection & Categorization

A production-grade, end-to-end machine learning system for SMS spam detection and intelligent message categorization using a **two-stage ML pipeline** optimized for high recall and on-device deployment.

---

## 🎯 Project Overview

### What is Nexalert?

Nexalert is an advanced ML-powered system that automatically detects and categorizes SMS messages to help users manage their inbox efficiently and securely.

### Problem Solved

1. **Spam Detection**: Identifies unwanted/spam messages (Stage 1)
2. **Smart Categorization**: Organizes legitimate messages into meaningful categories (Stage 2)
   - Personal, Banking, OTP, Subscription, Promotional, Unknown

### High-Level Pipeline

```
Incoming SMS
    ↓
Stage 1: Spam vs HAM
    ├─→ SPAM → Flag as spam, store separately
    └─→ HAM → Continue to Stage 2
            ↓
        Stage 2: Category Prediction
            ↓
        Organize into category (Personal/Banking/OTP/etc.)
```

---

## ✨ Features

### Core Capabilities

- ✅ **Two-Stage ML Pipeline**
  - Stage 1: Binary spam detection (TF-IDF + Logistic Regression)
  - Stage 2: Multi-class categorization (TF-IDF + LightGBM)

- ✅ **High Spam Recall**
  - Optimized to catch maximum spam messages
  - Custom threshold tuning for business metrics

- ✅ **6-Category HAM Classification**
  - Personal, Banking, OTP, Subscription, Promotional, Unknown
  - 94%+ accuracy on test set

- ✅ **Privacy-Focused Design**
  - On-device inference ready
  - No cloud dependencies required

- ✅ **Production-Ready**
  - Clean modular architecture
  - Comprehensive logging and metrics
  - Config-driven hyperparameters

---

## 🏗️ Architecture Overview

### Two-Stage Pipeline

#### Stage 1: Spam Detection
- **Input**: Raw SMS text
- **Model**: TF-IDF Vectorizer + Logistic Regression
- **Output**: SPAM or HAM classification
- **Goal**: Maximize spam recall (catch all spam)
- **Artifact**: `stage1/artifacts/model_bundle.pkl`

#### Stage 2: HAM Categorization
- **Input**: Messages classified as HAM by Stage 1
- **Model**: TF-IDF Vectorizer + LightGBM Classifier
- **Output**: One of 6 categories (Personal, Banking, OTP, etc.)
- **Goal**: Accurate multi-class classification
- **Artifact**: `stage2/artifacts/stage2_model.pkl`

### Inference Flow

```
User receives SMS
    ↓
Stage 1 Model
    ↓
Is SPAM?
    ├─ YES → Store in Spam folder
    │         Notify user (optional)
    │
    └─ NO → Stage 2 Model
            ↓
        Predict category
            ↓
        Store in category folder
        (Personal/Banking/OTP/etc.)
```

---

## 🛠️ Tech Stack

### Core Technologies

- **Python 3.8+**
- **scikit-learn** - ML framework for Stage 1
- **LightGBM** - Gradient boosting for Stage 2
- **pandas** - Data manipulation
- **NumPy** - Numerical operations

### ML Components

- **TF-IDF Vectorizer** - Text feature extraction
- **Logistic Regression** - Binary classification (Stage 1)
- **LightGBM Classifier** - Multi-class classification (Stage 2)

### Optional (Mobile Deployment)

- **ONNX** - Cross-platform model format
- **skl2onnx** - sklearn to ONNX conversion
- **onnxruntime** - Mobile inference engine

---

## 📊 Dataset & Data Management

### Dataset Structure

The dataset contains three columns:

```csv
text,label,category
"Congratulations! You've won $1000...",spam,
"Hey, are we still on for lunch?",ham,personal
"Your bank account balance is $500",ham,banking
"Your OTP is 123456",ham,otp
```

**Columns:**
- `text`: SMS message content
- `label`: `spam` or `ham`
- `category`: Message category (only for HAM messages)

### Data Usage

**Stage 1 (Spam Detection):**
- Uses **full dataset** (both spam and ham)
- Trains on `text` → `label` mapping
- Stratified split: 70% train, 15% val, 15% test

**Stage 2 (HAM Categorization):**
- Uses **HAM-only subset** (filtered from full dataset)
- Trains on `text` → `category` mapping
- Stratified split: 80% train, 20% test

### Data Preprocessing

Minimal preprocessing to preserve spam signals:
- Lowercase conversion only
- Preserves: numbers, URLs, symbols, emojis (all potential spam indicators)

---

## 🤖 Model Details

### Stage 1: Spam Detection

**Architecture:**
```
Text → TF-IDF (5000 features) → Logistic Regression → Spam Probability
```

**Configuration:**
- TF-IDF: max_features=5000, ngram_range=(1,2), stop_words='english'
- Logistic Regression: class_weight='balanced', max_iter=1000
- Decision Threshold: Tuned on validation set (typically ~0.2-0.3)

**Performance:**
- Spam Recall: ~94-98% (primary metric)
- Overall Accuracy: ~95%

### Stage 2: HAM Categorization

**Architecture:**
```
Text → TF-IDF (15000 features) → LightGBM → Category Prediction
```

**Configuration:**
- TF-IDF: max_features=15000, ngram_range=(1,2), sublinear_tf=True
- LightGBM: n_estimators=300, learning_rate=0.05, num_leaves=31
- Class Weights: Balanced (handles imbalanced categories)

**Categories & Performance:**
| Category | F1-Score | Support |
|----------|----------|--------|
| Personal | 0.95 | 6,106 |
| Banking | 0.99 | 1,405 |
| OTP | 1.00 | 1,165 |
| Subscription | 0.96 | 1,124 |
| Promotional | 1.00 | 1,000 |
| Unknown | 0.31 | 534 |

**Overall Accuracy: 94.35%**

---

## 📁 Project Structure

```
ml/
│
├── stage1/                          # Spam Detection Model
│   ├── train.py                     # Training script
│   ├── evaluate.py                  # Evaluation script
│   ├── export_onnx.py               # ONNX export
│   ├── test_inference.py            # Inference tests
│   └── artifacts/                   # Stage 1 models
│       └── model_bundle.pkl
│
├── stage2/                          # HAM Categorization Model
│   ├── train.py                     # Training script
│   ├── test_data.py                 # Data verification
│   └── artifacts/                   # Stage 2 models
│       └── stage2_model.pkl
│
├── docs/                            # Documentation
│   ├── BUNDLE_QUICK_REF.md
│   ├── STAGE2_QUICK_REF.md
│   ├── PROJECT_RESTRUCTURING_SUMMARY.md
│   └── [more docs...]
│
├── data/                            # Datasets
│   └── dataset.csv
│
├── config.py                        # Shared configuration
├── preprocess.py                    # Data preprocessing
├── utils.py                         # Utility functions
└── requirements.txt                 # Dependencies
```

---

## 🚀 Local Setup & Training

### 1. Installation

```bash
# Navigate to project root
cd NexAlert/ml

# Create virtual environment (Python 3.8+)
python -m venv venv

# Activate environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Prepare Dataset

Place your dataset in `data/dataset.csv`:

```csv
text,label,category
"FREE iPhone! Click here...",spam,
"Mom, coming home at 6",ham,personal
"Your OTP is 847291",ham,otp
```

**Requirements:**
- CSV format with headers: `text`, `label`, `category`
- Labels: `spam` or `ham` (case-insensitive)
- Category: Only required for HAM messages

### 3. Train Stage 1 (If Needed)

```bash
cd model/stage1
python train.py
```

**What happens:**
1. Loads and preprocesses data
2. Splits into train/val/test (70/15/15)
3. Fits TF-IDF on training set
4. Trains Logistic Regression
5. Tunes threshold on validation set
6. Saves model to `stage1/artifacts/`

### 4. Train Stage 2

```bash
cd model/stage2
python train.py
```

**Expected Output:**
```
STAGE 2: HAM MESSAGE CATEGORIZATION - MODEL TRAINING
✓ Total HAM messages: 11,332
✓ Training samples: 9,065
✓ Test samples: 2,267
✓ Number of classes: 6
✓ Test Accuracy: 0.9435 (94.35%)
✓ Model saved: stage2/artifacts/stage2_model.pkl
```

### 5. Where Models Are Saved

**Stage 1:**
- `stage1/artifacts/model_bundle.pkl`

**Stage 2:**
- `stage2/artifacts/stage2_model.pkl`

---

## 💻 Usage

### Basic Inference Flow

```python
from utils import SpamDetector, HamCategorizer

# Initialize models
spam_detector = SpamDetector()
spam_detector.initialize()

ham_categorizer = HamCategorizer()
ham_categorizer.initialize()

# Process incoming message
message = "Your OTP is 123456"

# Stage 1: Check if spam
stage1_result = spam_detector.predict(message)

if stage1_result['is_spam']:
    print("🚨 SPAM detected!")
else:
    # Stage 2: Categorize HAM message
    stage2_result = ham_categorizer.predict(message)
    print(f"📁 Category: {stage2_result['category']}")
    # Output: 📁 Category: otp
```

### Example Scenarios

**Scenario 1: Spam Message**
```python
message = "Congratulations! You've won $1000!"
# Stage 1 → SPAM
# Action: Store in spam folder
```

**Scenario 2: Personal Message**
```python
message = "Hey, are we still on for lunch?"
# Stage 1 → HAM
# Stage 2 → personal
# Action: Store in personal folder
```

**Scenario 3: OTP Message**
```python
message = "Your bank OTP is 847291. Valid for 5 min."
# Stage 1 → HAM
# Stage 2 → banking (or otp)
# Action: Highlight as important
```

---

## 📚 Documentation

Detailed documentation is available in the `docs/` folder:

### Quick References
- `BUNDLE_QUICK_REF.md` - Model bundle reference
- `STAGE2_QUICK_REF.md` - Stage 2 quick start
- `FILE_STRUCTURE_QUICK_REF.md` - Project structure guide

### Implementation Summaries
- `STAGE2_IMPLEMENTATION_COMPLETE.md` - Stage 2 training details
- `PROJECT_RESTRUCTURING_SUMMARY.md` - Architecture overview
- `CATEGORY_COLUMN_HANDLING.md` - Data handling guide

**Access Docs:**
```bash
cd ml/docs
ls  # View all documentation files
```

---

## 📄 License

This project is provided as-is for educational and production use.

---

## 🔮 Future Improvements

### Model Optimization
- [ ] Hyperparameter tuning (GridSearchCV)
- [ ] Feature selection to reduce dimensionality
- [ ] Ensemble methods for better accuracy

### On-Device Deployment
- [ ] Convert Stage 1 to ONNX/TFLite
- [ ] Convert Stage 2 to ONNX/TFLite
- [ ] Mobile app integration (Android/iOS)
- [ ] Optimize for mobile CPU/GPU

### Feedback Loop & Retraining
- [ ] Collect user corrections
- [ ] Incremental learning pipeline
- [ ] Scheduled retraining (weekly/monthly)
- [ ] A/B testing framework

### Advanced Features
- [ ] Multi-language support
- [ ] Custom user-defined categories
- [ ] Real-time streaming inference
- [ ] Model versioning and rollback

---

## 🧪 Testing

### Run Tests

```bash
# Test Stage 1 inference
cd model/stage1
python test_inference.py

# Test Stage 2 data
cd model/stage2
python test_data.py
```

### Expected Results

**Stage 1 Test:**
```
SPAM DETECTION TEST
✅ HAM (confidence: 98.23%) - "Hey, lunch tomorrow?"
🚨 SPAM (confidence: 94.56%) - "FREE iPhone!"
```

**Stage 2 Test:**
```
HAM CATEGORIZATION TEST
✅ Category: otp (confidence: 99.12%) - "Your OTP is 123456"
✅ Category: personal (confidence: 95.34%) - "Coming home at 6"
```

---

## 🤝 Contributing

This is a production-grade system. Before making changes:

1. ✅ Ensure all tests pass
2. ✅ Update relevant documentation in `docs/`
3. ✅ Follow existing code structure
4. ✅ Test both Stage 1 and Stage 2 independently
5. ✅ Verify no breaking changes to API

---

## 📞 Support & References

### Code References
- **Stage 1 Training**: `model/stage1/train.py`
- **Stage 2 Training**: `model/stage2/train.py`
- **Configuration**: `config.py`
- **Utilities**: `utils.py`

### External Resources
- [Scikit-learn Documentation](https://scikit-learn.org/)
- [LightGBM Documentation](https://lightgbm.readthedocs.io/)
- [ONNX Documentation](https://onnx.ai/)
- [SMS Spam Collection Dataset](https://archive.ics.uci.edu/ml/datasets/sms+spam+collection)

---

## 💡 Key Takeaways

1. **Two-Stage Architecture**: Separates spam detection from categorization
2. **High Recall Focus**: Prioritizes catching spam over avoiding false positives
3. **Production-Ready**: Clean code, comprehensive logging, modular design
4. **Privacy-First**: Designed for on-device deployment
5. **Scalable**: Easy to add new categories or improve models independently

---

For questions or issues, please review the documentation in `docs/` first.

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
