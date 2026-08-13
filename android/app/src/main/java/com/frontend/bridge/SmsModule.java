package com.frontend.bridge;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.Telephony;
import android.provider.ContactsContract;
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
import android.app.Activity;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.util.ArrayList;
import com.frontend.db.MlDatabaseHelper;
import com.frontend.db.MlMetadataContract;

public class SmsModule extends ReactContextBaseJavaModule {

    private static ReactApplicationContext reactContextHolder;

    public SmsModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContextHolder = reactContext;
    }

    public static void emitSmsReceived(String sender, String body, long date) {
        if (reactContextHolder == null) {
            return;
        }
        try {
            WritableMap params = Arguments.createMap();
            params.putString("sender", sender);
            params.putString("body", body != null ? body : "");
            params.putDouble("date", (double) date);
            reactContextHolder
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("onSmsReceived", params);
        } catch (Exception e) {
            android.util.Log.e("SmsModule", "Failed to emit onSmsReceived", e);
        }
    }

    @ReactMethod
    public void addListener(String eventName) {
        // Required for NativeEventEmitter
    }

    @ReactMethod
    public void removeListeners(double count) {
        // Required for NativeEventEmitter
    }

    @Override
    public String getName() {
        return "SmsModule";
    }

    private java.util.HashMap<String, WritableMap> loadMlMap() {
        java.util.HashMap<String, WritableMap> mlMap = new java.util.HashMap<>();
        try {
            MlDatabaseHelper dbHelper = new MlDatabaseHelper(getReactApplicationContext());
            android.database.sqlite.SQLiteDatabase db = dbHelper.getReadableDatabase();
            Cursor mlCursor = db.query(
                MlMetadataContract.FeedEntry.TABLE_NAME,
                new String[]{
                    MlMetadataContract.FeedEntry.COLUMN_NAME_ADDRESS,
                    MlMetadataContract.FeedEntry.COLUMN_NAME_TIMESTAMP,
                    MlMetadataContract.FeedEntry.COLUMN_NAME_IS_SPAM,
                    MlMetadataContract.FeedEntry.COLUMN_NAME_CATEGORY,
                    MlMetadataContract.FeedEntry.COLUMN_NAME_CONFIDENCE
                },
                null, null, null, null,
                MlMetadataContract.FeedEntry.COLUMN_NAME_TIMESTAMP + " DESC"
            );

            if (mlCursor != null) {
                while (mlCursor.moveToNext()) {
                    String addr = mlCursor.getString(0);
                    long ts = mlCursor.getLong(1);
                    boolean isSpam = mlCursor.getInt(2) == 1;
                    String category = mlCursor.getString(3);
                    float conf = mlCursor.getFloat(4);

                    String key = addr + "_" + ts;
                    WritableMap map = Arguments.createMap();
                    map.putBoolean("is_spam", isSpam);
                    map.putString("category", category);
                    map.putDouble("confidence", conf);
                    mlMap.put(key, map);
                }
                mlCursor.close();
            }
        } catch (Exception e) {
            android.util.Log.w("SmsModule", "ML map load failed: " + e.getMessage());
        }
        return mlMap;
    }

    private void attachMlData(WritableMap smsMap, String address, String date, java.util.HashMap<String, WritableMap> mlMap) {
        String mlKey = address + "_" + date;
        if (mlMap.containsKey(mlKey)) {
            WritableMap mlData = mlMap.get(mlKey);
            smsMap.putBoolean("is_spam", mlData.getBoolean("is_spam"));
            smsMap.putString("category", mlData.getString("category"));
            smsMap.putDouble("confidence", mlData.getDouble("confidence"));
        } else {
            smsMap.putBoolean("is_spam", false);
            smsMap.putString("category", "unknown");
        }
    }

    private String formatTime(long timestamp) {
        java.text.SimpleDateFormat sdf = new java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault());
        return sdf.format(new java.util.Date(timestamp));
    }

    private int getUnreadCountForAddress(ContentResolver contentResolver, String address) {
        Uri uri = Uri.parse("content://sms");
        String selection = "address = ? AND read = 0 AND type = 1";
        String[] selectionArgs = { address };
        Cursor cursor = contentResolver.query(uri, new String[] { "_id" }, selection, selectionArgs, null);
        int count = 0;
        if (cursor != null) {
            count = cursor.getCount();
            cursor.close();
        }
        return count;
    }

    @ReactMethod
    public void getConversationsPaginated(int page, int limit, ReadableArray excludeAddresses, Promise promise) {
        try {
            java.util.HashSet<String> excluded = new java.util.HashSet<>();
            if (excludeAddresses != null) {
                for (int i = 0; i < excludeAddresses.size(); i++) {
                    String value = excludeAddresses.getString(i);
                    if (value != null) {
                        excluded.add(value);
                    }
                }
            }

            int skip = Math.max(0, (page - 1) * limit);
            java.util.LinkedHashMap<String, WritableMap> conversations = new java.util.LinkedHashMap<>();
            java.util.HashMap<String, WritableMap> mlMap = loadMlMap();

            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            Uri uri = Uri.parse("content://sms");
            String[] projection = { "_id", "address", "body", "date", "type", "read" };
            Cursor cursor = contentResolver.query(uri, projection, null, null, "date DESC");

            int skipped = 0;
            boolean hasMore = false;

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String address = cursor.getString(cursor.getColumnIndexOrThrow("address"));
                    if (address == null || excluded.contains(address)) {
                        continue;
                    }

                    if (!conversations.containsKey(address)) {
                        if (skipped < skip) {
                            skipped++;
                            continue;
                        }

                        if (conversations.size() >= limit) {
                            hasMore = true;
                            break;
                        }

                        String body = cursor.getString(cursor.getColumnIndexOrThrow("body"));
                        String date = cursor.getString(cursor.getColumnIndexOrThrow("date"));
                        long rawTime = cursor.getLong(cursor.getColumnIndexOrThrow("date"));

                        WritableMap conv = Arguments.createMap();
                        conv.putString("id", address);
                        conv.putString("name", address);
                        conv.putString("avatar", address.length() > 0 ? address.substring(0, 1) : "?");
                        conv.putString("lastMessage", body != null ? body : "");
                        conv.putDouble("rawTime", (double) rawTime);
                        conv.putString("time", formatTime(rawTime));
                        conv.putInt("unread", 0);

                        String mlKey = address + "_" + date;
                        if (mlMap.containsKey(mlKey)) {
                            WritableMap mlData = mlMap.get(mlKey);
                            conv.putString("category", mlData.getString("category"));
                            conv.putBoolean("isSpam", mlData.getBoolean("is_spam"));
                        } else {
                            conv.putString("category", "unknown");
                            conv.putBoolean("isSpam", false);
                        }

                        conversations.put(address, conv);
                    }
                }

                if (!hasMore && conversations.size() >= limit) {
                    while (cursor.moveToNext()) {
                        String address = cursor.getString(cursor.getColumnIndexOrThrow("address"));
                        if (address != null && !excluded.contains(address) && !conversations.containsKey(address)) {
                            hasMore = true;
                            break;
                        }
                    }
                }

                cursor.close();
            }

            for (String address : conversations.keySet()) {
                int unread = getUnreadCountForAddress(contentResolver, address);
                conversations.get(address).putInt("unread", unread);
            }

            WritableArray result = Arguments.createArray();
            for (WritableMap conv : conversations.values()) {
                result.pushMap(conv);
            }

            WritableMap response = Arguments.createMap();
            response.putArray("conversations", result);
            response.putBoolean("hasMore", hasMore);
            response.putInt("page", page);
            promise.resolve(response);
        } catch (Exception e) {
            promise.reject("CONVERSATIONS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getChatMessagesPaginated(String address, int page, int limit, Promise promise) {
        try {
            int offset = Math.max(0, (page - 1) * limit);
            java.util.HashMap<String, WritableMap> mlMap = loadMlMap();

            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            Uri uri = Uri.parse("content://sms");
            String[] projection = { "_id", "address", "body", "date", "type", "read" };
            String selection = "address = ?";
            String[] selectionArgs = { address };
            String sortOrder = "date DESC LIMIT " + limit + " OFFSET " + offset;

            Cursor cursor = contentResolver.query(uri, projection, selection, selectionArgs, sortOrder);
            WritableArray smsArray = Arguments.createArray();

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    WritableMap smsMap = Arguments.createMap();
                    String date = cursor.getString(cursor.getColumnIndexOrThrow("date"));
                    String body = cursor.getString(cursor.getColumnIndexOrThrow("body"));

                    smsMap.putString("_id", cursor.getString(cursor.getColumnIndexOrThrow("_id")));
                    smsMap.putString("id", cursor.getString(cursor.getColumnIndexOrThrow("_id")));
                    smsMap.putString("address", address);
                    smsMap.putString("body", body != null ? body : "");
                    smsMap.putString("date", date);
                    smsMap.putString("type", cursor.getString(cursor.getColumnIndexOrThrow("type")));
                    smsMap.putString("read", cursor.getString(cursor.getColumnIndexOrThrow("read")));
                    attachMlData(smsMap, address, date, mlMap);
                    smsArray.pushMap(smsMap);
                }
                cursor.close();
            }

            boolean hasMore = smsArray.size() >= limit;
            WritableMap response = Arguments.createMap();
            response.putArray("messages", smsArray);
            response.putBoolean("hasMore", hasMore);
            response.putInt("page", page);
            promise.resolve(response);
        } catch (Exception e) {
            promise.reject("CHAT_MESSAGES_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void markAllAsRead(Promise promise) {
        try {
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            Uri uri = Uri.parse("content://sms");
            ContentValues values = new ContentValues();
            values.put("read", 1);
            int updatedRows = contentResolver.update(uri, values, "read = 0 AND type = 1", null);
            promise.resolve(updatedRows);
        } catch (Exception e) {
            promise.reject("MARK_ALL_READ_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getSmsMessages(Promise promise) {
        try {
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            Uri uri = Uri.parse("content://sms");
            String[] projection = { "_id", "address", "body", "date", "type", "read" };

            java.util.HashMap<String, WritableMap> mlMap = loadMlMap();

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

                    attachMlData(smsMap, address, date, mlMap);

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
            ArrayList<String> parts = smsManager.divideMessage(message);
            if (parts.size() <= 1) {
                smsManager.sendTextMessage(phoneNumber, null, message, null, null);
            } else {
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
            }

            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put("address", phoneNumber);
            values.put("body", message);
            values.put("date", System.currentTimeMillis());
            values.put("type", 2);
            values.put("read", 1);

            Uri uri = Uri.parse("content://sms/sent");
            contentResolver.insert(uri, values);

            promise.resolve("SMS sent successfully");
        } catch (Exception e) {
            promise.reject("SMS_SEND_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void markAsUnread(String address, Promise promise) {
        try {
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            Uri uri = Uri.parse("content://sms");
            ContentValues values = new ContentValues();
            values.put("read", 0);
            String selection = "address = ? AND type = 1";
            String[] selectionArgs = { address };
            int updatedRows = contentResolver.update(uri, values, selection, selectionArgs);
            promise.resolve(updatedRows);
        } catch (Exception e) {
            promise.reject("MARK_UNREAD_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getInitialIntentData(Promise promise) {
        try {
            WritableMap map = Arguments.createMap();
            Activity activity = getCurrentActivity();
            if (activity != null && activity.getIntent() != null) {
                Intent intent = activity.getIntent();
                String sender = intent.getStringExtra("sender");
                if (sender != null && !sender.isEmpty()) {
                    map.putString("contactId", sender);
                }
                Uri data = intent.getData();
                if (data != null) {
                    String scheme = data.getScheme();
                    if ("sms".equals(scheme) || "smsto".equals(scheme)) {
                        String phone = data.getSchemeSpecificPart();
                        if (phone != null) {
                            if (phone.contains("?")) {
                                phone = phone.split("\\?")[0];
                            }
                            map.putString("contactId", phone);
                        }
                        String body = data.getQueryParameter("body");
                        if (body != null) {
                            map.putString("body", body);
                        }
                    }
                }
                intent.removeExtra("sender");
            }
            promise.resolve(map);
        } catch (Exception e) {
            promise.reject("INTENT_DATA_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void getAllContacts(Promise promise) {
        try {
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            WritableArray contacts = Arguments.createArray();
            java.util.HashSet<String> seen = new java.util.HashSet<>();

            Cursor cursor = contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[] {
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                },
                null,
                null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
            );

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    String name = cursor.getString(0);
                    String number = cursor.getString(1);
                    if (number == null || number.isEmpty()) {
                        continue;
                    }
                    String normalized = number.replaceAll("[^0-9+]", "");
                    String key = normalized + "|" + (name != null ? name : "");
                    if (seen.contains(key)) {
                        continue;
                    }
                    seen.add(key);
                    WritableMap contact = Arguments.createMap();
                    contact.putString("id", normalized);
                    contact.putString("name", name != null && !name.isEmpty() ? name : normalized);
                    contact.putString("phone", normalized);
                    contacts.pushMap(contact);
                    if (contacts.size() >= 500) {
                        break;
                    }
                }
                cursor.close();
            }

            promise.resolve(contacts);
        } catch (Exception e) {
            promise.reject("CONTACTS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void searchMessages(String query, int limit, Promise promise) {
        try {
            if (query == null || query.trim().isEmpty()) {
                promise.resolve(Arguments.createArray());
                return;
            }

            String like = "%" + query.trim() + "%";
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            Uri uri = Uri.parse("content://sms");
            String[] projection = { "_id", "address", "body", "date", "type", "read" };
            String selection = "body LIKE ? OR address LIKE ?";
            String[] selectionArgs = { like, like };
            String sortOrder = "date DESC LIMIT " + Math.max(1, Math.min(limit, 100));

            Cursor cursor = contentResolver.query(uri, projection, selection, selectionArgs, sortOrder);
            WritableArray results = Arguments.createArray();

            if (cursor != null) {
                while (cursor.moveToNext()) {
                    WritableMap smsMap = Arguments.createMap();
                    smsMap.putString("_id", cursor.getString(cursor.getColumnIndexOrThrow("_id")));
                    smsMap.putString("address", cursor.getString(cursor.getColumnIndexOrThrow("address")));
                    smsMap.putString("body", cursor.getString(cursor.getColumnIndexOrThrow("body")));
                    smsMap.putString("date", cursor.getString(cursor.getColumnIndexOrThrow("date")));
                    smsMap.putString("type", cursor.getString(cursor.getColumnIndexOrThrow("type")));
                    smsMap.putString("read", cursor.getString(cursor.getColumnIndexOrThrow("read")));
                    results.pushMap(smsMap);
                }
                cursor.close();
            }

            promise.resolve(results);
        } catch (Exception e) {
            promise.reject("SEARCH_ERROR", e.getMessage());
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
    @ReactMethod
    public void getContactNames(ReadableArray phoneNumbers, Promise promise) {
        try {
            ContentResolver contentResolver = getReactApplicationContext().getContentResolver();
            WritableMap contactMap = Arguments.createMap();

            for (int i = 0; i < phoneNumbers.size(); i++) {
                String phoneNumber = phoneNumbers.getString(i);
                if (phoneNumber == null || phoneNumber.isEmpty()) continue;

                Uri lookupUri = Uri.withAppendedPath(
                    ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                    Uri.encode(phoneNumber)
                );

                Cursor cursor = contentResolver.query(
                    lookupUri,
                    new String[]{ ContactsContract.PhoneLookup.DISPLAY_NAME },
                    null, null, null
                );

                if (cursor != null) {
                    if (cursor.moveToFirst()) {
                        String name = cursor.getString(
                            cursor.getColumnIndexOrThrow(ContactsContract.PhoneLookup.DISPLAY_NAME)
                        );
                        if (name != null && !name.isEmpty()) {
                            contactMap.putString(phoneNumber, name);
                        }
                    }
                    cursor.close();
                }
            }

            promise.resolve(contactMap);
        } catch (Exception e) {
            promise.reject("CONTACT_LOOKUP_ERROR", e.getMessage());
        }
    }
}