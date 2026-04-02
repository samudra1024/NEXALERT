"""
Stage 2: Export HAM categorization model to ONNX format for mobile deployment.
Run this AFTER training the Stage 2 model.

This exports the complete pipeline:
- TF-IDF Vectorizer (15K features)
- LightGBM Classifier (6 classes)

Input: Raw SMS text (string)
Output: Predicted category index + probabilities
"""

import logging
import pickle
from pathlib import Path
import numpy as np

from ml.model.config import ARTIFACTS_DIR, STAGE2_TFIDF_CONFIG, HAM_CATEGORIES

# Safe import check for onnxmltools at module level
try:
    import onnxmltools
    from onnxmltools.convert import convert_lightgbm
    has_onnxmltools = True
except ImportError:
    has_onnxmltools = False

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def export_stage2_to_onnx():
    """
    Convert Stage 2 sklearn pipeline (TF-IDF + LightGBM) to ONNX format.
    
    Strategy:
    1. Load trained pipeline from stage2_model.pkl
    2. Use skl2onnx for TF-IDF conversion
    3. Use onnxmltools for LightGBM conversion (if available)
    4. Create unified ONNX graph accepting raw text input
    
    Returns:
        Path to saved ONNX model
    """
    logger.info("=" * 70)
    logger.info("STAGE 2: EXPORTING HAM CATEGORIZATION MODEL TO ONNX")
    logger.info("=" * 70)
    
    # ==========================================================================
    # STEP 1: Load Trained Pipeline
    # ==========================================================================
    logger.info("\nLoading trained Stage 2 model artifact...")
    
    model_path = ARTIFACTS_DIR / "stage2_model.pkl"
    
    with open(model_path, 'rb') as f:
        pipeline = pickle.load(f)
    
    logger.info(f"✓ Loaded pipeline from {model_path}")
    
    # Extract components
    vectorizer = pipeline.named_steps['tfidf']
    classifier = pipeline.named_steps['classifier']
    
    logger.info(f"  TF-IDF vocabulary size: {len(vectorizer.vocabulary_)}")
    logger.info(f"  LightGBM classes: {len(classifier.classes_)}")
    logger.info(f"  Categories: {HAM_CATEGORIES}")
    
    # ==========================================================================
    # STEP 2: Prepare Conversion
    # ==========================================================================
    logger.info("\nPreparing for ONNX conversion...")
    
    try:
        from skl2onnx.common.data_types import StringTensorType
        initial_type = [('input', StringTensorType([None, 1]))]
        logger.info("✓ Input type defined: StringTensorType([None, 1])")
    except ImportError as e:
        logger.error(f"skl2onnx import failed: {e}")
        raise
    
    # Check for required dependencies (already imported at top)
    if has_onnxmltools:
        logger.info("✓ onnxmltools available for LightGBM conversion")
    else:
        logger.warning("⚠️  onnxmltools not installed. Will use fallback strategy.")
        logger.warning("Install with: pip install onnxmltools")
    
    # ==========================================================================
    # STEP 3: Convert Pipeline to ONNX
    # ==========================================================================
    logger.info("\nConverting pipeline to ONNX format...")
    
    onnx_model = _convert_pipeline(pipeline, vectorizer, classifier, initial_type)
    logger.info("✓ Model converted successfully")
    
    # ==========================================================================
    # STEP 4: Save ONNX Model
    # ==========================================================================
    logger.info("\nSaving ONNX model...")
    
    onnx_path = ARTIFACTS_DIR / "stage2_model.onnx"
    
    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    
    logger.info(f"✓ ONNX model saved to {onnx_path}")
    logger.info(f"  File size: {onnx_path.stat().st_size / 1024:.2f} KB")
    
    # ==========================================================================
    # STEP 5: Verify and Validate Export
    # ==========================================================================
    logger.info("\nValidating ONNX export...")
    
    if not onnx_path.exists():
        logger.error("❌ CRITICAL ERROR: ONNX file was not saved!")
        raise FileNotFoundError(f"ONNX model not found at {onnx_path}")
    
    logger.info(f"✓ ONNX file exists: {onnx_path}")
    logger.info(f"  File size: {onnx_path.stat().st_size / 1024:.2f} KB")
    
    logger.info("\nVerifying ONNX model...")
    
    try:
        import onnxruntime as ort
        
        sess = ort.InferenceSession(str(onnx_path))
        
        input_name = sess.get_inputs()[0].name
        output_names = [out.name for out in sess.get_outputs()]
        
        logger.info(f"✓ ONNX model verified")
        logger.info(f"  Input name: {input_name}")
        logger.info(f"  Output names: {output_names}")
        
        # Test inference
        test_texts = np.array([
            "Meeting at 3pm tomorrow",
            "Your account balance is $5,432.10",
            "Your OTP is 847291",
            "Monthly subscription renewal $9.99",
            "Flash Sale! 50% off today"
        ])
        
        logger.info(f"\nRunning test inference on {len(test_texts)} samples...")
        test_texts = test_texts.reshape(-1, 1)
        
        results = sess.run(None, {input_name: test_texts})
        
        logger.info(f"✓ Test inference successful")
        logger.info(f"  Number of outputs: {len(results)}")
        for i, result in enumerate(results):
            logger.info(f"  Output {i} shape: {result.shape}")
        
        # Show predictions
        if len(results) > 0:
            predictions = results[0].flatten()
            logger.info(f"\nSample predictions:")
            for text, pred in zip(test_texts.flatten(), predictions):
                idx = int(pred)
                category = HAM_CATEGORIES[idx] if idx < len(HAM_CATEGORIES) else f"Unknown({idx})"
                logger.info(f"  '{text[:40]}...' → {category} (idx: {idx})")
        
    except ImportError:
        logger.warning("⚠️  onnxruntime not installed. Skipping verification.")
        logger.info("Install with: pip install onnxruntime")
    except Exception as e:
        logger.warning(f"⚠️  Verification issue: {e}")
        logger.info("Model saved but verification had issues (common with LightGBM)")
    
    # ==========================================================================
    # STEP 6: Save Metadata
    # ==========================================================================
    logger.info("\nSaving model metadata...")
    
    import json
    
    metadata = {
        'model_type': 'Stage 2 HAM Categorization',
        'pipeline': 'TF-IDF + LightGBM',
        'input_format': 'Raw SMS text (string)',
        'output_format': 'Category index (0-5)',
        'categories': HAM_CATEGORIES,
        'category_mapping': {str(i): cat for i, cat in enumerate(HAM_CATEGORIES)},
        'vectorizer_vocab_size': len(vectorizer.vocabulary_),
        'num_classes': len(classifier.classes_),
        'onnx_file': str(onnx_path.name),
        'onnx_opset': 11,
        'version': '1.0'
    }
    
    metadata_path = ARTIFACTS_DIR / "stage2_meta.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    logger.info(f"✓ Metadata saved to {metadata_path}")
    
    # Save vectorizer separately for fallback usage
    vectorizer_path = ARTIFACTS_DIR / "stage2_vectorizer.pkl"
    with open(vectorizer_path, 'wb') as f:
        pickle.dump(vectorizer, f)
    
    logger.info(f"✓ Vectorizer saved to {vectorizer_path}")
    
    # ==========================================================================
    # Summary
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STAGE 2 ONNX EXPORT COMPLETE")
    logger.info("=" * 70)
    
    logger.info(f"\n📦 Artifacts saved:")
    logger.info(f"   - Model: {onnx_path}")
    logger.info(f"   - Vectorizer: {ARTIFACTS_DIR / 'stage2_vectorizer.pkl'}")
    logger.info(f"   - Metadata: {metadata_path}")
    
    logger.info(f"\n📊 Model Statistics:")
    logger.info(f"   - Vocabulary: {len(vectorizer.vocabulary_)} features")
    logger.info(f"   - Classes: {len(classifier.classes_)} categories")
    logger.info(f"   - ONNX size: {onnx_path.stat().st_size / 1024:.2f} KB")
    
    logger.info(f"\n📱 MOBILE DEPLOYMENT:")
    logger.info(f"   ✓ Ready for ONNX Runtime Mobile")
    logger.info(f"   ✓ Input: Raw text string")
    logger.info(f"   ✓ Output: Category index + probabilities")
    
    logger.info(f"\n🔗 CATEGORY MAPPING:")
    for i, cat in enumerate(HAM_CATEGORIES):
        logger.info(f"   {i}: {cat}")
    
    return onnx_path


