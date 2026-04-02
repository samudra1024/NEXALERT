# NexAlert - Two-Stage SMS Spam Detection & Categorization

Production-grade ML system for SMS spam detection and intelligent message categorization.

---

## 🎯 Overview

Two-stage ML pipeline:
1. **Stage 1**: Spam Detection (TF-IDF + Logistic Regression)
2. **Stage 2**: HAM Categorization (TF-IDF + LightGBM) - 6 categories

---

## 📁 Project Structure

```
ml/
├── model/
│   ├── config.py              # Configuration & hyperparameters
│   ├── preprocess.py          # Data preprocessing
│   ├── utils.py               # Utility functions & inference
│   ├── stage1/                # Spam Detection
│   │   ├── train.py           # Training script
│   │   ├── evaluate.py        # Evaluation script
│   │   ├── export_onnx.py     # ONNX export
│   │   ├── test_inference.py  # Inference testing
│   │   └── artifacts/         # Stage 1 models
│   │       ├── model_bundle.pkl
│   │       ├── threshold.json
│   │       └── model.onnx
│   └── stage2/                # HAM Categorization
│       ├── train.py           # Training script
│       ├── test_data.py       # Data verification
│       ├── export_onnx.py     # ONNX export
│       ├── inference_example.py # Usage examples
│       └── artifacts/         # Stage 2 models
│           └── stage2_model.pkl
│           └── stage2_model.onnx
├── data/
│   └── dataset.csv            # SMS dataset
└── requirements.txt           # Python dependencies
```

---

## ⚙️ Setup

### Installation

```bash
cd NexAlert/ml

# Create virtual environment
python -m venv venv
venv\Scripts\activate    # Windows
source venv/bin/activate # Linux/Mac

# Install dependencies
pip install -r requirements.txt
```

### Dataset Format

Place `dataset.csv` in `ml/data/`:

```csv
text,label,category
"FREE iPhone! Click here...",spam,
"Hey, lunch tomorrow?",ham,personal
"Your OTP is 123456",ham,otp
"Account balance $500",ham,banking
```

**Requirements:**
- Columns: `text`, `label`, `category`
- Labels: `spam` or `ham`
- Category: For HAM messages only (personal, banking, otp, subscription, promotional, unknown)

---

## 🚀 Commands

**Run from project root (NexAlert/):**

### Stage 1: Spam Detection

```bash
# Training
python -m ml.model.stage1.train

# Evaluation
python -m ml.model.stage1.evaluate

# ONNX Export
python -m ml.model.stage1.export_onnx
```

**Artifacts saved to:** `ml/model/stage1/artifacts/`

### Stage 2: HAM Categorization

```bash
# Training
python -m ml.model.stage2.train

# ONNX Export
python -m ml.model.stage2.export_onnx
```

**Artifacts saved to:** `ml/model/stage2/artifacts/`

---

## 📦 Model Details

### Stage 1: Spam Detection
- **Model:** Logistic Regression
- **Vectorizer:** TF-IDF
- **Output:** Spam / Ham
- **Artifacts:**
  - `stage1_model.onnx`
  - `stage1_vectorizer.pkl`
  - `stage1_meta.json`

### Stage 2: HAM Classification
- **Model:** LightGBM
- **Vectorizer:** TF-IDF
- **Input:** ONLY HAM messages from Stage 1
- **Output:** 6 categories (Personal, Banking, OTP, Subscription, Promotional, Unknown)
- **Artifacts:**
  - `stage2_model.onnx`
  - `stage2_vectorizer.pkl`
  - `stage2_meta.json`

---

## 📊 Categories

| Index | Category | Description |
|-------|----------|-------------|
| 0 | personal | Personal messages |
| 1 | banking | Banking/financial |
| 2 | otp | One-time passwords |
| 3 | subscription | Subscriptions/recurring |
| 4 | promotional | Promotions/offers |
| 5 | unknown | Unclassified HAM |

---

## 🔄 How to Update Models

1. **Retrain:** Run training command for the stage you want to update
2. **Export ONNX:** Run the corresponding export command
3. **Replace Artifacts:** Copy new `.onnx` files to your app's assets folder

**Example:**
```bash
# Update Stage 1 model
python -m ml.model.stage1.train
python -m ml.model.stage1.export_onnx

# Update Stage 2 model
python -m ml.model.stage2.train
python -m ml.model.stage2.export_onnx
```

---

## 📱 Mobile Deployment

Both stages exported to ONNX for mobile deployment:
- Stage 1: `ml/model/stage1/artifacts/stage1_model.onnx`
- Stage 2: `ml/model/stage2/artifacts/stage2_model.onnx`

Copy `.onnx` files to mobile app assets folder. Use ONNX Runtime Mobile for inference.

**Dependencies:**
```bash
pip install onnxruntime onnxmltools skl2onnx
```

---

## 🔧 Troubleshooting

**Import errors:** Ensure you're running from project root with `python -m` commands

**Dataset not found:** Place `dataset.csv` in `ml/data/`

**Model not trained:** Run training before evaluation or ONNX export

**ONNX conversion fails:** Install `onnxmltools` for LightGBM support

---

## 📞 Support

Review code comments and configuration files for detailed parameters.

**License:** Provided as-is for educational and production use.
