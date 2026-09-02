package com.caruiapp.modules

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Point
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import android.widget.ScrollView
import com.facebook.react.bridge.Promise
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
import java.nio.ByteBuffer
import java.nio.charset.Charset
import java.util.Collections
import java.util.LinkedList
import java.util.Locale
import java.util.WeakHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executor
import java.util.concurrent.TimeUnit
import java.util.zip.Deflater
import kotlin.math.min

internal object ViewSnapshot {
    const val ERROR_UNABLE_TO_SNAPSHOT = "E_UNABLE_TO_SNAPSHOT"

    private const val TAG = "ViewSnapshot"
    private const val PREALLOCATE_SIZE = 64 * 1024
    private const val ARGB_SIZE = 4
    private const val SURFACE_VIEW_READ_PIXELS_TIMEOUT = 5L

    private var outputBuffer = ByteArray(PREALLOCATE_SIZE)

    enum class Format {
        JPEG,
        PNG,
        WEBP,
        RAW,
    }

    object Results {
        const val TEMP_FILE = "tmpfile"
        const val BASE_64 = "base64"
        const val DATA_URI = "data-uri"
        const val ZIP_BASE_64 = "zip-base64"
    }

    data class CaptureConfig(
        val tag: Int,
        val extension: String,
        val format: Format,
        val quality: Double,
        val width: Int?,
        val height: Int?,
        val output: File?,
        val result: String,
        val snapshotContentContainer: Boolean,
        val handleGLSurfaceView: Boolean,
    )

    fun capture(view: View?, config: CaptureConfig, promise: Promise, executor: Executor) {
        if (view == null) {
            promise.reject(ERROR_UNABLE_TO_SNAPSHOT, "No view found with reactTag: ${config.tag}")
            return
        }

        executor.execute {
            try {
                val stream = ReusableByteArrayOutputStream(outputBuffer)
                stream.setSize(proposeSize(view))
                outputBuffer = stream.innerBuffer()

                when (config.result) {
                    Results.TEMP_FILE -> {
                        val output = config.output
                        if (output == null) {
                            promise.reject(ERROR_UNABLE_TO_SNAPSHOT, "Output file is null")
                            return@execute
                        }
                        if (config.format == Format.RAW) {
                            saveToRawFileOnDevice(view, output, config, promise)
                        } else {
                            saveToTempFileOnDevice(view, output, config, promise)
                        }
                    }
                    Results.BASE_64, Results.ZIP_BASE_64 -> saveToBase64String(view, config, promise)
                    Results.DATA_URI -> saveToDataUriString(view, config, promise)
                    else -> promise.reject(ERROR_UNABLE_TO_SNAPSHOT, "Unknown result type: ${config.result}")
                }
            } catch (ex: Throwable) {
                Log.e(TAG, "Failed to capture view snapshot", ex)
                promise.reject(ERROR_UNABLE_TO_SNAPSHOT, "Failed to capture view snapshot")
            }
        }
    }

    private fun saveToTempFileOnDevice(
        view: View,
        output: File,
        config: CaptureConfig,
        promise: Promise,
    ) {
        FileOutputStream(output).use { fos ->
            captureView(view, config, fos)
        }
        promise.resolve(Uri.fromFile(output).toString())
    }

    private fun saveToRawFileOnDevice(
        view: View,
        output: File,
        config: CaptureConfig,
        promise: Promise,
    ) {
        val uri = Uri.fromFile(output).toString()

        val os = ReusableByteArrayOutputStream(outputBuffer)
        val size = captureView(view, config, os)
        outputBuffer = os.innerBuffer()
        val length = os.size()
        val resolution = String.format(Locale.US, "%d:%d|", size.x, size.y)

        FileOutputStream(output).use { fos ->
            fos.write(resolution.toByteArray(Charset.forName("US-ASCII")))
            fos.write(outputBuffer, 0, length)
        }

        promise.resolve(uri)
    }

    private fun saveToDataUriString(view: View, config: CaptureConfig, promise: Promise) {
        val os = ReusableByteArrayOutputStream(outputBuffer)
        captureView(view, config, os)

        outputBuffer = os.innerBuffer()
        val length = os.size()
        val data = Base64.encodeToString(outputBuffer, 0, length, Base64.NO_WRAP)
        val imageFormat = if (config.extension == "jpg") "jpeg" else config.extension

        promise.resolve("data:image/$imageFormat;base64,$data")
    }

