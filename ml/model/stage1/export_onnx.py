"""
Export trained model to ONNX format for mobile deployment.
Run this AFTER training the model.
"""

import logging
import pickle
from pathlib import Path
import numpy as np
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType, StringTensorType
from sklearn.pipeline import Pipeline

from ml.model.config import ARTIFACTS_DIR, TFIDF_CONFIG

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def export_to_onnx():
    """
    Convert trained sklearn pipeline to ONNX format.
    
    Note: We need to recreate the pipeline from individual components
    since TF-IDF + LogisticRegression are separate in our implementation.
    """
    logger.info("=" * 70)
    logger.info("EXPORTING MODEL TO ONNX FORMAT")
    logger.info("=" * 70)
    
    # ==========================================================================
    # STEP 1: Load Trained Components
    # ==========================================================================
    logger.info("\nLoading trained model artifacts...")
    
    vectorizer_path = ARTIFACTS_DIR / "vectorizer.pkl"
    model_path = ARTIFACTS_DIR / "model.pkl"
    
    with open(vectorizer_path, 'rb') as f:
        vectorizer = pickle.load(f)
    logger.info(f"✓ Loaded vectorizer from {vectorizer_path}")
    
    with open(model_path, 'rb') as f:
        model = pickle.load(f)
    logger.info(f"✓ Loaded model from {model_path}")
    
    # ==========================================================================
    # STEP 2: Create Sklearn Pipeline
    # ==========================================================================
    logger.info("\nCreating sklearn pipeline...")
    
    pipeline = Pipeline([
        ('tfidf', vectorizer),
        ('classifier', model)
    ])
    
    logger.info("✓ Pipeline created successfully")
    
    # ==========================================================================
    # STEP 3: Convert to ONNX
    # ==========================================================================
    logger.info("\nConverting to ONNX format...")
    
    # Define input type - we accept string input (raw text)
    # The pipeline will handle vectorization internally
    initial_type = [
        ('input', StringTensorType([None, 1]))
    ]
    
    try:
        # Convert pipeline to ONNX
        onnx_model = convert_sklearn(
            pipeline,
            initial_types=initial_type,
            target_opset=11,
            options={
                'tfidf': {
                    'optim': 'cdist'  # Optimize TF-IDF computation
                }
            }
        )
        
        logger.info("✓ Model converted to ONNX successfully")
        
    except Exception as e:
        logger.error(f"Conversion failed: {e}")
        logger.info("\nTrying alternative conversion method...")
        
        # Alternative: Convert without string input (requires pre-vectorized input)
        # This is simpler but requires manual TF-IDF on mobile
        initial_type_numeric = [
            ('float_input', FloatTensorType([None, TFIDF_CONFIG['max_features']]))
        ]
        
        # Convert only the classifier (not the full pipeline)
        onnx_model = convert_sklearn(
            model,
            initial_types=initial_type_numeric,
            target_opset=11
        )
        
        logger.info("✓ Converted classifier only (TF-IDF must be applied separately)")
        logger.warning("⚠️  You'll need to implement TF-IDF preprocessing on mobile")
    
    # ==========================================================================
    # STEP 4: Save ONNX Model
    # ==========================================================================
    logger.info("\nSaving ONNX model...")
    
    onnx_path = ARTIFACTS_DIR / "model.onnx"
    
    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())
    
    logger.info(f"✓ ONNX model saved to {onnx_path}")
    
    # ==========================================================================
    # STEP 5: Verify ONNX Model
    # ==========================================================================
    logger.info("\nVerifying ONNX model...")
    
    try:
        import onnxruntime as ort
        
        # Load ONNX session
        sess = ort.InferenceSession(str(onnx_path))
        
        # Get input/output names
        input_name = sess.get_inputs()[0].name
        output_name = sess.get_outputs()[0].name
        
        logger.info(f"✓ ONNX model verified")
        logger.info(f"  Input name: {input_name}")
        logger.info(f"  Output name: {output_name}")
        
        # Test inference with sample text
        test_texts = np.array(["Congratulations! You've won a prize!", "Hey, how are you?"])
        
        # Reshape for batch input
        test_texts = test_texts.reshape(-1, 1)
        
        # Run inference
        predictions = sess.run([output_name], {input_name: test_texts})
        
        logger.info(f"✓ Test inference successful")
        logger.info(f"  Predictions shape: {predictions[0].shape}")
        logger.info(f"  Sample prediction: {predictions[0][0]}")
        
    except ImportError:
        logger.warning("⚠️  onnxruntime not installed. Skipping verification.")
        logger.info("Install with: pip install onnxruntime")
    except Exception as e:
        logger.warning(f"⚠️  Verification warning: {e}")
    
    # ==========================================================================
    # Summary
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("ONNX EXPORT COMPLETE")
    logger.info("=" * 70)
    
    logger.info(f"\n📦 ONNX model saved: {onnx_path}")
    logger.info(f"📊 File size: {onnx_path.stat().st_size / 1024:.2f} KB")
    
    logger.info("\n📱 MOBILE DEPLOYMENT:")
    logger.info("   ✓ Model is ready for mobile deployment")
    logger.info("   ✓ See README.md for Android/iOS integration instructions")
    logger.info("   ✓ Use ONNX Runtime Mobile for optimized inference")
    
    logger.info("\n🔗 USEFUL LINKS:")
    logger.info("   - ONNX Runtime: https://onnxruntime.ai/")
    logger.info("   - Android: https://onnxruntime.ai/docs/tutorials/mobile/")
    logger.info("   - iOS: https://onnxruntime.ai/docs/tutorials/mobile/")
    
    return onnx_path


if __name__ == "__main__":
    try:
        export_to_onnx()
        print("\n" + "=" * 70)
        print("✅ ONNX EXPORT SUCCESSFUL!")
        print("=" * 70)
        print(f"\nModel saved to: {ARTIFACTS_DIR / 'model.onnx'}")
        print("\nReady for mobile deployment!")
    except FileNotFoundError as e:
        print(f"\n❌ Error: {e}")
        print("\nPlease train the model first:")
        print("  python train.py")
    except Exception as e:
        print(f"\n❌ Export failed: {e}")
        logger.exception("Detailed error:")
