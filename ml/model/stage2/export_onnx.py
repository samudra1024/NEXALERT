"""
Export trained Stage 2 (HAM Categorization) model to ONNX format.

ROOT CAUSE ANALYSIS (Fixed in this script):
============================================

Problem 1: skl2onnx MissingShapeCalculator for LGBMClassifier
  - skl2onnx has NO built-in converter for lightgbm.sklearn.LGBMClassifier
  - Calling convert_sklearn(pipeline) raises:
      MissingShapeCalculator: Unable to find a shape calculator for
      type '<class 'lightgbm.sklearn.LGBMClassifier'>'
  - This is not a missing dependency issue — LightGBM is not in skl2onnx's
    supported operator set by design. It requires a separate converter.

Problem 2: onnxmltools is the correct LightGBM converter
  - onnxmltools.convert.convert_lightgbm() correctly converts LGBMClassifier
  - BUT it produces ONNX IR version 4, opset 8 — incompatible with skl2onnx's
    output (IR version 6-7, opset 11+)

Problem 3: sklearn 1.3 -> 1.9 idf_ AttributeError (same as Stage 1)
  - TfidfTransformer._idf_diag exists but idf_ attribute is missing after
    loading a sklearn 1.3 pickle in sklearn 1.9

Fix Strategy:
  1. Patch idf_ on the loaded vectorizer (same as Stage 1 fix)
  2. Convert TF-IDF step alone using skl2onnx (opset 11, Pipeline trick)
  3. Convert LightGBM alone using onnxmltools.convert_lightgbm (opset 11)
  4. Harmonize ONNX IR version and opset declarations between both sub-models
  5. Stitch together using onnx.compose.merge_models with prefix namespacing
     to avoid node name collisions (specifically duplicate 'Identity' nodes)
  6. Rename prefixed I/O names back to clean 'input', 'output_label', etc.
  7. Validate merged model with OnnxRuntime

Full Pipeline ONNX (String Input):
  - Contains TF-IDF preprocessing + LightGBM inference in one ONNX graph
  - Input:  tensor(string), shape=[N] — raw SMS text from Android
  - Output: output_label (string: category name), output_probability (map)
"""

import logging
import pickle
import warnings
from pathlib import Path

import numpy as np
import onnx
from onnx.compose import merge_models

from ml.model.config import ARTIFACTS_DIR, HAM_CATEGORIES

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def _fix_idf_compatibility(vectorizer):
    """
    Fix sklearn 1.3 -> 1.9 pickle compatibility for TfidfVectorizer.

    See Stage 1 export_onnx.py for full explanation.
    """
    tfidf_transformer = vectorizer._tfidf
    if hasattr(tfidf_transformer, '_idf_diag') and not hasattr(tfidf_transformer, 'idf_'):
        idf_array = np.asarray(tfidf_transformer._idf_diag.diagonal()).flatten()
        tfidf_transformer.idf_ = idf_array
        logger.info(f"Patched idf_: shape={idf_array.shape}")
        return True
    elif hasattr(tfidf_transformer, 'idf_'):
        logger.info(f"idf_ already present: shape={tfidf_transformer.idf_.shape}")
        return False
    else:
        raise AttributeError(
            "TfidfTransformer has neither _idf_diag nor idf_. "
            "Model may be corrupt or from an unsupported sklearn version."
        )


def _harmonize_onnx_models(tfidf_onnx, lgbm_onnx):
    """
    Harmonize IR version and opset declarations between two ONNX models so
    that onnx.compose.merge_models can stitch them together.

    Args:
        tfidf_onnx: ONNX model from skl2onnx (IR=6, opset=11)
        lgbm_onnx:  ONNX model from onnxmltools (IR=4, opset=8)

    Returns:
        Harmonized lgbm_onnx (modified in-place, also returned for clarity).
    """
    # Set IR version to match tfidf model
    lgbm_onnx.ir_version = tfidf_onnx.ir_version

    # Fix opset versions: for each domain in lgbm_onnx, use tfidf_onnx's
    # version if available (avoids "different operator set ids" error)
    tfidf_opset_map = {op.domain: op.version for op in tfidf_onnx.opset_import}
    lgbm_opset_map = {op.domain: op.version for op in lgbm_onnx.opset_import}

    del lgbm_onnx.opset_import[:]
    for domain, version in lgbm_opset_map.items():
        entry = lgbm_onnx.opset_import.add()
        entry.domain = domain
        entry.version = tfidf_opset_map.get(domain, version)

    logger.info(f"Harmonized: tfidf IR={tfidf_onnx.ir_version} opsets={tfidf_opset_map}")
    logger.info(f"            lgbm  IR={lgbm_onnx.ir_version}  opsets={dict((op.domain, op.version) for op in lgbm_onnx.opset_import)}")
    return lgbm_onnx


