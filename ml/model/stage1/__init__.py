"""
Stage 1: SMS Spam Detection using TF-IDF + Logistic Regression.

This module handles binary classification of SMS messages as SPAM or HAM.
Key features:
- Minimal preprocessing to preserve spam signals
- TF-IDF vectorization with n-grams
- Logistic Regression classifier
- Threshold tuning for high recall
- ONNX export for mobile deployment

Usage:
    # Training
    python -m ml.model.stage1.train
    
    # Evaluation
    python -m ml.model.stage1.evaluate
    
    # Export to ONNX
    python -m ml.model.stage1.export_onnx
    
    # Test inference
    python -m ml.model.stage1.test_inference
"""

from . import train
from . import evaluate
from . import export_onnx

__all__ = ['train', 'evaluate', 'export_onnx']
