package com.frontend.ml

import ai.onnxruntime.OnnxMap
import ai.onnxruntime.OnnxSequence
import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OnnxValue
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import java.io.File
import java.io.FileOutputStream
import org.json.JSONObject
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock
import kotlin.math.max
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

data class MlResult(
    val isSpam: Boolean,
    val confidence: Float,
    val category: String
)

class MlPipelineManager private constructor(private val context: Context) {
    private val ortEnv: OrtEnvironment = OrtEnvironment.getEnvironment()
    private var stage1Session: OrtSession? = null
    private var stage2Session: OrtSession? = null
    private var spamThreshold: Float = 0.5f

    /** TEMP: Android-only runtime trace for HAM SMS verification. Remove after debugging. */
    private fun shouldLogAndroidRuntime(message: String): Boolean {
        return true
    }

    private fun logRuntime(tag: String, message: String) {
        android.util.Log.d("AndroidRuntimeML", "[$tag] $message")
    }
    // Production-grade reliability flags
    @Volatile
    private var modelLoaded = AtomicBoolean(false)
    // CHANGE: Replaced kotlinx.coroutines.sync.Mutex with ReentrantLock so model
    // loading and inference can use blocking withLock without requiring suspend.
    private val modelLock = ReentrantLock()
    private val messageQueue = ConcurrentLinkedQueue<QueuedMessage>()
    private val backgroundScope = CoroutineScope(Dispatchers.IO) // Background thread for model loading
    
    // Performance monitoring
    private var modelLoadTimeMs: Long = 0
    private var stage1LoadTimeMs: Long = 0
    private var stage2LoadTimeMs: Long = 0
    private var firstInferenceTimeMs: Long = -1
    private val INFERENCE_TIMEOUT_MS = 5000L // 5 seconds timeout
    private var isFirstInference = true

    init {
        // Load models asynchronously to avoid blocking main thread
        backgroundScope.launch {
            loadModelsSafely()
        }
    }

    // Enhanced model loading with safety guards and detailed timing
    // CHANGE: Removed suspend — Mutex was the only suspension point; ReentrantLock.withLock is blocking.
    private fun loadModelsSafely() {
        android.util.Log.d("MODEL_LOAD", "loadModelsSafely() started")
        if (modelLoaded.get()) return
        
        val totalStartTime = System.currentTimeMillis()
        android.util.Log.d("MlPipelineManager", "========== ML MODEL LOADING START ==========")
        
        try {
            modelLock.withLock {
                // Double-check after acquiring lock
                if (modelLoaded.get()) return@loadModelsSafely
                
                // Load Stage 1 with timing
                val stage1StartTime = System.currentTimeMillis()
                android.util.Log.d("MlPipelineManager", "[1/3] Loading Stage 1 (Spam Detection)...")
                stage1Session = loadSession("models/v1/stage1.onnx", "stage1.onnx")
                spamThreshold = loadSpamThreshold()
                stage1LoadTimeMs = System.currentTimeMillis() - stage1StartTime
                android.util.Log.d("MlPipelineManager", "[1/3] Stage 1 loaded in ${stage1LoadTimeMs}ms (threshold=$spamThreshold)")
                
                // Load Stage 2 with timing
                val stage2StartTime = System.currentTimeMillis()
                android.util.Log.d("MlPipelineManager", "[2/3] Loading Stage 2 (Categorization)...")
                stage2Session = loadSession("models/v1/stage2.onnx", "stage2.onnx")
                stage2LoadTimeMs = System.currentTimeMillis() - stage2StartTime
                android.util.Log.d("MlPipelineManager", "[2/3] Stage 2 loaded in ${stage2LoadTimeMs}ms")
                
                modelLoaded.set(true)
                android.util.Log.d("MODEL_LOAD", "modelLoaded=true")
                android.util.Log.d("MODEL_READY", "Models loaded successfully")
                modelLoadTimeMs = System.currentTimeMillis() - totalStartTime
                
                logModelDebugInfoOnce()
                
                android.util.Log.d("MlPipelineManager", "========== ML MODEL LOADING COMPLETE ==========")
                android.util.Log.d("MlPipelineManager", "  Stage 1 (Spam Detection): ${stage1LoadTimeMs}ms")
                android.util.Log.d("MlPipelineManager", "  Stage 2 (Categorization): ${stage2LoadTimeMs}ms")
                android.util.Log.d("MlPipelineManager", "  TOTAL LOAD TIME: ${modelLoadTimeMs}ms")
                android.util.Log.d("MlPipelineManager", "================================================")
                
                // Process any queued messages
                processQueuedMessages()
            }

            // Schedule one-time inbox backfill after models are ready (background, idempotent)
            if (modelLoaded.get()) {
                InitialSmsClassifier.scheduleAfterModelsLoaded(context)
            }
        } catch (e: Exception) {
            android.util.Log.e("MODEL_LOAD", "Model loading failed", e)
            android.util.Log.e("MlPipelineManager", "Error loading ONNX models", e)
            modelLoaded.set(false)
        }
    }

