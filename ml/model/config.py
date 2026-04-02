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
import numpy as np

THRESHOLD_CONFIG = {
    # Generate 10 evenly spaced thresholds between 0.25 and 0.40
    'thresholds': np.linspace(0.25, 0.40, 10).tolist(),  # [0.25, 0.267, 0.283, ..., 0.40]
    'min_precision': 0.80,          # Minimum acceptable precision constraint
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
# STAGE 2: HAM MESSAGE CATEGORIZATION CONFIGURATION
# =============================================================================
# TF-IDF Vectorizer for Stage 2 (HAM classifier)
STAGE2_TFIDF_CONFIG = {
    'max_features': 15000,       # Larger vocabulary for fine-grained classification
    'ngram_range': (1, 2),       # Unigrams and bigrams
    'min_df': 2,                 # Ignore terms appearing in fewer than 2 documents
    'max_df': 0.9,               # Ignore terms appearing in more than 90% of documents
    'sublinear_tf': True,        # Apply sublinear tf scaling (1 + log(tf))
}

# LightGBM Classifier for Stage 2
STAGE2_LGBM_CONFIG = {
    'objective': 'multiclass',   # Multi-class classification
    'num_class': 6,              # 6 HAM categories
    'n_estimators': 300,         # Number of boosting rounds
    'learning_rate': 0.05,       # Step size shrinkage
    'num_leaves': 31,            # Max tree leaves
    'random_state': RANDOM_SEED, # Reproducibility
}

# Class weights for handling imbalanced HAM categories
STAGE2_CLASS_WEIGHTS = {
    'personal': 1.0,
    'unknown': 1.2,
    'banking': 1.5,
    'promotional': 1.5,
    'otp': 2.0,
    'subscription': 2.0,
}

# HAM categories list
HAM_CATEGORIES = ['personal', 'banking', 'otp', 'subscription', 'promotional', 'unknown']

# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================
LOG_LEVEL = 'INFO'
LOG_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
