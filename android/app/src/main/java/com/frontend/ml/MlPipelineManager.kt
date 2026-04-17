package com.frontend.ml

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.content.Context
import java.io.File
import java.io.FileOutputStream

data class MlResult(
    val isSpam: Boolean,
    val confidence: Float,
    val category: String
)

class MlPipelineManager private constructor(private val context: Context) {
    private val ortEnv: OrtEnvironment = OrtEnvironment.getEnvironment()
    private var stage1Session: OrtSession? = null
    private var stage2Session: OrtSession? = null

    init {
        loadModels()
    }

    private fun loadModels() {
        try {
            stage1Session = loadSession("models/v1/stage1.onnx", "stage1.onnx")
            stage2Session = loadSession("models/v1/stage2.onnx", "stage2.onnx")
        } catch (e: Exception) {
            android.util.Log.e("MlPipelineManager", "Error loading ONNX models", e)
        }
    }

    private fun loadSession(assetPath: String, fileName: String): OrtSession {
        val file = File(context.cacheDir, fileName)
        if (!file.exists()) {
            context.assets.open(assetPath).use { inputStream ->
                FileOutputStream(file).use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            }
        }
        return ortEnv.createSession(file.absolutePath)
    }

    fun processMessage(message: String): MlResult {
        var isSpam = false
        var confidence = 0.0f
        var category = "unknown"

        try {
            // Stage 1: Spam Detection
            val s1 = stage1Session
            if (s1 != null) {
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
            }

            // Stage 2: Categorization
            if (!isSpam && stage2Session != null) {
                val s2 = stage2Session!!
                val inputName = s2.inputNames.iterator().next()
                val inputTensor = OnnxTensor.createTensor(ortEnv, arrayOf(message))
                val results = s2.run(mapOf(inputName to inputTensor))

                var catProbArray: FloatArray? = null
                for (res in results) {
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
                
                results.close()
                inputTensor.close()

                if (catProbArray != null && catProbArray.isNotEmpty()) {
                    var maxIdx = 0
                    var maxVal = catProbArray[0]
                    for (i in 1 until catProbArray.size) {
                        if (catProbArray[i] > maxVal) {
                            maxVal = catProbArray[i]
                            maxIdx = i
                        }
                    }
                    val categories = arrayOf("Finance", "Promotions", "Utility", "Personal", "Others")
                    if (maxIdx < categories.size) {
                        category = categories[maxIdx]
                    } else {
                        category = "Category_$maxIdx"
                    }
                }
            }

        } catch (e: Exception) {
            android.util.Log.e("MlPipelineManager", "Inference error", e)
        }

        return MlResult(isSpam, confidence, category)
    }

    companion object {
        @Volatile
        private var instance: MlPipelineManager? = null

        fun getInstance(context: Context): MlPipelineManager {
            return instance ?: synchronized(this) {
                instance ?: MlPipelineManager(context.applicationContext).also { instance = it }
            }
        }
    }
}
