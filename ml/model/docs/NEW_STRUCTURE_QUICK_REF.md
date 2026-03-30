# Project Structure Quick Reference

## 📁 New Directory Layout

```
ml/model/
├── stage1/           ← Spam Detection
│   ├── train.py
│   ├── evaluate.py
│   ├── export_onnx.py
│   ├── test_inference.py
│   └── artifacts/
│
├── stage2/           ← HAM Categorization
│   ├── train.py
│   ├── test_data.py
│   └── artifacts/
│
├── config.py         ← Shared
├── preprocess.py     ← Shared
└── utils.py          ← Shared
```

---

## 🚀 Quick Commands

### Stage 1 (Spam Detection)
```bash
# Train model
python stage1/train.py

# Evaluate
python stage1/evaluate.py

# Export to ONNX
python stage1/export_onnx.py

# Test inference
python stage1/test_inference.py
```

### Stage 2 (HAM Categorization)
```bash
# Train model
python stage2/train.py

# Test data verification
python stage2/test_data.py
```

---

## 📦 Model Artifacts

### Stage 1
- **Location:** `stage1/artifacts/`
- **File:** `model_bundle.pkl`

### Stage 2
- **Location:** `stage2/artifacts/`
- **File:** `stage2_model.pkl`

---

## 🔧 Import Pattern

All files use this pattern:
```python
import sys
sys.path.append('.')

from config import ...      # Works ✓
from preprocess import ...  # Works ✓
from utils import ...       # Works ✓
```

**No changes required!** ✅

---

## 📊 File Mapping

| Old Location | New Location |
|--------------|--------------|
| stage1_train.py | stage1/train.py |
| stage1_evaluate.py | stage1/evaluate.py |
| stage1_export_onnx.py | stage1/export_onnx.py |
| test_stage1.py | stage1/test_inference.py |
| stage2_train.py | stage2/train.py |
| test_stage2_data.py | stage2/test_data.py |

---

## ✅ What Changed
- ✓ Directory structure created
- ✓ Files moved to folders
- ✓ Artifacts organized
- ✓ Clear separation

## ❌ What Didn't Change
- ✓ Model logic
- ✓ Functionality
- ✓ Functions/classes
- ✓ Internal code

---

## 🎯 Key Benefits

1. **Clear Separation** - Stage 1 and Stage 2 isolated
2. **Better Organization** - Easy to find files
3. **Independent Development** - Work on stages separately
4. **Scalable** - Easy to add more stages

---

**Status:** ✅ Complete  
**Date:** March 30, 2026
