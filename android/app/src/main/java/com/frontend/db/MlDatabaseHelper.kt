package com.frontend.db

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.provider.BaseColumns

object MlMetadataContract {
    object FeedEntry : BaseColumns {
        const val TABLE_NAME = "ml_metadata"
        const val COLUMN_NAME_ADDRESS = "address"
        const val COLUMN_NAME_TIMESTAMP = "timestamp"
        const val COLUMN_NAME_IS_SPAM = "is_spam"
        const val COLUMN_NAME_CATEGORY = "category"
        const val COLUMN_NAME_CONFIDENCE = "confidence"
    }
}

class MlDatabaseHelper(context: Context) : SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        val createTable = "CREATE TABLE " + MlMetadataContract.FeedEntry.TABLE_NAME + " (" +
                BaseColumns._ID + " INTEGER PRIMARY KEY," +
                MlMetadataContract.FeedEntry.COLUMN_NAME_ADDRESS + " TEXT," +
                MlMetadataContract.FeedEntry.COLUMN_NAME_TIMESTAMP + " INTEGER," +
                MlMetadataContract.FeedEntry.COLUMN_NAME_IS_SPAM + " INTEGER," + // 0 or 1
                MlMetadataContract.FeedEntry.COLUMN_NAME_CATEGORY + " TEXT," +
                MlMetadataContract.FeedEntry.COLUMN_NAME_CONFIDENCE + " REAL)"
        db.execSQL(createTable)
        
        // Add indexes for faster lookups
        db.execSQL("CREATE INDEX idx_address_time ON ${MlMetadataContract.FeedEntry.TABLE_NAME} (${MlMetadataContract.FeedEntry.COLUMN_NAME_ADDRESS}, ${MlMetadataContract.FeedEntry.COLUMN_NAME_TIMESTAMP})")
        db.execSQL("CREATE INDEX idx_timestamp ON ${MlMetadataContract.FeedEntry.TABLE_NAME} (${MlMetadataContract.FeedEntry.COLUMN_NAME_TIMESTAMP})")
        db.execSQL("CREATE INDEX idx_spam ON ${MlMetadataContract.FeedEntry.TABLE_NAME} (${MlMetadataContract.FeedEntry.COLUMN_NAME_IS_SPAM})")
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS " + MlMetadataContract.FeedEntry.TABLE_NAME)
        onCreate(db)
    }

    fun insertMetadata(address: String, timestamp: Long, isSpam: Boolean, category: String, confidence: Float) {
        val db = this.writableDatabase
        val values = ContentValues().apply {
            put(MlMetadataContract.FeedEntry.COLUMN_NAME_ADDRESS, address)
            put(MlMetadataContract.FeedEntry.COLUMN_NAME_TIMESTAMP, timestamp)
            put(MlMetadataContract.FeedEntry.COLUMN_NAME_IS_SPAM, if (isSpam) 1 else 0)
            put(MlMetadataContract.FeedEntry.COLUMN_NAME_CATEGORY, category)
            put(MlMetadataContract.FeedEntry.COLUMN_NAME_CONFIDENCE, confidence)
        }
        db.insert(MlMetadataContract.FeedEntry.TABLE_NAME, null, values)
    }

    companion object {
        const val DATABASE_VERSION = 1
        const val DATABASE_NAME = "MlMetadata.db"
    }
}
