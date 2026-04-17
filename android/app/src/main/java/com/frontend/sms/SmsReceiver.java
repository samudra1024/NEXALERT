package com.frontend.sms;

import android.content.BroadcastReceiver;
import android.content.BroadcastReceiver.PendingResult;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.telephony.SmsMessage;
import android.provider.Telephony;
import android.content.ContentValues;
import android.net.Uri;
import android.app.NotificationManager;
import android.app.NotificationChannel;
import android.app.Notification;
import android.app.PendingIntent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import com.frontend.ml.MlPipelineManager;
import com.frontend.ml.MlResult;
import com.frontend.db.MlDatabaseHelper;
import com.frontend.MainActivity;
public class SmsReceiver extends BroadcastReceiver {
    
    private static final ExecutorService executor = Executors.newSingleThreadExecutor();

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        
        if (Telephony.Sms.Intents.SMS_DELIVER_ACTION.equals(action)) {
            // Handle SMS_DELIVER - this is the primary action for default SMS apps
            final PendingResult pendingResult = goAsync();
            handleSmsDeliverAsync(context, intent, pendingResult);
        } else if (Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(action)) {
            // Fallback for non-default apps, we just log, or optionally process.
            // For now, keep as original but minimal async if needed.
            handleSmsReceived(context, intent);
        }
    }
    
    private void handleSmsDeliverAsync(Context context, Intent intent, PendingResult pendingResult) {
        executor.execute(() -> {
            try {
                Bundle bundle = intent.getExtras();
                if (bundle != null) {
                    Object[] pdus = (Object[]) bundle.get("pdus");
                    String format = bundle.getString("format");
                    
                    if (pdus != null) {
                        // Multipart SMS handling - concatenate all parts
                        SmsMessage[] messages = new SmsMessage[pdus.length];
                        for (int i = 0; i < pdus.length; i++) {
                            if (format != null) {
                                messages[i] = SmsMessage.createFromPdu((byte[]) pdus[i], format);
                            } else {
                                messages[i] = SmsMessage.createFromPdu((byte[]) pdus[i]);
                            }
                        }
                        
                        // Check if this is a multipart message
                        if (messages.length > 0 && messages[0] != null) {
                            String sender = messages[0].getDisplayOriginatingAddress();
                            long timestamp = messages[0].getTimestampMillis();
                            
                            // Concatenate multipart message body
                            StringBuilder messageBodyBuilder = new StringBuilder();
                            for (SmsMessage msg : messages) {
                                if (msg != null && msg.getMessageBody() != null) {
                                    messageBodyBuilder.append(msg.getMessageBody());
                                }
                            }
                            String messageBody = messageBodyBuilder.toString();
                            
                            if (messages.length > 1) {
                                android.util.Log.d("SmsReceiver", "Multipart SMS detected: " + messages.length + " parts from " + sender);
                            }
                            
                            // 1. Run ML Pipeline
                            MlPipelineManager mlManager = MlPipelineManager.Companion.getInstance(context);
                            MlResult result = mlManager.processMessage(messageBody);

                            // 2. Store ML metadata locally in standard SQLite table
                            MlDatabaseHelper dbHelper = new MlDatabaseHelper(context);
                            dbHelper.insertMetadata(sender, timestamp, result.isSpam(), result.getCategory(), result.getConfidence());
                            
                            // 3. Store in system SMS database using default Android approach
                            storeSmsInDatabase(context, sender, messageBody, timestamp);
                            
                            // 4. Conditionally show notification!
                            if (!result.isSpam()) {
                                showNotification(context, sender, messageBody, result.getCategory());
                            } else {
                                android.util.Log.d("SmsReceiver", "Spam blocked! Discarding notification for: " + sender);
                            }
                        }
                    }
                }
            } catch (Exception e) {
                android.util.Log.e("SmsReceiver", "Error processing SMS", e);
            } finally {
                if (pendingResult != null) {
                    pendingResult.finish();
                }
            }
        });
    }
    
    private void handleSmsReceived(Context context, Intent intent) {
        Bundle bundle = intent.getExtras();
        if (bundle != null) {
            Object[] pdus = (Object[]) bundle.get("pdus");
            String format = bundle.getString("format");
            
            if (pdus != null) {
                for (Object pdu : pdus) {
                    SmsMessage smsMessage;
                    if (format != null) {
                        smsMessage = SmsMessage.createFromPdu((byte[]) pdu, format);
                    } else {
                        smsMessage = SmsMessage.createFromPdu((byte[]) pdu);
                    }
                    
                    if (smsMessage != null) {
                        String sender = smsMessage.getDisplayOriginatingAddress();
                        String messageBody = smsMessage.getMessageBody();
                        
                        android.util.Log.d("SmsReceiver", "SMS_RECEIVED from: " + sender + ", message: " + messageBody);
                    }
                }
            }
        }
    }
    
    private void storeSmsInDatabase(Context context, String sender, String message, long timestamp) {
        try {
            ContentValues values = new ContentValues();
            values.put(Telephony.Sms.ADDRESS, sender);
            values.put(Telephony.Sms.BODY, message);
            values.put(Telephony.Sms.DATE, timestamp);
            values.put(Telephony.Sms.DATE_SENT, timestamp);
            values.put(Telephony.Sms.READ, 0);
            values.put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_INBOX);
            values.put(Telephony.Sms.THREAD_ID, getThreadId(context, sender));
            
            Uri uri = context.getContentResolver().insert(Telephony.Sms.CONTENT_URI, values);
            if (uri != null) {
                android.util.Log.d("SmsReceiver", "SMS stored in database: " + uri.toString());
            }
        } catch (Exception e) {
            android.util.Log.e("SmsReceiver", "Error storing SMS in database", e);
        }
    }
    
    private long getThreadId(Context context, String address) {
        try {
            return Telephony.Threads.getOrCreateThreadId(context, address);
        } catch (Exception e) {
            android.util.Log.e("SmsReceiver", "Error getting thread ID", e);
            return 0;
        }
    }
    
    private void showNotification(Context context, String sender, String message, String category) {
        try {
            NotificationManager notificationManager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            String channelId = "sms_notifications";
            
            // Create notification channel for Android 8.0+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    "SMS Notifications",
                    NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Notifications for incoming SMS messages");
                channel.enableVibration(true);
                channel.setShowBadge(true);
                notificationManager.createNotificationChannel(channel);
            }
            
            // Create intent to open the app when notification is tapped
            Intent intent = new Intent(context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            intent.putExtra("sender", sender);
            
            PendingIntent pendingIntent = PendingIntent.getActivity(
                context, 
                0, 
                intent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            
            // Build notification
            NotificationCompat.Builder builder = new NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.ic_dialog_email)
                .setContentTitle("New message from " + sender + " [" + category + "]")
                .setContentText(message)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(message))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setVibrate(new long[]{0, 500, 200, 500})
                .setDefaults(Notification.DEFAULT_SOUND);
            
            // Show notification with unique ID based on sender
            int notificationId = sender.hashCode();
            notificationManager.notify(notificationId, builder.build());
            
            android.util.Log.d("SmsReceiver", "Notification shown for SMS from: " + sender);
            
        } catch (Exception e) {
            android.util.Log.e("SmsReceiver", "Error showing notification", e);
        }
    }
}
