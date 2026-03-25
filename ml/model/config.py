"""
Configuration file for SMS Spam Detection ML System.
All hyperparameters, paths, and constants are defined here.
"""

import os
from pathlib import Path

# =============================================================================
# RANDOM SEED FOR REPRODUCIBILITY
# =============================================================================
RANDOM_SEED = 42

# =============================================================================
# PATH CONFIGURATION
# =============================================================================
# Get the project root directory (parent of model/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Data directory
DATA_DIR = PROJECT_ROOT / "data"
DATASET_PATH = DATA_DIR / "dataset.csv"

# Model artifacts directory
ARTIFACTS_DIR = PROJECT_ROOT / "model" / "artifacts"

# Ensure directories exist
DATA_DIR.mkdir(parents=True, exist_ok=True)
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

# =============================================================================
# DATA SPLIT CONFIGURATION
# =============================================================================
TRAIN_SIZE = 0.70      # 70% training data
VAL_SIZE = 0.15        # 15% validation data (for threshold tuning)
TEST_SIZE = 0.15       # 15% test data (held out for final evaluation)

# =============================================================================
# PREPROCESSING CONFIGURATION
# =============================================================================
# Minimal preprocessing to preserve spam signals
PREPROCESSING_CONFIG = {
    'lowercase': True,  # Only lowercase text
    'remove_stopwords': False,  # Keep stopwords (spam often uses common words)
    'remove_numbers': False,  # Keep numbers (spam often has phone numbers, prices)
    'remove_urls': False,  # Keep URLs (strong spam signal)
    'remove_symbols': False,  # Keep symbols ($$$, !!!, etc. are spam signals)
}

# =============================================================================
# TF-IDF VECTORIZER CONFIGURATION
# =============================================================================
TFIDF_CONFIG = {
    'max_features': 5000,          # Maximum vocabulary size
    'ngram_range': (1, 2),         # Unigrams and bigrams
    'stop_words': 'english',       # Remove English stop words
    'min_df': 2,                   # Ignore terms that appear in fewer than 2 documents
    'max_df': 0.95,                # Ignore terms that appear in more than 95% of documents
    'sublinear_tf': True,          # Apply sublinear tf scaling (1 + log(tf))
}

# =============================================================================
# LOGISTIC REGRESSION MODEL CONFIGURATION
# =============================================================================
LR_CONFIG = {
    'class_weight': 'balanced',    # Handle class imbalance automatically
    'max_iter': 1000,              # Maximum iterations for convergence
    'solver': 'liblinear',         # Good for small datasets
    'random_state': RANDOM_SEED,   # Reproducibility
}

# =============================================================================
# THRESHOLD TUNING CONFIGURATION
# =============================================================================
THRESHOLD_CONFIG = {
    'min_threshold': 0.1,          # Minimum threshold to try
    'max_threshold': 0.9,          # Maximum threshold to try
    'step': 0.05,                  # Step size for threshold search
    'min_precision': 0.3,          # Minimum acceptable precision (avoid complete collapse)
}

# =============================================================================
# LABEL ENCODING
# =============================================================================
LABEL_MAPPING = {
    'spam': 1,
    'ham': 0,
}

LABEL_DECODING = {v: k for k, v in LABEL_MAPPING.items()}

# =============================================================================
# ONNX EXPORT CONFIGURATION
# =============================================================================
ONNX_CONFIG = {
    'opset_version': 11,           # ONNX opset version for compatibility
    'target_opset': 'sklearn',     # Target scikit-learn operators
}

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
LOG_LEVEL = 'INFO'
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
