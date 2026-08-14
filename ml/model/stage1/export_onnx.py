"""
Export trained Stage 1 (Spam Detection) model to ONNX format.

ROOT CAUSE ANALYSIS (Fixed in this script):
============================================
Original failure: AttributeError: 'TfidfTransformer' object has no attribute 'idf_'

Cause:
  - Model was pickled with scikit-learn 1.3.0
  - Current environment has scikit-learn 1.9.0
  - In sklearn 1.3, TfidfTransformer stored IDF weights in _idf_diag (sparse diagonal matrix)
  - In sklearn 1.9, idf_ is a cached property backed differently; unpickling a 1.3 model
    sets _idf_diag but NOT the new idf_ cache -> AttributeError when skl2onnx reads idf_

  Secondary failure (in original script only): option 'optim' not in valid options for
  TfidfVectorizer — was removed in skl2onnx >= 1.17. Never pass unknown option keys.

Fix:
  - After loading the vectorizer, manually patch tfidf_transformer.idf_ = diagonal of _idf_diag
  - This re-creates the numpy array that skl2onnx expects without retraining anything

Full Pipeline ONNX (String Input):
  - Full sklearn Pipeline (TfIdfVectorizer -> LinearClassifier) exported
  - Input: tensor(string) shape=[N] — raw SMS text, directly from Android
  - Output: output_label (int64: 0=ham, 1=spam), output_probability (map)
"""

import logging
import pickle
import warnings
import json
from pathlib import Path

import numpy as np

from ml.model.config import ARTIFACTS_DIR

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _fix_idf_compatibility(vectorizer):
    """
    Fix sklearn 1.3 -> 1.9 pickle compatibility for TfidfVectorizer.

    In sklearn 1.3, TfidfTransformer stores IDF weights as a sparse diagonal
    matrix in _idf_diag. In sklearn 1.9, the idf_ property is backed differently.
    When a sklearn 1.3 model is loaded in sklearn 1.9, _idf_diag is restored but
    idf_ (the numpy array) is not — causing AttributeError in skl2onnx.

    This function patches the missing idf_ attribute without retraining.

    Args:
        vectorizer: Fitted TfidfVectorizer loaded from a pickle file.

    Returns:
        True if patch was applied, False if idf_ was already present.

    Raises:
        AttributeError: If neither _idf_diag nor idf_ is available.
    """
    tfidf_transformer = vectorizer._tfidf
    if hasattr(tfidf_transformer, '_idf_diag') and not hasattr(tfidf_transformer, 'idf_'):
        # Extract the diagonal of the sparse matrix -> shape [vocab_size]
        idf_array = np.asarray(tfidf_transformer._idf_diag.diagonal()).flatten()
        tfidf_transformer.idf_ = idf_array
        logger.info(f"Patched idf_ compatibility: shape={idf_array.shape}, dtype={idf_array.dtype}")
        return True
    elif hasattr(tfidf_transformer, 'idf_'):
        logger.info(f"idf_ already present: shape={tfidf_transformer.idf_.shape}")
        return False
    else:
        raise AttributeError(
            "TfidfTransformer has neither _idf_diag nor idf_. "
            "Model may be corrupt or from an unsupported sklearn version."
        )


