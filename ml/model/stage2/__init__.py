"""
Stage 2: HAM Message Categorization using TF-IDF + LightGBM.

This module categorizes HAM messages into fine-grained categories:
- personal
- otp
- banking
- subscription
- recharge_data

Unknown is a fallback when Stage 2 cannot assign a label; it is not a trained class.
The frontend "All" tab is a UI filter only and is not an ML category.

IMPORTANT: This model works independently from Stage 1.
It only processes messages that are already known to be HAM.

Usage:
    # Training
    python -m ml.model.stage2.train
    
    # Export to ONNX
    python -m ml.model.stage2.export_onnx
    
    # Testing
    python -m ml.model.stage2.test_data
"""

from . import train
from . import test_data
from . import export_onnx

__all__ = ['train', 'test_data', 'export_onnx']
