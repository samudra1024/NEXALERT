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
    private val isRunning = AtomicBoolean(false)

    /**
     * Schedules backfill on a background thread after ML models are loaded.
     * Safe to call multiple times; skips messages that already have metadata.
     */
    fun scheduleAfterModelsLoaded(context: Context) {
        if (!isRunning.compareAndSet(false, true)) {
            Log.d(TAG, "Already running — skip duplicate schedule")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                runBackfill(context.applicationContext)
            } finally {
                isRunning.set(false)
            }
        }
    }

    private fun runBackfill(context: Context) {
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
    }
}