def export_to_onnx():
    """
    Export Stage 1 Spam Detection pipeline to ONNX format.

    Pipeline: TF-IDF (5000 features) -> Logistic Regression (binary classifier)
    Input:    tensor(string), shape=[N]    — raw SMS text
    Output:   output_label (int64: 0=ham, 1=spam), output_probability

    Returns:
        Path to the saved ONNX model file.
    """
    logger.info("=" * 70)
    logger.info("STAGE 1: EXPORTING SPAM DETECTION MODEL TO ONNX")
    logger.info("=" * 70)

    # =========================================================================
    # STEP 1: Load Trained Artifacts
    # =========================================================================
    logger.info("\nLoading trained model artifacts...")

    bundle_path = ARTIFACTS_DIR / "model_bundle.pkl"
    vectorizer_path = ARTIFACTS_DIR / "vectorizer.pkl"
    model_path = ARTIFACTS_DIR / "model.pkl"
    threshold_path = ARTIFACTS_DIR / "threshold.json"

    if bundle_path.exists():
        with open(bundle_path, 'rb') as f:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                bundle = pickle.load(f)
        vectorizer = bundle['vectorizer']
        model = bundle['model']
        threshold = bundle['threshold']
        logger.info(f"Loaded model bundle: threshold={threshold:.4f}")
    elif vectorizer_path.exists() and model_path.exists():
        with open(vectorizer_path, 'rb') as f:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                vectorizer = pickle.load(f)
        logger.info(f"Loaded vectorizer: vocab_size={len(vectorizer.vocabulary_)}")

        with open(model_path, 'rb') as f:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                model = pickle.load(f)
        logger.info(f"Loaded model: {type(model).__name__}, classes={list(model.classes_)}")

        if threshold_path.exists():
            with open(threshold_path, 'r') as f:
                threshold = json.load(f)['threshold']
        else:
            threshold = 0.5
            logger.warning("threshold.json not found; defaulting to 0.5 for export logging")
    else:
        raise FileNotFoundError(
            f"Stage 1 artifacts not found in {ARTIFACTS_DIR}. "
            "Run: python -m ml.model.stage1.train"
        )

    with open(threshold_path, 'w') as f:
        json.dump({'threshold': threshold}, f)
    logger.info(f"Ensured threshold.json is present: {threshold:.4f}")

    # =========================================================================
    # STEP 2: Fix sklearn Version Compatibility (Root Cause Fix)
    # =========================================================================
    logger.info("\nFixing sklearn version compatibility (idf_ attribute patch)...")
    patched = _fix_idf_compatibility(vectorizer)
    if patched:
        logger.info("Applied idf_ patch for sklearn 1.3 -> 1.9 compatibility")

    # =========================================================================
    # STEP 3: Build sklearn Pipeline
    # =========================================================================
    logger.info("\nBuilding sklearn Pipeline (TF-IDF + Logistic Regression)...")
    from sklearn.pipeline import Pipeline
    pipeline = Pipeline([
        ('tfidf', vectorizer),
        ('classifier', model)
    ])
    logger.info("Pipeline created successfully")

    # =========================================================================
    # STEP 4: Convert to ONNX
    # =========================================================================
    logger.info("\nConverting to ONNX (full pipeline)...")

    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import StringTensorType

    # StringTensorType([None]) -> 1D string tensor
    # Matches Android: OnnxTensor.createTensor(ortEnv, arrayOf(message))
    initial_type = [('input', StringTensorType([None]))]

    onnx_model = convert_sklearn(
        pipeline,
        initial_types=initial_type,
        target_opset=12,
        # NOTE: Do NOT pass options with 'optim' key — removed in skl2onnx >= 1.17
    )

    # Validate ONNX graph contains TF-IDF preprocessing node
    op_types = set(n.op_type for n in onnx_model.graph.node)
    if 'TfIdfVectorizer' not in op_types:
        raise RuntimeError(
            f"EXPORT VALIDATION FAILED: ONNX graph is missing TfIdfVectorizer node.\n"
            f"Found ops: {sorted(op_types)}\n"
            f"This means TF-IDF preprocessing was not included. "
            f"The model would return wrong results."
        )

    logger.info(f"ONNX graph op_types: {sorted(op_types)}")
    logger.info("TfIdfVectorizer node confirmed present in ONNX graph")

    # =========================================================================
    # STEP 5: Save ONNX Model
    # =========================================================================
    logger.info("\nSaving ONNX model...")
    onnx_path = ARTIFACTS_DIR / "model.onnx"
    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    logger.info(f"Saved: {onnx_path} ({onnx_path.stat().st_size / 1024:.2f} KB)")

    # =========================================================================
    # STEP 6: Verify with OnnxRuntime
    # =========================================================================
    logger.info("\nVerifying with OnnxRuntime...")
    try:
        import onnxruntime as ort

        sess = ort.InferenceSession(str(onnx_path))
        inp = sess.get_inputs()[0]

        logger.info(f"  Input:  name={inp.name}, type={inp.type}, shape={inp.shape}")
        for out in sess.get_outputs():
            logger.info(f"  Output: name={out.name}, type={out.type}, shape={out.shape}")

        # Verify input type is string
        assert inp.type == 'tensor(string)', (
            f"CRITICAL: Input type must be tensor(string), got {inp.type}. "
            f"Android sends STRING, not FLOAT."
        )

        # Test inference with 1D array (matching Android's arrayOf(message))
        test_texts = np.array(
            ["Congratulations! You've won a free prize!", "Hey are you coming tonight?"],
            dtype=object
        )
        results = sess.run(None, {inp.name: test_texts})
        logger.info(f"  Test labels (0=ham, 1=spam): {results[0]}")
        logger.info("  OnnxRuntime verification passed")

    except ImportError:
        logger.warning("onnxruntime not installed — skipping verification")
        logger.info("Install with: pip install onnxruntime")

    # =========================================================================
    # Summary
    # =========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STAGE 1 ONNX EXPORT COMPLETE")
    logger.info("=" * 70)
    logger.info(f"\n  Model:            {onnx_path}")
    logger.info(f"  File size:        {onnx_path.stat().st_size / 1024:.2f} KB")
    logger.info(f"  Input name:       input")
    logger.info(f"  Input type:       tensor(string)")
    logger.info(f"  Input shape:      [N]  (1D — matches Android arrayOf(message))")
    logger.info(f"  TF-IDF in graph:  YES (TfIdfVectorizer op)")
    logger.info(f"  Output:           output_label (int64: 0=ham, 1=spam at ONNX default 0.5)")
    logger.info(f"                    output_probability (map<int64, float>)")
    logger.info(f"  Decision threshold: {threshold:.4f} (saved to threshold.json)")
    logger.info(f"  Android must apply: P(spam) >= {threshold:.4f}")

    return onnx_path


if __name__ == "__main__":
    try:
        onnx_path = export_to_onnx()
        print("\n" + "=" * 70)
        print("STAGE 1 ONNX EXPORT SUCCESSFUL")
        print("=" * 70)
        print(f"\nModel saved: {onnx_path}")
        print(f"File size:   {onnx_path.stat().st_size / 1024:.2f} KB")
        print("\nNEXT STEP: Copy to Android assets:")
        print(f"  copy {onnx_path} android\\app\\src\\main\\assets\\models\\v1\\stage1.onnx")
        print(f"  copy {ARTIFACTS_DIR / 'threshold.json'} android\\app\\src\\main\\assets\\models\\v1\\threshold.json")
    except FileNotFoundError as e:
        print(f"\nError: {e}")
        print("\nTrain the model first:")
        print("  python -m ml.model.stage1.train")
    except Exception as e:
        print(f"\nExport failed: {e}")
        logger.exception("Detailed traceback:")
