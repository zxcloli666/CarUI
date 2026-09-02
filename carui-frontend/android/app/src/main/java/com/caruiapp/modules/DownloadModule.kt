package com.caruiapp.modules

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.widget.Toast
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class DownloadModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "DownloadModule"

    private val pendingDownloads = mutableMapOf<Long, String>()

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
            val filename = pendingDownloads.remove(id) ?: return

            val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val query = DownloadManager.Query().setFilterById(id)
            val cursor: Cursor? = dm.query(query)

            if (cursor != null && cursor.moveToFirst()) {
                val statusIdx = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS)
                val status = cursor.getInt(statusIdx)

                if (status == DownloadManager.STATUS_SUCCESSFUL) {
                    val path = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                        .resolve(filename).absolutePath
                    Toast.makeText(context, "Сохранено: $path", Toast.LENGTH_LONG).show()
                } else {
                    Toast.makeText(context, "Ошибка загрузки: $filename", Toast.LENGTH_LONG).show()
                }
                cursor.close()
            }
        }
    }

    init {
        val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            reactContext.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            reactContext.registerReceiver(receiver, filter)
        }
    }

    @ReactMethod
    fun download(url: String, filename: String) {
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle(filename)
            .setDescription("Загрузка записи CarUI")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename)
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val dm = reactContext.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val downloadId = dm.enqueue(request)
        pendingDownloads[downloadId] = filename

        Toast.makeText(reactContext, "Загрузка: $filename", Toast.LENGTH_SHORT).show()
    }
}
