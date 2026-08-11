package com.frontend.ml

import android.content.Context
import android.net.Uri
import android.provider.Telephony
import android.util.Log
import com.frontend.db.MlDatabaseHelper
import java.util.concurrent.atomic.AtomicBoolean
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * One-time (idempotent) inbox backfill: classifies existing SMS in content://sms
 * that do not yet have a matching ml_metadata row (address + timestamp).
 */
object InitialSmsClassifier {

    private const val TAG = "BACKFILL"
    private const val PREF_TAG = "BACKFILL_PREF"
    private const val PREF_NAME = "ml_preferences"
    private const val KEY_MODEL_VERSION = "ml_model_version"
    private const val CURRENT_MODEL_VERSION = 1
    private val isRunning = AtomicBoolean(false)

    /**
     * Schedules backfill on a background thread after ML models are loaded.
     * Skips immediately if a previous run completed successfully (SharedPreferences).
     * Safe to call multiple times; skips messages that already have metadata.
     */
    fun scheduleAfterModelsLoaded(context: Context) {
        val appContext = context.applicationContext

        if (isBackfillCompleted(appContext)) {
            return
        }

        if (!isRunning.compareAndSet(false, true)) {
            Log.d(TAG, "Already running — skip duplicate schedule")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                runBackfill(appContext)
            } finally {
                isRunning.set(false)
            }
        }
    }

    private fun isBackfillCompleted(context: Context): Boolean {
        val savedVersion = prefs(context).getInt(KEY_MODEL_VERSION, 0)

        if (savedVersion == CURRENT_MODEL_VERSION) {
            Log.d(
                PREF_TAG,
                "Backfill already completed for model version $savedVersion"
            )
            return true
        }

        Log.d(
            PREF_TAG,
            "Running backfill. Saved=$savedVersion Current=$CURRENT_MODEL_VERSION"
        )

        return false
    }

    private fun markBackfillCompleted(context: Context) {
        prefs(context)
            .edit()
            .putInt(KEY_MODEL_VERSION, CURRENT_MODEL_VERSION)
            .apply()

        Log.d(
            PREF_TAG,
            "Saved model version $CURRENT_MODEL_VERSION"
        )
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    private fun runBackfill(context: Context) {
        Log.d(PREF_TAG, "Starting first-time backfill")

        val startMs = System.currentTimeMillis()
        Log.d(TAG, "Started")

        val dbHelper = MlDatabaseHelper(context)
        val mlManager = MlPipelineManager.getInstance(context)

        var totalSms = 0
        var alreadyClassified = 0
        var newlyClassified = 0
        var failed = 0

        val projection = arrayOf(
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE
        )

        try {
            val cursor = context.contentResolver.query(
                Uri.parse("content://sms"),
                projection,
                null,
                null,
                "${Telephony.Sms.DATE} ASC"
            )

            if (cursor == null) {
                Log.e(TAG, "Failed to query content://sms")
                Log.d(TAG, "Finished")
                Log.d(TAG, "Total execution time: ${System.currentTimeMillis() - startMs}ms")
                return
            }

            cursor.use {
                totalSms = it.count
                Log.d(TAG, "Total SMS found: $totalSms")

                while (it.moveToNext()) {
                    val address = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.ADDRESS))
                    if (address.isNullOrBlank()) {
                        failed++
                        continue
                    }

                    val body = it.getString(it.getColumnIndexOrThrow(Telephony.Sms.BODY)) ?: ""
                    val timestamp = it.getLong(it.getColumnIndexOrThrow(Telephony.Sms.DATE))

                    if (dbHelper.hasMetadata(address, timestamp)) {
                        alreadyClassified++
                        continue
                    }

                    try {
                        val result = mlManager.processMessage(body)
                        dbHelper.insertMetadata(
                            address,
                            timestamp,
                            result.isSpam,
                            result.category,
                            result.confidence
                        )
                        newlyClassified++
                    } catch (e: Exception) {
                        failed++
                        Log.e(TAG, "Failed address=$address timestamp=$timestamp", e)
                    }
                }
            }

            Log.d(TAG, "Already classified: $alreadyClassified")
            Log.d(TAG, "Newly classified: $newlyClassified")
            Log.d(TAG, "Failed: $failed")
            Log.d(TAG, "Finished")
            Log.d(TAG, "Total execution time: ${System.currentTimeMillis() - startMs}ms")

            if (failed == 0) {
                markBackfillCompleted(context)
                Log.d(PREF_TAG, "Backfill completed successfully")
            }
        } catch (e: Exception) {
            Log.e(TAG, "Backfill aborted due to error", e)
        }
    }
}
