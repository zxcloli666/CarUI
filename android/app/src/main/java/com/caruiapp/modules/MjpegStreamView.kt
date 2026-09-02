package com.caruiapp.modules

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.SystemClock
import android.util.AttributeSet
import androidx.appcompat.widget.AppCompatImageView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter
import okhttp3.Call
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.BufferedInputStream
import java.util.concurrent.atomic.AtomicBoolean

class MjpegStreamView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null
) : AppCompatImageView(context, attrs) {
    private var streamUrl: String? = null
    private var paused = false
    private var maxFps = 0
    private var retryDelayMs = 1000L
    private var status = "idle"

    private val running = AtomicBoolean(false)
    private var readerThread: Thread? = null
    private var call: Call? = null

    private val bitmapOptions = BitmapFactory.Options().apply {
        inPreferredConfig = Bitmap.Config.RGB_565
    }

    init {
        scaleType = ScaleType.FIT_CENTER
    }

    fun setUrl(url: String?) {
        if (streamUrl == url) return
        streamUrl = url
        restartStream()
    }

    fun setPaused(value: Boolean) {
        if (paused == value) return
        paused = value
        if (paused) {
            stopStream()
        } else {
            startStream()
        }
    }

    fun setMaxFps(value: Int) {
        maxFps = value
    }

    fun setRetryDelayMs(value: Int) {
        retryDelayMs = value.toLong()
    }

    fun setResizeMode(mode: String?) {
        scaleType = when (mode) {
            "cover" -> ScaleType.CENTER_CROP
            "stretch" -> ScaleType.FIT_XY
            else -> ScaleType.FIT_CENTER
        }
    }

    override fun onAttachedToWindow() {
        super.onAttachedToWindow()
        startStream()
    }

    override fun onDetachedFromWindow() {
        stopStream()
        super.onDetachedFromWindow()
    }

    private fun startStream() {
        if (paused || streamUrl.isNullOrBlank()) return
        if (running.get()) return
        running.set(true)
        readerThread = Thread { streamLoop() }.apply {
            isDaemon = true
            name = "MjpegStream-${hashCode()}"
            start()
        }
    }

    private fun stopStream() {
        running.set(false)
        call?.cancel()
        call = null
        readerThread?.interrupt()
        readerThread = null
    }

    private fun restartStream() {
        stopStream()
        startStream()
    }

    private fun streamLoop() {
        while (running.get() && !paused) {
            val targetUrl = streamUrl ?: break
            emitStatus("connecting")

            try {
                val request = Request.Builder().url(targetUrl).build()
                call = httpClient.newCall(request)
                val response = call?.execute()

                if (response == null || !response.isSuccessful) {
                    response?.close()
                    emitStatus("error")
                    sleepRetry()
                    continue
                }

                val boundary = parseBoundary(response.header("Content-Type")) ?: DEFAULT_BOUNDARY
                val stream = response.body?.byteStream()

                if (stream == null) {
                    response.close()
                    emitStatus("error")
                    sleepRetry()
                    continue
                }

                val reader = MjpegStreamReader(BufferedInputStream(stream), boundary)
                var hasFrame = false
                var lastFrameAt = 0L

                while (running.get() && !paused) {
                    val frame = reader.readFrame() ?: break
                    if (!hasFrame) {
                        emitStatus("streaming")
                        hasFrame = true
                    }

                    val limit = maxFps
                    val now = SystemClock.uptimeMillis()
                    if (limit > 0) {
                        val minInterval = 1000L / limit
                        if (now - lastFrameAt < minInterval) {
                            continue
                        }
                    }

                    val bitmap = BitmapFactory.decodeByteArray(frame, 0, frame.size, bitmapOptions)
                    if (bitmap != null) {
                        lastFrameAt = now
                        post { setImageBitmap(bitmap) }
                    }
                }

                response.close()
            } catch (_: Exception) {
                emitStatus("error")
            } finally {
                call = null
            }

            sleepRetry()
        }
    }

    private fun sleepRetry() {
        if (!running.get() || paused) return
        try {
            Thread.sleep(retryDelayMs)
        } catch (_: InterruptedException) {
        }
    }

    private fun emitStatus(next: String) {
        if (status == next) return
        status = next
        val reactContext = context as? ReactContext ?: return
        val payload = Arguments.createMap().apply {
            putString("status", next)
        }
        reactContext
            .getJSModule(RCTEventEmitter::class.java)
            .receiveEvent(id, "onStatus", payload)
    }

    private fun parseBoundary(contentType: String?): String? {
        if (contentType.isNullOrBlank()) return null
        val parts = contentType.split(';')
        for (part in parts) {
            val trimmed = part.trim()
            if (trimmed.startsWith("boundary=", ignoreCase = true)) {
                var boundary = trimmed.substringAfter("=").trim()
                if (!boundary.startsWith("--")) {
                    boundary = "--$boundary"
                }
                return boundary
            }
        }
        return null
    }

    private class MjpegStreamReader(
        private val input: BufferedInputStream,
        private val boundary: String
    ) {
        fun readFrame(): ByteArray? {
            var line = readLine() ?: return null
            while (!line.startsWith(boundary)) {
                line = readLine() ?: return null
            }

            var contentLength = -1
            while (true) {
                val header = readLine() ?: return null
                if (header.isEmpty()) break
                val parts = header.split(":", limit = 2)
                if (parts.size == 2 && parts[0].trim().equals("Content-Length", ignoreCase = true)) {
                    contentLength = parts[1].trim().toIntOrNull() ?: -1
                }
            }

            if (contentLength <= 0) return null

            val buffer = ByteArray(contentLength)
            var offset = 0
            while (offset < contentLength) {
                val read = input.read(buffer, offset, contentLength - offset)
                if (read == -1) return null
                offset += read
            }
            return buffer
        }

        private fun readLine(): String? {
            val builder = StringBuilder()
            var byte = input.read()
            if (byte == -1) return null
            while (byte != -1) {
                if (byte == '\n'.code) break
                if (byte != '\r'.code) {
                    builder.append(byte.toChar())
                }
                byte = input.read()
            }
            return builder.toString()
        }
    }

    companion object {
        private const val DEFAULT_BOUNDARY = "--frame"
        private val httpClient = OkHttpClient.Builder()
            .retryOnConnectionFailure(true)
            .build()
    }
}
