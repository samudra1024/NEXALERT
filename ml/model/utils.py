"""
Utility functions for SMS Spam Detection ML System.
Includes model I/O, metrics computation, and inference pipeline.
"""

import pickle
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Tuple

import numpy as np
from sklearn.metrics import (
    precision_score, recall_score, f1_score,
    confusion_matrix, classification_report
)

from ml.model.config import ARTIFACTS_DIR, LABEL_DECODING, LOG_LEVEL, LOG_FORMAT
from ml.model.preprocess import preprocess_text

# Setup logging
logging.basicConfig(level=LOG_LEVEL, format=LOG_FORMAT)
logger = logging.getLogger(__name__)


# =============================================================================
# MODEL I/O FUNCTIONS
# =============================================================================

def save_model(model, vectorizer, threshold: float, filepath: str = None, use_bundle: bool = True):
    """
    Save trained model, vectorizer, and threshold to disk.
    
    Args:
        model: Trained sklearn model
        vectorizer: Fitted TF-IDF vectorizer
        threshold: Optimal decision threshold
        filepath: Directory path to save artifacts
        use_bundle: If True, save as single model_bundle.pkl; if False, save separate files
    """
    filepath = filepath or ARTIFACTS_DIR
    
    logger.info(f"Saving model artifacts to {filepath}")

    threshold_path = filepath / "threshold.json"
    with open(threshold_path, 'w') as f:
        json.dump({'threshold': threshold}, f)
    logger.info(f"✓ Saved threshold to {threshold_path} ({threshold:.4f})")
    
    if use_bundle:
        # Save as single bundle containing all components
        bundle = {
            'model': model,
            'vectorizer': vectorizer,
            'threshold': threshold
        }
        
        bundle_path = filepath / "model_bundle.pkl"
        with open(bundle_path, 'wb') as f:
            pickle.dump(bundle, f)
        logger.info(f"✓ Saved model bundle to {bundle_path}")
        logger.info(f"   Contents: model, vectorizer, threshold ({threshold:.4f})")

        # Keep separate artifacts for ONNX export compatibility
        vectorizer_path = filepath / "vectorizer.pkl"
        with open(vectorizer_path, 'wb') as f:
            pickle.dump(vectorizer, f)
        logger.info(f"✓ Saved vectorizer to {vectorizer_path}")

        model_path = filepath / "model.pkl"
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)
        logger.info(f"✓ Saved model to {model_path}")
    else:
        # Legacy: Save separate files
        # Save vectorizer
        vectorizer_path = filepath / "vectorizer.pkl"
        with open(vectorizer_path, 'wb') as f:
            pickle.dump(vectorizer, f)
        logger.info(f"✓ Saved vectorizer to {vectorizer_path}")
        
        # Save model
        model_path = filepath / "model.pkl"
        with open(model_path, 'wb') as f:
            pickle.dump(model, f)
        logger.info(f"✓ Saved model to {model_path}")
        
        # Save threshold
        threshold_path = filepath / "threshold.json"
        with open(threshold_path, 'w') as f:
            json.dump({'threshold': threshold}, f)
        logger.info(f"✓ Saved threshold to {threshold_path}")


def load_model(filepath: str = None, use_bundle: bool = True) -> Tuple[Any, Any, float]:
    """
    Load trained model, vectorizer, and threshold from disk.
    
    Args:
        filepath: Directory path containing artifacts
        use_bundle: If True, load from model_bundle.pkl; if False, load separate files
        
    Returns:
        Tuple of (model, vectorizer, threshold)
    """
    filepath = filepath or ARTIFACTS_DIR
    
    logger.info(f"Loading model artifacts from {filepath}")
    
    if use_bundle:
        # Load from single bundle
        bundle_path = filepath / "model_bundle.pkl"
        with open(bundle_path, 'rb') as f:
            bundle = pickle.load(f)
        
        model = bundle['model']
        vectorizer = bundle['vectorizer']
        threshold = bundle['threshold']
        
        logger.info(f"✓ Loaded model bundle from {bundle_path}")
        logger.info(f"   Threshold: {threshold:.4f}")
    else:
        # Legacy: Load separate files
        # Load vectorizer
        vectorizer_path = filepath / "vectorizer.pkl"
        with open(vectorizer_path, 'rb') as f:
            vectorizer = pickle.load(f)
        logger.info(f"✓ Loaded vectorizer from {vectorizer_path}")
        
        # Load model
        model_path = filepath / "model.pkl"
        with open(model_path, 'rb') as f:
            model = pickle.load(f)
        logger.info(f"✓ Loaded model from {model_path}")
        
        # Load threshold
        threshold_path = filepath / "threshold.json"
        with open(threshold_path, 'r') as f:
            threshold_data = json.load(f)
        threshold = threshold_data['threshold']
        logger.info(f"✓ Loaded threshold: {threshold:.3f}")
    
    return model, vectorizer, threshold


