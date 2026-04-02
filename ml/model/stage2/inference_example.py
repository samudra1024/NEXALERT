"""
Example: Using Stage 2 ONNX model for HAM message categorization.

This demonstrates how to load and use the exported ONNX model
for inference on mobile or production systems.
"""

import numpy as np


def example_basic_inference():
    """Basic inference with Stage 2 ONNX model."""
    
    try:
        import onnxruntime as ort
    except ImportError:
        print("❌ onnxruntime not installed!")
        print("Install with: pip install onnxruntime")
        return
    
    from ml.model.config import ARTIFACTS_DIR, HAM_CATEGORIES
    
    # Load model
    model_path = ARTIFACTS_DIR / "stage2_model.onnx"
    
    if not model_path.exists():
        print(f"❌ ERROR: Model file not found at {model_path}")
        print(f"\nPlease export the Stage 2 model first:")
        print(f"  python -m ml.model.stage2.export_onnx")
        return
    
    sess = ort.InferenceSession(str(model_path))
    
    # Get input/output names
    input_name = sess.get_inputs()[0].name
    output_name = sess.get_outputs()[0].name
    
    print("=" * 70)
    print("STAGE 2 ONNX INFERENCE EXAMPLE")
    print("=" * 70)
    
    # Test messages
    test_messages = [
        "Hey, are we still on for lunch tomorrow?",
        "Your account balance is $5,432.10 as of today",
        "Your OTP for transaction is 847291. Valid for 10 minutes",
        "Monthly subscription renewal: $9.99 will be charged tomorrow",
        "FLASH SALE! 50% OFF on all items! Today only!",
        "Meeting rescheduled to 3pm in conference room B"
    ]
    
    print(f"\nRunning inference on {len(test_messages)} messages...\n")
    
    # Run inference
    for text in test_messages:
        # Prepare input (reshape for batch)
        X = np.array([text]).reshape(-1, 1)
        
        # Get prediction
        outputs = sess.run(None, {input_name: X})
        prediction = outputs[0][0]
        
        # Map to category
        idx = int(prediction)
        category = HAM_CATEGORIES[idx] if idx < len(HAM_CATEGORIES) else f"Unknown({idx})"
        
        print(f"Text: '{text[:50]}...'")
        print(f"  → Predicted: {category} (index: {idx})")
        print()
    
    print("=" * 70)


def example_batch_inference():
    """Batch inference for multiple messages."""
    
    try:
        import onnxruntime as ort
    except ImportError:
        print("❌ onnxruntime not installed!")
        return
    
    from ml.model.config import ARTIFACTS_DIR, HAM_CATEGORIES
    
    # Load model
    model_path = ARTIFACTS_DIR / "stage2_model.onnx"
    
    if not model_path.exists():
        print(f"❌ ERROR: Model file not found at {model_path}")
        print(f"\nPlease run export first:")
        print(f"  python -m ml.model.stage2.export_onnx")
        return
    
    sess = ort.InferenceSession(str(model_path))
    
    input_name = sess.get_inputs()[0].name
    
    # Batch of messages
    messages = [
        "Your salary has been credited",
        "Happy birthday! 🎉",
        "Your order has been shipped",
        "URGENT! Claim your prize now!",
        "Team meeting at 2pm"
    ]
    
    print("\n" + "=" * 70)
    print("BATCH INFERENCE EXAMPLE")
    print("=" * 70)
    
    # Prepare batch input
    X = np.array(messages).reshape(-1, 1)
    
    # Run batch inference
    outputs = sess.run(None, {input_name: X})
    predictions = outputs[0].flatten()
    
    # Display results
    for msg, pred in zip(messages, predictions):
        idx = int(pred)
        category = HAM_CATEGORIES[idx] if idx < len(HAM_CATEGORIES) else f"Unknown({idx})"
        print(f"  {msg:<50} → {category}")
    
    print("=" * 70)


def example_with_probability_output():
    """Inference with probability scores (if available)."""
    
    try:
        import onnxruntime as ort
    except ImportError:
        print("❌ onnxruntime not installed!")
        return
    
    from ml.model.config import ARTIFACTS_DIR, HAM_CATEGORIES
    
    # Load model
    model_path = ARTIFACTS_DIR / "stage2_model.onnx"
    
    if not model_path.exists():
        print(f"❌ ERROR: Model file not found at {model_path}")
        print(f"\nRun export first:")
        print(f"  python -m ml.model.stage2.export_onnx")
        return
    
    sess = ort.InferenceSession(str(model_path))
    
    input_name = sess.get_inputs()[0].name
    output_names = [out.name for out in sess.get_outputs()]
    
    print("\n" + "=" * 70)
    print("INFERENCE WITH PROBABILITY OUTPUT")
    print("=" * 70)
    
    text = "Your bank account has been credited with $1000"
    X = np.array([text]).reshape(-1, 1)
    
    # Get all outputs
    outputs = sess.run(None, {input_name: X})
    
    print(f"Text: '{text}'")
    print(f"Number of outputs: {len(outputs)}")
    print(f"Output names: {output_names}")
    
    for i, (name, output) in enumerate(zip(output_names, outputs)):
        print(f"\nOutput {i} ({name}):")
        print(f"  Shape: {output.shape}")
        print(f"  Values: {output[0]}")
    
    print("=" * 70)


