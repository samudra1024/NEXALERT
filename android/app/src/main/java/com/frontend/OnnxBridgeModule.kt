package com.frontend

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import com.frontend.ml.MlPipelineManager

class OnnxBridgeModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun getName(): String = "OnnxBridge"

    @ReactMethod
    fun loadModel(modelName: String, promise: Promise) {
        scope.launch {
            try {
                // Initialize the Singleton manager which pre-loads the models
                MlPipelineManager.getInstance(reactContext)
                promise.resolve(true)
            } catch (e: Exception) {
                promise.reject("ONNX_LOAD_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun runInference(modelName: String, input: String, promise: Promise) {
        scope.launch {
            try {
                val manager = MlPipelineManager.getInstance(reactContext)
                // Note: The UI layer previously invoked `stage1` mapping. 
                // We run processMessage which is Stage 1 & 2 combined logic.
                val result = manager.processMessage(input)
                
                // Return a robust JSON string mimicking what JS expects
                val jsonResult = """{"probability": ${result.confidence}, "is_spam": ${result.isSpam}, "category": "${result.category}"}"""
                promise.resolve(jsonResult)
                
            } catch (e: Exception) {
                promise.reject("ONNX_INFERENCE_ERROR", "Inference failed: ${e.message}", e)
            }
        }
    }
}
