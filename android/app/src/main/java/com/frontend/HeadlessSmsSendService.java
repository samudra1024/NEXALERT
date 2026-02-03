package com.frontend;

import android.app.IntentService;
import android.content.Intent;
import android.telephony.SmsManager;
import android.net.Uri;

public class HeadlessSmsSendService extends IntentService {
    
    public HeadlessSmsSendService() {
        super("HeadlessSmsSendService");
    }

    @Override
    protected void onHandleIntent(Intent intent) {
        if (intent != null) {
            String action = intent.getAction();
            if ("android.intent.action.RESPOND_VIA_MESSAGE".equals(action)) {
                Uri uri = intent.getData();
                String message = intent.getStringExtra(Intent.EXTRA_TEXT);
                
                if (uri != null && message != null) {
                    String phoneNumber = uri.getSchemeSpecificPart();
                    try {
                        SmsManager smsManager = SmsManager.getDefault();
                        smsManager.sendTextMessage(phoneNumber, null, message, null, null);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }
    }
}