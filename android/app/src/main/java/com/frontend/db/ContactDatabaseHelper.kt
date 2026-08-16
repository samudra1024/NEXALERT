package com.frontend.db

import android.content.ContentValues
import android.content.Context
import android.database.DatabaseUtils
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.provider.BaseColumns
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.util.Locale

object ContactContract {
    object Entry : BaseColumns {
        const val TABLE_NAME = "contacts"
        const val COLUMN_CONTACT_ID = "contact_id"
        const val COLUMN_NAME = "name"
        const val COLUMN_NORMALIZED_NAME = "normalized_name"
        const val COLUMN_PHONE_NUMBER = "phone_number"
        const val COLUMN_NORMALIZED_PHONE = "normalized_phone"
        const val COLUMN_PHOTO_URI = "photo_uri"
        const val COLUMN_IS_REGISTERED = "is_registered"
        const val COLUMN_LAST_UPDATED = "last_updated"
        const val COLUMN_SYNC_STATUS = "sync_status"
        const val COLUMN_CONTENT_HASH = "content_hash"
    }
}

data class ContactRecord(
    val contactId: String,
    val name: String,
    val normalizedName: String,
    val phoneNumber: String,
    val normalizedPhone: String,
    val photoUri: String?,
    val contentHash: String,
    val lastUpdated: Long,
)

