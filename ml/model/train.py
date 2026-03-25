"""
Training module for SMS Spam Detection.
Handles model training, threshold tuning, and artifact saving.
"""

import logging
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_score, recall_score

import sys
sys.path.append('.')

from config import (
    TFIDF_CONFIG,
    LR_CONFIG,
    THRESHOLD_CONFIG,
    RANDOM_SEED,
    ARTIFACTS_DIR,
)
from preprocess import prepare_data
from utils import save_model, save_metrics, compute_metrics

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def create_vectorizer() -> TfidfVectorizer:
    """
    Create TF-IDF vectorizer with configured parameters.
    
    Returns:
        Configured TfidfVectorizer instance
    """
    logger.info("Creating TF-IDF vectorizer...")
    logger.info(f"  Configuration: {TFIDF_CONFIG}")
    
    vectorizer = TfidfVectorizer(**TFIDF_CONFIG)
    
    return vectorizer


def create_model() -> LogisticRegression:
    """
    Create Logistic Regression model with configured parameters.
    
    Returns:
        Configured LogisticRegression instance
    """
    logger.info("Creating Logistic Regression model...")
    logger.info(f"  Configuration: {LR_CONFIG}")
    
    model = LogisticRegression(**LR_CONFIG)
    
    return model


def tune_threshold(
    model: LogisticRegression,
    vectorizer: TfidfVectorizer,
    X_val: np.ndarray,
    y_val: np.ndarray
) -> float:
    """
    Tune decision threshold on validation set to maximize spam recall.
    
    Strategy:
    - Search thresholds from 0.1 to 0.9
    - Select threshold that maximizes recall while maintaining minimum precision
    
    Args:
        model: Trained LogisticRegression model
        vectorizer: Fitted TfidfVectorizer
        X_val: Validation texts
        y_val: Validation labels
        
    Returns:
        Optimal threshold value
    """
    logger.info("=" * 70)
    logger.info("THRESHOLD TUNING (VALIDATION SET)")
    logger.info("=" * 70)
    
    # Get prediction probabilities for validation set
    X_val_tfidf = vectorizer.transform(X_val)
    y_proba = model.predict_proba(X_val_tfidf)[:, 1]  # Probability of spam
    
    # Threshold search parameters from config
    thresholds = THRESHOLD_CONFIG['thresholds']
    min_precision = THRESHOLD_CONFIG['min_precision']
    
    best_threshold = 0.5  # Default
    best_recall = 0.0
    best_precision = 0.0
    
    logger.info(f"\nSearching {len(thresholds)} thresholds in range [{min(thresholds):.3f}, {max(thresholds):.3f}]")
    logger.info(f"Minimum precision constraint: {min_precision}\n")
    
    threshold_results = []
    
    # Search through predefined thresholds
    for current_thresh in thresholds:
        # Apply threshold
        y_pred = (y_proba >= current_thresh).astype(int)
        
        # Compute metrics
        recall = recall_score(y_val, y_pred, zero_division=0)
        precision = precision_score(y_val, y_pred, zero_division=0)
        
        threshold_results.append({
            'threshold': current_thresh,
            'recall': recall,
            'precision': precision
        })
        
        # Check if this is the best threshold
        # Priority: Maximize recall, but maintain minimum precision
        if recall > best_recall and precision >= min_precision:
            best_threshold = current_thresh
            best_recall = recall
            best_precision = precision
    
    # Log all threshold results
    logger.info("Threshold Search Results:")
    logger.info("-" * 70)
    logger.info(f"{'Threshold':<12} {'Recall':<12} {'Precision':<12} {'Status'}")
    logger.info("-" * 70)
    
    for result in threshold_results:
        thresh = result['threshold']
        rec = result['recall']
        prec = result['precision']
        
        # Highlight best threshold
        if abs(thresh - best_threshold) < 1e-6:
            status = "← BEST"
        elif prec < min_precision:
            status = "(precision too low)"
        else:
            status = ""
        
        logger.info(f"{thresh:<12.3f} {rec:<12.4f} {prec:<12.4f} {status}")
    
    logger.info("-" * 70)
    logger.info(f"\n✅ SELECTED THRESHOLD: {best_threshold:.3f}")
    logger.info(f"   Spam Recall:    {best_recall:.4f} ({best_recall*100:.2f}%)")
    logger.info(f"   Spam Precision: {best_precision:.4f} ({best_precision*100:.2f}%)")
    
    # Explain threshold selection
    logger.info("\n📊 THRESHOLD ANALYSIS:")
    if best_threshold < 0.5:
        logger.info(f"   → Lower threshold ({best_threshold:.3f} < 0.5) increases spam detection")
        logger.info(f"   → More aggressive spam filtering (higher recall)")
        logger.info(f"   → Trade-off: More false positives (ham marked as spam)")
    elif best_threshold > 0.5:
        logger.info(f"   → Higher threshold ({best_threshold:.3f} > 0.5) is more conservative")
        logger.info(f"   → Stricter spam criteria (higher precision)")
        logger.info(f"   → Trade-off: May miss some spam messages")
    else:
        logger.info(f"   → Default threshold (0.5) provides balanced performance")
    
    return best_threshold