def save_metrics(metrics: Dict[str, Any], filepath: str = None):
    """
    Save evaluation metrics to JSON file.
    
    Args:
        metrics: Dictionary of metrics
        filepath: Directory path to save metrics
    """
    filepath = filepath or ARTIFACTS_DIR
    
    metrics_path = filepath / "metrics.json"
    with open(metrics_path, 'w') as f:
        json.dump(metrics, f, indent=2)
    
    logger.info(f"✓ Saved metrics to {metrics_path}")


def load_metrics(filepath: str = None) -> Dict[str, Any]:
    """
    Load evaluation metrics from JSON file.
    
    Args:
        filepath: Directory path containing metrics.json
        
    Returns:
        Dictionary of metrics
    """
    filepath = filepath or ARTIFACTS_DIR
    
    metrics_path = filepath / "metrics.json"
    with open(metrics_path, 'r') as f:
        metrics = json.load(f)
    
    logger.info(f"✓ Loaded metrics from {metrics_path}")
    return metrics


# =============================================================================
# METRICS COMPUTATION
# =============================================================================

def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    class_names: list = ['ham', 'spam']
) -> Dict[str, Any]:
    """
    Compute comprehensive evaluation metrics.
    
    Args:
        y_true: Ground truth labels
        y_pred: Predicted labels
        class_names: Names for each class
        
    Returns:
        Dictionary containing all metrics
    """
    # Compute per-class metrics
    precision = precision_score(y_true, y_pred, average=None)
    recall = recall_score(y_true, y_pred, average=None)
    f1 = f1_score(y_true, y_pred, average=None)
    
    # Compute overall metrics
    precision_macro = precision_score(y_true, y_pred, average='macro')
    recall_macro = recall_score(y_true, y_pred, average='macro')
    f1_macro = f1_score(y_true, y_pred, average='macro')
    
    precision_weighted = precision_score(y_true, y_pred, average='weighted')
    recall_weighted = recall_score(y_true, y_pred, average='weighted')
    f1_weighted = f1_score(y_true, y_pred, average='weighted')
    
    # Confusion matrix
    cm = confusion_matrix(y_true, y_pred)
    
    # Build metrics dictionary
    metrics = {
        'per_class': {
            class_names[0]: {
                'precision': float(precision[0]),
                'recall': float(recall[0]),
                'f1': float(f1[0]),
                'support': int(np.sum(y_true == 0))
            },
            class_names[1]: {
                'precision': float(precision[1]),
                'recall': float(recall[1]),
                'f1': float(f1[1]),
                'support': int(np.sum(y_true == 1))
            }
        },
        'overall': {
            'precision_macro': float(precision_macro),
            'recall_macro': float(recall_macro),
            'f1_macro': float(f1_macro),
            'precision_weighted': float(precision_weighted),
            'recall_weighted': float(recall_weighted),
            'f1_weighted': float(f1_weighted),
        },
        'confusion_matrix': {
            'true_negatives': int(cm[0, 0]),  # Ham predicted as ham
            'false_positives': int(cm[0, 1]),  # Ham predicted as spam
            'false_negatives': int(cm[1, 0]),  # Spam predicted as ham
            'true_positives': int(cm[1, 1])   # Spam predicted as spam
        },
        'total_samples': int(len(y_true))
    }
    
    return metrics


def print_metrics_report(metrics: Dict[str, Any], y_true: np.ndarray, y_pred: np.ndarray):
    """
    Print detailed metrics report to console.
    
    Args:
        metrics: Metrics dictionary
        y_true: Ground truth labels
        y_pred: Predicted labels
    """
    print("\n" + "=" * 70)
    print("EVALUATION REPORT")
    print("=" * 70)
    
    # Classification report
    print("\n📊 CLASSIFICATION REPORT:")
    print("-" * 70)
    print(classification_report(y_true, y_pred, target_names=['ham', 'spam']))
    
    # Confusion matrix
    print("\n📈 CONFUSION MATRIX:")
    print("-" * 70)
    cm = metrics['confusion_matrix']
    print(f"                    Predicted Ham   Predicted Spam")
    print(f"Actual Ham         {cm['true_negatives']:>10}   {cm['false_positives']:>14}")
    print(f"Actual Spam        {cm['false_negatives']:>10}   {cm['true_positives']:>14}")
    
    # Key metrics (highlighting spam recall)
    print("\n🎯 KEY METRICS (FOCUS ON SPAM DETECTION):")
    print("-" * 70)
    spam_metrics = metrics['per_class']['spam']
    print(f"✅ SPAM RECALL (MOST IMPORTANT):  {spam_metrics['recall']:.4f} ({spam_metrics['recall']*100:.2f}%)")
    print(f"   Spam Precision:                 {spam_metrics['precision']:.4f} ({spam_metrics['precision']*100:.2f}%)")
    print(f"   Spam F1-Score:                  {spam_metrics['f1']:.4f}")
    print(f"   Total Spam Samples:             {spam_metrics['support']}")
    
    print(f"\n📱 HAM Recall:                      {metrics['per_class']['ham']['recall']:.4f}")
    print(f"   Ham Precision:                  {metrics['per_class']['ham']['precision']:.4f}")
    
    print(f"\n📊 Overall Accuracy:              {np.mean(y_true == y_pred):.4f} ({np.mean(y_true == y_pred)*100:.2f}%)")
    
    # Business metrics
    print("\n💼 BUSINESS IMPACT:")
    print("-" * 70)
    total_spam = cm['true_positives'] + cm['false_negatives']
    spam_detected = cm['true_positives']
    spam_missed = cm['false_negatives']
    false_alarms = cm['false_positives']
    
    print(f"   Total spam messages:            {total_spam}")
    print(f"   ✅ Spam detected correctly:     {spam_detected} ({spam_detected/total_spam*100:.1f}%)")
    print(f"   ❌ Spam missed:                 {spam_missed} ({spam_missed/total_spam*100:.1f}%)")
    print(f"   ⚠️  False alarms (ham→spam):     {false_alarms}")
    
    print("\n" + "=" * 70)


