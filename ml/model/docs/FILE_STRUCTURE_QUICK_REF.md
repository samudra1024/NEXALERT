# File Structure Quick Reference

## 📁 New File Names

### Stage 1 (Spam Detection)
- `stage1_train.py` - Train spam detection model
- `stage1_evaluate.py` - Evaluate spam detection
- `stage1_export_onnx.py` - Export to ONNX format
- `test_stage1.py` - Test spam detection inference

### Stage 2 (HAM Categorization)
- `stage2_train.py` - Train HAM categorization model
- `test_stage2_data.py` - Verify Stage 2 data handling

### Shared Modules
- `config.py` - Configuration for both stages
- `preprocess.py` - Data preprocessing
- `utils.py` - Utility functions

---

## 🚀 Quick Commands

### Train Models
```bash
# Stage 1: Spam Detection
python stage1_train.py

# Stage 2: HAM Categorization
python stage2_train.py
```

### Evaluate
```bash
# Stage 1 Evaluation
python stage1_evaluate.py

# Stage 1 ONNX Export
python stage1_export_onnx.py
```

### Test
```bash
# Stage 1 Inference Test
python test_stage1.py

# Stage 2 Data Verification
python test_stage2_data.py
```

---

## 📊 File Mapping

| Old Name | New Name |
|----------|----------|
| train.py | stage1_train.py |
| evaluate.py | stage1_evaluate.py |
| export_onnx.py | stage1_export_onnx.py |
| train_stage2.py | stage2_train.py |
| test_inference.py | test_stage1.py |
| verify_category_handling.py | test_stage2_data.py |

---

## ✅ What Changed
- ✓ File names only
- ✓ Clear organization
- ✓ Consistent naming
- ✓ No logic changes

## ❌ What Didn't Change
- ✓ Model logic
- ✓ Functionality
- ✓ Internal code
- ✓ Functions/classes

---

**Status:** ✅ Complete  
**Date:** March 30, 2026
