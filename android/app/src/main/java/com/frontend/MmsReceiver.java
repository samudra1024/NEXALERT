package com.frontend;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class MmsReceiver extends BroadcastReceiver {
    
    @Override
    public void onReceive(Context context, Intent intent) {
        if ("android.provider.Telephony.WAP_PUSH_DELIVER".equals(intent.getAction())) {
            // Handle MMS messages here if needed
            android.util.Log.d("MmsReceiver", "MMS received");
        }
    }
}