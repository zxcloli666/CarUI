package com.caruiapp.modules

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.content.ContextCompat

class KeepAliveDismissReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (!CarUIKeepAliveService.isKeepAliveEnabled(context)) {
            return
        }

        val serviceIntent = Intent(context, CarUIKeepAliveService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ContextCompat.startForegroundService(context, serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
