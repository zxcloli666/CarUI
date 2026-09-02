package com.caruiapp.modules

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class OverlayModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "OverlayModule"

    private fun getActivity(): Activity? = reactApplicationContext.currentActivity

    private var overlayView: View? = null
    private var parkingOverlayView: View? = null
    private var musicOverlayView: View? = null
    private var windowManager: WindowManager? = null

    private var parkingContainer: LinearLayout? = null
    private var parkingLeftBlock: LinearLayout? = null
    private var parkingRightBlock: LinearLayout? = null
    private var parkingFrontRow: LinearLayout? = null
    private var parkingRearRow: LinearLayout? = null
    private var parkingLeftDot: View? = null
    private var parkingRightDot: View? = null
    private var parkingLeftValue: TextView? = null
    private var parkingRightValue: TextView? = null
    private var parkingFrontValue: TextView? = null
    private var parkingRearValue: TextView? = null
    private var parkingLeftSpacer: View? = null
    private var parkingRightSpacer: View? = null
    private var parkingMiddleSpacer: View? = null
    private var parkingMainSection: LinearLayout? = null

    // Saved positions for overlays
    private val prefs by lazy {
        reactApplicationContext.getSharedPreferences("overlay_positions", Context.MODE_PRIVATE)
    }

    private fun saveOverlayPosition(key: String, x: Int, y: Int) {
        prefs.edit().putInt("${key}_x", x).putInt("${key}_y", y).apply()
    }

    private fun getOverlayPosition(key: String, defaultX: Int, defaultY: Int): Pair<Int, Int> {
        val x = prefs.getInt("${key}_x", defaultX)
        val y = prefs.getInt("${key}_y", defaultY)
        return Pair(x, y)
    }

    @ReactMethod
    fun canDrawOverlays(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                promise.resolve(Settings.canDrawOverlays(reactApplicationContext))
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(reactApplicationContext)) {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:${reactApplicationContext.packageName}")
                    )
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    reactApplicationContext.startActivity(intent)
                    promise.resolve(false)
                } else {
                    promise.resolve(true)
                }
            } else {
                promise.resolve(true)
            }
        } catch (e: Exception) {
            promise.reject("OVERLAY_ERROR", e.message)
        }
    }

    @ReactMethod
    fun enterPipMode(promise: Promise) {
        try {
            val activity = getActivity()
            if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val aspectRatio = android.util.Rational(16, 9)
                val params = android.app.PictureInPictureParams.Builder()
                    .setAspectRatio(aspectRatio)
                    .build()
                activity.enterPictureInPictureMode(params)
                promise.resolve(true)
            } else {
                promise.reject("NOT_SUPPORTED", "PiP not supported")
            }
        } catch (e: Exception) {
            promise.reject("PIP_ERROR", e.message)
        }
    }

    @ReactMethod
    fun bringToFront(promise: Promise) {
        try {
            val activity = getActivity()
            if (activity != null) {
                val intent = Intent(activity, activity::class.java)
                intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
                activity.startActivity(intent)
                promise.resolve(true)
            } else {
                promise.reject("NO_ACTIVITY", "No activity")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun setKeepScreenOn(enabled: Boolean, promise: Promise) {
        try {
            val activity = getActivity()
            if (activity != null) {
                activity.runOnUiThread {
                    if (enabled) {
                        activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    } else {
                        activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
                    }
                }
                promise.resolve(true)
            } else {
                promise.reject("NO_ACTIVITY", "No activity")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun setFullscreen(enabled: Boolean, promise: Promise) {
        try {
            val activity = getActivity()
            if (activity != null) {
                activity.runOnUiThread {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        if (enabled) {
                            activity.window.insetsController?.hide(
                                android.view.WindowInsets.Type.statusBars() or
                                android.view.WindowInsets.Type.navigationBars()
                            )
                        } else {
                            activity.window.insetsController?.show(
                                android.view.WindowInsets.Type.statusBars() or
                                android.view.WindowInsets.Type.navigationBars()
                            )
                        }
                    } else {
                        @Suppress("DEPRECATION")
                        if (enabled) {
                            activity.window.decorView.systemUiVisibility = (
                                android.view.View.SYSTEM_UI_FLAG_FULLSCREEN or
                                android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                                android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            )
                        } else {
                            activity.window.decorView.systemUiVisibility = 0
                        }
                    }
                }
                promise.resolve(true)
            } else {
                promise.reject("NO_ACTIVITY", "No activity")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun showBackToCarUIButton(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactApplicationContext)) {
                promise.reject("NO_PERMISSION", "Overlay permission required")
                return
            }

            Handler(Looper.getMainLooper()).post {
                if (overlayView != null) {
                    promise.resolve(true)
                    return@post
                }

                windowManager = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager

                // Create button layout
                val layout = LinearLayout(reactApplicationContext).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER
                    setPadding(32, 16, 32, 16)

                    // Rounded background
                    val bg = GradientDrawable().apply {
                        shape = GradientDrawable.RECTANGLE
                        cornerRadius = 50f
                        setColor(Color.parseColor("#E6121212")) // Semi-transparent dark
                        setStroke(2, Color.parseColor("#3B82F6")) // Blue border
                    }
                    background = bg
                }

                // Arrow icon (using unicode)
                val arrow = TextView(reactApplicationContext).apply {
                    text = "←"
                    textSize = 18f
                    setTextColor(Color.parseColor("#3B82F6"))
                    setPadding(0, 0, 16, 0)
                }

                // Text
                val text = TextView(reactApplicationContext).apply {
                    text = "CarUI"
                    textSize = 16f
                    setTextColor(Color.WHITE)
                }

                layout.addView(arrow)
                layout.addView(text)

                // Click listener
                layout.setOnClickListener {
                    hideOverlayButton()
                    bringCarUIToFront()
                }

                // Layout params for overlay
                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    else
                        WindowManager.LayoutParams.TYPE_PHONE,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                    y = 50 // Offset from bottom
                }

                // Make draggable
                var initialX = 0
                var initialY = 0
                var initialTouchX = 0f
                var initialTouchY = 0f

                layout.setOnTouchListener { v, event ->
                    when (event.action) {
                        MotionEvent.ACTION_DOWN -> {
                            initialX = params.x
                            initialY = params.y
                            initialTouchX = event.rawX
                            initialTouchY = event.rawY
                            false
                        }
                        MotionEvent.ACTION_MOVE -> {
                            params.x = initialX + (event.rawX - initialTouchX).toInt()
                            params.y = initialY - (event.rawY - initialTouchY).toInt()
                            windowManager?.updateViewLayout(layout, params)
                            true
                        }
                        else -> false
                    }
                }

                overlayView = layout
                windowManager?.addView(layout, params)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun hideBackToCarUIButton(promise: Promise) {
        try {
            hideOverlayButton()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private fun hideOverlayButton() {
        Handler(Looper.getMainLooper()).post {
            overlayView?.let {
                windowManager?.removeView(it)
                overlayView = null
            }
        }
    }

    private fun bringCarUIToFront() {
        try {
            val pm = reactApplicationContext.packageManager
            val intent = pm.getLaunchIntentForPackage(reactApplicationContext.packageName)
            intent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            android.util.Log.e("OverlayModule", "Failed to bring CarUI to front", e)
        }
    }

    @ReactMethod
    fun closeAllFreeformWindows(promise: Promise) {
        try {
            // Send HOME intent to minimize all windows
            val intent = Intent(Intent.ACTION_MAIN).apply {
                addCategory(Intent.CATEGORY_HOME)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    // ========================================================================
    // Parking Overlay
    // ========================================================================

    private fun getDistanceColor(distanceCm: Int): Int {
        return when {
            distanceCm < 30 -> Color.parseColor("#EF4444")   // Red - danger
            distanceCm < 60 -> Color.parseColor("#F97316")   // Orange - warning
            distanceCm < 100 -> Color.parseColor("#EAB308")  // Yellow - caution
            else -> Color.parseColor("#22C55E")              // Green - safe
        }
    }

    private fun formatDistance(cm: Int): String {
        return when {
            cm >= 999 -> "---"
            cm >= 100 -> String.format("%.1fм", cm / 100f)
            else -> "${cm}см"
        }
    }

    @ReactMethod
    fun showParkingOverlay(
        frontDistance: Int,
        rearDistance: Int,
        leftDistance: Int,
        rightDistance: Int,
        promise: Promise
    ) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactApplicationContext)) {
                promise.reject("NO_PERMISSION", "Overlay permission required")
                return
            }

            Handler(Looper.getMainLooper()).post {
                val density = reactApplicationContext.resources.displayMetrics.density
                ensureParkingOverlay(density)
                updateParkingOverlayViews(frontDistance, rearDistance, leftDistance, rightDistance)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    private data class SideBlockParts(
        val block: LinearLayout,
        val dot: View,
        val value: TextView
    )

    private data class DistanceRowParts(
        val row: LinearLayout,
        val value: TextView
    )

    private fun createDistanceRowParts(arrow: String, density: Float): DistanceRowParts {
        val row = LinearLayout(reactApplicationContext).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }

        val arrowText = TextView(reactApplicationContext).apply {
            text = arrow
            textSize = 18f
            setTextColor(Color.parseColor("#9CA3AF"))
        }
        row.addView(arrowText)

        val value = TextView(reactApplicationContext).apply {
            text = "---"
            textSize = 22f
            setTextColor(Color.parseColor("#9CA3AF"))
            setTypeface(null, android.graphics.Typeface.BOLD)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                leftMargin = (4 * density).toInt()
            }
        }
        row.addView(value)

        return DistanceRowParts(row, value)
    }

    private fun createSideBlockParts(density: Float): SideBlockParts {
        val block = LinearLayout(reactApplicationContext).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
        }

        val dot = View(reactApplicationContext).apply {
            val dotBg = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#9CA3AF"))
            }
            background = dotBg
            layoutParams = LinearLayout.LayoutParams(
                (8 * density).toInt(),
                (8 * density).toInt()
            )
        }
        block.addView(dot)

        val value = TextView(reactApplicationContext).apply {
            text = "---"
            textSize = 16f
            setTextColor(Color.parseColor("#9CA3AF"))
            setTypeface(null, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = (4 * density).toInt()
            }
        }
        block.addView(value)

        return SideBlockParts(block, dot, value)
    }

    private fun createSpacer(width: Int): View {
        return View(reactApplicationContext).apply {
            layoutParams = LinearLayout.LayoutParams(width, 1)
        }
    }

    private fun ensureParkingOverlay(density: Float) {
        if (parkingOverlayView != null && parkingContainer != null) {
            return
        }

        if (windowManager == null) {
            windowManager = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        }

        val container = LinearLayout(reactApplicationContext).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(
                (16 * density).toInt(),
                (10 * density).toInt(),
                (16 * density).toInt(),
                (10 * density).toInt()
            )

            val bg = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = 12f * density
                setColor(Color.parseColor("#CC121212"))
            }
            background = bg
        }

        val leftParts = createSideBlockParts(density)
        parkingLeftBlock = leftParts.block
        parkingLeftDot = leftParts.dot
        parkingLeftValue = leftParts.value
        container.addView(leftParts.block)

        val leftSpacer = createSpacer((16 * density).toInt())
        parkingLeftSpacer = leftSpacer
        container.addView(leftSpacer)

        val mainSection = LinearLayout(reactApplicationContext).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        parkingMainSection = mainSection

        val frontParts = createDistanceRowParts("↑", density)
        parkingFrontRow = frontParts.row
        parkingFrontValue = frontParts.value
        mainSection.addView(frontParts.row)

        val middleSpacer = createSpacer((16 * density).toInt())
        parkingMiddleSpacer = middleSpacer
        mainSection.addView(middleSpacer)

        val rearParts = createDistanceRowParts("↓", density)
        parkingRearRow = rearParts.row
        parkingRearValue = rearParts.value
        mainSection.addView(rearParts.row)

        container.addView(mainSection)

        val rightSpacer = createSpacer((16 * density).toInt())
        parkingRightSpacer = rightSpacer
        container.addView(rightSpacer)

        val rightParts = createSideBlockParts(density)
        parkingRightBlock = rightParts.block
        parkingRightDot = rightParts.dot
        parkingRightValue = rightParts.value
        container.addView(rightParts.block)

        val defaultY = (80 * density).toInt()
        val (savedX, savedY) = getOverlayPosition("parking", 0, defaultY)

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            x = savedX
            y = savedY
        }

        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f

        container.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    params.x = initialX + (event.rawX - initialTouchX).toInt()
                    params.y = initialY - (event.rawY - initialTouchY).toInt()
                    windowManager?.updateViewLayout(container, params)
                    true
                }
                MotionEvent.ACTION_UP -> {
                    saveOverlayPosition("parking", params.x, params.y)
                    false
                }
                else -> false
            }
        }

        parkingContainer = container
        parkingOverlayView = container
        windowManager?.addView(container, params)
    }

    private fun updateParkingOverlayViews(
        frontDistance: Int,
        rearDistance: Int,
        leftDistance: Int,
        rightDistance: Int
    ) {
        val hasLeft = leftDistance < 999
        val hasRight = rightDistance < 999
        val hasFront = frontDistance < 999
        val hasRear = rearDistance < 999
        val hasMain = hasFront || hasRear

        parkingLeftBlock?.visibility = if (hasLeft) View.VISIBLE else View.GONE
        parkingRightBlock?.visibility = if (hasRight) View.VISIBLE else View.GONE
        parkingFrontRow?.visibility = if (hasFront) View.VISIBLE else View.GONE
        parkingRearRow?.visibility = if (hasRear) View.VISIBLE else View.GONE
        parkingMainSection?.visibility = if (hasMain) View.VISIBLE else View.GONE

        parkingMiddleSpacer?.visibility = if (hasFront && hasRear) View.VISIBLE else View.GONE
        parkingLeftSpacer?.visibility = if (hasLeft && hasMain) View.VISIBLE else View.GONE
        parkingRightSpacer?.visibility = if (hasRight && hasMain) View.VISIBLE else View.GONE

        if (hasLeft) {
            val color = getDistanceColor(leftDistance)
            parkingLeftValue?.text = formatDistance(leftDistance)
            parkingLeftValue?.setTextColor(color)
            updateDotColor(parkingLeftDot, color)
        }

        if (hasRight) {
            val color = getDistanceColor(rightDistance)
            parkingRightValue?.text = formatDistance(rightDistance)
            parkingRightValue?.setTextColor(color)
            updateDotColor(parkingRightDot, color)
        }

        if (hasFront) {
            val color = getDistanceColor(frontDistance)
            parkingFrontValue?.text = formatDistance(frontDistance)
            parkingFrontValue?.setTextColor(color)
        }

        if (hasRear) {
            val color = getDistanceColor(rearDistance)
            parkingRearValue?.text = formatDistance(rearDistance)
            parkingRearValue?.setTextColor(color)
        }
    }

    private fun updateDotColor(dot: View?, color: Int) {
        val bg = dot?.background
        if (bg is GradientDrawable) {
            bg.setColor(color)
        } else {
            dot?.setBackgroundColor(color)
        }
    }

    @ReactMethod
    fun updateParkingOverlay(
        frontDistance: Int,
        rearDistance: Int,
        leftDistance: Int,
        rightDistance: Int,
        promise: Promise
    ) {
        showParkingOverlay(frontDistance, rearDistance, leftDistance, rightDistance, promise)
    }

    @ReactMethod
    fun hideParkingOverlay(promise: Promise) {
        try {
            Handler(Looper.getMainLooper()).post {
                parkingOverlayView?.let {
                    windowManager?.removeView(it)
                    parkingOverlayView = null
                }
                parkingContainer = null
                parkingLeftBlock = null
                parkingRightBlock = null
                parkingFrontRow = null
                parkingRearRow = null
                parkingLeftDot = null
                parkingRightDot = null
                parkingLeftValue = null
                parkingRightValue = null
                parkingFrontValue = null
                parkingRearValue = null
                parkingLeftSpacer = null
                parkingRightSpacer = null
                parkingMiddleSpacer = null
                parkingMainSection = null
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    // ========================================================================
    // Music Overlay - compact player for navigation
    // ========================================================================

    @ReactMethod
    fun showMusicOverlay(
        title: String,
        artist: String,
        isPlaying: Boolean,
        promise: Promise
    ) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactApplicationContext)) {
                promise.reject("NO_PERMISSION", "Overlay permission required")
                return
            }

            Handler(Looper.getMainLooper()).post {
                // Remove existing
                musicOverlayView?.let {
                    windowManager?.removeView(it)
                }

                if (windowManager == null) {
                    windowManager = reactApplicationContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
                }

                val density = reactApplicationContext.resources.displayMetrics.density

                // Main container - horizontal layout
                val container = LinearLayout(reactApplicationContext).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = Gravity.CENTER_VERTICAL
                    setPadding((12 * density).toInt(), (8 * density).toInt(), (12 * density).toInt(), (8 * density).toInt())

                    val bg = GradientDrawable().apply {
                        shape = GradientDrawable.RECTANGLE
                        cornerRadius = 16f * density
                        setColor(Color.parseColor("#E6121212"))
                        setStroke((1 * density).toInt(), Color.parseColor("#2A2A2A"))
                    }
                    background = bg
                }

                // Music icon (placeholder for album art)
                val musicIcon = TextView(reactApplicationContext).apply {
                    text = "♪"
                    textSize = 20f
                    setTextColor(Color.parseColor("#6366F1"))
                    gravity = Gravity.CENTER
                    layoutParams = LinearLayout.LayoutParams(
                        (36 * density).toInt(),
                        (36 * density).toInt()
                    ).apply {
                        rightMargin = (10 * density).toInt()
                    }

                    val iconBg = GradientDrawable().apply {
                        shape = GradientDrawable.RECTANGLE
                        cornerRadius = 8f * density
                        setColor(Color.parseColor("#1A1A24"))
                    }
                    background = iconBg
                }
                container.addView(musicIcon)

                // Track info container
                val infoContainer = LinearLayout(reactApplicationContext).apply {
                    orientation = LinearLayout.VERTICAL
                    layoutParams = LinearLayout.LayoutParams(
                        0,
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        1f
                    )
                }

                val titleText = TextView(reactApplicationContext).apply {
                    text = if (title.length > 20) title.take(20) + "..." else title
                    textSize = 14f
                    setTextColor(Color.WHITE)
                    setTypeface(null, android.graphics.Typeface.BOLD)
                    maxLines = 1
                    tag = "titleText"
                }
                infoContainer.addView(titleText)

                val artistText = TextView(reactApplicationContext).apply {
                    text = if (artist.length > 25) artist.take(25) + "..." else artist
                    textSize = 12f
                    setTextColor(Color.parseColor("#9CA3AF"))
                    maxLines = 1
                    tag = "artistText"
                }
                infoContainer.addView(artistText)

                container.addView(infoContainer)

                // Play/pause button
                val playButton = TextView(reactApplicationContext).apply {
                    text = if (isPlaying) "⏸" else "▶"
                    textSize = 18f
                    setTextColor(Color.WHITE)
                    gravity = Gravity.CENTER
                    tag = "playButton"
                    layoutParams = LinearLayout.LayoutParams(
                        (40 * density).toInt(),
                        (40 * density).toInt()
                    ).apply {
                        leftMargin = (8 * density).toInt()
                    }

                    val btnBg = GradientDrawable().apply {
                        shape = GradientDrawable.OVAL
                        setColor(Color.parseColor("#6366F1"))
                    }
                    background = btnBg
                }
                container.addView(playButton)

                // Get saved position or use default
                val defaultY = (140 * density).toInt()
                val (savedX, savedY) = getOverlayPosition("music", 0, defaultY)

                // Window params
                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    else
                        WindowManager.LayoutParams.TYPE_PHONE,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
                    PixelFormat.TRANSLUCENT
                ).apply {
                    gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
                    x = savedX
                    y = savedY
                }

                // Make draggable
                var initialX = 0
                var initialY = 0
                var initialTouchX = 0f
                var initialTouchY = 0f

                container.setOnTouchListener { v, event ->
                    when (event.action) {
                        MotionEvent.ACTION_DOWN -> {
                            initialX = params.x
                            initialY = params.y
                            initialTouchX = event.rawX
                            initialTouchY = event.rawY
                            true
                        }
                        MotionEvent.ACTION_MOVE -> {
                            params.x = initialX + (event.rawX - initialTouchX).toInt()
                            params.y = initialY - (event.rawY - initialTouchY).toInt()
                            windowManager?.updateViewLayout(container, params)
                            true
                        }
                        MotionEvent.ACTION_UP -> {
                            saveOverlayPosition("music", params.x, params.y)
                            false
                        }
                        else -> false
                    }
                }

                musicOverlayView = container
                windowManager?.addView(container, params)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateMusicOverlay(
        title: String,
        artist: String,
        isPlaying: Boolean,
        promise: Promise
    ) {
        Handler(Looper.getMainLooper()).post {
            musicOverlayView?.let { view ->
                if (view is LinearLayout) {
                    // Find and update title
                    for (i in 0 until view.childCount) {
                        val child = view.getChildAt(i)
                        if (child is LinearLayout) {
                            for (j in 0 until child.childCount) {
                                val subChild = child.getChildAt(j)
                                if (subChild is TextView) {
                                    when (subChild.tag) {
                                        "titleText" -> subChild.text = if (title.length > 20) title.take(20) + "..." else title
                                        "artistText" -> subChild.text = if (artist.length > 25) artist.take(25) + "..." else artist
                                    }
                                }
                            }
                        }
                        if (child is TextView && child.tag == "playButton") {
                            child.text = if (isPlaying) "⏸" else "▶"
                        }
                    }
                }
            }
        }
        promise.resolve(true)
    }

    @ReactMethod
    fun hideMusicOverlay(promise: Promise) {
        try {
            Handler(Looper.getMainLooper()).post {
                musicOverlayView?.let {
                    windowManager?.removeView(it)
                    musicOverlayView = null
                }
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
