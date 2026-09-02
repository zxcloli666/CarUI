package com.caruiapp.modules

import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.UIManager
import com.facebook.react.common.annotations.UnstableReactNativeAPI
import com.facebook.react.fabric.FabricUIManager
import com.facebook.react.fabric.interop.UIBlock as FabricUIBlock
import com.facebook.react.uimanager.UIBlock as PaperUIBlock
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.UIManagerModule
import com.facebook.react.uimanager.common.UIManagerType
import java.io.File
import java.io.IOException
import java.util.Locale
import java.util.concurrent.Executor
import java.util.concurrent.Executors

@OptIn(UnstableReactNativeAPI::class)
class ScreenCaptureModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val executor: Executor = Executors.newCachedThreadPool()

    override fun getName(): String = "ScreenCaptureModule"

    @ReactMethod
    fun releaseCapture(uri: String) {
        val path = Uri.parse(uri).path ?: return
        val file = File(path)
        if (!file.exists()) return
        val parent = file.parentFile
        val context = reactApplicationContext
        if (parent == context.externalCacheDir || parent == context.cacheDir) {
            file.delete()
        }
    }

    @ReactMethod
    fun captureRef(tag: Int, options: ReadableMap, promise: Promise) {
        try {
            val extension = (options.getString("format") ?: "png").lowercase(Locale.US)
            val imageFormat = when (extension) {
                "jpg", "jpeg" -> ViewSnapshot.Format.JPEG
                "webm", "webp" -> ViewSnapshot.Format.WEBP
                "raw" -> ViewSnapshot.Format.RAW
                else -> ViewSnapshot.Format.PNG
            }
            val quality = if (options.hasKey("quality")) {
                options.getDouble("quality").coerceIn(0.0, 1.0)
            } else {
                1.0
            }
            val scaleWidth = if (options.hasKey("width")) options.getInt("width") else null
            val scaleHeight = if (options.hasKey("height")) options.getInt("height") else null
            val resultStreamFormat = options.getString("result") ?: ViewSnapshot.Results.TEMP_FILE
            val fileName = if (options.hasKey("fileName")) options.getString("fileName") else null
            val snapshotContentContainer = options.hasKey("snapshotContentContainer") &&
                options.getBoolean("snapshotContentContainer")
            val handleGLSurfaceView = options.hasKey("handleGLSurfaceViewOnAndroid") &&
                options.getBoolean("handleGLSurfaceViewOnAndroid")

            val outputFile = if (ViewSnapshot.Results.TEMP_FILE == resultStreamFormat) {
                createTempFile(reactApplicationContext, extension, fileName)
            } else {
                null
            }

            val config = ViewSnapshot.CaptureConfig(
                tag = tag,
                extension = extension,
                format = imageFormat,
                quality = quality,
                width = scaleWidth,
                height = scaleHeight,
                output = outputFile,
                result = resultStreamFormat,
                snapshotContentContainer = snapshotContentContainer,
                handleGLSurfaceView = handleGLSurfaceView,
            )

            if (tag == -1) {
                val rootView = reactApplicationContext.currentActivity
                    ?.window
                    ?.decorView
                    ?.findViewById<android.view.View>(android.R.id.content)
                ViewSnapshot.capture(rootView, config, promise, executor)
                return
            }

            val uiManager = resolveUIManager(tag)
            if (uiManager == null) {
                promise.reject(ERROR_NO_UI_MANAGER, "UIManager is null")
                return
            }

            when (uiManager) {
                is UIManagerModule -> uiManager.addUIBlock(PaperUIBlock { nativeViewHierarchyManager ->
                    val view = nativeViewHierarchyManager.resolveView(tag)
                    ViewSnapshot.capture(view, config, promise, executor)
                })
                is FabricUIManager -> uiManager.addUIBlock(FabricUIBlock { resolver ->
                    val view = resolver.resolveView(tag)
                    ViewSnapshot.capture(view, config, promise, executor)
                })
                else -> promise.reject(
                    ERROR_UNSUPPORTED_UI_MANAGER,
                    "Unsupported UIManager: ${uiManager.javaClass.name}"
                )
            }
        } catch (ex: Throwable) {
            Log.e(TAG, "Failed to snapshot view tag $tag", ex)
            promise.reject(ViewSnapshot.ERROR_UNABLE_TO_SNAPSHOT, "Failed to snapshot view tag $tag")
        }
    }

    @ReactMethod
    fun captureScreen(options: ReadableMap, promise: Promise) {
        captureRef(-1, options, promise)
    }

    private fun resolveUIManager(tag: Int): UIManager? {
        return if (tag == -1) {
            UIManagerHelper.getUIManager(reactApplicationContext, UIManagerType.FABRIC)
                ?: UIManagerHelper.getUIManager(reactApplicationContext, UIManagerType.DEFAULT)
        } else {
            UIManagerHelper.getUIManagerForReactTag(reactApplicationContext, tag)
        }
    }

    @Throws(IOException::class)
    private fun createTempFile(
        context: ReactApplicationContext,
        ext: String,
        fileName: String?
    ): File {
        val externalCacheDir = context.externalCacheDir
        val internalCacheDir = context.cacheDir
        val cacheDir = when {
            externalCacheDir == null && internalCacheDir == null ->
                throw IOException("No cache directory available")
            externalCacheDir == null -> internalCacheDir
            internalCacheDir == null -> externalCacheDir
            else -> if (externalCacheDir.freeSpace > internalCacheDir.freeSpace) {
                externalCacheDir
            } else {
                internalCacheDir
            }
        }

        val suffix = ".$ext"
        return if (fileName != null) {
            File.createTempFile(fileName, suffix, cacheDir)
        } else {
            File.createTempFile(TEMP_FILE_PREFIX, suffix, cacheDir)
        }
    }

    companion object {
        private const val TAG = "ScreenCaptureModule"
        private const val TEMP_FILE_PREFIX = "CarUI-snapshot"
        private const val ERROR_NO_UI_MANAGER = "E_NO_UI_MANAGER"
        private const val ERROR_UNSUPPORTED_UI_MANAGER = "E_UNSUPPORTED_UI_MANAGER"
    }
}
