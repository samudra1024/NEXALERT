package com.frontend.bridge;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import android.telephony.SmsManager;
import android.app.role.RoleManager;
import android.os.Build;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.frontend.db.MlDatabaseHelper;
import com.frontend.db.MlMetadataContract;

public class SmsModule extends ReactContextBaseJavaModule {

    public SmsModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "SmsModule";
    }

    @ReactMethod
    public void getSmsMessages(Promise promise) {
        try {
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            Uri uri = Uri.parse("content://sms");
            String[] projection = { "_id", "address", "body", "date", "type", "read" };

            // Fetch mapping from our SQLite ML DB
            MlDatabaseHelper dbHelper = new MlDatabaseHelper(getReactApplicationContext());
            android.database.sqlite.SQLiteDatabase db = dbHelper.getReadableDatabase();

            // DEBUG: Log total ML metadata entries for pipeline tracing
            Cursor countCursor = db.rawQuery("SELECT COUNT(*) FROM " + MlMetadataContract.FeedEntry.TABLE_NAME, null);
            if (countCursor != null) {
                if (countCursor.moveToFirst()) {
                    android.util.Log.d("[NexAlert-ML]", "[DB] Total ML metadata entries: " + countCursor.getInt(0));
                }
                countCursor.close();
            }

            Cursor mlCursor = db.query(MlMetadataContract.FeedEntry.TABLE_NAME,
                new String[]{
                    MlMetadataContract.FeedEntry.COLUMN_NAME_ADDRESS,
                    MlMetadataContract.FeedEntry.COLUMN_NAME_TIMESTAMP,
                    MlMetadataContract.FeedEntry.COLUMN_NAME_IS_SPAM,
                    MlMetadataContract.FeedEntry.COLUMN_NAME_CATEGORY,
                    MlMetadataContract.FeedEntry.COLUMN_NAME_CONFIDENCE
                }, null, null, null, null,
                MlMetadataContract.FeedEntry.COLUMN_NAME_TIMESTAMP + " DESC"); // newest first

            // FIX: Key by address only (keep the latest ML result per sender).
            // Previously keyed by addr+timestamp which caused mismatches because
            // getTimestampMillis() (from SMS PDU) != the date column in content://sms
            // (assigned by the OS when inserting). This meant no ML category was ever
            // matched, so every message fell through to the "unknown" default.
            java.util.HashMap<String, WritableMap> mlMap = new java.util.HashMap<>();
            if (mlCursor != null) {
                while (mlCursor.moveToNext()) {
                    String addr = mlCursor.getString(0);
                    long ts = mlCursor.getLong(1);
                    boolean isSpam = mlCursor.getInt(2) == 1;
                    String category = mlCursor.getString(3);
                    float conf = mlCursor.getFloat(4);

                    // DEBUG: Log every ML metadata row
                    android.util.Log.d("[NexAlert-ML]", "[DB] ML metadata row: addr=" + addr
                        + " ts=" + ts + " isSpam=" + isSpam
                        + " category=" + category + " conf=" + conf);

                    // Only store the first (newest) result per address since cursor is DESC
                    if (!mlMap.containsKey(addr)) {
                        WritableMap map = Arguments.createMap();
                        map.putBoolean("is_spam", isSpam);
                        map.putString("category", category);
                        map.putDouble("confidence", conf);
                        mlMap.put(addr, map);
                        android.util.Log.d("[NexAlert-ML]", "[DB] Stored ML result for addr=" + addr + " -> category=" + category);
                    }
                }
                mlCursor.close();
            }

            android.util.Log.d("[NexAlert-ML]", "[DB] Unique ML addresses loaded: " + mlMap.size());

            Cursor cursor = contentResolver.query(uri, projection, null, null, "date DESC");
            WritableArray smsArray = Arguments.createArray();

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    WritableMap smsMap = Arguments.createMap();
                    String address = cursor.getString(cursor.getColumnIndexOrThrow("address"));
                    String date = cursor.getString(cursor.getColumnIndexOrThrow("date"));
                    String body = cursor.getString(cursor.getColumnIndexOrThrow("body"));

                    smsMap.putString("id", cursor.getString(cursor.getColumnIndexOrThrow("_id")));
                    smsMap.putString("address", address);
                    smsMap.putString("body", body);
                    smsMap.putString("date", date);
                    smsMap.putString("type", cursor.getString(cursor.getColumnIndexOrThrow("type")));
                    smsMap.putString("read", cursor.getString(cursor.getColumnIndexOrThrow("read")));

                    // FIX: Look up by address alone (was addr+timestamp — timestamps mismatched)
                    if (mlMap.containsKey(address)) {
                        WritableMap mlData = mlMap.get(address);
                        String category = mlData.getString("category");
                        smsMap.putBoolean("is_spam", mlData.getBoolean("is_spam"));
                        smsMap.putString("category", category);
                        smsMap.putDouble("confidence", mlData.getDouble("confidence"));
                        // DEBUG: Log successful ML category assignment
                        android.util.Log.d("[NexAlert-ML]", "[API] SMS addr=" + address
                            + " body=" + (body != null ? body.substring(0, Math.min(40, body.length())) : "null")
                            + " -> category=" + category + " [ML MATCH]");
                        android.util.Log.d("[NexAlert-ML]", "[PIPE] Category stored=" + category
                            + " | Category returned to frontend=" + category);
                    } else {
                        smsMap.putBoolean("is_spam", false);
                        smsMap.putString("category", "unknown");
                        // DEBUG: Log fallback to unknown
                        android.util.Log.d("[NexAlert-ML]", "[API] SMS addr=" + address
                            + " body=" + (body != null ? body.substring(0, Math.min(40, body.length())) : "null")
                            + " -> category=unknown [NO ML MATCH — no metadata for this sender]");
                    }

                    smsArray.pushMap(smsMap);
                }
                cursor.close();
            }

            promise.resolve(smsArray);
        } catch (Exception e) {
            promise.reject("SMS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void sendSms(String phoneNumber, String message, Promise promise) {
        try {
            SmsManager smsManager = SmsManager.getDefault();
            smsManager.sendTextMessage(phoneNumber, null, message, null, null);

            // Add to sent messages
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put("address", phoneNumber);
            values.put("body", message);
            values.put("date", System.currentTimeMillis());
            values.put("type", 2); // Sent message
            values.put("read", 1);

            Uri uri = Uri.parse("content://sms/sent");
            contentResolver.insert(uri, values);

            promise.resolve("SMS sent successfully");
        } catch (Exception e) {
            promise.reject("SMS_SEND_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void markAsRead(String address, Promise promise) {
        try {
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            Uri uri = Uri.parse("content://sms");

            ContentValues values = new ContentValues();
            values.put("read", 1);

            // Only mark received messages (type=1) as read
            String selection = "address = ? AND read = 0 AND type = 1";
            String[] selectionArgs = { address };

            int updatedRows = contentResolver.update(uri, values, selection, selectionArgs);
            promise.resolve("Marked " + updatedRows + " messages as read");
        } catch (Exception e) {
            promise.reject("MARK_READ_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getUnreadCount(Promise promise) {
        try {
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            Uri uri = Uri.parse("content://sms/inbox");
            String selection = "read = 0";

            Cursor cursor = contentResolver.query(uri, new String[] { "COUNT(*) as count" }, selection, null, null);
            int unreadCount = 0;

            if (cursor != null) {
                if (cursor.moveToFirst()) {
                    unreadCount = cursor.getInt(0);
                }
                cursor.close();
            }

            promise.resolve(unreadCount);
        } catch (Exception e) {
            promise.reject("UNREAD_COUNT_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isDefaultSmsApp(Promise promise) {
        try {
            String packageName = getReactApplicationContext().getPackageName();
            boolean isDefault = false;

            // Check using RoleManager for Android 11+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                RoleManager roleManager = (RoleManager) getReactApplicationContext()
                        .getSystemService(getReactApplicationContext().ROLE_SERVICE);
                if (roleManager != null) {
                    isDefault = roleManager.isRoleHeld(RoleManager.ROLE_SMS);
                }
            } else {
                // Fallback for older versions
                String defaultSmsPackage = Telephony.Sms.getDefaultSmsPackage(getReactApplicationContext());
                isDefault = packageName.equals(defaultSmsPackage);
            }

            android.util.Log.d("SmsModule", "Package: " + packageName + ", Is default: " + isDefault);
            promise.resolve(isDefault);
        } catch (Exception e) {
            promise.reject("DEFAULT_SMS_CHECK_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void requestDefaultSmsApp(Promise promise) {
        try {
            String packageName = getReactApplicationContext().getPackageName();

            // Check current default first to avoid redundant prompts
            String currentDefault = Telephony.Sms.getDefaultSmsPackage(getReactApplicationContext());
            if (packageName.equals(currentDefault)) {
                promise.resolve("Already default SMS app");
                return;
            }

            // Use RoleManager for Android 11+ (API 30+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                RoleManager roleManager = (RoleManager) getReactApplicationContext()
                        .getSystemService(getReactApplicationContext().ROLE_SERVICE);

                if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_SMS)
                        && !roleManager.isRoleHeld(RoleManager.ROLE_SMS)) {
                    Intent intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS);
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                    android.app.Activity currentActivity = getCurrentActivity();
                    if (currentActivity != null) {
                        currentActivity.startActivity(intent);
                    } else {
                        getReactApplicationContext().startActivity(intent);
                    }
                    promise.resolve("RoleManager SMS request sent");
                } else if (roleManager != null && roleManager.isRoleHeld(RoleManager.ROLE_SMS)) {
                    promise.resolve("Already default SMS app via RoleManager");
                } else {
                    promise.reject("ROLE_NOT_AVAILABLE", "SMS role not available or accessible");
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                // Fallback for Android 4.4 to 10 (pre-R)
                Intent intent = new Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT);
                intent.putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, packageName);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                android.app.Activity currentActivity = getCurrentActivity();
                if (currentActivity != null) {
                    currentActivity.startActivity(intent);
                } else {
                    getReactApplicationContext().startActivity(intent);
                }
                promise.resolve("Legacy SMS request sent");
            } else {
                promise.reject("UNSUPPORTED_VERSION", "Default SMS app requires Android 4.4+");
            }
        } catch (Exception e) {
            promise.reject("DEFAULT_SMS_REQUEST_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void openSmsAppSettings(Promise promise) {
        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
                // Direct intent to default SMS app settings
                Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                try {
                    getReactApplicationContext().startActivity(intent);
                    promise.resolve("Default apps settings opened");
                    return;
                } catch (Exception e) {
                    // Try alternative method
                    try {
                        Intent altIntent = new Intent("android.settings.MANAGE_DEFAULT_APPS_SETTINGS");
                        altIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getReactApplicationContext().startActivity(altIntent);
                        promise.resolve("Default apps settings opened (alt)");
                        return;
                    } catch (Exception e2) {
                        // Final fallback to app settings
                        Intent appIntent = new Intent(android.provider.Settings.ACTION_APPLICATION_SETTINGS);
                        appIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        getReactApplicationContext().startActivity(appIntent);
                        promise.resolve("App settings opened");
                    }
                }
            } else {
                promise.reject("UNSUPPORTED_VERSION", "Default SMS app feature requires Android 4.4+");
            }
        } catch (Exception e) {
            promise.reject("SETTINGS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void deleteSms(ReadableArray ids, Promise promise) {
        try {
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            Uri uri = Uri.parse("content://sms");
            int deletedCount = 0;

            for (int i = 0; i < ids.size(); i++) {
                String id = ids.getString(i);
                String selection = "_id = ?";
                String[] selectionArgs = { id };
                deletedCount += contentResolver.delete(uri, selection, selectionArgs);
            }

            promise.resolve(deletedCount);
        } catch (Exception e) {
            promise.reject("DELETE_ERROR", e.getMessage());
        }
    }
}