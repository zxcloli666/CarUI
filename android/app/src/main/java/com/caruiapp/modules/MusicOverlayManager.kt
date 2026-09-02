package com.caruiapp.modules

import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable
import android.media.MediaMetadata
import android.media.session.MediaController
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.provider.Settings
import android.util.DisplayMetrics
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import com.caruiapp.ReactActivityState
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

object MusicOverlayManager {
    private const val PREFS_NAME = "overlay_positions"
    private const val KEY_MUSIC_X = "music_x"
    private const val KEY_MUSIC_Y = "music_y"
    private const val KEY_MUSIC_SCALE = "music_scale"
    private const val KEY_MUSIC_COLLAPSED = "music_collapsed"

    private const val BASE_WIDTH_DP = 420
    private const val BASE_HEIGHT_DP = 560
    private const val COLLAPSED_WIDTH_DP = 320
    private const val COLLAPSED_HEIGHT_DP = 70
    private const val DEFAULT_SCALE = 0.78f
    private const val MIN_SCALE = 0.3f
    private const val MAX_SCALE = 1.25f

    private val STANDARD_ACTIONS = setOf(
        "play",
        "pause",
        "stop",
        "skip_next",
        "skip_to_next",
        "next",
        "skip_previous",
        "skip_to_previous",
        "previous",
        "fast_forward",
        "rewind",
        "seek_to"
    )

    private val handler = Handler(Looper.getMainLooper())
    private var appContext: Context? = null
    private var windowManager: WindowManager? = null
    private var overlayView: MusicOverlayView? = null
    private var overlayParams: WindowManager.LayoutParams? = null
    private var mediaSessionManager: MediaSessionManager? = null
    private var activeController: MediaController? = null
    private var sessionListener: MediaSessionManager.OnActiveSessionsChangedListener? = null
    private var progressRunnable: Runnable? = null
    private var initialized = false
    private var isAppInForeground = true
    private var isCollapsed = false
    private var baseWidth = 0
    private var baseHeight = 0
    private var scaleFactor = 1f
    private var expandedScale = 1f
    private var currentTitle = ""
    private var currentArtist = ""
    private var currentArtwork: Bitmap? = null
    private var currentDuration = 0L
    private var currentPlaybackState: PlaybackState? = null
    private var currentActions: List<CustomActionInfo> = emptyList()

    private val controllerCallback = object : MediaController.Callback() {
        override fun onPlaybackStateChanged(state: PlaybackState?) {
            currentPlaybackState = state
            updateFromController(activeController)
        }

        override fun onMetadataChanged(metadata: MediaMetadata?) {
            updateFromController(activeController)
        }

        override fun onSessionDestroyed() {
            updateActiveController(selectController(getActiveControllers()))
        }
    }

    fun init(context: Context) {
        if (initialized) return
        appContext = context.applicationContext
        windowManager = appContext?.getSystemService(Context.WINDOW_SERVICE) as? WindowManager
        mediaSessionManager = appContext?.getSystemService(Context.MEDIA_SESSION_SERVICE) as? MediaSessionManager
        isAppInForeground = ReactActivityState.isInForeground
        registerSessionListener()
        updateActiveController(selectController(getActiveControllers()))
        initialized = true
    }

    fun onAppStateChanged(isForeground: Boolean) {
        isAppInForeground = isForeground
        updateVisibility()
    }

    private fun registerSessionListener() {
        val context = appContext ?: return
        val manager = mediaSessionManager ?: return
        val cn = ComponentName(context, MediaNotificationListenerService::class.java)
        sessionListener = MediaSessionManager.OnActiveSessionsChangedListener { controllers ->
            updateActiveController(selectController(controllers ?: emptyList()))
        }
        try {
            manager.addOnActiveSessionsChangedListener(sessionListener!!, cn, handler)
        } catch (_: SecurityException) {
            sessionListener = null
        } catch (_: Exception) {
            sessionListener = null
        }
    }

    private fun getActiveControllers(): List<MediaController> {
        val context = appContext ?: return emptyList()
        val cn = ComponentName(context, MediaNotificationListenerService::class.java)
        return try {
            mediaSessionManager?.getActiveSessions(cn) ?: emptyList()
        } catch (_: SecurityException) {
            emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun selectController(controllers: List<MediaController>): MediaController? {
        controllers.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PLAYING }?.let { return it }
        controllers.firstOrNull { it.playbackState?.state == PlaybackState.STATE_PAUSED }?.let { return it }
        controllers.firstOrNull {
            it.playbackState?.state == PlaybackState.STATE_BUFFERING ||
            it.playbackState?.state == PlaybackState.STATE_CONNECTING
        }?.let { return it }
        controllers.firstOrNull { it.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) != null }?.let { return it }
        return controllers.firstOrNull()
    }

