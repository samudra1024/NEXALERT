"""
Data preprocessing module for SMS Spam Detection.
Handles data loading, cleaning, and stratified splitting.
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
import logging

from ml.model.config import (
    DATASET_PATH,
    PREPROCESSING_CONFIG,
    TRAIN_SIZE,
    VAL_SIZE,
    TEST_SIZE,
    LABEL_MAPPING,
    RANDOM_SEED,
)

# Setup logging
logger = logging.getLogger(__name__)


def load_data(dataset_path: str = None) -> pd.DataFrame:
    """
    Load dataset from CSV file.
    
    Args:
        dataset_path: Path to the CSV file. Uses default if None.
        
    Returns:
        DataFrame with 'label' and 'text' columns
        
    Raises:
        FileNotFoundError: If dataset file doesn't exist
        ValueError: If required columns are missing
    """
    dataset_path = dataset_path or DATASET_PATH
    
    logger.info(f"Loading dataset from {dataset_path}")
    
    if not dataset_path.exists():
        raise FileNotFoundError(
            f"Dataset not found at {dataset_path}. "
            "Please place your dataset.csv in the data/ directory."
        )
    
    # Load CSV with robust encoding handling
    # Note: Dataset may have additional columns (e.g., 'category' for Model 2)
    # Model 1 only uses 'text' and 'label' columns - all others are ignored
    try:
        df = pd.read_csv(dataset_path, encoding="utf-8")
        logger.info("Dataset loaded with UTF-8 encoding")
    except UnicodeDecodeError:
        logger.info("UTF-8 decoding failed, falling back to latin1 encoding")
        df = pd.read_csv(dataset_path, encoding="latin1")
        logger.info("Dataset loaded with latin1 encoding (Windows-1252 compatible)")
    
    # Validate required columns
    required_columns = {'label', 'text'}
    if not required_columns.issubset(df.columns):
        raise ValueError(
            f"Dataset must have 'label' and 'text' columns. "
            f"Found: {list(df.columns)}"
        )
    
    # Remove rows with missing values
    initial_rows = len(df)
    df = df.dropna(subset=['label', 'text'])
    dropped_rows = initial_rows - len(df)
    
    if dropped_rows > 0:
        logger.warning(f"Dropped {dropped_rows} rows with missing values")

    # Remove exact duplicate SMS text to prevent train/test leakage
    before_dedup = len(df)
    df = df.drop_duplicates(subset=['text'], keep='first')
    deduped_rows = before_dedup - len(df)
    if deduped_rows > 0:
        logger.warning(f"Removed {deduped_rows} exact duplicate SMS texts before splitting")
    
    logger.info(f"Loaded {len(df)} samples")
    logger.info(f"Label distribution:\n{df['label'].value_counts()}")
    
    return df


def preprocess_text(text: str) -> str:
    """
    Apply minimal preprocessing to text.
    
    Args:
        text: Raw SMS text
        
    Returns:
        Preprocessed text
    """
    if not isinstance(text, str):
        text = str(text)
    
    # Only lowercase (preserve numbers, URLs, symbols as they're spam signals)
    if PREPROCESSING_CONFIG['lowercase']:
        text = text.lower()
    
    return text.strip()


def encode_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    Encode string labels to numeric (spam=1, ham=0).
    
    Args:
        df: DataFrame with 'label' column
        
    Returns:
        DataFrame with encoded 'label' column
    """
    df = df.copy()
    
    # Check if labels are already numeric
    if df['label'].dtype in [np.int64, np.float64]:
        # Assume 1=spam, 0=ham
        logger.info("Labels appear to be already encoded (numeric)")
        return df
    
    # Map string labels to numeric
    try:
        df['label'] = df['label'].str.lower().map(LABEL_MAPPING)
        logger.info("Encoded string labels to numeric (spam=1, ham=0)")
    except KeyError as e:
        raise ValueError(
            f"Invalid label found: {e}. Expected 'spam' or 'ham'."
        )
    
    return df


def split_data(
    df: pd.DataFrame,
    random_state: int = RANDOM_SEED
) -> tuple:
    """
    Split data into train, validation, and test sets with stratification.
    
    Split ratio: 70% train, 15% val, 15% test
    
    Args:
        df: DataFrame with 'label' and 'text' columns
        random_state: Random seed for reproducibility
        
    Returns:
        Tuple of (X_train, X_val, X_test, y_train, y_val, y_test)
    """
    logger.info("Splitting data into train/val/test (70/15/15)...")
    
    # Separate features and labels
    # IMPORTANT: Only use 'text' and 'label' columns - ignore all others (e.g., 'category')
    # This ensures Model 1 remains independent from Model 2's categorization task
    X = df['text'].values
    y = df['label'].values
    
    # First split: separate test set (15%)
    X_temp, X_test, y_temp, y_test = train_test_split(
        X, y,
        test_size=TEST_SIZE,
        random_state=random_state,
        stratify=y  # Maintain class distribution
    )
    
    # Second split: separate train and val (70% / 15% of original)
    # Calculate val_size relative to remaining temp set
    val_size_adjusted = VAL_SIZE / (TRAIN_SIZE + VAL_SIZE)
    
    X_train, X_val, y_train, y_val = train_test_split(
        X_temp, y_temp,
        test_size=val_size_adjusted,
        random_state=random_state,
        stratify=y_temp
    )
    
    logger.info(f"Split complete:")
    logger.info(f"  Train: {len(X_train)} samples ({len(X_train)/len(X)*100:.1f}%)")
    logger.info(f"  Val:   {len(X_val)} samples ({len(X_val)/len(X)*100:.1f}%)")
    logger.info(f"  Test:  {len(X_test)} samples ({len(X_test)/len(X)*100:.1f}%)")
    
    # Log class distribution in each split
    for name, y_split in [('Train', y_train), ('Val', y_val), ('Test', y_test)]:
        spam_count = np.sum(y_split == 1)
        spam_pct = spam_count / len(y_split) * 100
        logger.info(f"  {name} spam ratio: {spam_count}/{len(y_split)} ({spam_pct:.1f}%)")
    
    return X_train, X_val, X_test, y_train, y_val, y_test


def prepare_data(random_state: int = RANDOM_SEED) -> tuple:
    """
    Complete data preparation pipeline.
    
    Args:
        random_state: Random seed for reproducibility
        
    Returns:
        Tuple of (X_train, X_val, X_test, y_train, y_val, y_test)
    """
    logger.info("=" * 60)
    logger.info("DATA PREPARATION PIPELINE")
    logger.info("=" * 60)
    
    # Load data
    df = load_data()
    
    # Preprocess text
    logger.info("Preprocessing text (minimal cleaning)...")
    df['text'] = df['text'].apply(preprocess_text)
    
    # Encode labels
    df = encode_labels(df)
    
    # Split data
    X_train, X_val, X_test, y_train, y_val, y_test = split_data(
        df, random_state
    )
    
    logger.info("=" * 60)
    logger.info("DATA PREPARATION COMPLETE")
    logger.info("=" * 60)
    
    return X_train, X_val, X_test, y_train, y_val, y_test


if __name__ == "__main__":
    # Test the preprocessing pipeline
    logging.basicConfig(level=logging.INFO)
    
    try:
        X_train, X_val, X_test, y_train, y_val, y_test = prepare_data()
        print("\n✅ Data preparation successful!")
        print(f"Train shape: {X_train.shape}")
        print(f"Val shape: {X_val.shape}")
        print(f"Test shape: {X_test.shape}")
    except Exception as e:
        print(f"\n❌ Error during data preparation: {e}")
        print("\nMake sure you have a dataset.csv file in the data/ directory")