    private fun saveToBase64String(view: View, config: CaptureConfig, promise: Promise) {
        val isRaw = config.format == Format.RAW
        val isZippedBase64 = config.result == Results.ZIP_BASE_64

        val os = ReusableByteArrayOutputStream(outputBuffer)
        val size = captureView(view, config, os)
        outputBuffer = os.innerBuffer()
        val length = os.size()
        val resolution = String.format(Locale.US, "%d:%d|", size.x, size.y)
        val header = if (isRaw) resolution else ""

        val data = if (isZippedBase64) {
            val deflater = Deflater()
            deflater.setInput(outputBuffer, 0, length)
            deflater.finish()

            val zipped = ReusableByteArrayOutputStream(ByteArray(32))
            val buffer = ByteArray(1024)
            while (!deflater.finished()) {
                val count = deflater.deflate(buffer)
                zipped.write(buffer, 0, count)
            }
            header + Base64.encodeToString(zipped.innerBuffer(), 0, zipped.size(), Base64.NO_WRAP)
        } else {
            header + Base64.encodeToString(outputBuffer, 0, length, Base64.NO_WRAP)
        }

        promise.resolve(data)
    }

    private fun captureView(view: View, config: CaptureConfig, os: OutputStream): Point {
        try {
            return captureViewImpl(view, config, os)
        } finally {
            os.close()
        }
    }

    private fun captureViewImpl(view: View, config: CaptureConfig, os: OutputStream): Point {
        var width = view.width
        var height = view.height

        if (width <= 0 || height <= 0) {
            throw RuntimeException("Impossible to snapshot the view: view is invalid")
        }

        if (config.snapshotContentContainer && view is ScrollView) {
            height = 0
            for (i in 0 until view.childCount) {
                height += view.getChildAt(i).height
            }
        }

        val resolution = Point(width, height)
        var bitmap = getBitmapForScreenshot(width, height)

        val paint = Paint().apply {
            isAntiAlias = true
            isFilterBitmap = true
            isDither = true
        }

        val canvas = Canvas(bitmap)
        view.draw(canvas)

        val childrenList = getAllChildren(view)
        for (child in childrenList) {
            if (child is TextureView) {
                if (child.visibility != View.VISIBLE) continue
                child.isOpaque = false

                val childBitmapBuffer = getExactBitmapForScreenshot(child.width, child.height)
                val childBitmap = child.getBitmap(childBitmapBuffer)
                if (childBitmap != null) {
                    val countCanvasSave = canvas.save()
                    applyTransformations(canvas, view, child)
                    canvas.drawBitmap(childBitmap, 0f, 0f, paint)
                    canvas.restoreToCount(countCanvasSave)
                    recycleBitmap(childBitmap)
                } else {
                    recycleBitmap(childBitmapBuffer)
                }
            } else if (child is SurfaceView && config.handleGLSurfaceView) {
                val latch = CountDownLatch(1)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    val childBitmapBuffer = getExactBitmapForScreenshot(child.width, child.height)
                    try {
                        PixelCopy.request(
                            child,
                            childBitmapBuffer,
                            { _ ->
                                val countCanvasSave = canvas.save()
                                applyTransformations(canvas, view, child)
                                canvas.drawBitmap(childBitmapBuffer, 0f, 0f, paint)
                                canvas.restoreToCount(countCanvasSave)
                                recycleBitmap(childBitmapBuffer)
                                latch.countDown()
                            },
                            Handler(Looper.getMainLooper())
                        )
                        latch.await(SURFACE_VIEW_READ_PIXELS_TIMEOUT, TimeUnit.SECONDS)
                    } catch (ex: Exception) {
                        Log.e(TAG, "Cannot PixelCopy for $child", ex)
                        recycleBitmap(childBitmapBuffer)
                    }
                } else {
                    val cache = child.drawingCache
                    if (cache != null) {
                        canvas.drawBitmap(cache, 0f, 0f, paint)
                    }
                }
            }
        }

        if (config.width != null && config.height != null &&
            (config.width != width || config.height != height)
        ) {
            val scaledBitmap = Bitmap.createScaledBitmap(bitmap, config.width, config.height, true)
            recycleBitmap(bitmap)
            bitmap = scaledBitmap
        }

