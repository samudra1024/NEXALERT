"""
Stage 2 Training: HAM Message Categorization using TF-IDF + LightGBM.

This module trains a multi-class classifier to categorize HAM messages into:
- personal
- otp
- banking

IMPORTANT: This model works independently from Stage 1 (Spam Detection).
It only processes messages that are already known to be HAM.
"""

import logging
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, confusion_matrix
import lightgbm as lgb
import pickle
from pathlib import Path

from ml.model.config import (
    DATASET_PATH,
    ARTIFACTS_DIR,
    RANDOM_SEED,
    STAGE2_TFIDF_CONFIG,
    STAGE2_LGBM_CONFIG,
    HAM_CATEGORIES,
)
from ml.model.preprocess import preprocess_text

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def load_ham_dataset(dataset_path: str = None) -> pd.DataFrame:
    """
    Load dataset and filter for HAM messages only.
    
    Reuses existing dataset loading logic but filters for HAM messages
    and uses the category column as target.
    
    Args:
        dataset_path: Path to the CSV file
        
    Returns:
        DataFrame with only HAM messages and their categories
    """
    dataset_path = dataset_path or DATASET_PATH
    
    logger.info(f"Loading dataset from {dataset_path}")
    
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found at {dataset_path}")
    
    # Load dataset with robust encoding handling
    try:
        df = pd.read_csv(dataset_path, encoding="utf-8")
        logger.info("Dataset loaded with UTF-8 encoding")
    except UnicodeDecodeError:
        logger.info("UTF-8 decoding failed, falling back to latin1 encoding")
        df = pd.read_csv(dataset_path, encoding="latin1")
        logger.info("Dataset loaded with latin1 encoding (Windows-1252 compatible)")
    
    logger.info(f"Loaded {len(df)} total messages")
    
    # Filter for HAM messages only (Stage 2 only processes HAM)
    ham_df = df[df['label'].astype(str).str.lower().str.strip() == 'ham'].copy()
    
    logger.info(f"Filtered to {len(ham_df)} HAM messages")

    # Normalize category names to the intended Stage 2 labels
    category_lookup = {cat.lower(): cat for cat in HAM_CATEGORIES}
    ham_df['category'] = (
        ham_df['category']
        .astype(str)
        .str.strip()
        .str.lower()
        .map(category_lookup)
    )
    invalid_rows = ham_df['category'].isna().sum()
    if invalid_rows > 0:
        logger.warning(
            f"Dropping {invalid_rows} HAM rows with categories outside {HAM_CATEGORIES}"
        )
        ham_df = ham_df.dropna(subset=['category'])

    ham_df['text'] = ham_df['text'].apply(preprocess_text)
    
    logger.info(f"HAM category distribution:\n{ham_df['category'].value_counts()}")
    
    # Validate required columns
    required_columns = {'text', 'category'}
    if not required_columns.issubset(ham_df.columns):
        raise ValueError(
            f"Dataset must have 'text' and 'category' columns for Stage 2. "
            f"Found: {list(ham_df.columns)}"
        )
    
    # Remove rows with missing values
    initial_rows = len(ham_df)
    ham_df = ham_df.dropna(subset=['text', 'category'])
    dropped_rows = initial_rows - len(ham_df)
    
    if dropped_rows > 0:
        logger.warning(f"Dropped {dropped_rows} rows with missing values")

    before_dedup = len(ham_df)
    ham_df = ham_df.drop_duplicates(subset=['text'], keep='first')
    deduped_rows = before_dedup - len(ham_df)
    if deduped_rows > 0:
        logger.warning(f"Removed {deduped_rows} exact duplicate HAM SMS texts before splitting")
    
    return ham_df


def create_stage2_pipeline() -> Pipeline:
    """
    Create sklearn Pipeline for Stage 2 (TF-IDF + LightGBM).
    
    Returns:
        Configured sklearn Pipeline
    """
    logger.info("Creating Stage 2 pipeline (TF-IDF + LightGBM)...")
    
    # TF-IDF Vectorizer
    vectorizer = TfidfVectorizer(**STAGE2_TFIDF_CONFIG)
    
    # LightGBM Classifier
    classifier = lgb.LGBMClassifier(**STAGE2_LGBM_CONFIG)
    
    # Create pipeline
    pipeline = Pipeline([
        ('tfidf', vectorizer),
        ('classifier', classifier)
    ])
    
    logger.info(f"✓ Pipeline created successfully")
    logger.info(f"  TF-IDF config: max_features={STAGE2_TFIDF_CONFIG['max_features']}, "
                f"ngram_range={STAGE2_TFIDF_CONFIG['ngram_range']}")
    logger.info(f"  LightGBM config: n_estimators={STAGE2_LGBM_CONFIG['n_estimators']}, "
                f"learning_rate={STAGE2_LGBM_CONFIG['learning_rate']}")
    
    return pipeline


