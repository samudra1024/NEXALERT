"""
ML Model Package for SMS Spam Detection.

This package contains:
- config: Configuration and hyperparameters
- preprocess: Data loading and preprocessing
- utils: Utility functions and inference pipeline
- stage1: Binary spam detection (TF-IDF + Logistic Regression)
- stage2: HAM message categorization (TF-IDF + LightGBM)
"""

__version__ = "1.0.0"
__author__ = "NexAlert Team"
