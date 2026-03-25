# System Design Decisions - SMS Spam Detection ML System

## 🧠 Architecture Overview

This document explains the **why** behind every major design decision in the system.

---

## 1. Model Selection: TF-IDF + Logistic Regression

### Why NOT Deep Learning?

**Constraints Given:**
- Must run on mobile devices (offline)
- Need fast inference (< 100ms)
- Limited computational resources

**Why TF-IDF + LR is Perfect:**

| Aspect | TF-IDF + LR | Deep Learning |
|--------|-------------|---------------|
| **Model Size** | ~50-100 KB | ~100-500 MB |
| **Inference Time** | ~10-50 ms | ~200-1000 ms |
| **Training Data** | Works with 1K samples | Needs 100K+ samples |
| **Interpretability** | ✅ Feature coefficients | ❌ Black box |
| **Mobile Deployment** | ✅ Easy (ONNX) | ⚠️ Complex (TFLite) |
| **Accuracy** | 90-97% for spam | 95-98% for spam |

**Diminishing Returns:** The 2-3% accuracy gain from deep learning isn't worth:
- 1000x model size increase
- 20x slower inference
- Complex deployment pipeline
- Loss of interpretability

### Why Logistic Regression Specifically?

1. **Linear Model**: Works perfectly with high-dimensional sparse features (TF-IDF)
2. **Probabilistic Output**: `predict_proba()` gives confidence scores for threshold tuning
3. **Class Weights**: Built-in `class_weight='balanced'` handles imbalanced data
4. **Fast Training**: Converges in seconds/minutes vs hours for neural nets
5. **Stable**: Deterministic results with fixed random seed

### Alternatives Considered

**Naive Bayes:**
- ❌ Poor probability calibration
- ❌ Strong independence assumption unrealistic
- ✅ Fast, but not significantly better than LR

**Random Forest:**
- ❌ Slower inference (many trees)
- ❌ Larger model size
- ❌ Overkill for text classification

**SVM:**
- ❌ No probabilistic output (needs Platt scaling)
- ❌ Slower training on large datasets
- ❌ Harder to tune

**Winner: Logistic Regression** ✅

---

## 2. Threshold Tuning Strategy

### The Problem with 0.5

Default threshold assumes:
- P(spam) > 0.5 → spam
- P(spam) ≤ 0.5 → ham

**This is wrong for spam detection because:**

1. **Class Imbalance**: Typically 80-90% ham, 10-20% spam
   - Model becomes biased toward ham
   - Many spam messages get P(spam) = 0.3-0.4

2. **Asymmetric Costs**:
   - **False Negative (spam→ham)**: User sees unwanted spam ❌
   - **False Positive (ham→spam)**: User might miss message ⚠️
   
   Missing spam is WORSE than false alarm!

### Our Solution: Validation-Based Threshold Tuning

**Process:**
1. Train model normally
2. Get prediction probabilities on **validation set** (not test!)
3. Search thresholds from 0.1 to 0.9
4. Select threshold that maximizes recall while maintaining minimum precision

**Example Results:**
```
Threshold = 0.5 (default):
  Spam Recall: 78%
  Spam Precision: 65%
  
Threshold = 0.2 (tuned):
  Spam Recall: 95% ← Better!
  Spam Precision: 38% ← Lower, but acceptable
```

**Why This Works:**
- Lower threshold (0.2) catches more spam
- Messages with P(spam) ≥ 0.2 are flagged
- Trade-off: More false positives, but that's acceptable

### Why Not Go Even Lower (e.g., 0.1)?

**Precision Floor:** We set `min_precision=0.3` to prevent:
- Too many false alarms (ham marked as spam)
- User frustration from checking spam folder constantly
- Important messages being missed

**Sweet Spot:** Maximize recall while keeping precision reasonable.

---

## 3. Data Splitting Strategy

### 70/15/15 Split Rationale

**Standard Practice:**
- **Train (70%)**: Enough data for model to learn patterns
- **Validation (15%)**: Sufficient for reliable threshold tuning
- **Test (15%)**: Unbiased performance estimate

**Why Not 80/20?**
- Need dedicated validation set for threshold tuning
- Can't use test set (contamination)
- 15% val gives stable threshold selection

