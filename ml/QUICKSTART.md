# Quick Start Guide - SMS Spam Detection

## 🚀 Get Started in 5 Minutes

### Step 1: Install Dependencies

```bash
cd ml_spam_detection
pip install -r requirements.txt
```

### Step 2: Verify Installation

```bash
python -c "import pandas, numpy, sklearn; print('✅ Dependencies installed!')"
```

### Step 3: Train the Model

```bash
cd model
python train.py
```

**Expected Output:**
```
======================================================================
SMS SPAM DETECTION - MODEL TRAINING
======================================================================

... (detailed logs) ...

✅ SELECTED THRESHOLD: 0.200
   Spam Recall:    0.9500 (95.00%)
   Spam Precision: 0.3800 (38.00%)

✅ Model artifacts saved to: model/artifacts/
   - vectorizer.pkl
   - model.pkl
   - threshold.json

✅ TRAINING SUCCESSFUL!
```

### Step 4: Evaluate on Test Set

```bash
python evaluate.py
```

**Expected Output:**
```
======================================================================
EVALUATION REPORT
======================================================================

📊 CLASSIFICATION REPORT:
              precision    recall  f1-score   support

         ham       0.97      0.96      0.96       120
        spam       0.45      0.95      0.61        40

✅ SPAM RECALL (MOST IMPORTANT):  0.9500 (95.00%)

💼 BUSINESS IMPACT:
   ✅ Spam detected correctly:     38 (95.0%)
   ❌ Spam missed:                 2 (5.0%)
   ⚠️  False alarms (ham→spam):     5

✅ EVALUATION SUCCESSFUL!
```

### Step 5: Make Predictions

#### Option A: Command Line

```bash
python -c "from utils import predict; result = predict('FREE iPhone! Click here!'); print(f'SPAM: {result[\"is_spam\"]} (confidence: {result[\"probability_spam\"]:.2%})')"
```

#### Option B: Python Script

Create `test_prediction.py`:

```python
from utils import SpamDetector

# Initialize
detector = SpamDetector()
detector.initialize()

# Test messages
messages = [
    "Congratulations! You've won a $1000 gift card!",
    "Hey, are we still on for lunch?",
    "URGENT! Call now to claim your reward!",
    "Can you pick up some milk?"
]

print("=" * 60)
print("SPAM DETECTION TEST")
print("=" * 60)

for msg in messages:
    result = detector.predict(msg)
    label = "🚨 SPAM" if result['is_spam'] else "✅ HAM"
    print(f"\n{label} (confidence: {result['confidence']:.2%})")
    print(f"Message: {msg}")
    print(f"Spam probability: {result['probability_spam']:.4f}")

print("\n" + "=" * 60)
```

Run it:
```bash
python test_prediction.py
```

---

## 📱 Export to ONNX (Optional)

For mobile deployment:

```bash
python export_onnx.py
```

**Expected Output:**
```
======================================================================
EXPORTING MODEL TO ONNX FORMAT
======================================================================

✓ Loaded vectorizer
✓ Loaded model
✓ Pipeline created successfully
✓ Model converted to ONNX successfully
✓ ONNX model saved to: model/artifacts/model.onnx

✅ ONNX EXPORT SUCCESSFUL!
```

---

## 📊 View Results

Check your trained model metrics:

```bash
cat model/artifacts/metrics.json
```

Or view in Python:

```python
import json
with open('model/artifacts/metrics.json', 'r') as f:
    metrics = json.load(f)
    
print(f"Spam Recall: {metrics['per_class']['spam']['recall']:.4f}")
print(f"Spam Precision: {metrics['per_class']['spam']['precision']:.4f}")
print(f"Threshold Used: {metrics['threshold']:.3f}")
```

---

## 🔧 Troubleshooting

### Error: "Dataset not found"

**Solution:** Make sure `dataset.csv` exists in the `data/` folder with correct format:

```csv
label,text
spam,"Congratulations! You've won..."
ham,"Hey, are we still on..."
```

### Error: "ModuleNotFoundError"

**Solution:** Install missing package:

```bash
pip install <package_name>
```

### Error: "Model artifacts not found"

**Solution:** Run training first:

```bash
python train.py
```

---

## 📈 Next Steps

1. **Replace Sample Data**: Use your own dataset in `data/dataset.csv`
2. **Retrain Model**: Run `python train.py` with your data
3. **Evaluate Performance**: Run `python evaluate.py`
4. **Deploy to Mobile**: Follow ONNX export instructions in README.md
5. **Integrate with App**: Use the `SpamDetector` class in your application

---

## 💡 Tips

### Adjust Threshold Sensitivity

Edit `config.py` to change threshold tuning behavior:

```python
THRESHOLD_CONFIG = {
    'min_threshold': 0.1,        # Lower = more aggressive spam detection
    'max_threshold': 0.9,        # Higher = more conservative
    'step': 0.05,                # Smaller step = finer search
    'min_precision': 0.3,        # Increase to reduce false positives
}
```

### Change TF-IDF Features

```python
TFIDF_CONFIG = {
    'max_features': 5000,        # Increase for larger vocabulary
    'ngram_range': (1, 2),       # Try (1,3) for trigrams
    'min_df': 2,                 # Lower to 1 for small datasets
    'max_df': 0.95,              # Adjust to remove common words
}
```

### Monitor Training Logs

Pay attention to:
- **Top spam indicators**: Which words/phrases indicate spam
- **Threshold selection**: Why certain threshold was chosen
- **Class distribution**: Ensure balanced representation

---

## 🎯 Success Criteria

Your system is working correctly if:

✅ Training completes without errors  
✅ Spam recall is **> 90%** (primary goal)  
✅ Test evaluation runs once and saves metrics  
✅ Predictions return probabilities between 0-1  
✅ ONNX export creates valid `.onnx` file  

---

## 📞 Support

If you encounter issues:

1. Check error message carefully
2. Review the full training/evaluation logs
3. Verify file paths and permissions
4. Ensure all dependencies are installed
5. Check that dataset format matches requirements

---

**Happy Spam Detecting! 🎯**
