package com.frontend.ml

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Boot receiver to pre-warm ML models after device restart.
 * This ensures the ML pipeline is ready even if the app hasn't been opened yet.
 */
class ModelPreWarmReceiver : BroadcastReceiver() {
    
    companion object {
        private const val TAG = "ModelPreWarmReceiver"
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        
        if (action == Intent.ACTION_BOOT_COMPLETED || 
            action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            
            Log.d(TAG, "Pre-warming ML models after: $action")
            
            // Initialize ML pipeline in background
            // This loads models into memory so they're ready when first SMS arrives
            try {
                val mlManager = MlPipelineManager.getInstance(context)
                Log.d(TAG, "ML pipeline initialized successfully")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to pre-warm ML models", e)
            }
        }
    }
}
