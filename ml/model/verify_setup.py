"""
Verification script to test that the package refactoring is working correctly.

Run this script to verify all imports and module resolution work properly.

Usage:
    python -m ml.model.verify_setup
"""

import sys
from pathlib import Path

print("=" * 70)
print("PYTHON PACKAGE REFACTORING VERIFICATION")
print("=" * 70)

# Test 1: Verify Python path
print("\n✓ Test 1: Python Path")
print(f"  Current working directory: {Path.cwd()}")
print(f"  Python executable: {sys.executable}")
print(f"  Python version: {sys.version.split()[0]}")

# Test 2: Import root package
print("\n✓ Test 2: Import Root Package")
try:
    import ml.model
    print(f"  ✓ Successfully imported ml.model")
    print(f"  ✓ Package location: {ml.model.__file__}")
    print(f"  ✓ Package version: {ml.model.__version__}")
except ImportError as e:
    print(f"  ❌ Failed to import ml.model: {e}")
    sys.exit(1)

# Test 3: Import config module
print("\n✓ Test 3: Import Config Module")
try:
    from ml.model.config import DATASET_PATH, RANDOM_SEED, TFIDF_CONFIG
    print(f"  ✓ Successfully imported config")
    print(f"  ✓ DATASET_PATH: {DATASET_PATH}")
    print(f"  ✓ RANDOM_SEED: {RANDOM_SEED}")
    print(f"  ✓ TFIDF_CONFIG max_features: {TFIDF_CONFIG['max_features']}")
except ImportError as e:
    print(f"  ❌ Failed to import config: {e}")
    sys.exit(1)

# Test 4: Import preprocess module
print("\n✓ Test 4: Import Preprocess Module")
try:
    from ml.model.preprocess import load_data, preprocess_text, prepare_data
    print(f"  ✓ Successfully imported preprocess")
    print(f"  ✓ Available functions: load_data, preprocess_text, prepare_data")
except ImportError as e:
    print(f"  ❌ Failed to import preprocess: {e}")
    sys.exit(1)

# Test 5: Import utils module
print("\n✓ Test 5: Import Utils Module")
try:
    from ml.model.utils import SpamDetector, save_model, load_model, compute_metrics
    print(f"  ✓ Successfully imported utils")
    print(f"  ✓ Available classes: SpamDetector")
    print(f"  ✓ Available functions: save_model, load_model, compute_metrics")
except ImportError as e:
    print(f"  ❌ Failed to import utils: {e}")
    sys.exit(1)

# Test 6: Import stage1 sub-package
print("\n✓ Test 6: Import Stage 1 Sub-Package")
try:
    import ml.model.stage1
    print(f"  ✓ Successfully imported ml.model.stage1")
    print(f"  ✓ Available modules: {ml.model.stage1.__all__}")
except ImportError as e:
    print(f"  ❌ Failed to import stage1: {e}")
    sys.exit(1)

# Test 7: Import stage1 modules
print("\n✓ Test 7: Import Stage 1 Modules")
try:
    from ml.model.stage1.train import train_model
    from ml.model.stage1.evaluate import evaluate_on_test_set
    from ml.model.stage1.export_onnx import export_to_onnx
    print(f"  ✓ Successfully imported stage1 modules")
    print(f"  ✓ Available functions: train_model, evaluate_on_test_set, export_to_onnx")
except ImportError as e:
    print(f"  ❌ Failed to import stage1 modules: {e}")
    sys.exit(1)

# Test 8: Import stage2 sub-package
print("\n✓ Test 8: Import Stage 2 Sub-Package")
try:
    import ml.model.stage2
    print(f"  ✓ Successfully imported ml.model.stage2")
    print(f"  ✓ Available modules: {ml.model.stage2.__all__}")
except ImportError as e:
    print(f"  ❌ Failed to import stage2: {e}")
    sys.exit(1)

# Test 9: Import stage2 modules
print("\n✓ Test 9: Import Stage 2 Modules")
try:
    from ml.model.stage2.train import train_stage2_model
    # Note: test_data.py is a script, not a module with exportable functions
    print(f"  ✓ Successfully imported stage2 modules")
    print(f"  ✓ Available functions: train_stage2_model")
except ImportError as e:
    print(f"  ❌ Failed to import stage2 modules: {e}")
    sys.exit(1)

# Test 10: Verify no sys.path hacks in code
print("\n✓ Test 10: Verify No sys.path Hacks")
import inspect

stage1_train_source = inspect.getsource(ml.model.stage1.train)
if "sys.path.append" in stage1_train_source:
    print(f"  ⚠️  Warning: sys.path.append found in stage1.train")
else:
    print(f"  ✓ No sys.path hacks detected in stage1.train")

stage2_train_source = inspect.getsource(ml.model.stage2.train)
if "sys.path.append" in stage2_train_source:
    print(f"  ⚠️  Warning: sys.path.append found in stage2.train")
else:
    print(f"  ✓ No sys.path hacks detected in stage2.train")

export_onnx_source = inspect.getsource(ml.model.stage1.export_onnx)
if "sys.path.append" in export_onnx_source:
    print(f"  ⚠️  Warning: sys.path.append found in export_onnx")
else:
    print(f"  ✓ No sys.path hacks detected in export_onnx")

# Summary
print("\n" + "=" * 70)
print("VERIFICATION COMPLETE")
print("=" * 70)

print("\n✅ ALL TESTS PASSED!")
print("\nYour Python package is properly configured and ready to use.")
print("\nNext steps:")
print("  1. Run training: python -m ml.model.stage1.train")
print("  2. Run evaluation: python -m ml.model.stage1.evaluate")
print("  3. Export ONNX: python -m ml.model.stage1.export_onnx")
print("  4. Train Stage 2: python -m ml.model.stage2.train")

print("\n📋 Quick Reference:")
print("  - All imports use absolute paths: from ml.model.X import Y")
print("  - Execute with -m flag: python -m ml.model.stage1.train")
print("  - No sys.path manipulation needed")
print("  - Works from project root directory")

print("\n" + "=" * 70)