    // CHANGE: Removed deprecated loadModels() wrapper — it incorrectly called suspend
    // loadModelsSafely() from a non-suspend context and was unused in the codebase.

    private fun loadSession(assetPath: String, fileName: String): OrtSession {
        val sessionStartTime = System.currentTimeMillis()
        android.util.Log.d("MlPipelineManager", "  → Extracting $fileName from assets...")
        
        val file = File(context.cacheDir, fileName)

        // Always replace the cached model with the latest asset
        if (file.exists()) {
            file.delete()
        }

        val extractStartTime = System.currentTimeMillis()
        context.assets.open(assetPath).use { inputStream ->
            FileOutputStream(file).use { outputStream ->
                inputStream.copyTo(outputStream)
            }
        }
        val extractTime = System.currentTimeMillis() - extractStartTime
        android.util.Log.d("MlPipelineManager", "  → Extraction completed in ${extractTime}ms")
        
        android.util.Log.d("MlPipelineManager", "  → Creating ONNX session for $fileName...")
        val sessionCreateStart = System.currentTimeMillis()
        val session = ortEnv.createSession(file.absolutePath)
        val sessionCreateTime = System.currentTimeMillis() - sessionCreateStart
        
        android.util.Log.d("MlPipelineManager", "  → ONNX session created in ${sessionCreateTime}ms")
        android.util.Log.d("MlPipelineManager", "  → File size: ${file.length() / 1024}KB")
        
        return session
    }

    /** Load tuned spam threshold saved during Python training (models/v1/threshold.json). */
    private fun loadSpamThreshold(): Float {
        return try {
            context.assets.open("models/v1/threshold.json").use { inputStream ->
                val threshold = JSONObject(inputStream.bufferedReader().readText()).getDouble("threshold").toFloat()
                android.util.Log.d("MlPipelineManager", "Loaded Stage 1 threshold: $threshold")
                threshold
            }
        } catch (e: Exception) {
            android.util.Log.w("MlPipelineManager", "Failed to load threshold.json; using default 0.5", e)
            0.5f
        }
    }

    // Lazy initialization guard for app killed scenarios
    private fun ensureModelLoaded() {
        if (!modelLoaded.get()) {
            // Trigger async loading if not loaded
            backgroundScope.launch {
                loadModelsSafely()
            }
        }
    }
    
    fun processMessage(message: String): MlResult {
        android.util.Log.d("MODEL_READY", "modelLoaded=" + modelLoaded.get())

        // Lazy initialization for robustness
        ensureModelLoaded()
        
        // Queue message if model not ready yet
        if (!modelLoaded.get()) {
            android.util.Log.w("MlPipelineManager", "Model not ready, queuing message")
            messageQueue.add(QueuedMessage(message))
            return getSafeFallback() // Return safe default immediately
        }

        android.util.Log.d("MODEL_READY", "Running inference")

        return runInferenceWithTimeout(message)
    }
    