# =============================================================================
# INFERENCE PIPELINE
# =============================================================================

class SpamDetector:
    """
    Production-ready spam detector with singleton pattern.
    Loads model artifacts once and reuses them for inference.
    """
    
    _instance = None
    _model = None
    _vectorizer = None
    _threshold = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(SpamDetector, cls).__new__(cls)
        return cls._instance
    
    def initialize(self, filepath: str = None):
        """
        Initialize the detector by loading model artifacts.
        
        Args:
            filepath: Directory path containing artifacts
        """
        if self._model is None:
            logger.info("Initializing SpamDetector...")
            self._model, self._vectorizer, self._threshold = load_model(filepath, use_bundle=True)
            logger.info("✓ SpamDetector initialized successfully")
        else:
            logger.info("SpamDetector already initialized")
    
    def predict(self, text: str) -> Dict[str, Any]:
        """
        Predict whether a single SMS is spam or ham.
        
        Args:
            text: Raw SMS text
            
        Returns:
            Dictionary with prediction result and confidence
        """
        if self._model is None:
            raise RuntimeError(
                "SpamDetector not initialized. Call initialize() first."
            )
        
        # Preprocess text
        text_clean = preprocess_text(text)
        
        # Vectorize
        X = self._vectorizer.transform([text_clean])
        
        # Get prediction probability
        proba_spam = self._model.predict_proba(X)[0, 1]
        
        # Apply threshold
        prediction = 1 if proba_spam >= self._threshold else 0
        
        # Decode label
        label = LABEL_DECODING[prediction]
        
        return {
            'prediction': label,
            'confidence': float(proba_spam) if prediction == 1 else float(1 - proba_spam),
            'probability_spam': float(proba_spam),
            'is_spam': prediction == 1
        }
    
    def predict_batch(self, texts: list) -> list:
        """
        Predict multiple SMS messages.
        
        Args:
            texts: List of SMS texts
            
        Returns:
            List of prediction dictionaries
        """
        return [self.predict(text) for text in texts]


# Convenience function for quick inference
def predict(text: str, detector: Optional[SpamDetector] = None) -> Dict[str, Any]:
    """
    Quick prediction function for single SMS.
    
    Args:
        text: SMS text to classify
        detector: Existing SpamDetector instance (optional)
        
    Returns:
        Prediction dictionary
    """
    if detector is None:
        detector = SpamDetector()
        detector.initialize()
    
    return detector.predict(text)


if __name__ == "__main__":
    # Test the inference pipeline
    print("Testing SpamDetector...")
    
    try:
        # Initialize detector
        detector = SpamDetector()
        detector.initialize()
        
        # Test predictions
        test_messages = [
            "Congratulations! You've won a $1000 Walmart gift card. Click here to claim!",
            "Hey, are we still on for lunch tomorrow?",
            "URGENT! Your mobile number has been selected for a £2000 reward. Call now!",
            "Can you pick up some milk on your way home?"
        ]
        
        print("\n" + "=" * 70)
        print("TEST PREDICTIONS")
        print("=" * 70)
        
        for msg in test_messages:
            result = detector.predict(msg)
            label = "🚨 SPAM" if result['is_spam'] else "✅ HAM"
            print(f"\n{label} (confidence: {result['confidence']:.2%})")
            print(f"Message: {msg}")
            print(f"Spam probability: {result['probability_spam']:.4f}")
        
        print("\n" + "=" * 70)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        print("Make sure you have trained the model and saved artifacts first.")
