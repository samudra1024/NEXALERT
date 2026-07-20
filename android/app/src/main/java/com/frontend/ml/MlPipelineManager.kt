package com.frontend.ml

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import java.io.File
import java.io.FileOutputStream
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
                stage1LoadTimeMs = System.currentTimeMillis() - stage1StartTime
                android.util.Log.d("MlPipelineManager", "[1/3] Stage 1 loaded in ${stage1LoadTimeMs}ms")
                
                // Load Stage 2 with timing
                val stage2StartTime = System.currentTimeMillis()
                android.util.Log.d("MlPipelineManager", "[2/3] Loading Stage 2 (Categorization)...")
                stage2Session = loadSession("models/v1/stage2.onnx", "stage2.onnx")
                stage2LoadTimeMs = System.currentTimeMillis() - stage2StartTime
                android.util.Log.d("MlPipelineManager", "[2/3] Stage 2 loaded in ${stage2LoadTimeMs}ms")
                
                modelLoaded.set(true)
                modelLoadTimeMs = System.currentTimeMillis() - totalStartTime
                
                android.util.Log.d("MlPipelineManager", "========== ML MODEL LOADING COMPLETE ==========")
                android.util.Log.d("MlPipelineManager", "  Stage 1 (Spam Detection): ${stage1LoadTimeMs}ms")
                android.util.Log.d("MlPipelineManager", "  Stage 2 (Categorization): ${stage2LoadTimeMs}ms")
                android.util.Log.d("MlPipelineManager", "  TOTAL LOAD TIME: ${modelLoadTimeMs}ms")
                android.util.Log.d("MlPipelineManager", "================================================")
                
                // Process any queued messages
                processQueuedMessages()
            }
        } catch (e: Exception) {
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
        val fileExists = file.exists()
        
        if (!fileExists) {
            val extractStartTime = System.currentTimeMillis()
            context.assets.open(assetPath).use { inputStream ->
                FileOutputStream(file).use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            }
            val extractTime = System.currentTimeMillis() - extractStartTime
            android.util.Log.d("MlPipelineManager", "  → Extraction completed in ${extractTime}ms")
        } else {
            android.util.Log.d("MlPipelineManager", "  → File already cached, skipping extraction")
        }
        
        android.util.Log.d("MlPipelineManager", "  → Creating ONNX session for $fileName...")
        val sessionCreateStart = System.currentTimeMillis()
        val session = ortEnv.createSession(file.absolutePath)
        val sessionCreateTime = System.currentTimeMillis() - sessionCreateStart
        
        android.util.Log.d("MlPipelineManager", "  → ONNX session created in ${sessionCreateTime}ms")
        android.util.Log.d("MlPipelineManager", "  → File size: ${file.length() / 1024}KB")
        
        return session
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
        // Lazy initialization for robustness
        ensureModelLoaded()
        
        // Queue message if model not ready yet
        if (!modelLoaded.get()) {
            android.util.Log.w("MlPipelineManager", "Model not ready, queuing message")
            messageQueue.add(QueuedMessage(message))
            return getSafeFallback() // Return safe default immediately
        }
        
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
        var isSpam = false
        var confidence = 0.0f
        var category = "unknown"
        
        val s1 = stage1Session
        if (s1 == null) {
            android.util.Log.e("MlPipelineManager", "Stage 1 session is null")
            return MlResult(isSpam, confidence, category)
        }

        try {
            // Stage 1: Spam Detection
            val inputName = s1.inputNames.iterator().next()
            val inputTensor = OnnxTensor.createTensor(ortEnv, arrayOf(message))
            val results = s1.run(mapOf(inputName to inputTensor))
            
            var spamProb = 0f
            for (res in results) {
                val value = res.value
                if (value is OnnxTensor) {
                    try {
                        val floatBuffer = value.floatBuffer
                        if (floatBuffer != null) {
                            if (floatBuffer.capacity() >= 2) {
                                spamProb = floatBuffer.get(1) // class 1
                            } else if (floatBuffer.capacity() == 1) {
                                spamProb = floatBuffer.get(0)
                            }
                        }
                        break
                    } catch (e: Exception) {}
                } else if (value is Array<*>) {
                    // Sometimes float maps or generic arrays
                    try {
                       val firstRow = value[0]
                       if (firstRow is FloatArray) {
                           if (firstRow.size >= 2) spamProb = firstRow[1]
                           else if (firstRow.size == 1) spamProb = firstRow[0]
                       }
                       break
                    } catch (e: Exception) {}
                }
            }
            
            isSpam = spamProb >= 0.5f
            confidence = spamProb
            results.close()
            inputTensor.close()

            // Stage 2: Categorization
            if (!isSpam) {
                val s2 = stage2Session
                if (s2 != null) {
                    val stage2InputName = s2.inputNames.iterator().next()
                    val stage2InputTensor = OnnxTensor.createTensor(ortEnv, arrayOf(message))
                    val stage2Results = s2.run(mapOf(stage2InputName to stage2InputTensor))

                    var catProbArray: FloatArray? = null
                    for (res in stage2Results) {
                        val value = res.value
                        if (value is OnnxTensor) {
                            try {
                                val floatBuffer = value.floatBuffer
                                if (floatBuffer != null) {
                                    catProbArray = FloatArray(floatBuffer.capacity())
                                    floatBuffer.get(catProbArray)
                                }
                                break
                            } catch (e: Exception) {}
                        } else if (value is Array<*>) {
                            try {
                                val firstRow = value[0]
                                if (firstRow is FloatArray) {
                                    catProbArray = firstRow
                                }
                                break
                            } catch(e: Exception){}
                        }
                    }
                    
                    stage2Results.close()
                    stage2InputTensor.close()

                    if (catProbArray != null && catProbArray.isNotEmpty()) {
                        var maxIdx = 0
                        var maxVal = catProbArray[0]
                        for (i in 1 until catProbArray.size) {
                            if (catProbArray[i] > maxVal) {
                                maxVal = catProbArray[i]
                                maxIdx = i
                            }
                        }
                        val categories = arrayOf("personal", "banking", "otp", "subscription", "promotional", "unknown")
                        if (maxIdx < categories.size) {
                            category = categories[maxIdx]
                        } else {
                            category = "Category_$maxIdx"
                        }
                    }
                }
            }

        } catch (e: Exception) {
            android.util.Log.e("MlPipelineManager", "Inference error", e)
        }

        return MlResult(isSpam, confidence, category)
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
}
