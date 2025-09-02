package com.frontend;

import android.content.ContentResolver;
import android.database.Cursor;
import android.net.Uri;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

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
            String[] projection = {"_id", "address", "body", "date", "type"};
            
            Cursor cursor = contentResolver.query(uri, projection, null, null, "date DESC");
            WritableArray smsArray = Arguments.createArray();
            
            if (cursor != null) {
                while (cursor.moveToNext()) {
                    WritableMap smsMap = Arguments.createMap();
                    smsMap.putString("id", cursor.getString(cursor.getColumnIndexOrThrow("_id")));
                    smsMap.putString("address", cursor.getString(cursor.getColumnIndexOrThrow("address")));
                    smsMap.putString("body", cursor.getString(cursor.getColumnIndexOrThrow("body")));
                    smsMap.putString("date", cursor.getString(cursor.getColumnIndexOrThrow("date")));
                    smsMap.putString("type", cursor.getString(cursor.getColumnIndexOrThrow("type")));
                    smsArray.pushMap(smsMap);
                }
                cursor.close();
            }
            
            promise.resolve(smsArray);
        } catch (Exception e) {
            promise.reject("SMS_ERROR", e.getMessage());
        }
    }
}