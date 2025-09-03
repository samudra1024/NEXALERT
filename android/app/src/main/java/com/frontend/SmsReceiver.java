package com.frontend;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class SmsReceiver extends BroadcastReceiver {
    
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if ("android.provider.Telephony.SMS_RECEIVED".equals(action) || 
            "android.provider.Telephony.SMS_DELIVER".equals(action)) {
            
            Bundle bundle = intent.getExtras();
            if (bundle != null) {
                Object[] pdus = (Object[]) bundle.get("pdus");
                if (pdus != null) {
                    for (Object pdu : pdus) {
                        SmsMessage smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                        String sender = smsMessage.getDisplayOriginatingAddress();
                        String messageBody = smsMessage.getMessageBody();
                        long timestamp = smsMessage.getTimestampMillis();
                        
                        // Send event to React Native
                        sendSmsEvent(context, sender, messageBody, timestamp);
                    }
                }
            }
        }
    }
    
    private void sendSmsEvent(Context context, String sender, String message, long timestamp) {
        try {
            // Store SMS data for later retrieval by the app
            // The app will refresh its message list when it becomes active
            android.util.Log.d("SmsReceiver", "SMS received from: " + sender + ", message: " + message);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}