    private fun updateActiveController(controller: MediaController?) {
        if (controller?.sessionToken == activeController?.sessionToken) {
            updateFromController(controller)
            return
        }
        activeController?.unregisterCallback(controllerCallback)
        activeController = controller
        if (controller != null) {
            controller.registerCallback(controllerCallback, handler)
        }
        updateFromController(controller)
    }

    private fun updateFromController(controller: MediaController?) {
        val metadata = controller?.metadata
        currentPlaybackState = controller?.playbackState
        currentTitle = metadata?.getString(MediaMetadata.METADATA_KEY_TITLE)
            ?: metadata?.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE)
            ?: ""
        currentArtist = metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST)
            ?: metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST)
            ?: metadata?.getString(MediaMetadata.METADATA_KEY_AUTHOR)
            ?: ""
        currentDuration = metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L
        currentArtwork =
            metadata?.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
                ?: metadata?.getBitmap(MediaMetadata.METADATA_KEY_ART)
                ?: metadata?.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)
                ?: metadata?.description?.iconBitmap
        currentActions = buildCustomActions(controller)
        updateOverlayContent()
        updateVisibility()
    }

    private fun buildCustomActions(controller: MediaController?): List<CustomActionInfo> {
        if (controller == null) return emptyList()
        val playbackState = controller.playbackState ?: return emptyList()
        val packageName = controller.packageName
        val resources = try {
            appContext?.packageManager?.getResourcesForApplication(packageName)
        } catch (_: Exception) {
            null
        }

        val actions = mutableListOf<CustomActionInfo>()
        playbackState.customActions?.forEach { action ->
            val actionId = action.action ?: return@forEach
            if (STANDARD_ACTIONS.any { actionId.lowercase().contains(it) }) {
                return@forEach
            }
            val iconDrawable = loadActionIcon(resources, action.icon)
            if (iconDrawable != null) {
                actions.add(CustomActionInfo(actionId, iconDrawable, false))
            }
        }
        return actions
    }

    private fun loadActionIcon(resources: android.content.res.Resources?, iconResId: Int): Drawable? {
        if (resources == null || iconResId == 0) return null
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                resources.getDrawable(iconResId, null)
            } else {
                @Suppress("DEPRECATION")
                resources.getDrawable(iconResId)
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun updateVisibility() {
        val shouldShow = !isAppInForeground && hasVisibleSession() && canDrawOverlays()
        if (shouldShow) {
            showOverlay()
        } else {
            hideOverlay()
        }
    }

    private fun showOverlay() {
        handler.post {
            ensureOverlay()
            updateOverlayContent()
            val view = overlayView ?: return@post
            val params = overlayParams ?: return@post
            if (view.parent == null) {
                windowManager?.addView(view, params)
            } else {
                windowManager?.updateViewLayout(view, params)
            }
            if (isPlaybackActive(currentPlaybackState)) {
                startProgressUpdates()
            } else {
                stopProgressUpdates()
            }
        }
    }

    private fun hideOverlay() {
        handler.post {
            overlayView?.let { view ->
                if (view.parent != null) {
                    windowManager?.removeView(view)
                }
            }
            stopProgressUpdates()
        }
    }

    private fun ensureOverlay() {
        if (overlayView != null && overlayParams != null) return
        val context = appContext ?: return
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val collapsedWidth = dp(COLLAPSED_WIDTH_DP)
        val collapsedHeight = dp(COLLAPSED_HEIGHT_DP)
        val savedX = prefs.getInt(KEY_MUSIC_X, dp(24))
        val savedY = prefs.getInt(KEY_MUSIC_Y, dp(120))
        baseWidth = dp(BASE_WIDTH_DP)
        baseHeight = dp(BASE_HEIGHT_DP)
        val storedScale = prefs.getFloat(KEY_MUSIC_SCALE, DEFAULT_SCALE)
        val maxScale = getMaxScale(baseWidth, baseHeight)
        scaleFactor = storedScale.coerceIn(MIN_SCALE, maxScale)
        expandedScale = scaleFactor
        isCollapsed = prefs.getBoolean(KEY_MUSIC_COLLAPSED, false)

        val expandedWidth = (baseWidth * scaleFactor).roundToInt()
        val expandedHeight = (baseHeight * scaleFactor).roundToInt()

        val params = WindowManager.LayoutParams(
            if (isCollapsed) collapsedWidth else expandedWidth,
            if (isCollapsed) collapsedHeight else expandedHeight,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            else
                WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = savedX
            y = savedY
        }

        val view = MusicOverlayView(context, baseWidth, baseHeight)
        if (isCollapsed) {
            view.setContainerSize(collapsedWidth, collapsedHeight)
            view.setScaleFactor(1f)
        } else {
            view.setContainerSize(baseWidth, baseHeight)
            view.setScaleFactor(scaleFactor)
        }
        view.setCollapsed(isCollapsed)
        view.onPlayPause = { togglePlayPause() }
        view.onNext = { activeController?.transportControls?.skipToNext() }
        view.onPrev = { activeController?.transportControls?.skipToPrevious() }
        view.onToggleCollapse = { toggleCollapsed() }
        view.onCustomAction = { actionId ->
            activeController?.transportControls?.sendCustomAction(actionId, null)
        }

        attachDragHandlers(view, params)
        attachResizeHandler(view, params)

        overlayView = view
        overlayParams = params
    }

    private fun attachDragHandlers(view: MusicOverlayView, params: WindowManager.LayoutParams) {
        val dragTargets = listOf(view.dragHandle, view.collapsedHandle)
        for (target in dragTargets) {
            target.setOnTouchListener(object : View.OnTouchListener {
                private var startX = 0
                private var startY = 0
                private var startTouchX = 0f
                private var startTouchY = 0f

                override fun onTouch(v: View, event: MotionEvent): Boolean {
                    when (event.action) {
                        MotionEvent.ACTION_DOWN -> {
                            startX = params.x
                            startY = params.y
                            startTouchX = event.rawX
                            startTouchY = event.rawY
                            return true
                        }
                        MotionEvent.ACTION_MOVE -> {
                            params.x = startX + (event.rawX - startTouchX).toInt()
                            params.y = startY + (event.rawY - startTouchY).toInt()
                            windowManager?.updateViewLayout(view, params)
                            return true
                        }
                        MotionEvent.ACTION_UP -> {
                            savePosition(params.x, params.y)
                            return true
                        }
                    }
                    return false
                }
            })
        }
    }

    private fun attachResizeHandler(view: MusicOverlayView, params: WindowManager.LayoutParams) {
        view.resizeHandle.setOnTouchListener(object : View.OnTouchListener {
            private var startScale = 1f
            private var startTouchX = 0f
            private var startTouchY = 0f

            override fun onTouch(v: View, event: MotionEvent): Boolean {
                if (isCollapsed) return false
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        startScale = expandedScale
                        startTouchX = event.rawX
                        startTouchY = event.rawY
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val deltaScaleX = (event.rawX - startTouchX) / baseWidth.toFloat()
                        val deltaScaleY = (event.rawY - startTouchY) / baseHeight.toFloat()
                        val nextScale = startScale + max(deltaScaleX, deltaScaleY)
                        applyScale(view, params, nextScale)
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        saveScale(expandedScale)
                        return true
                    }
                }
                return false
            }
        })
    }

    private fun applyScale(view: MusicOverlayView, params: WindowManager.LayoutParams, scale: Float) {
        val maxScale = getMaxScale(baseWidth, baseHeight)
        val clampedScale = scale.coerceIn(MIN_SCALE, maxScale)
        scaleFactor = clampedScale
        expandedScale = clampedScale
        params.width = (baseWidth * clampedScale).roundToInt()
        params.height = (baseHeight * clampedScale).roundToInt()
        view.setContainerSize(baseWidth, baseHeight)
        view.setScaleFactor(clampedScale)
        view.setCollapsed(false)
        windowManager?.updateViewLayout(view, params)
    }

    private fun toggleCollapsed() {
        val view = overlayView ?: return
        val params = overlayParams ?: return
        val context = appContext ?: return
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val collapsedWidth = dp(COLLAPSED_WIDTH_DP)
        val collapsedHeight = dp(COLLAPSED_HEIGHT_DP)
        if (isCollapsed) {
            isCollapsed = false
            val maxScale = getMaxScale(baseWidth, baseHeight)
            val targetScale = expandedScale.coerceIn(MIN_SCALE, maxScale)
            applyScale(view, params, targetScale)
        } else {
            isCollapsed = true
            expandedScale = scaleFactor
            params.width = collapsedWidth
            params.height = collapsedHeight
            view.setContainerSize(collapsedWidth, collapsedHeight)
            view.setScaleFactor(1f)
        }
        view.setCollapsed(isCollapsed)
        windowManager?.updateViewLayout(view, params)
        prefs.edit().putBoolean(KEY_MUSIC_COLLAPSED, isCollapsed).apply()
        saveScale(expandedScale)
    }

    private fun togglePlayPause() {
        val controller = activeController ?: return
        val state = controller.playbackState?.state ?: PlaybackState.STATE_NONE
        if (state == PlaybackState.STATE_PLAYING) {
            controller.transportControls?.pause()
        } else {
            controller.transportControls?.play()
        }
    }

    private fun updateOverlayContent() {
        handler.post {
            val view = overlayView ?: return@post
            view.setMetadata(currentTitle, currentArtist, currentArtwork)
            view.setPlayback(isPlaybackActive(currentPlaybackState))
            val position = getEffectivePosition(currentPlaybackState)
            view.setProgress(position, currentDuration)
            view.setCustomActions(currentActions)
        }
    }

    private fun startProgressUpdates() {
        if (progressRunnable != null) return
        progressRunnable = object : Runnable {
            override fun run() {
                val position = getEffectivePosition(currentPlaybackState)
                overlayView?.setProgress(position, currentDuration)
                handler.postDelayed(this, 1000L)
            }
        }
        handler.post(progressRunnable!!)
    }

    private fun stopProgressUpdates() {
        progressRunnable?.let { handler.removeCallbacks(it) }
        progressRunnable = null
    }

    private fun isPlaybackActive(state: PlaybackState?): Boolean {
        return when (state?.state) {
            PlaybackState.STATE_PLAYING,
            PlaybackState.STATE_BUFFERING,
            PlaybackState.STATE_CONNECTING -> true
            else -> false
        }
    }

    private fun hasVisibleSession(): Boolean {
        val hasMetadata = currentTitle.isNotBlank() ||
            currentArtist.isNotBlank() ||
            currentDuration > 0L ||
            currentArtwork != null
        val state = currentPlaybackState?.state ?: PlaybackState.STATE_NONE
        val hasState = state == PlaybackState.STATE_PLAYING ||
            state == PlaybackState.STATE_PAUSED ||
            state == PlaybackState.STATE_BUFFERING ||
            state == PlaybackState.STATE_CONNECTING
        return hasMetadata || hasState
    }

    private fun getEffectivePosition(playbackState: PlaybackState?): Long {
        if (playbackState == null) return 0L
        val basePosition = playbackState.position
        if (playbackState.state != PlaybackState.STATE_PLAYING) return basePosition
        val updateTime = playbackState.lastPositionUpdateTime
        if (updateTime <= 0L) return basePosition
        val speed = playbackState.playbackSpeed
        if (speed <= 0f) return basePosition
        val deltaMs = SystemClock.elapsedRealtime() - updateTime
        if (deltaMs <= 0L) return basePosition
        return (basePosition + (deltaMs * speed).toLong()).coerceAtLeast(0L)
    }

    private fun canDrawOverlays(): Boolean {
        val context = appContext ?: return false
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }
    }

    private fun savePosition(x: Int, y: Int) {
        val context = appContext ?: return
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putInt(KEY_MUSIC_X, x)
            .putInt(KEY_MUSIC_Y, y)
            .apply()
    }

    private fun saveScale(scale: Float) {
        val context = appContext ?: return
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putFloat(KEY_MUSIC_SCALE, scale)
            .apply()
    }

    private fun dp(value: Int): Int {
        val context = appContext ?: return value
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            context.resources.displayMetrics
        ).roundToInt()
    }

    private fun getMaxSize(): Pair<Int, Int> {
        val wm = windowManager ?: return Pair(dp(BASE_WIDTH_DP), dp(BASE_HEIGHT_DP))
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val bounds = wm.currentWindowMetrics.bounds
            Pair((bounds.width() * 0.9f).toInt(), (bounds.height() * 0.9f).toInt())
        } else {
            val metrics = DisplayMetrics()
            @Suppress("DEPRECATION")
            wm.defaultDisplay.getRealMetrics(metrics)
            Pair((metrics.widthPixels * 0.9f).toInt(), (metrics.heightPixels * 0.9f).toInt())
        }
    }

    private fun getMaxScale(baseWidthPx: Int, baseHeightPx: Int): Float {
        if (baseWidthPx <= 0 || baseHeightPx <= 0) return MAX_SCALE
        val (maxWidth, maxHeight) = getMaxSize()
        val scaleByWidth = maxWidth.toFloat() / baseWidthPx.toFloat()
        val scaleByHeight = maxHeight.toFloat() / baseHeightPx.toFloat()
        return min(min(scaleByWidth, scaleByHeight), MAX_SCALE)
    }
}