**Why Stratified?**
- Maintains class distribution across splits
- Prevents all spam ending up in one split
- Ensures representative evaluation

### Critical: NO DATA LEAKAGE

**Rules Followed:**
1. Test set NEVER touched during training
2. Vectorizer fit ONLY on training data
3. Threshold tuned ONLY on validation data
4. Test evaluation done ONCE after everything

**Consequences of Leakage:**
- Optimistic performance estimates
- Model fails in production
- Can't trust metrics

---

## 4. Preprocessing: Minimal Cleaning

### What We Do

```python
def preprocess_text(text):
    return text.lower().strip()
```

**Only lowercasing!** That's it.

### What We DON'T Do (And Why)

| Operation | Typical Approach | Our Decision | Reason |
|-----------|-----------------|--------------|--------|
| **Remove Numbers** | ✅ Common | ❌ NO | Spam has phone numbers, prices, amounts |
| **Remove URLs** | ✅ Common | ❌ NO | URLs are STRONG spam signals |
| **Remove Symbols** | ✅ Common | ❌ NO | $$$, !!!, ??? indicate spam |
| **Remove Stopwords** | ✅ Common | ⚠️ Optional | Some spam uses common words naturally |
| **Lemmatization** | ✅ Common | ❌ NO | Overkill, loses signal |
| **Remove Emojis** | ✅ Common | ❌ NO | Emojis can indicate spam |

### Examples of Preserved Signals

**Spam Message:**
```
"CONGRATULATIONS!!! You've WON $1000! Call 1-800-SCAM-NOW or visit http://scam.com NOW!!!"
```