def train_stage2_model():
    """
    Complete training pipeline for Stage 2 (HAM categorization).
    
    This function:
    1. Loads and filters dataset for HAM messages only
    2. Performs stratified train-test split
    3. Trains TF-IDF + LightGBM pipeline
    4. Evaluates on test set
    5. Saves model artifact
    """
    logger.info("=" * 70)
    logger.info("STAGE 2: HAM MESSAGE CATEGORIZATION - MODEL TRAINING")
    logger.info("=" * 70)
    
    # ==========================================================================
    # STEP 1: Load and Prepare Data
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 1: DATA PREPARATION")
    logger.info("=" * 70)
    
    ham_df = load_ham_dataset()
    
    # Separate features and labels
    X = ham_df['text'].values
    y = ham_df['category'].values
    
    logger.info(f"\nFeatures shape: {X.shape}")
    logger.info(f"Labels shape: {y.shape}")
    
    # Stratified train-test split (maintain class distribution)
    logger.info("\nPerforming stratified train-test split (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.20,
        random_state=RANDOM_SEED,
        stratify=y  # Maintain class distribution
    )
    
    logger.info(f"✓ Train set: {len(X_train)} samples")
    logger.info(f"✓ Test set: {len(X_test)} samples")
    logger.info(f"\nTrain class distribution:\n{pd.Series(y_train).value_counts().sort_index()}")
    
    # ==========================================================================
    # STEP 2: Create and Train Pipeline
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 2: MODEL TRAINING")
    logger.info("=" * 70)
    
    pipeline = create_stage2_pipeline()
    
    logger.info("\nTraining pipeline on HAM messages...")
    pipeline.fit(X_train, y_train)
    logger.info("✓ Model training complete")
    
    # ==========================================================================
    # STEP 3: Evaluate on Test Set
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 3: MODEL EVALUATION")
    logger.info("=" * 70)
    
    # Predictions
    y_pred = pipeline.predict(X_test)
    
    # Classification report
    logger.info("\n📊 CLASSIFICATION REPORT:")
    logger.info("-" * 70)
    report = classification_report(y_test, y_pred, zero_division=0)
    logger.info(report)
    
    # Confusion matrix
    logger.info("\n📈 CONFUSION MATRIX:")
    logger.info("-" * 70)
    cm = confusion_matrix(y_test, y_pred, labels=HAM_CATEGORIES)
    logger.info(f"Classes: {HAM_CATEGORIES}")
    logger.info(cm)
    
    # Overall accuracy
    accuracy = np.mean(y_pred == y_test)
    logger.info(f"\n✓ Overall Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
    
    # ==========================================================================
    # STEP 4: Save Model Artifact
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("STEP 4: SAVING MODEL ARTIFACT")
    logger.info("=" * 70)
    
    model_path = ARTIFACTS_DIR / "stage2_model.pkl"
    
    with open(model_path, 'wb') as f:
        pickle.dump(pipeline, f)
    
    logger.info(f"✓ Saved Stage 2 model to {model_path}")
    
    # ==========================================================================
    # Summary
    # ==========================================================================
    logger.info("\n" + "=" * 70)
    logger.info("TRAINING COMPLETE")
    logger.info("=" * 70)
    
    logger.info(f"\n📋 TRAINING SUMMARY:")
    logger.info(f"   ✓ Total HAM messages: {len(ham_df)}")
    logger.info(f"   ✓ Training samples: {len(X_train)}")
    logger.info(f"   ✓ Test samples: {len(X_test)}")
    logger.info(f"   ✓ Number of classes: {len(HAM_CATEGORIES)}")
    logger.info(f"   ✓ Classes: {', '.join(HAM_CATEGORIES)}")
    logger.info(f"   ✓ Test Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
    logger.info(f"   ✓ Model saved: {model_path.name}")
    
    logger.info(f"\n✅ Stage 2 model is ready for deployment!")
    logger.info(f"   Use with: from utils import predict_ham_category")
    
    return pipeline, accuracy


if __name__ == "__main__":
    try:
        model, accuracy = train_stage2_model()
        
        print("\n" + "=" * 70)
        print("✅ STAGE 2 TRAINING SUCCESSFUL!")
        print("=" * 70)
        print(f"\nModel trained and saved to: {ARTIFACTS_DIR / 'stage2_model.pkl'}")
        print(f"Test Accuracy: {accuracy:.4f} ({accuracy*100:.2f}%)")
        print("\nNext steps:")
        print("  1. Update utils.py with Stage 2 prediction functions")
        print("  2. Test unified inference pipeline")
        print("  3. Integrate with frontend")
        
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        logger.exception("Detailed error:")