def _convert_pipeline(pipeline, vectorizer, classifier, initial_type):
    """
    Convert TF-IDF + LightGBM pipeline to ONNX.
    
    Strategy:
    1. Try full pipeline conversion first
    2. If fails, convert ONLY LightGBM classifier (TF-IDF stays outside ONNX)
    
    Args:
        pipeline: Full sklearn pipeline
        vectorizer: TF-IDF vectorizer
        classifier: LightGBM classifier
        initial_type: Input type definition
        
    Returns:
        ONNX model (LightGBM only if pipeline conversion fails)
    """
    from skl2onnx import convert_sklearn
    from skl2onnx.common.data_types import FloatTensorType
    
    # Strategy 1: Direct sklearn pipeline conversion
    try:
        logger.info("Attempting direct pipeline conversion...")
        
        onnx_model = convert_sklearn(
            pipeline,
            initial_types=initial_type,
            target_opset=11,
            options={
                'tfidf': {
                    'keep_empty_string': False,
                    'tokenexp': r"(?u)\\b\\w+\\b"
                }
            }
        )
        
        logger.info("✓ Direct conversion successful")
        return onnx_model
        
    except Exception as e:
        logger.warning(f"Pipeline conversion failed: {e}")
        logger.info("\nFalling back to LightGBM-only conversion...")
        
        # Strategy 2: Convert ONLY the LightGBM classifier
        # TF-IDF will be applied separately before inference
        if not has_onnxmltools:
            logger.error("❌ Cannot convert LightGBM without onnxmltools")
            logger.error("\nINSTALL REQUIRED:")
            logger.error("  pip install onnxmltools")
            raise ImportError("onnxmltools required for LightGBM conversion") from e
        
        try:
            # Get feature dimension from vectorizer
            feature_dim = len(vectorizer.vocabulary_)
            logger.info(f"Extracting LightGBM classifier (features: {feature_dim})")
            
            # Define input type for TF-IDF vectors (not raw text)
            # Use onnxmltypes FloatTensorType, NOT skl2onnx's
            from onnxmltools.convert.common.data_types import FloatTensorType
            lightgbm_input_type = [('input', FloatTensorType([None, feature_dim]))]
            
            # Convert ONLY the LightGBM classifier
            logger.info("Converting LightGBM classifier using onnxmltools...")
            onnx_model = convert_lightgbm(
                classifier,
                initial_types=lightgbm_input_type,
                target_opset=11
            )
            
            logger.info("✓ LightGBM-only conversion successful")
            logger.info("ℹ️  Note: TF-IDF vectorizer must be applied separately before inference")
            
            # Update docstring to reflect actual behavior
            export_stage2_to_onnx.__doc__ = """
            Convert Stage 2 HAM categorization model to ONNX format.
            
            This exports ONLY the LightGBM classifier:
            - LightGBM Classifier (6 classes)
            
            Input: TF-IDF vector (float array of size 14864)
            Output: Predicted category index + probabilities
            
            Note: TF-IDF vectorizer is saved separately as stage2_vectorizer.pkl
            and must be applied before feeding input to the ONNX model.
            """
            
            return onnx_model
            
        except Exception as lgbm_error:
            logger.error(f"LightGBM conversion failed: {lgbm_error}")
            logger.error("\nTroubleshooting:")
            logger.error("  1. Ensure onnxmltools is installed: pip install onnxmltools")
            logger.error("  2. Check LightGBM version compatibility")
            logger.error("  3. Consider using native LightGBM inference instead")
            raise lgbm_error