class ContactDatabaseHelper(context: Context) :
    SQLiteOpenHelper(context, DATABASE_NAME, null, DATABASE_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE ${ContactContract.Entry.TABLE_NAME} (
                ${ContactContract.Entry.COLUMN_CONTACT_ID} TEXT PRIMARY KEY,
                ${ContactContract.Entry.COLUMN_NAME} TEXT NOT NULL,
                ${ContactContract.Entry.COLUMN_NORMALIZED_NAME} TEXT NOT NULL,
                ${ContactContract.Entry.COLUMN_PHONE_NUMBER} TEXT NOT NULL,
                ${ContactContract.Entry.COLUMN_NORMALIZED_PHONE} TEXT NOT NULL,
                ${ContactContract.Entry.COLUMN_PHOTO_URI} TEXT,
                ${ContactContract.Entry.COLUMN_IS_REGISTERED} INTEGER NOT NULL DEFAULT 0,
                ${ContactContract.Entry.COLUMN_LAST_UPDATED} INTEGER NOT NULL,
                ${ContactContract.Entry.COLUMN_SYNC_STATUS} TEXT NOT NULL DEFAULT 'synced',
                ${ContactContract.Entry.COLUMN_CONTENT_HASH} TEXT NOT NULL
            )
            """.trimIndent(),
        )
        db.execSQL(
            "CREATE INDEX idx_contacts_normalized_name ON ${ContactContract.Entry.TABLE_NAME} " +
                "(${ContactContract.Entry.COLUMN_NORMALIZED_NAME} COLLATE NOCASE)",
        )
        db.execSQL(
            "CREATE INDEX idx_contacts_normalized_phone ON ${ContactContract.Entry.TABLE_NAME} " +
                "(${ContactContract.Entry.COLUMN_NORMALIZED_PHONE})",
        )
        db.execSQL(
            "CREATE INDEX idx_contacts_last_updated ON ${ContactContract.Entry.TABLE_NAME} " +
                "(${ContactContract.Entry.COLUMN_LAST_UPDATED})",
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 1) {
            onCreate(db)
        }
    }

    fun getCount(searchQuery: String?): Int {
        val db = readableDatabase
        val trimmed = searchQuery?.trim().orEmpty()
        val (selection, args) = buildSearchClause(trimmed)
        val count = if (selection.isNullOrEmpty()) {
            DatabaseUtils.queryNumEntries(db, ContactContract.Entry.TABLE_NAME).toInt()
        } else {
            db.query(
                ContactContract.Entry.TABLE_NAME,
                arrayOf("COUNT(*) AS total_count"),
                selection,
                args,
                null,
                null,
                null,
            ).use { cursor ->
                if (cursor.moveToFirst()) cursor.getInt(0) else 0
            }
        }
        Log.d(
            TAG,
            "[CONTACT PAGINATION] getCount query=\"$trimmed\" total=$count",
        )
        return count
    }

    fun queryContacts(offset: Int, limit: Int, searchQuery: String?): WritableArray {
        val db = readableDatabase
        val trimmed = searchQuery?.trim().orEmpty()
        val (selection, args) = buildSearchClause(trimmed)
        val results = Arguments.createArray()
        val whereClause = if (selection.isNullOrEmpty()) "" else "WHERE $selection"
        val sql = """
            SELECT * FROM ${ContactContract.Entry.TABLE_NAME}
            $whereClause
            ORDER BY ${ContactContract.Entry.COLUMN_NORMALIZED_NAME} COLLATE NOCASE ASC
            LIMIT ? OFFSET ?
        """.trimIndent()
        val queryArgs = if (args != null) {
            args + arrayOf(limit.toString(), offset.toString())
        } else {
            arrayOf(limit.toString(), offset.toString())
        }

        db.rawQuery(sql, queryArgs).use { cursor ->
            val idIdx = cursor.getColumnIndexOrThrow(ContactContract.Entry.COLUMN_CONTACT_ID)
            val nameIdx = cursor.getColumnIndexOrThrow(ContactContract.Entry.COLUMN_NAME)
            val phoneIdx = cursor.getColumnIndexOrThrow(ContactContract.Entry.COLUMN_PHONE_NUMBER)
            val normPhoneIdx = cursor.getColumnIndexOrThrow(ContactContract.Entry.COLUMN_NORMALIZED_PHONE)
            val photoIdx = cursor.getColumnIndexOrThrow(ContactContract.Entry.COLUMN_PHOTO_URI)
            val updatedIdx = cursor.getColumnIndexOrThrow(ContactContract.Entry.COLUMN_LAST_UPDATED)

            while (cursor.moveToNext()) {
                val map = Arguments.createMap()
                val phone = cursor.getString(phoneIdx)
                map.putString("contactId", cursor.getString(idIdx))
                map.putString("id", phone)
                map.putString("name", cursor.getString(nameIdx))
                map.putString("phone", phone)
                map.putString("phoneNumber", phone)
                map.putString("normalizedPhone", cursor.getString(normPhoneIdx))
                val photo = cursor.getString(photoIdx)
                if (!photo.isNullOrEmpty()) {
                    map.putString("photoUri", photo)
                }
                map.putDouble("lastUpdated", cursor.getLong(updatedIdx).toDouble())
                map.putString("source", "phone")
                results.pushMap(map)
            }
        }

        Log.d(
            TAG,
            "[CONTACT PAGINATION] queryContacts offset=$offset limit=$limit query=\"$trimmed\" returned=${results.size()}",
        )
        return results
    }

    fun getExistingHashes(): Map<String, String> {
        val db = readableDatabase
        val map = HashMap<String, String>()
        db.query(
            ContactContract.Entry.TABLE_NAME,
            arrayOf(
                ContactContract.Entry.COLUMN_CONTACT_ID,
                ContactContract.Entry.COLUMN_CONTENT_HASH,
            ),
            null,
            null,
            null,
            null,
            null,
        ).use { cursor ->
            val idIdx = cursor.getColumnIndexOrThrow(ContactContract.Entry.COLUMN_CONTACT_ID)
            val hashIdx = cursor.getColumnIndexOrThrow(ContactContract.Entry.COLUMN_CONTENT_HASH)
            while (cursor.moveToNext()) {
                map[cursor.getString(idIdx)] = cursor.getString(hashIdx)
            }
        }
        return map
    }

    fun applyIncrementalSync(records: List<ContactRecord>): SyncStats {
        val db = writableDatabase
        val stats = SyncStats()
        val existingHashes = getExistingHashes()
        val incomingIds = HashSet<String>()

        db.beginTransaction()
        try {
            for (record in records) {
                incomingIds.add(record.contactId)
                val existingHash = existingHashes[record.contactId]
                if (existingHash == record.contentHash) {
                    stats.unchanged++
                    continue
                }

                val values = ContentValues().apply {
                    put(ContactContract.Entry.COLUMN_CONTACT_ID, record.contactId)
                    put(ContactContract.Entry.COLUMN_NAME, record.name)
                    put(ContactContract.Entry.COLUMN_NORMALIZED_NAME, record.normalizedName)
                    put(ContactContract.Entry.COLUMN_PHONE_NUMBER, record.phoneNumber)
                    put(ContactContract.Entry.COLUMN_NORMALIZED_PHONE, record.normalizedPhone)
                    put(ContactContract.Entry.COLUMN_PHOTO_URI, record.photoUri)
                    put(ContactContract.Entry.COLUMN_IS_REGISTERED, 0)
                    put(ContactContract.Entry.COLUMN_LAST_UPDATED, record.lastUpdated)
                    put(ContactContract.Entry.COLUMN_SYNC_STATUS, "synced")
                    put(ContactContract.Entry.COLUMN_CONTENT_HASH, record.contentHash)
                }

                val updated = db.update(
                    ContactContract.Entry.TABLE_NAME,
                    values,
                    "${ContactContract.Entry.COLUMN_CONTACT_ID} = ?",
                    arrayOf(record.contactId),
                )
                if (updated == 0) {
                    db.insert(ContactContract.Entry.TABLE_NAME, null, values)
                    stats.inserted++
                } else {
                    stats.updated++
                }
            }

            val staleIds = existingHashes.keys.filter { !incomingIds.contains(it) }
            for (staleId in staleIds) {
                db.delete(
                    ContactContract.Entry.TABLE_NAME,
                    "${ContactContract.Entry.COLUMN_CONTACT_ID} = ?",
                    arrayOf(staleId),
                )
                stats.deleted++
            }

            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
        return stats
    }

    fun getLastSyncTimestamp(): Long {
        val db = readableDatabase
        db.query(
            ContactContract.Entry.TABLE_NAME,
            arrayOf("MAX(${ContactContract.Entry.COLUMN_LAST_UPDATED})"),
            null,
            null,
            null,
            null,
            null,
        ).use { cursor ->
            return if (cursor.moveToFirst() && !cursor.isNull(0)) cursor.getLong(0) else 0L
        }
    }

    private fun buildSearchClause(query: String): Pair<String?, Array<String>?> {
        if (query.isEmpty()) {
            return null to null
        }
        val like = "%$query%"
        val digits = query.replace(Regex("[^0-9]"), "")
        return if (digits.length >= 3) {
            (
                "${ContactContract.Entry.COLUMN_NORMALIZED_NAME} LIKE ? OR " +
                    "${ContactContract.Entry.COLUMN_NAME} LIKE ? OR " +
                    "${ContactContract.Entry.COLUMN_NORMALIZED_PHONE} LIKE ? OR " +
                    "${ContactContract.Entry.COLUMN_PHONE_NUMBER} LIKE ?"
                ) to arrayOf(like, like, "%$digits%", like)
        } else {
            (
                "${ContactContract.Entry.COLUMN_NORMALIZED_NAME} LIKE ? OR " +
                    "${ContactContract.Entry.COLUMN_NAME} LIKE ? OR " +
                    "${ContactContract.Entry.COLUMN_PHONE_NUMBER} LIKE ?"
                ) to arrayOf(like, like, like)
        }
    }

    companion object {
        const val DATABASE_NAME = "Contacts.db"
        const val DATABASE_VERSION = 1
        private const val TAG = "ContactDatabaseHelper"

        @JvmStatic
        fun normalizePhone(phone: String?): String {
            if (phone.isNullOrEmpty()) return ""
            val digits = phone.replace(Regex("[^0-9]"), "")
            return if (digits.length >= 10) digits.takeLast(10) else digits
        }

        @JvmStatic
        fun normalizeName(name: String?): String {
            return name?.trim()?.lowercase(Locale.getDefault()).orEmpty()
        }

        @JvmStatic
        fun buildContentHash(name: String, phone: String, photoUri: String?): String {
            return "${name}|${phone}|${photoUri.orEmpty()}".hashCode().toString()
        }
    }
}

data class SyncStats(
    var inserted: Int = 0,
    var updated: Int = 0,
    var deleted: Int = 0,
    var unchanged: Int = 0,
)