def _rename_graph_input(model, old_name, new_name):
    """Rename a graph input and all references in node inputs."""
    for inp in model.graph.input:
        if inp.name == old_name:
            inp.name = new_name
    for node in model.graph.node:
        for i, inp in enumerate(node.input):
            if inp == old_name:
                node.input[i] = new_name
    return model


def _rename_graph_output(model, old_name, new_name):
    """Rename a graph output and all references in node outputs."""
    for out in model.graph.output:
        if out.name == old_name:
            out.name = new_name
    for node in model.graph.node:
        for i, out in enumerate(node.output):
            if out == old_name:
                node.output[i] = new_name
    return model


def _convert_tfidf_to_onnx(vectorizer, feature_dim):
    """Convert TF-IDF vectorizer to ONNX as a single-step pipeline."""
    from sklearn.pipeline import Pipeline
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import StringTensorType

    tfidf_pipeline = Pipeline([('tfidf', vectorizer)])
    tfidf_onnx = convert_sklearn(
        tfidf_pipeline,
        initial_types=[('input', StringTensorType([None]))],
        target_opset=11,
    )

    # Validate TF-IDF output shape
    output = tfidf_onnx.graph.output[0]
    output_name = output.name
    logger.info(f"TF-IDF ONNX output: {output_name}")
    logger.info(f"TF-IDF op_types: {sorted(set(n.op_type for n in tfidf_onnx.graph.node))}")

    return tfidf_onnx, output_name


def _convert_lgbm_to_onnx(classifier, feature_dim):
    """Convert LightGBM classifier to ONNX using onnxmltools."""
    try:
        from onnxmltools.convert import convert_lightgbm
        from onnxmltools.convert.common.data_types import FloatTensorType as OnnxMLFloat
    except ImportError:
        raise ImportError(
            "onnxmltools is required for LightGBM ONNX conversion.\n"
            "Install with: pip install onnxmltools"
        )

    lgbm_input_type = [('lgbm_input', OnnxMLFloat([None, feature_dim]))]
    lgbm_onnx = convert_lightgbm(
        classifier,
        initial_types=lgbm_input_type,
        target_opset=11,
    )
    input_name = lgbm_onnx.graph.input[0].name
    output_names = [o.name for o in lgbm_onnx.graph.output]
    logger.info(f"LightGBM ONNX input: {input_name}")
    logger.info(f"LightGBM ONNX outputs: {output_names}")

    return lgbm_onnx, input_name, output_names


