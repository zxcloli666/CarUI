package com.caruiapp.modules

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

class MediaNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "MediaNotificationListener"
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        // We don't need to process notifications here
        // This service is just to get permission to access MediaSessions
        Log.d(TAG, "Notification posted from: ${sbn?.packageName}")
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        Log.d(TAG, "Notification removed from: ${sbn?.packageName}")
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d(TAG, "NotificationListener connected")
    }

    override fun onListenerDisconnected() {
        super.onListenerDisconnected()
        Log.d(TAG, "NotificationListener disconnected")
    }
}