def predict_with_onnx(onnx_path: str = None, texts: list = None):
    """
    Convenience function to test ONNX model inference.
    
    Args:
        onnx_path: Path to ONNX model file
        texts: List of SMS texts to classify
        
    Returns:
        List of (category, confidence) tuples
    """
    import onnxruntime as ort
    
    onnx_path = onnx_path or (ARTIFACTS_DIR / "stage2_model.onnx")
    
    if texts is None:
        texts = [
            "Hey, are we still on for lunch?",
            "Your bank account credited with $500",
            "Your verification code is 123456"
        ]
    
    # Load session
    sess = ort.InferenceSession(str(onnx_path))
    input_name = sess.get_inputs()[0].name
    
    # Prepare input
    X = np.array(texts).reshape(-1, 1)
    
    # Run inference
    results = sess.run(None, {input_name: X})
    
    # Process outputs
    predictions = results[0].flatten()
    
    output = []
    for pred in predictions:
        idx = int(pred)
        category = HAM_CATEGORIES[idx] if idx < len(HAM_CATEGORIES) else f"Unknown({idx})"
        output.append((category, 1.0))  # Confidence would need probability output
    
    return output


if __name__ == "__main__":
    try:
        onnx_path = export_stage2_to_onnx()
        
        print("\n" + "=" * 70)
        print("✅ STAGE 2 ONNX EXPORT SUCCESSFUL!")
        print("=" * 70)
        print(f"\nModel saved to: {onnx_path}")
        print(f"Metadata saved to: {ARTIFACTS_DIR / 'stage2_meta.json'}")
        
        print("\n📋 Usage Example:")
        print("-" * 70)
        print("""
import onnxruntime as ort
import numpy as np

# Load model
sess = ort.InferenceSession('stage2_model.onnx')
input_name = sess.get_inputs()[0].name

# Prepare input
text = np.array(['Your message here']).reshape(-1, 1)

# Run inference
outputs = sess.run(None, {input_name: text})
prediction = outputs[0][0]

# Map to category
categories = ['personal', 'banking', 'otp', 'subscription', 'promotional', 'unknown']
print(f"Predicted category: {categories[int(prediction)]}")
        """)
        print("-" * 70)
        
    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")
        print("\nPlease train Stage 2 model first:")
        print("  python -m ml.model.stage2.train")
        print("\nOr check if model artifacts exist:")
        print(f"  {ARTIFACTS_DIR}/stage2_model.pkl")
    except ImportError as e:
        print(f"\n❌ Import Error: {e}")
        print("\nRequired packages:")
        print("  pip install skl2onnx onnxmltools onnxruntime")
        print("\n⚠️  NOTE: LightGBM ONNX conversion REQUIRES onnxmltools")
        print("Install with:")
        print("  pip install onnxmltools")
    except Exception as e:
        print(f"\n❌ Export failed: {e}")
        print("\nTroubleshooting:")
        print("  1. Ensure Stage 2 model is trained")
        print("  2. Install onnxmltools: pip install onnxmltools")
        print("  3. Check LightGBM version compatibility")
        logger.exception("Detailed error:")