def train_model() -> dict:
    """
    Complete training pipeline with threshold tuning.
    
    Returns:
        Dictionary containing trained components and metrics
    """
    logger.info("=" * 70)
    logger.info("SMS SPAM DETECTION - MODEL TRAINING")
    logger.info("=" * 70)
    
    # Set random seed for reproducibility
    np.random.seed(RANDOM_SEED)
    
    # ==========================================================================
    # STEP 1: Prepare Data
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 1: DATA PREPARATION")
    logger.info("=" * 70)
    
    X_train, X_val, X_test, y_train, y_val, y_test = prepare_data()
    
    # IMPORTANT: Do NOT touch test set at this stage!
    logger.info("\n⚠️  TEST SET IS HELD OUT - NO ACCESS DURING TRAINING")
    
    # ==========================================================================
    # STEP 2: Feature Engineering (TF-IDF)
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 2: FEATURE ENGINEERING (TF-IDF VECTORIZATION)")
    logger.info("=" * 70)
    
    vectorizer = create_vectorizer()
    
    # Fit vectorizer on TRAINING data ONLY (prevent data leakage)
    logger.info("\nFitting TF-IDF vectorizer on TRAINING set only...")
    X_train_tfidf = vectorizer.fit_transform(X_train)
    
    logger.info(f"✓ Vocabulary size: {len(vectorizer.vocabulary_)} features")
    logger.info(f"✓ Training matrix shape: {X_train_tfidf.shape}")
    
    # Transform validation set (using already-fitted vectorizer)
    X_val_tfidf = vectorizer.transform(X_val)
    logger.info(f"✓ Validation matrix shape: {X_val_tfidf.shape}")
    
    # ==========================================================================
    # STEP 3: Model Training
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 3: MODEL TRAINING (LOGISTIC REGRESSION)")
    logger.info("=" * 70)
    
    model = create_model()
    
    # Train on TF-IDF features
    logger.info("\nTraining Logistic Regression...")
    model.fit(X_train_tfidf, y_train)
    logger.info("✓ Model training complete")
    
    # Training performance
    train_accuracy = model.score(X_train_tfidf, y_train)
    logger.info(f"✓ Training accuracy: {train_accuracy:.4f} ({train_accuracy*100:.2f}%)")
    
    # Coefficient analysis
    coef = model.coef_[0]
    intercept = model.intercept_[0]
    logger.info(f"✓ Model coefficients: {len(coef)} features")
    logger.info(f"✓ Intercept: {intercept:.4f}")
    
    # Top features for spam detection
    feature_names = np.array(vectorizer.get_feature_names_out())
    top_spam_indices = np.argsort(coef)[-10:][::-1]
    top_ham_indices = np.argsort(coef)[:10]
    
    logger.info("\n🔝 Top 10 features indicating SPAM:")
    for idx in top_spam_indices:
        logger.info(f"   {feature_names[idx]:<20} (coef: {coef[idx]:.4f})")
    
    logger.info("\n🔝 Top 10 features indicating HAM:")
    for idx in top_ham_indices:
        logger.info(f"   {feature_names[idx]:<20} (coef: {coef[idx]:.4f})")
    
    # ==========================================================================
    # STEP 4: Threshold Tuning (on Validation Set)
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 4: THRESHOLD TUNING (VALIDATION SET)")
    logger.info("=" * 70)
    
    optimal_threshold = tune_threshold(model, vectorizer, X_val, y_val)
    
    # ==========================================================================
    # STEP 5: Save Artifacts
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 5: SAVING MODEL ARTIFACTS")
    logger.info("=" * 70)
    
    save_model(model, vectorizer, optimal_threshold)
    
    logger.info(f"\n✅ Model artifacts saved to: {ARTIFACTS_DIR}")
    logger.info("   - vectorizer.pkl (TF-IDF vectorizer)")
    logger.info("   - model.pkl (Logistic Regression)")
    logger.info("   - threshold.json (Optimal decision threshold)")
    
    # ==========================================================================
    # Summary
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 70)
    
    logger.info("\n📋 TRAINING SUMMARY:")
    logger.info(f"   ✓ Training samples: {len(X_train)}")
    logger.info(f"   ✓ Validation samples: {len(X_val)}")
    logger.info(f"   ✓ Test samples: {len(X_test)} (held out for evaluation)")
    logger.info(f"   ✓ Features: {X_train_tfidf.shape[1]}")
    logger.info(f"   ✓ Optimal threshold: {optimal_threshold:.3f}")
    logger.info(f"   ✓ Training accuracy: {train_accuracy:.4f}")
    
    logger.info("\n⚠️  NEXT STEP: Run evaluate.py to assess test set performance")
    logger.info("   DO NOT use test set results to adjust the model!")
    
    # Return training results
    return {
        'model': model,
        'vectorizer': vectorizer,
        'threshold': optimal_threshold,
        'train_accuracy': train_accuracy,
        'X_train_shape': X_train_tfidf.shape,
    }


if __name__ == "__main__":
    try:
        results = train_model()
        print("\n" + "=" * 70)
        print("✅ TRAINING SUCCESSFUL!")
        print("=" * 70)
        print(f"\nModel trained and artifacts saved.")
        print(f"Ready for evaluation with: python evaluate.py")
    except FileNotFoundError as e:
        print(f"\n❌ Dataset Error: {e}")
        print("\nPlease ensure you have a dataset.csv file in the data/ directory")
        print("with 'label' and 'text' columns.")
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        logger.exception("Detailed error:")
