"""
Evaluation module for SMS Spam Detection.
Performs final evaluation on the held-out test set ONLY ONCE.
"""

import logging
import numpy as np

from config import DATASET_PATH, ARTIFACTS_DIR
from preprocess import prepare_data, load_data, preprocess_text, encode_labels
from utils import (
    load_model,
    save_metrics,
    compute_metrics,
    print_metrics_report
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def evaluate_on_test_set() -> dict:
    """
    Evaluate trained model on the held-out test set.
    
    CRITICAL RULES:
    1. Test set is accessed ONLY ONCE after training and threshold tuning
    2. NO model adjustments based on test performance
    3. Test metrics represent FINAL unbiased performance estimate
    
    Returns:
        Dictionary containing test set metrics
    """
    logger.info("=" * 70)
    logger.info("SMS SPAM DETECTION - TEST SET EVALUATION")
    logger.info("=" * 70)
    
    # ==========================================================================
    # STEP 1: Load Test Data
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 1: LOADING TEST DATA")
    logger.info("=" * 70)
    
    # Load full dataset
    df = load_data()
    
    # Preprocess text
    logger.info("Preprocessing text...")
    df['text'] = df['text'].apply(preprocess_text)
    
    # Encode labels
    df = encode_labels(df)
    
    # Split data to get test set (using same random seed as training)
    from sklearn.model_selection import train_test_split
    from config import TRAIN_SIZE, VAL_SIZE, TEST_SIZE, RANDOM_SEED
    
    X = df['text'].values
    y = df['label'].values
    
    # Reproduce the exact same split as in training
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y,
        test_size=TEST_SIZE,
        random_state=RANDOM_SEED,
        stratify=y
    )
    
    val_size_adjusted = VAL_SIZE / (TRAIN_SIZE + VAL_SIZE)
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp,
        test_size=val_size_adjusted,
        random_state=RANDOM_SEED,
        stratify=y_temp
    )
    
    logger.info(f"\n✓ Test set loaded: {len(X_test)} samples")
    logger.info(f"  Spam: {np.sum(y_test == 1)} ({np.sum(y_test == 1)/len(y_test)*100:.1f}%)")
    logger.info(f"  Ham:  {np.sum(y_test == 0)} ({np.sum(y_test == 0)/len(y_test)*100:.1f}%)")
    
    # ==========================================================================
    # STEP 2: Load Trained Model
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 2: LOADING TRAINED MODEL")
    logger.info("=" * 70)
    
    model, vectorizer, threshold = load_model(use_bundle=True)
    
    logger.info(f"\n✓ Model loaded successfully")
    logger.info(f"  Decision threshold: {threshold:.3f}")
    
    # ==========================================================================
    # STEP 3: Generate Predictions
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 3: GENERATING PREDICTIONS")
    logger.info("=" * 70)
    
    # Transform test set with TF-IDF vectorizer
    logger.info("Vectorizing test set...")
    X_test_tfidf = vectorizer.transform(X_test)
    logger.info(f"✓ Test matrix shape: {X_test_tfidf.shape}")
    
    # Get predictions using tuned threshold
    logger.info(f"Applying decision threshold: {threshold:.3f}")
    y_proba = model.predict_proba(X_test_tfidf)[:, 1]
    y_pred = (y_proba >= threshold).astype(int)
    
    logger.info(f"✓ Predictions generated")
    
    # ==========================================================================
    # STEP 4: Compute Metrics
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 4: COMPUTING EVALUATION METRICS")
    logger.info("=" * 70)
    
    metrics = compute_metrics(y_test, y_pred)
    
    # Add threshold info
    metrics['threshold'] = threshold
    metrics['model_type'] = 'Logistic Regression'
    metrics['vectorizer_type'] = 'TF-IDF'
    
    # ==========================================================================
    # STEP 5: Print Report
    # ==========================================================================
    print_metrics_report(metrics, y_test, y_pred)
    
    # ==========================================================================
    # STEP 6: Save Metrics
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 5: SAVING METRICS")
    logger.info("=" * 70)
    
    save_metrics(metrics)
    
    logger.info(f"✓ Metrics saved to: {ARTIFACTS_DIR / 'metrics.json'}")
    
    # ==========================================================================
    # Final Warnings and Summary
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("EVALUATION COMPLETE")
    logger.info("=" * 70)
    
    spam_recall = metrics['per_class']['spam']['recall']
    spam_precision = metrics['per_class']['spam']['precision']
    spam_f1 = metrics['per_class']['spam']['f1']
    
    logger.info("\n🎯 FINAL TEST SET PERFORMANCE:")
    logger.info(f"   ✅ SPAM RECALL:     {spam_recall:.4f} ({spam_recall*100:.2f}%)")
    logger.info(f"   📊 SPAM PRECISION:  {spam_precision:.4f} ({spam_precision*100:.2f}%)")
    logger.info(f"   📈 SPAM F1-SCORE:   {spam_f1:.4f}")
    
    logger.info("\n⚠️  IMPORTANT REMINDERS:")
    logger.info("   1. Test set was evaluated ONLY ONCE")
    logger.info("   2. DO NOT use these results to adjust the model")
    logger.info("   3. These metrics represent unbiased generalization performance")
    logger.info("   4. Model is ready for deployment!")
    
    logger.info("\n📱 DEPLOYMENT READY:")
    logger.info("   ✓ Model artifacts saved in model/artifacts/")
    logger.info("   ✓ Inference pipeline available in utils.py")
    logger.info("   ✓ Use SpamDetector class for predictions")
    
    return metrics


if __name__ == "__main__":
    try:
        metrics = evaluate_on_test_set()
        
        print("\n" + "=" * 70)
        print("✅ EVALUATION SUCCESSFUL!")
        print("=" * 70)
        print(f"\nTest metrics saved to: {ARTIFACTS_DIR / 'metrics.json'}")
        print("\nModel is ready for production deployment!")
        
    except FileNotFoundError as e:
        print(f"\n❌ Model Loading Error: {e}")
        print("\nPlease ensure you have trained the model first:")
        print("  python train.py")
    except Exception as e:
        print(f"\n❌ Evaluation failed: {e}")
        logger.exception("Detailed error:")