        if (config.format == Format.RAW && os is ReusableByteArrayOutputStream) {
            val total = width * height * ARGB_SIZE
            val buffer = os.asBuffer(total)
            bitmap.copyPixelsToBuffer(buffer)
            os.setSize(total)
        } else {
            val compressFormat = when (config.format) {
                Format.JPEG -> Bitmap.CompressFormat.JPEG
                Format.PNG -> Bitmap.CompressFormat.PNG
                Format.WEBP -> Bitmap.CompressFormat.WEBP
                Format.RAW -> Bitmap.CompressFormat.PNG
            }
            val quality = (100.0 * config.quality.coerceIn(0.0, 1.0)).toInt()
            bitmap.compress(compressFormat, quality, os)
        }

        recycleBitmap(bitmap)
        return resolution
    }

    private fun getAllChildren(v: View): List<View> {
        if (v !is ViewGroup) {
            return arrayListOf(v)
        }

        val result = ArrayList<View>()
        for (i in 0 until v.childCount) {
            val child = v.getChildAt(i)
            result.addAll(getAllChildren(child))
        }
        return result
    }

    private fun applyTransformations(canvas: Canvas, root: View, child: View): Matrix {
        val transform = Matrix()
        val nodes = LinkedList<View>()

        var iterator: View? = child
        while (iterator != null && iterator != root) {
            nodes.add(iterator)
            iterator = iterator.parent as? View
        }
        nodes.reverse()

        for (v in nodes) {
            canvas.save()
            val dx =
                v.left.toFloat() +
                    (if (v != child) v.paddingLeft else 0).toFloat() +
                    v.translationX
            val dy =
                v.top.toFloat() +
                    (if (v != child) v.paddingTop else 0).toFloat() +
                    v.translationY
            canvas.translate(dx, dy)
            canvas.rotate(v.rotation, v.pivotX, v.pivotY)
            canvas.scale(v.scaleX, v.scaleY)

            transform.postTranslate(dx, dy)
            transform.postRotate(v.rotation, v.pivotX, v.pivotY)
            transform.postScale(v.scaleX, v.scaleY)
        }

        return transform
    }

    private fun proposeSize(view: View): Int {
        val size = view.width * view.height * ARGB_SIZE
        return min(size, 32)
    }

    private val guardBitmaps = Any()
    private val weakBitmaps = Collections.newSetFromMap(WeakHashMap<Bitmap, Boolean>())

    private fun recycleBitmap(bitmap: Bitmap) {
        synchronized(guardBitmaps) {
            weakBitmaps.add(bitmap)
        }
    }

    private fun getBitmapForScreenshot(width: Int, height: Int): Bitmap {
        synchronized(guardBitmaps) {
            for (bmp in weakBitmaps) {
                if (bmp.width == width && bmp.height == height) {
                    weakBitmaps.remove(bmp)
                    bmp.eraseColor(Color.TRANSPARENT)
                    return bmp
                }
            }
        }

        return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    }

    private fun getExactBitmapForScreenshot(width: Int, height: Int): Bitmap {
        synchronized(guardBitmaps) {
            for (bmp in weakBitmaps) {
                if (bmp.width == width && bmp.height == height) {
                    weakBitmaps.remove(bmp)
                    bmp.eraseColor(Color.TRANSPARENT)
                    return bmp
                }
            }
        }

        return Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    }

    internal class ReusableByteArrayOutputStream(buffer: ByteArray) : ByteArrayOutputStream(0) {
        init {
            this.buf = buffer
        }

        fun innerBuffer(): ByteArray = buf

        fun asBuffer(size: Int): ByteBuffer {
            if (buf.size < size) {
                grow(size)
            }
            return ByteBuffer.wrap(buf)
        }

        fun setSize(size: Int) {
            count = size
        }

        private fun grow(minCapacity: Int) {
            val oldCapacity = buf.size
            var newCapacity = oldCapacity shl 1
            if (newCapacity - minCapacity < 0) {
                newCapacity = minCapacity
            }
            if (newCapacity - MAX_ARRAY_SIZE > 0) {
                newCapacity = hugeCapacity(minCapacity)
            }
            buf = buf.copyOf(newCapacity)
        }

        private fun hugeCapacity(minCapacity: Int): Int {
            if (minCapacity < 0) {
                throw OutOfMemoryError()
            }
            return if (minCapacity > MAX_ARRAY_SIZE) Int.MAX_VALUE else MAX_ARRAY_SIZE
        }

        companion object {
            private const val MAX_ARRAY_SIZE = Int.MAX_VALUE - 8
        }
    }
}