    // Thread-safe inference with detailed timing
    // CHANGE: Removed suspend — ReentrantLock.withLock provides the same mutual exclusion
    // synchronously, so processMessage() can call this without a coroutine context.
    private fun runInferenceWithTimeout(message: String): MlResult {
        val startTime = System.currentTimeMillis()
        
        return try {
            modelLock.withLock {
                runInferenceInternal(message)
            }.also {
                val inferenceTime = System.currentTimeMillis() - startTime
                
                // Log first inference separately for cold start analysis
                if (isFirstInference) {
                    firstInferenceTimeMs = inferenceTime
                    isFirstInference = false
                    android.util.Log.d("MlPipelineManager", "========== FIRST INFERENCE ==========")
                    android.util.Log.d("MlPipelineManager", "  First inference (cold start): ${firstInferenceTimeMs}ms")
                    android.util.Log.d("MlPipelineManager", "  Message length: ${message.length} chars")
                    android.util.Log.d("MlPipelineManager", "  Result: isSpam=${it.isSpam}, category=${it.category}")
                    android.util.Log.d("MlPipelineManager", "=====================================")
                } else if (inferenceTime > 100) {
                    android.util.Log.w("MlPipelineManager", "Slow inference: ${inferenceTime}ms")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("MlPipelineManager", "Inference error", e)
            getSafeFallback()
        }
    }
    
    // Original inference logic - UNCHANGED, just wrapped for safety
    private fun runInferenceInternal(message: String): MlResult {
        android.util.Log.d("ML_START", "runInferenceInternal() called with: $message")
        var isSpam = false
        var confidence = 0.0f
        var category = "unknown"
        val runtimeDebug = shouldLogAndroidRuntime(message)

        if (runtimeDebug) {
            logRuntime("SMS", "body=\"$message\"")
        }
        
        val s1 = stage1Session
        if (s1 == null) {
            android.util.Log.e("MlPipelineManager", "Stage 1 session is null")
            if (runtimeDebug) logRuntime("FAIL", "Stage 1 session is null")
            return MlResult(isSpam, confidence, category)
        }

        try {
            // Stage 1: Spam Detection — outputs output_label (int64) + output_probability (seq(map))
            val inputName = s1.inputNames.iterator().next()
            val inputTensor = OnnxTensor.createTensor(ortEnv, arrayOf(message))
            val results = s1.run(mapOf(inputName to inputTensor))

            val spamLabel = parseSpamLabel(results)
            val spamProb = parseClassProbability(results, spamClassKey = 1L)
            isSpam = spamProb >= spamThreshold
            confidence = if (isSpam) spamProb else (1f - spamProb)

            if (runtimeDebug) {
                logRuntime("Stage1", "spamLabel=$spamLabel onnxDefault=${spamLabel == 1L}")
                logRuntime("Stage1", "spamProb=$spamProb threshold=$spamThreshold")
                logRuntime("Stage1", "confidence=$confidence")
                logRuntime("Stage1", "isSpam=$isSpam")
            }

            var stage2Results: OrtSession.Result? = null
            var stage2Probs: Map<String, Float>? = null

            // Stage 2: Categorization — outputs output_label (string) + output_probability (seq(map))
            if (!isSpam) {
                val s2 = stage2Session
                if (s2 != null) {
                    val stage2InputName = s2.inputNames.iterator().next()
                    val stage2InputTensor = OnnxTensor.createTensor(ortEnv, arrayOf(message))

                    if (runtimeDebug) {
                        logRuntime("Stage2", "IMMEDIATELY BEFORE s2.run() inputName=$stage2InputName")
                    }

                    stage2Results = s2.run(mapOf(stage2InputName to stage2InputTensor))

                    if (runtimeDebug) {
                        val outputKeys = stage2Results.map { it.key }
                        logRuntime("Stage2", "IMMEDIATELY AFTER s2.run() stage2Results.keys=$outputKeys")
                        for (entry in stage2Results) {
                            val outputName = entry.key
                            val onnxValue = entry.value
                            logRuntime(
                                "Stage2Output",
                                "outputName=$outputName | class=${onnxValue?.javaClass?.name} | value=${describeOnnxValue(onnxValue)}"
                            )
                        }
                    }

                    category = parseCategoryLabel(stage2Results, runtimeDebug)
                    stage2Probs = extractProbabilityMap(stage2Results)

                    stage2Results.close()
                    stage2InputTensor.close()
                } else if (runtimeDebug) {
                    logRuntime("FAIL", "Stage 2 session is null — categorization skipped")
                }
            } else if (runtimeDebug) {
                logRuntime("FAIL", "Stage 2 skipped because Stage 1 isSpam=true")
            }

            // TEMP diagnostic — log raw model output before closing Stage1 results
            logClassificationDebug(
                message = message,
                stage1Results = results,
                stage2Probs = stage2Probs,
                predictedLabel = if (isSpam) null else category,
                spamLabel = spamLabel,
                spamProb = spamProb,
                isSpam = isSpam,
                finalCategory = category
            )

            results.close()
            inputTensor.close()

        } catch (e: Exception) {
            android.util.Log.e("MlPipelineManager", "Inference error", e)
            if (runtimeDebug) logRuntime("FAIL", "Exception during inference: ${e.javaClass.name}: ${e.message}")
        }

        if (runtimeDebug) {
            logRuntime("Final", "isSpam=$isSpam confidence=$confidence category=$category")
        }

        return MlResult(isSpam, confidence, category)
    }

    /** TEMP: Describe OnnxValue for Android runtime logging. */
    private fun describeOnnxValue(onnxValue: OnnxValue?): String {
        if (onnxValue == null) return "null"
        return try {
            val raw = onnxValue.value
            "rawClass=${raw?.javaClass?.name} rawValue=$raw toString=${onnxValue}"
        } catch (e: Exception) {
            "errorReadingValue=${e.message} toString=${onnxValue}"
        }
    }

    /** Stage 1 output_label: tensor(int64) — 0=ham, 1=spam */
    private fun parseSpamLabel(results: OrtSession.Result): Long {
        val labelValue = results.get("output_label").orElse(null) ?: return 0L
        return extractLongFromOnnxValue(labelValue)
    }

    /** Stage 2 output_label: tensor(string) — category name directly from model */
    private fun parseCategoryLabel(results: OrtSession.Result, runtimeDebug: Boolean = false): String {
        val availableKeys = results.map { it.key }
        if (runtimeDebug) {
            logRuntime("parseCategoryLabel", "availableKeys=$availableKeys")
        }

        val labelValue = results.get("output_label").orElse(null)
        if (runtimeDebug) {
            logRuntime(
                "parseCategoryLabel",
                "output_label present=${labelValue != null} | class=${labelValue?.javaClass?.name} | value=${describeOnnxValue(labelValue)}"
            )
        }

        if (labelValue == null) {
            if (runtimeDebug) {
                logRuntime(
                    "parseCategoryLabel",
                    "RETURNING unknown — FAILED: results.get(\"output_label\") was empty (key missing from stage2Results)"
                )
            }
            return "unknown"
        }

        val extracted = extractStringFromOnnxValue(labelValue, runtimeDebug)
        if (runtimeDebug) {
            logRuntime("parseCategoryLabel", "extractedString=$extracted")
        }

        if (extracted == "unknown" && runtimeDebug) {
            logRuntime(
                "parseCategoryLabel",
                "RETURNING unknown — FAILED: extractStringFromOnnxValue could not read a non-empty string (see extractString logs above)"
            )
        } else if (runtimeDebug) {
            logRuntime("parseCategoryLabel", "returning category=$extracted")
        }

        return extracted
    }

    /** output_probability: sequence(map(key, float)) — first map entry in sequence */
    private fun parseClassProbability(results: OrtSession.Result, spamClassKey: Long): Float {
        val probValue = results.get("output_probability").orElse(null) ?: return 0f
        if (probValue !is OnnxSequence) return 0f
        val seqList = probValue.value as? List<*> ?: return 0f
        if (seqList.isEmpty()) return 0f
        val mapValue = seqList[0] as? OnnxMap ?: return 0f
        val probMap = mapValue.value ?: return 0f
        for ((key, value) in probMap) {
            val keyLong = when (key) {
                is Number -> key.toLong()
                else -> null
            }
            if (keyLong == spamClassKey) {
                return when (value) {
                    is Float -> value
                    is Double -> value.toFloat()
                    is Number -> value.toFloat()
                    else -> 0f
                }
            }
        }
        return 0f
    }

    private fun extractLongFromOnnxValue(onnxValue: OnnxValue): Long {
        return when (val v = onnxValue.value) {
            is LongArray -> if (v.isNotEmpty()) v[0] else 0L
            is Array<*> -> (v.firstOrNull() as? Number)?.toLong() ?: 0L
            is Number -> v.toLong()
            else -> {
                if (onnxValue is OnnxTensor) {
                    onnxValue.longBuffer?.let { buf ->
                        if (buf.capacity() > 0) buf.get(0) else 0L
                    } ?: 0L
                } else {
                    0L
                }
            }
        }
    }

    private fun extractStringFromOnnxValue(onnxValue: OnnxValue, runtimeDebug: Boolean = false): String {
        val v = onnxValue.value
        if (runtimeDebug) {
            logRuntime("extractString", "onnxValue.class=${onnxValue.javaClass.name} | v.class=${v?.javaClass?.name} | v=$v")
        }

        return when (v) {
            is Array<*> -> {
                val first = v.firstOrNull()
                if (runtimeDebug) {
                    logRuntime("extractString", "branch=Array size=${v.size} first.class=${first?.javaClass?.name} first=$first")
                }
                (first as? String)?.takeIf { it.isNotEmpty() } ?: run {
                    if (runtimeDebug) {
                        logRuntime(
                            "extractString",
                            "FAIL branch=Array — first element is not a non-empty String (first=$first)"
                        )
                    }
                    "unknown"
                }
            }
            is String -> {
                if (runtimeDebug) logRuntime("extractString", "branch=String value=\"$v\"")
                v.ifEmpty {
                    if (runtimeDebug) logRuntime("extractString", "FAIL branch=String — value is empty")
                    "unknown"
                }
            }
            else -> {
                if (onnxValue is OnnxTensor) {
                    val tensorValue = onnxValue.value
                    if (runtimeDebug) {
                        logRuntime(
                            "extractString",
                            "branch=OnnxTensor tensorValue.class=${tensorValue?.javaClass?.name} tensorValue=$tensorValue"
                        )
                    }
                    (tensorValue as? Array<*>)?.firstOrNull()?.let { first ->
                        if (runtimeDebug) logRuntime("extractString", "OnnxTensor array first.class=${first.javaClass.name} first=$first")
                        (first as? String)?.takeIf { it.isNotEmpty() }
                    } ?: run {
                        if (runtimeDebug) {
                            logRuntime(
                                "extractString",
                                "FAIL branch=OnnxTensor — tensorValue is not Array with non-empty String first element"
                            )
                        }
                        null
                    } ?: "unknown"
                } else {
                    if (runtimeDebug) {
                        logRuntime(
                            "extractString",
                            "FAIL branch=else — v is neither Array, String, nor OnnxTensor (v.class=${v?.javaClass?.name})"
                        )
                    }
                    "unknown"
                }
            }
        }
    }
    
    // Safe fallback - never crash
    private fun getSafeFallback(): MlResult {
        return MlResult(
            isSpam = false,
            confidence = 0.0f,
            category = "unknown"
        )
    }
    
    // Message queue processing
    private fun processQueuedMessages() {
        if (messageQueue.isEmpty()) return
        
        android.util.Log.d("MlPipelineManager", "Processing ${messageQueue.size} queued messages")
        val queued = mutableListOf<QueuedMessage>()
        
        // Drain queue
        while (messageQueue.isNotEmpty()) {
            messageQueue.poll()?.let { queued.add(it) }
        }
        
        // Note: We don't re-process queued messages automatically here
        // because they've already been handled by SMS receiver with safe fallback
        // This is just for cleanup and logging
        queued.clear()
    }

    // Data class for message queue
    private data class QueuedMessage(
        val message: String,
        val queuedAt: Long = System.currentTimeMillis()
    )
    
    companion object {
        private const val MODEL_DEBUG_TAG = "NEXALERT_MODEL_DEBUG"
        /** Training label order (ml/model/config.py HAM_CATEGORIES) — for diagnostic index display only. */
        private val STAGE2_INDEX_TO_LABEL = arrayOf(
            "personal", "otp", "banking"
        )
        private val modelDebugInfoLogged = AtomicBoolean(false)

        @Volatile
        private var instance: MlPipelineManager? = null

        fun getInstance(context: Context): MlPipelineManager {
            return instance ?: runBlocking {
                synchronized(this@Companion) {
                    instance ?: MlPipelineManager(context.applicationContext).also { instance = it }
                }
            }
        }
    }

    /** TEMP diagnostic: log model files, output types, and label mapping once after load. */
    private fun logModelDebugInfoOnce() {
        if (!modelDebugInfoLogged.compareAndSet(false, true)) return

        android.util.Log.d(MODEL_DEBUG_TAG, "MODEL: stage1.onnx (assets/models/v1/stage1.onnx)")
        android.util.Log.d(MODEL_DEBUG_TAG, "MODEL: stage2.onnx (assets/models/v1/stage2.onnx)")
        android.util.Log.d(MODEL_DEBUG_TAG, "RUNTIME: ONNX Runtime — OrtSession / OnnxTensor")
        android.util.Log.d(MODEL_DEBUG_TAG, "PREPROCESSING: none — raw SMS string via OnnxTensor.createTensor(ortEnv, arrayOf(message))")
        android.util.Log.d(MODEL_DEBUG_TAG, "STAGE1 INPUT: tensor(string), shape=[batch]")
        android.util.Log.d(MODEL_DEBUG_TAG, "STAGE1 OUTPUT: output_label tensor(int64); output_probability seq(map(int64,float))")
        android.util.Log.d(MODEL_DEBUG_TAG, "STAGE1 OUTPUT SHAPE: output_label=[batch]; output_probability=seq(map) with keys 0,1")
        android.util.Log.d(MODEL_DEBUG_TAG, "STAGE1 LABEL MAPPING: 0 -> ham, 1 -> spam")
        android.util.Log.d(MODEL_DEBUG_TAG, "STAGE2 INPUT: tensor(string), shape=[batch]")
        android.util.Log.d(MODEL_DEBUG_TAG, "STAGE2 OUTPUT: output_label tensor(string); output_probability seq(map(string,float))")
        android.util.Log.d(MODEL_DEBUG_TAG, "STAGE1 THRESHOLD: $spamThreshold (spam if P(spam) >= threshold)")
        android.util.Log.d(MODEL_DEBUG_TAG, "STAGE2 OUTPUT SHAPE: output_label=[1]; output_probability=seq(map) with 3 string keys")
        STAGE2_INDEX_TO_LABEL.forEachIndexed { index, label ->
            android.util.Log.d(MODEL_DEBUG_TAG, "STAGE2 LABEL MAPPING: $index -> $label")
        }
        stage1Session?.let { session ->
            android.util.Log.d(MODEL_DEBUG_TAG, "STAGE1 session inputNames=${session.inputNames} outputNames=${session.outputNames}")
        }
        stage2Session?.let { session ->
            android.util.Log.d(MODEL_DEBUG_TAG, "STAGE2 session inputNames=${session.inputNames} outputNames=${session.outputNames}")
        }
        android.util.Log.d(
            MODEL_DEBUG_TAG,
            "NOTE: Stage2 category comes from output_label string directly (parseCategoryLabel); no index array in Android code."
        )
    }

    /** TEMP diagnostic: read output_probability map without changing inference behaviour. */
    private fun extractProbabilityMap(results: OrtSession.Result): Map<String, Float> {
        val out = linkedMapOf<String, Float>()
        val probValue = results.get("output_probability").orElse(null) ?: return out
        if (probValue !is OnnxSequence) return out
        val seqList = probValue.value as? List<*> ?: return out
        if (seqList.isEmpty()) return out
        val mapValue = seqList[0] as? OnnxMap ?: return out
        val probMap = mapValue.value ?: return out
        for ((key, value) in probMap) {
            val floatVal = when (value) {
                is Float -> value
                is Double -> value.toFloat()
                is Number -> value.toFloat()
                else -> continue
            }
            out[key.toString()] = floatVal
        }
        return out
    }

    /** TEMP diagnostic: log SMS, raw class scores, predicted index, confidence, final category. */
    private fun logClassificationDebug(
        message: String,
        stage1Results: OrtSession.Result,
        stage2Probs: Map<String, Float>?,
        predictedLabel: String?,
        spamLabel: Long,
        spamProb: Float,
        isSpam: Boolean,
        finalCategory: String
    ) {
        val smsDisplay = if (message.length > 500) message.take(500) + "..." else message
        android.util.Log.d(MODEL_DEBUG_TAG, "SMS: $smsDisplay")

        val stage1Probs = extractProbabilityMap(stage1Results)
        android.util.Log.d(MODEL_DEBUG_TAG, "STAGE1 RAW OUTPUT:")
        android.util.Log.d(MODEL_DEBUG_TAG, "0=${stage1Probs["0"] ?: 0f}")
        android.util.Log.d(MODEL_DEBUG_TAG, "1=${stage1Probs["1"] ?: 0f}")
        android.util.Log.d(MODEL_DEBUG_TAG, "PREDICTED_INDEX=${if (isSpam) 1 else 0}")
        android.util.Log.d(MODEL_DEBUG_TAG, "CONFIDENCE=${if (isSpam) spamProb else (1f - spamProb)}")
        android.util.Log.d(MODEL_DEBUG_TAG, "THRESHOLD=$spamThreshold")
        android.util.Log.d(MODEL_DEBUG_TAG, "ONNX_DEFAULT_LABEL=$spamLabel")
        android.util.Log.d(MODEL_DEBUG_TAG, "CATEGORY=${if (isSpam) "spam" else "ham"}")

        if (isSpam) {
            android.util.Log.d(MODEL_DEBUG_TAG, "STAGE2: skipped (Stage1 predicted spam)")
            android.util.Log.d(MODEL_DEBUG_TAG, "FINAL_CATEGORY=$finalCategory")
            return
        }

        if (stage2Probs == null || predictedLabel == null) {
            android.util.Log.d(MODEL_DEBUG_TAG, "STAGE2: no results (session null or not run)")
            android.util.Log.d(MODEL_DEBUG_TAG, "FINAL_CATEGORY=$finalCategory")
            return
        }

        val predictedIndex = STAGE2_INDEX_TO_LABEL.indexOf(predictedLabel)
        val confidence = stage2Probs[predictedLabel]
            ?: stage2Probs.values.maxOrNull()
            ?: 0f

        android.util.Log.d(MODEL_DEBUG_TAG, "RAW OUTPUT:")
        STAGE2_INDEX_TO_LABEL.forEachIndexed { index, label ->
            android.util.Log.d(MODEL_DEBUG_TAG, "$index=${stage2Probs[label] ?: 0f}")
        }
        android.util.Log.d(MODEL_DEBUG_TAG, "PREDICTED_INDEX=$predictedIndex")
        android.util.Log.d(MODEL_DEBUG_TAG, "CONFIDENCE=$confidence")
        android.util.Log.d(MODEL_DEBUG_TAG, "PREDICTED_CATEGORY=$predictedLabel")
        android.util.Log.d(MODEL_DEBUG_TAG, "FINAL_CATEGORY=$finalCategory")
    }
}
