package com.caruiapp.modules

import android.app.Activity
import android.app.ActivityOptions
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.os.Build
import android.util.Base64
import android.view.WindowManager
import com.facebook.react.bridge.*
import org.lsposed.hiddenapibypass.HiddenApiBypass
import java.io.ByteArrayOutputStream

class AppLauncherModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AppLauncherModule"

    private fun getActivity(): Activity? = reactApplicationContext.currentActivity

    private fun drawableToBitmap(drawable: Drawable): Bitmap {
        if (drawable is BitmapDrawable) {
            return drawable.bitmap
        }

        val width = if (drawable.intrinsicWidth > 0) drawable.intrinsicWidth else 96
        val height = if (drawable.intrinsicHeight > 0) drawable.intrinsicHeight else 96

        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)
        return bitmap
    }

    private fun getIconBase64(drawable: Drawable): String {
        val bitmap = drawableToBitmap(drawable)
        val scaledBitmap = Bitmap.createScaledBitmap(bitmap, 72, 72, true)
        val stream = ByteArrayOutputStream()
        scaledBitmap.compress(Bitmap.CompressFormat.PNG, 90, stream)
        val byteArray = stream.toByteArray()
        return Base64.encodeToString(byteArray, Base64.NO_WRAP)
    }

    private fun getAppCategory(packageName: String, androidCategory: Int): String {
        // 1. Ручной маппинг для навигации и медиа (Автомобильный стандарт)
        if (packageName.contains("navi") || packageName.contains("maps") || packageName.contains("2gis")) return "Navigation"
        if (packageName.contains("music") || packageName.contains("spotify") || packageName.contains("player") || packageName.contains(
                "sound"
            )
        ) return "Media"
        if (packageName.contains("messenger") || packageName.contains("telegram") || packageName.contains("whatsapp")) return "Communication"
        if (packageName.contains("browser") || packageName.contains("chrome")) return "Browsers"
        if (packageName.contains("settings") || packageName.contains("car")) return "System"

        // 2. Стандартные категории Android (API 26+)
        when (androidCategory) {
            ApplicationInfo.CATEGORY_MAPS -> return "Navigation"
            ApplicationInfo.CATEGORY_AUDIO -> return "Media"
            ApplicationInfo.CATEGORY_VIDEO -> return "Media"
            ApplicationInfo.CATEGORY_SOCIAL -> return "Communication"
            ApplicationInfo.CATEGORY_GAME -> return "Games"
            ApplicationInfo.CATEGORY_IMAGE -> return "Tools"
        }

        return "Other"
    }

    @ReactMethod
    fun getInstalledApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }

            val apps = pm.queryIntentActivities(mainIntent, 0)
            val result = WritableNativeArray()

            val seenPackages = mutableSetOf<String>()

            for (app in apps) {
                try {
                    val packageName = app.activityInfo.packageName

                    if (seenPackages.contains(packageName)) continue

                    val icon = app.loadIcon(pm)
                    val iconBase64 = getIconBase64(icon)
                    val sysCat = pm.getApplicationInfo(packageName, 0).category

                    val appInfo = WritableNativeMap().apply {
                        putString("packageName", packageName)
                        putString("appName", app.loadLabel(pm).toString())
                        putString("activityName", app.activityInfo.name)
                        putString("category", getAppCategory(packageName, sysCat))
                        putString("icon", "data:image/png;base64,$iconBase64")
                    }

                    result.pushMap(appInfo)
                    seenPackages.add(packageName)
                } catch (e: Exception) {
                    // Skip apps that fail to load
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("APP_LIST_ERROR", e.message)
        }
    }

    @ReactMethod
    fun launchApp(packageName: String, promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val launchIntent = pm.getLaunchIntentForPackage(packageName)

            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(launchIntent)
                promise.resolve(true)
            } else {
                promise.reject("APP_NOT_FOUND", "App not found: $packageName")
            }
        } catch (e: Exception) {
            promise.reject("LAUNCH_ERROR", e.message)
        }
    }

    @ReactMethod
    fun launchAppInSplitScreen(packageName: String, promise: Promise) {
        try {
            val activity = getActivity()
            if (activity == null) {
                // Fallback to normal launch if no activity
                launchApp(packageName, promise)
                return
            }

            val pm = reactApplicationContext.packageManager
            val launchIntent = pm.getLaunchIntentForPackage(packageName)

            if (launchIntent == null) {
                promise.reject("APP_NOT_FOUND", "App not found: $packageName")
                return
            }

            // Configure for split-screen/multi-window
            launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT or
                Intent.FLAG_ACTIVITY_MULTIPLE_TASK
            )

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                // Use activity options for better multi-window control
                val options = ActivityOptions.makeBasic()

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // Set launch bounds for the new activity (right half of screen)
                    val wm = activity.getSystemService(android.content.Context.WINDOW_SERVICE) as WindowManager
                    val display = wm.defaultDisplay
                    val metrics = android.util.DisplayMetrics()
                    display.getRealMetrics(metrics)

                    val launchBounds = Rect(
                        metrics.widthPixels / 2, // Start from middle
                        0,
                        metrics.widthPixels,
                        metrics.heightPixels
                    )
                    options.launchBounds = launchBounds
                }

                activity.startActivity(launchIntent, options.toBundle())
            } else {
                activity.startActivity(launchIntent)
            }

            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("LAUNCH_ERROR", e.message)
        }
    }

    companion object {
        private const val WINDOWING_MODE_FREEFORM = 5
        private const val FREEFORM_WORKSPACE_STACK_ID = 2
        private var reflectionAllowed = false
    }

    private fun allowReflection() {
        if (reflectionAllowed) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                HiddenApiBypass.addHiddenApiExemptions("")
                reflectionAllowed = true
                android.util.Log.d("AppLauncher", "HiddenApiBypass enabled")
            } catch (e: Exception) {
                android.util.Log.e("AppLauncher", "HiddenApiBypass failed", e)
            }
        }
    }

    private fun getActivityOptions(x: Int, y: Int, width: Int, height: Int): ActivityOptions {
        allowReflection()

        val options = ActivityOptions.makeBasic()

        // Set freeform windowing mode
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            // Android 9+: setLaunchWindowingMode(5)
            try {
                val method = ActivityOptions::class.java.getMethod(
                    "setLaunchWindowingMode",
                    Int::class.javaPrimitiveType
                )
                method.invoke(options, WINDOWING_MODE_FREEFORM)
                android.util.Log.d("AppLauncher", "setLaunchWindowingMode(5) success")
            } catch (e: Exception) {
                android.util.Log.e("AppLauncher", "setLaunchWindowingMode failed", e)
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            // Android 7-8: setLaunchStackId(2)
            try {
                val method = ActivityOptions::class.java.getMethod(
                    "setLaunchStackId",
                    Int::class.javaPrimitiveType
                )
                method.invoke(options, FREEFORM_WORKSPACE_STACK_ID)
            } catch (e: Exception) {
                android.util.Log.e("AppLauncher", "setLaunchStackId failed", e)
            }
        }

        // Set launch bounds
        val launchBounds = Rect(x, y, x + width, y + height)
        options.launchBounds = launchBounds

        return options
    }

    @ReactMethod
    fun launchAppInFreeform(packageName: String, x: Int, y: Int, width: Int, height: Int, promise: Promise) {
        try {
            val activity = getActivity()
            val pm = reactApplicationContext.packageManager
            val launchIntent = pm.getLaunchIntentForPackage(packageName)

            if (launchIntent == null) {
                promise.reject("APP_NOT_FOUND", "App not found: $packageName")
                return
            }

            // Flags like Taskbar uses
            launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_MULTIPLE_TASK
            )
            val options = getActivityOptions(x, y, width, height)

            if (activity != null) {
                activity.startActivity(launchIntent, options.toBundle())
            } else {
                reactApplicationContext.startActivity(launchIntent, options.toBundle())
            }
            android.util.Log.d("AppLauncher", "Launched $packageName in freeform at ($x,$y) ${width}x${height}")
            promise.resolve(true)
        } catch (e: Exception) {
            android.util.Log.e("AppLauncher", "launchAppInFreeform failed", e)
            promise.reject("LAUNCH_ERROR", e.message)
        }
    }

    @ReactMethod
    fun openSettings(promise: Promise) {
        try {
            val intent = Intent(android.provider.Settings.ACTION_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isMultiWindowSupported(promise: Promise) {
        try {
            val activity = getActivity()
            if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                promise.resolve(activity.isInMultiWindowMode || true)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun enterPipMode(promise: Promise) {
        try {
            val activity = getActivity()
            if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val params = android.app.PictureInPictureParams.Builder()
                    .setAspectRatio(android.util.Rational(16, 9))
                    .build()
                activity.enterPictureInPictureMode(params)
                promise.resolve(true)
            } else {
                promise.reject("NOT_SUPPORTED", "PiP mode not supported")
            }
        } catch (e: Exception) {
            promise.reject("PIP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getScreenDimensions(promise: Promise) {
        try {
            val activity = getActivity()
            if (activity != null) {
                val wm = activity.getSystemService(android.content.Context.WINDOW_SERVICE) as WindowManager
                val density = activity.resources.displayMetrics.density
                val resources = activity.resources

                // Status bar height
                val statusBarId = resources.getIdentifier("status_bar_height", "dimen", "android")
                val statusBarHeight = if (statusBarId > 0) resources.getDimensionPixelSize(statusBarId) else 0

                // Navigation bar height
                val navBarId = resources.getIdentifier("navigation_bar_height", "dimen", "android")
                val navBarHeight = if (navBarId > 0) resources.getDimensionPixelSize(navBarId) else 0

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    val bounds = wm.currentWindowMetrics.bounds
                    val result = WritableNativeMap().apply {
                        putInt("width", bounds.width())
                        putInt("height", bounds.height())
                        putDouble("density", density.toDouble())
                        putInt("statusBarHeight", statusBarHeight)
                        putInt("navBarHeight", navBarHeight)
                    }
                    promise.resolve(result)
                } else {
                    val metrics = android.util.DisplayMetrics()
                    @Suppress("DEPRECATION")
                    wm.defaultDisplay.getRealMetrics(metrics)
                    val result = WritableNativeMap().apply {
                        putInt("width", metrics.widthPixels)
                        putInt("height", metrics.heightPixels)
                        putDouble("density", density.toDouble())
                        putInt("statusBarHeight", statusBarHeight)
                        putInt("navBarHeight", navBarHeight)
                    }
                    promise.resolve(result)
                }
            } else {
                promise.reject("NO_ACTIVITY", "No activity available")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
