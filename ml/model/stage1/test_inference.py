"""Test the spam detector with sample messages."""

from utils import SpamDetector

# Initialize detector
detector = SpamDetector()
detector.initialize()

# Test messages
messages = [
    "Congratulations! You've won a $1000 gift card!",
    "Hey, are we still on for lunch?",
    "URGENT! Call now to claim your reward!",
    "Can you pick up some milk?",
    "FREE iPhone! Click here!",
    "Meeting at 3pm tomorrow"
]

print("=" * 70)
print("SPAM DETECTION TEST")
print("=" * 70)

for msg in messages:
    result = detector.predict(msg)
    label = "🚨 SPAM" if result['is_spam'] else "✅ HAM"
    print(f"\n{label} (confidence: {result['confidence']:.2%})")
    print(f"Message: {msg}")
    print(f"Spam probability: {result['probability_spam']:.4f}")

print("\n" + "=" * 70)
print("✅ Inference test complete!")
print("=" * 70)