def example_mobile_deployment():
    """Example optimized for mobile deployment."""
    
    try:
        import onnxruntime as ort
    except ImportError:
        print("❌ onnxruntime not installed!")
        return
    
    from ml.model.config import ARTIFACTS_DIR, HAM_CATEGORIES
    
    # Configure session for mobile optimization
    session_options = ort.SessionOptions()
    session_options.intra_op_num_threads = 1  # Single thread for mobile
    session_options.inter_op_num_threads = 1
    
    model_path = ARTIFACTS_DIR / "stage2_model.onnx"
    
    if not model_path.exists():
        print(f"❌ ERROR: Model file not found at {model_path}")
        print(f"\nExport the model first:")
        print(f"  python -m ml.model.stage2.export_onnx")
        return
    
    sess = ort.InferenceSession(
        str(model_path),
        sess_options=session_options
    )
    
    input_name = sess.get_inputs()[0].name
    
    print("\n" + "=" * 70)
    print("MOBILE DEPLOYMENT EXAMPLE")
    print("=" * 70)
    
    # Single message inference
    message = "Your verification code is 123456"
    X = np.array([message]).reshape(-1, 1)
    
    # Run inference
    outputs = sess.run(None, {input_name: X})
    prediction = outputs[0][0]
    
    idx = int(prediction)
    category = HAM_CATEGORIES[idx] if idx < len(HAM_CATEGORIES) else f"Unknown({idx})"
    
    print(f"Message: '{message}'")
    print(f"Prediction: {category}")
    print(f"Category index: {idx}")
    print("=" * 70)


class Stage2HAMClassifier:
    """
    Production-ready HAM classifier wrapper.
    
    Usage:
        classifier = Stage2HAMClassifier()
        result = classifier.predict("Your message here")
        print(result['category'])
    """
    
    def __init__(self, model_path: str = None):
        """Initialize classifier with ONNX model."""
        import onnxruntime as ort
        from ml.model.config import ARTIFACTS_DIR
        
        model_path = model_path or (ARTIFACTS_DIR / "stage2_model.onnx")
        
        if not model_path.exists():
            raise FileNotFoundError(
                f"Stage 2 ONNX model not found at {model_path}. "
                "Please run 'python -m ml.model.stage2.export_onnx' first."
            )
        
        self.sess = ort.InferenceSession(str(model_path))
        self.input_name = self.sess.get_inputs()[0].name
        self.categories = HAM_CATEGORIES
    
    def predict(self, text: str) -> dict:
        """
        Predict category for single message.
        
        Args:
            text: SMS text
            
        Returns:
            Dictionary with prediction details
        """
        X = np.array([text]).reshape(-1, 1)
        outputs = self.sess.run(None, {self.input_name: X})
        
        prediction = outputs[0][0]
        idx = int(prediction)
        
        return {
            'category': self.categories[idx] if idx < len(self.categories) else f'Unknown({idx})',
            'category_index': idx,
            'confidence': 1.0,  # Would need probability output for real confidence
            'all_outputs': outputs
        }
    
    def predict_batch(self, texts: list) -> list:
        """
        Predict categories for multiple messages.
        
        Args:
            texts: List of SMS texts
            
        Returns:
            List of prediction dictionaries
        """
        X = np.array(texts).reshape(-1, 1)
        outputs = self.sess.run(None, {self.input_name: X})
        
        predictions = outputs[0].flatten()
        
        results = []
        for idx in predictions:
            cat_idx = int(idx)
            results.append({
                'category': self.categories[cat_idx] if cat_idx < len(self.categories) else f'Unknown({cat_idx})',
                'category_index': cat_idx,
                'confidence': 1.0
            })
        
        return results


if __name__ == "__main__":
    print("Stage 2 ONNX Model Inference Examples")
    print("=" * 70)
    
    # Run examples
    try:
        example_basic_inference()
        example_batch_inference()
        # example_with_probability_output()
        example_mobile_deployment()
        
        # Test wrapper class
        print("\nTesting wrapper class...")
        classifier = Stage2HAMClassifier()
        result = classifier.predict("Your salary has been credited to account")
        print(f"Result: {result['category']}")
        
        print("\n✅ All examples completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Example failed: {e}")
        import traceback
        traceback.print_exc()