def export_stage2_to_onnx():
    """
    Export Stage 2 HAM Categorization pipeline to ONNX format.

    Pipeline: TF-IDF (14864 features) -> LightGBM (6-class multiclass)
    Input:    tensor(string), shape=[N]        — raw SMS text
    Output:   output_label (string: category), output_probability (map)

    Returns:
        Path to the saved ONNX model file.
    """
    logger.info("=" * 70)
    logger.info("STAGE 2: EXPORTING HAM CATEGORIZATION MODEL TO ONNX")
    logger.info("=" * 70)

    # =========================================================================
    # STEP 1: Load Trained Pipeline
    # =========================================================================
    logger.info("\nLoading Stage 2 pipeline...")

    model_path = ARTIFACTS_DIR / "stage2_model.pkl"
    if not model_path.exists():
        raise FileNotFoundError(
            f"Stage 2 model not found: {model_path}\n"
            "Run: python -m ml.model.stage2.train"
        )

    with open(model_path, 'rb') as f:
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            pipeline = pickle.load(f)

    vectorizer = pipeline.named_steps['tfidf']
    classifier = pipeline.named_steps['classifier']
    feature_dim = len(vectorizer.vocabulary_)

    logger.info(f"Loaded pipeline: TfidfVectorizer + {type(classifier).__name__}")
    logger.info(f"  TF-IDF vocab size: {feature_dim}")
    logger.info(f"  LightGBM classes:  {list(classifier.classes_)}")

    # =========================================================================
    # STEP 2: Fix sklearn Version Compatibility (Root Cause Fix #1)
    # =========================================================================
    logger.info("\nFixing sklearn version compatibility...")
    _fix_idf_compatibility(vectorizer)

    # =========================================================================
    # STEP 3: Convert TF-IDF to ONNX (Root Cause Fix #2 — separate conversion)
    # =========================================================================
    logger.info("\nConverting TF-IDF to ONNX (skl2onnx)...")
    tfidf_onnx, tfidf_output_name = _convert_tfidf_to_onnx(vectorizer, feature_dim)
    logger.info("TF-IDF ONNX conversion successful")

    # =========================================================================
    # STEP 4: Convert LightGBM to ONNX (onnxmltools — only correct tool)
    # =========================================================================
    logger.info("\nConverting LightGBM to ONNX (onnxmltools)...")
    lgbm_onnx, lgbm_input_name, lgbm_output_names = _convert_lgbm_to_onnx(
        classifier, feature_dim
    )
    logger.info("LightGBM ONNX conversion successful")

    # =========================================================================
    # STEP 5: Harmonize IR/Opset Versions (Root Cause Fix #3)
    # =========================================================================
    logger.info("\nHarmonizing ONNX IR and opset versions...")
    lgbm_onnx = _harmonize_onnx_models(tfidf_onnx, lgbm_onnx)

    # =========================================================================
    # STEP 6: Stitch Sub-models (Root Cause Fix #4 — use prefix to avoid name collision)
    # =========================================================================
    logger.info("\nStitching TF-IDF + LightGBM ONNX graphs...")

    # Use prefixes to avoid node name collisions (e.g. duplicate 'Identity' nodes)
    merged = merge_models(
        tfidf_onnx,
        lgbm_onnx,
        io_map=[(tfidf_output_name, lgbm_input_name)],
        prefix1='tfidf_',
        prefix2='lgbm_',
    )
    logger.info(f"Merge successful. IR={merged.ir_version}")

    # Fix prefixed I/O names back to clean names
    merged_inputs = [i.name for i in merged.graph.input]
    merged_outputs = [o.name for o in merged.graph.output]
    logger.info(f"Merged inputs before rename:  {merged_inputs}")
    logger.info(f"Merged outputs before rename: {merged_outputs}")

    if 'tfidf_input' in merged_inputs:
        merged = _rename_graph_input(merged, 'tfidf_input', 'input')
    if 'lgbm_label' in [o.name for o in merged.graph.output]:
        merged = _rename_graph_output(merged, 'lgbm_label', 'output_label')
    if 'lgbm_probabilities' in [o.name for o in merged.graph.output]:
        merged = _rename_graph_output(merged, 'lgbm_probabilities', 'output_probability')

    logger.info(f"Final inputs:  {[i.name for i in merged.graph.input]}")
    logger.info(f"Final outputs: {[o.name for o in merged.graph.output]}")

    # Validate op types include both TF-IDF and LightGBM nodes
    merged_op_types = set(n.op_type for n in merged.graph.node)
    logger.info(f"Merged ONNX op_types: {sorted(merged_op_types)}")
    if 'TfIdfVectorizer' not in merged_op_types:
        raise RuntimeError(
            "EXPORT VALIDATION FAILED: TfIdfVectorizer node missing from merged graph. "
            "TF-IDF preprocessing was not included."
        )
    if 'TreeEnsembleClassifier' not in merged_op_types:
        raise RuntimeError(
            "EXPORT VALIDATION FAILED: TreeEnsembleClassifier node missing from merged graph. "
            "LightGBM classifier was not included."
        )

    # =========================================================================
    # STEP 7: Save ONNX Model
    # =========================================================================
    logger.info("\nSaving ONNX model...")
    onnx_path = ARTIFACTS_DIR / "stage2_model.onnx"
    with open(onnx_path, "wb") as f:
        f.write(merged.SerializeToString())
    logger.info(f"Saved: {onnx_path} ({onnx_path.stat().st_size / 1024:.2f} KB)")

    # =========================================================================
    # STEP 8: Verify with OnnxRuntime
    # =========================================================================
    logger.info("\nVerifying with OnnxRuntime...")
    try:
        import onnxruntime as ort

        sess = ort.InferenceSession(str(onnx_path))
        inp = sess.get_inputs()[0]

        logger.info(f"  Input:  name={inp.name}, type={inp.type}, shape={inp.shape}")
        for out in sess.get_outputs():
            logger.info(f"  Output: name={out.name}, type={out.type}, shape={out.shape}")

        # Verify input is string type
        assert inp.type == 'tensor(string)', (
            f"CRITICAL: Input type must be tensor(string), got {inp.type}. "
            f"Android sends STRING, not FLOAT."
        )

        # Test inference with 1D string array (matching Android's arrayOf(message))
        test_texts = np.array([
            "Meeting at 3pm tomorrow",
            "Your account balance is 5432",
            "Your OTP is 847291",
            "Monthly subscription renewal 9.99",
            "Flash Sale 50 percent off today",
        ], dtype=object)

        results = sess.run(None, {inp.name: test_texts})
        logger.info(f"  Test predictions:")
        for text, pred in zip(test_texts, results[0]):
            logger.info(f"    '{text}' -> {pred}")
        logger.info("  OnnxRuntime verification passed")

    except ImportError:
        logger.warning("onnxruntime not installed — skipping verification")

    # =========================================================================
    # STEP 9: Save Metadata
    # =========================================================================
    logger.info("\nSaving model metadata...")
    import json
    metadata = {
        'model_type': 'Stage 2 HAM Categorization',
        'pipeline': 'TF-IDF + LightGBM (stitched ONNX)',
        'input_format': 'Raw SMS text (string)',
        'input_shape': '[N]  (1D, matches Android arrayOf(message))',
        'output_format': 'Category name (string)',
        'categories': HAM_CATEGORIES,
        'category_mapping': {str(i): cat for i, cat in enumerate(HAM_CATEGORIES)},
        'vectorizer_vocab_size': feature_dim,
        'num_classes': len(classifier.classes_),
        'onnx_file': 'stage2_model.onnx',
        'onnx_opset': 11,
        'tfidf_in_graph': True,
        'version': '2.0',
    }
    metadata_path = ARTIFACTS_DIR / "stage2_meta.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Metadata saved: {metadata_path}")

    # =========================================================================
    # Summary
    # =========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STAGE 2 ONNX EXPORT COMPLETE")
    logger.info("=" * 70)
    logger.info(f"\n  Model:              {onnx_path}")
    logger.info(f"  File size:          {onnx_path.stat().st_size / 1024:.2f} KB")
    logger.info(f"  Input name:         input")
    logger.info(f"  Input type:         tensor(string)")
    logger.info(f"  Input shape:        [N]  (1D — matches Android arrayOf(message))")
    logger.info(f"  TF-IDF in graph:    YES (TfIdfVectorizer op)")
    logger.info(f"  LightGBM in graph:  YES (TreeEnsembleClassifier op)")
    logger.info(f"  Output:             output_label (string: category name)")
    logger.info(f"                      output_probability (map<string, float>)")
    logger.info(f"  Categories:         {HAM_CATEGORIES}")

    return onnx_path


if __name__ == "__main__":
    try:
        onnx_path = export_stage2_to_onnx()
        print("\n" + "=" * 70)
        print("STAGE 2 ONNX EXPORT SUCCESSFUL")
        print("=" * 70)
        print(f"\nModel saved: {onnx_path}")
        print(f"File size:   {onnx_path.stat().st_size / 1024:.2f} KB")
        print("\nNEXT STEP: Copy to Android assets:")
        print(f"  copy {onnx_path} android\\app\\src\\main\\assets\\models\\v1\\stage2.onnx")
    except FileNotFoundError as e:
        print(f"\nError: {e}")
        print("\nTrain Stage 2 first:")
        print("  python -m ml.model.stage2.train")
    except ImportError as e:
        print(f"\nImport Error: {e}")
        print("\nInstall required packages:")
        print("  pip install skl2onnx onnxmltools onnxruntime")
    except Exception as e:
        print(f"\nExport failed: {e}")
        logger.exception("Detailed traceback:")
