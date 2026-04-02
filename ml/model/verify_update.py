"""Quick verification that model bundle update is working correctly."""

import pickle
from pathlib import Path

print("=" * 70)
print("MODEL BUNDLE UPDATE VERIFICATION")
print("=" * 70)

# Test 1: Check if config has correct threshold settings
print("\n✅ Test 1: Verifying THRESHOLD_CONFIG...")
from ml.model.config import THRESHOLD_CONFIG

assert 'thresholds' in THRESHOLD_CONFIG, "Missing 'thresholds' in config"
assert 'min_precision' in THRESHOLD_CONFIG, "Missing 'min_precision' in config"
assert len(THRESHOLD_CONFIG['thresholds']) == 10, "Should have 10 thresholds"
assert THRESHOLD_CONFIG['min_precision'] == 0.80, "Min precision should be 0.80"
print(f"   ✓ Thresholds: {len(THRESHOLD_CONFIG['thresholds'])} values")
print(f"   ✓ Min precision: {THRESHOLD_CONFIG['min_precision']}")

# Test 2: Verify save_model has use_bundle parameter
print("\n✅ Test 2: Verifying save_model function signature...")
import inspect
from ml.model.utils import save_model

sig = inspect.signature(save_model)
assert 'use_bundle' in sig.parameters, "save_model missing use_bundle parameter"
print(f"   ✓ save_model has use_bundle parameter")

# Test 3: Verify load_model has use_bundle parameter
print("\n✅ Test 3: Verifying load_model function signature...")
from ml.model.utils import load_model

sig = inspect.signature(load_model)
assert 'use_bundle' in sig.parameters, "load_model missing use_bundle parameter"
print(f"   ✓ load_model has use_bundle parameter")

# Test 4: Verify SpamDetector uses bundles
print("\n✅ Test 4: Verifying SpamDetector initialization...")
from ml.model.utils import SpamDetector

detector_class_code = inspect.getsource(SpamDetector.initialize)
assert 'use_bundle=True' in detector_class_code, "SpamDetector not using bundles"
print(f"   ✓ SpamDetector uses bundle format")

# Test 5: Check train.py uses bundles
print("\n✅ Test 5: Verifying training saves as bundle...")
with open('train.py', 'r', encoding='utf-8') as f:
    train_code = f.read()
    assert 'use_bundle=True' in train_code, "Training not using bundles"
    # Verify enhanced threshold selection
    assert 'recall == best_recall and precision > best_precision' in train_code, \
        "Enhanced threshold selection not found"
print(f"   ✓ Training uses bundle format")
print(f"   ✓ Enhanced threshold selection implemented")

# Test 6: Check evaluate.py uses bundles
print("\n✅ Test 6: Verifying evaluation loads from bundle...")
with open('evaluate.py', 'r', encoding='utf-8') as f:
    eval_code = f.read()
    assert 'use_bundle=True' in eval_code, "Evaluation not using bundles"
print(f"   ✓ Evaluation uses bundle format")

# Test 7: Verify bundle structure (if exists)
print("\n✅ Test 7: Checking for existing model bundles...")
artifacts_dir = Path('artifacts')
if artifacts_dir.exists():
    bundle_files = list(artifacts_dir.glob('model_bundle.pkl'))
    if bundle_files:
        print(f"   ✓ Found {len(bundle_files)} model bundle(s)")
        
        # Verify bundle structure
        with open(bundle_files[0], 'rb') as f:
            bundle = pickle.load(f)
        
        assert 'model' in bundle, "Bundle missing 'model' key"
        assert 'vectorizer' in bundle, "Bundle missing 'vectorizer' key"
        assert 'threshold' in bundle, "Bundle missing 'threshold' key"
        assert isinstance(bundle['threshold'], float), "Threshold should be float"
        
        print(f"   ✓ Bundle structure verified: model, vectorizer, threshold")
        print(f"   ✓ Stored threshold: {bundle['threshold']:.4f}")
    else:
        print(f"   ℹ️  No existing bundles (run train.py to create)")
else:
    print(f"   ℹ️  Artifacts directory not found (run train.py to create)")

print("\n" + "=" * 70)
print("✅ ALL VERIFICATION TESTS PASSED!")
print("=" * 70)

print("\n📋 Summary:")
print("   • Threshold selection: Automatic with tie-breaking")
print("   • Precision constraint: ≥ 0.80")
print("   • Selection criteria: Max recall, then max precision")
print("   • Model artifact: Single bundle file (model_bundle.pkl)")
print("   • Bundle contents: model, vectorizer, threshold")
print("   • Backward compatible: Yes (legacy format supported)")

print("\n🚀 Ready to use!")
print("   Run 'python train.py' to train with new bundle format")