**Signals preserved:**
- `$$$` (money amounts)
- `!!!` (urgency/excitement)
- `http://` (URLs)
- `1-800` (phone numbers)
- `NOW` (urgency - even though it's a stopword)

**After over-cleaning (WRONG):**
```
"congratulations won call visit scam com"
```
Lost: urgency, monetary incentive, contact method!

**Our approach (RIGHT):**
```
"congratulations!!! you've won $1000! call 1-800-scam-now or visit http://scam.com now!!!"
```
Preserved all spam signals! ✅

---

## 5. TF-IDF Configuration

### max_features=5000

**Why 5000?**
- Balances vocabulary coverage vs model size
- Most discriminative words appear in top 5000
- Beyond 5000: diminishing returns, larger model

**Trade-offs:**
- Smaller (1000): Misses important features
- Larger (10000): Marginal accuracy gain, 2x model size

### ngram_range=(1, 2)

**Unigrams (1):** Individual words
- "free", "winner", "congratulations"

**Bigrams (2):** Word pairs
- "free money", "call now", "click here"

**Why Both?**
- Bigrams capture context and common phrases
- Many spam indicators are multi-word expressions

**Why Not Trigrams?**
- Explosion of features (vocabulary size)
- Most trigrams are too specific
- Marginal benefit over bigrams

### stop_words='english'

**Controversial Choice!**

**Arguments Against:**
- Removes potentially useful words
- Spam often uses natural language

**Arguments For:**
- Reduces noise from common words
- Faster training, smaller model
- Focuses on content words

**Our Decision:** Remove stopwords for efficiency, but this is debatable.

### min_df=2, max_df=0.95

**min_df=2:** Ignore words appearing in < 2 documents
- Removes typos, extremely rare words
- Prevents overfitting to unique terms

**max_df=0.95:** Ignore words in > 95% of documents
- Removes ultra-common words that survived stopword removal
- "hi", "thanks", "ok" might be in almost every message

---

## 6. Class Weight Balancing

### The Imbalance Problem

Typical SMS dataset:
- 80-90% ham
- 10-20% spam

**Without balancing:**
- Model learns to predict "ham" always
- Achieves 85% accuracy by doing nothing!
- Spam recall = 0% (catches no spam)

### class_weight='balanced' Solution

**What It Does:**
- Automatically weights classes inversely proportional to frequency
- Spam gets higher weight (e.g., 4x if 20% of data)
- Model penalized more for misclassifying spam

**Mathematical Formulation:**
```
weight_class = n_samples / (n_classes * n_samples_class)

If 80% ham, 20% spam:
  weight_ham = 1000 / (2 * 800) = 0.625
  weight_spam = 1000 / (2 * 200) = 2.5
```

Spam misclassification is 4x more costly! ✅

### Alternative: SMOTE (Not Used)

**Synthetic Minority Oversampling:**
- Generate synthetic spam samples
- Balance dataset artificially

**Why NOT used:**
- Adds complexity
- Synthetic samples may not be realistic
- `class_weight='balanced'` works well enough

---

## 7. ONNX for Mobile Deployment

### Why ONNX > TensorFlow Lite for sklearn

**Conversion Path:**

```
scikit-learn model
    ↓
skl2onnx (direct conversion)
    ↓
ONNX model ✅
    ↓
ONNX Runtime Mobile
```

vs

``` 
scikit-learn model
    ↓
??? (no direct path)
    ↓
Convert to TensorFlow first (complex!)
    ↓
TensorFlow Lite
    ↓
TFLite Interpreter
```

### Technical Advantages

| Aspect | ONNX | TFLite |
|--------|------|--------|
| **sklearn Support** | ✅ Native | ❌ None |
| **Conversion** | ✅ One step | ❌ Multi-step hack |
| **Mobile Runtime** | ✅ Optimized | ✅ Optimized |
| **iOS Support** | ✅ CoreML backend | ✅ Metal backend |
| **Android Support** | ✅ NNAPI backend | ✅ NNAPI backend |
| **Model Size** | ✅ Compact | Similar |

### Implementation Details

**Our Export Strategy:**

1. **Full Pipeline Export:**
   ```python
   pipeline = Pipeline([
       ('tfidf', vectorizer),
       ('classifier', model)
   ])
   ```
   
2. **String Input:**
   - Accept raw text directly
   - ONNX handles TF-IDF internally
   - Simpler mobile integration

3. **Optimization:**
   ```python
   options={'tfidf': {'optim': 'cdist'}}
   ```
   - Optimizes TF-IDF distance computation
   - Faster inference on mobile

### Mobile Integration Code

**Android (Kotlin):**
```kotlin
// Load ONNX model
val session = env.createSession("model.onnx")

// Run inference
val input = arrayOf("FREE iPhone!")
val result = session.run(mapOf("input" to input))
val isSpam = result[0].probability > 0.2
```

**iOS (Swift):**
```swift
// Load ONNX model
let session = try OrtSession(env: env, modelPath: "model.onnx")

// Run inference
let input = ["FREE iPhone!"]
let result = try session.run(inputNames: ["input"], values: [input])
let isSpam = result.probability > 0.2
```

---

## 8. Reproducibility & Random Seeds

### Setting Seeds Everywhere

```python
RANDOM_SEED = 42

# Data splitting
train_test_split(..., random_state=RANDOM_SEED)

# Model initialization
LogisticRegression(random_state=RANDOM_SEED)

# Numpy operations
np.random.seed(RANDOM_SEED)
```

### Why This Matters

1. **Debugging**: Same results every run = easier to debug
2. **Comparison**: Fair comparison when changing hyperparameters
3. **Production**: Consistent behavior across deployments
4. **Science**: Others can reproduce your results

### What Could Go Wrong Without Seeds

**Scenario:**
- Monday: Train model, get 95% recall ✅
- Tuesday: Retrain for deployment, get 87% recall ❌
- Why? Different random split, different initialization

**With seeds:** Always get same results! ✅

---

## 9. Config-Driven Design

### All Parameters in config.py

**Benefits:**

1. **Single Source of Truth:**
   - No hunting through code for hyperparameters
   - Clear documentation of all choices

2. **Easy Experimentation:**
   ```python
   # Try different TF-IDF settings
   TFIDF_CONFIG['max_features'] = 10000
   TFIDF_CONFIG['ngram_range'] = (1, 3)
   ```

3. **Version Control:**
   - Track parameter changes in git
   - Rollback if new params don't work

4. **Team Collaboration:**
   - Everyone uses same parameters
   - Clear communication about settings

### Example Configuration Change

**Goal:** Improve recall even further

```python
# Before
THRESHOLD_CONFIG = {
    'min_precision': 0.3,
}

# After (accept more false positives for higher recall)
THRESHOLD_CONFIG = {
    'min_precision': 0.25,  # Lower bar
}
```

**Result:** Recall increases from 95% → 97%, precision drops slightly

---

## 10. Evaluation Philosophy

### Test Set: Touch Once!

**Golden Rule:** Test set evaluated ONLY AFTER:
1. ✅ Model trained
2. ✅ Threshold tuned
3. ✅ All decisions made

**Why:**
- Test set represents "real world"
- Once you peek, it's contaminated
- Can't trust performance estimates

### Metrics Hierarchy

**Primary Metric: Spam Recall**
```
Recall = True Positives / (True Positives + False Negatives)
```
**Goal:** Catch as many spam as possible

**Secondary Metric: Spam Precision**
```
Precision = True Positives / (True Positives + False Positives)
```
**Constraint:** Keep above minimum threshold (0.3)

**Tertiary Metrics:**
- F1-Score: Harmonic mean (useful for comparison)
- Accuracy: Overall correctness (misleading for imbalanced data)
- Confusion Matrix: Detailed breakdown

### Business Impact Translation

**Technical Metrics → Business Value:**

```
Spam Recall: 95%
  → 950 out of 1000 spam messages blocked
  → 50 spam reach users (acceptable)

Spam Precision: 38%
  → Of 100 messages flagged as spam, 38 are actually spam
  → 62 ham messages in spam folder (trade-off)

Business Decision:
  ✅ Users prefer seeing some ham in spam folder
  ✅ Rather than missing important spam
```

---

## 11. Common Pitfalls & How We Avoid Them

### Pitfall 1: Data Leakage

**Problem:**
- Fitting vectorizer on entire dataset
- Using test set for threshold tuning

**Our Solution:**
```python
# CORRECT
vectorizer.fit(X_train)  # Only train data
X_val_tfidf = vectorizer.transform(X_val)  # Use fitted vectorizer
```

### Pitfall 2: Default Threshold

**Problem:**
- Using 0.5 without thinking
- Missing lots of spam

**Our Solution:**
- Explicit threshold tuning on validation set
- Optimize for business metric (recall)

### Pitfall 3: Over-Cleaning Text

**Problem:**
- Removing URLs, numbers, symbols
- Losing spam signals

**Our Solution:**
- Minimal preprocessing (lowercase only)
- Preserve all potential spam indicators

### Pitfall 4: Ignoring Class Imbalance

**Problem:**
- Training on imbalanced data without adjustment
- Model predicts majority class always

**Our Solution:**
- `class_weight='balanced'` in Logistic Regression
- Penalizes misclassifying minority class more

### Pitfall 5: No Reproducibility

**Problem:**
- Different results every run
- Can't debug or compare

**Our Solution:**
- Fixed random seeds everywhere
- Config-driven parameters

---

## 12. Future Extensibility Design

### User Feedback Loop

**Design Decision:** Store prediction metadata

```python
result = {
    'prediction': 'spam',
    'confidence': 0.92,
    'probability_spam': 0.92,
    'is_spam': True,
    'timestamp': datetime.now(),
    'message_id': uuid4()
}
```

**Why:** Enables collecting user corrections for retraining

### Model Versioning

**Directory Structure Ready:**
```
artifacts/
├── v1.0.0/
│   └── model.pkl
├── v1.1.0/
│   └── model.pkl
└── current/ → symlink to latest
```

**Why:** Easy rollback if new version underperforms

### A/B Testing Framework

**Design:** Multiple threshold configurations

```python
# config.py
THRESHOLDS = {
    'control': 0.5,
    'experiment_a': 0.2,
    'experiment_b': 0.3
}
```

**Why:** Test different thresholds in production

---

## Summary: Key Takeaways

1. **TF-IDF + LR**: Perfect balance of performance, speed, and interpretability for spam detection
2. **Threshold Tuning**: Critical for imbalanced problems; default 0.5 is usually wrong
3. **Minimal Preprocessing**: Preserve spam signals (URLs, numbers, symbols)
4. **Data Hygiene**: Strict train/val/test separation prevents leakage
5. **ONNX for Mobile**: Best choice for sklearn models on mobile devices
6. **Reproducibility**: Fixed seeds enable debugging and comparison
7. **Config-Driven**: Makes experimentation and deployment easier
8. **Business-Aligned Metrics**: Optimize for what matters (spam recall)

---

**This system is production-grade because every decision was intentional and documented.** 🎯
