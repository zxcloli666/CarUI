package com.caruiapp.modules

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
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
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest

class MediaSessionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "MediaSessionModule"
        private const val EVENT_MEDIA_SESSION_CHANGED = "onMediaSessionChanged"
        private const val EVENT_PLAYBACK_POSITION_CHANGED = "onPlaybackPositionChanged"

        // Standard actions that we handle separately (not shown as custom)
        private val STANDARD_ACTIONS = setOf(
            "play", "pause", "stop", "skip_next", "skip_to_next", "next",
            "skip_previous", "skip_to_previous", "previous",
            "fast_forward", "rewind", "seek_to"
        )
    }

    private var mediaSessionManager: MediaSessionManager? = null
    private var activeController: MediaController? = null
    private val handler = Handler(Looper.getMainLooper())
    private var positionUpdateRunnable: Runnable? = null
    private var sessionUpdateRunnable: Runnable? = null
    private var isPolling = false
    private var lastSessionHash = 0

    override fun getName(): String = "MediaSessionModule"

    init {
        try {
            mediaSessionManager = reactApplicationContext.getSystemService(Context.MEDIA_SESSION_SERVICE) as? MediaSessionManager
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get MediaSessionManager", e)
        }
    }

    private val mediaCacheDir: File by lazy {
        File(reactApplicationContext.cacheDir, "media_cache")
    }
    private val maxCacheFiles = 80

    private fun sendEvent(eventName: String, params: Any?) {
        try {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to send event $eventName", e)
        }
    }

    private fun drawableToBitmap(drawable: Drawable): Bitmap {
        if (drawable is BitmapDrawable && drawable.bitmap != null) {
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

    private fun ensureCacheDir(): File {
        if (!mediaCacheDir.exists()) {
            mediaCacheDir.mkdirs()
        }
        return mediaCacheDir
    }

    private fun md5(value: String): String {
        val digest = MessageDigest.getInstance("MD5").digest(value.toByteArray())
        return digest.joinToString("") { "%02x".format(it) }
    }

    private fun trimCache(dir: File) {
        val files = dir.listFiles() ?: return
        if (files.size <= maxCacheFiles) return
        val sorted = files.sortedBy { it.lastModified() }
        val deleteCount = files.size - maxCacheFiles
        for (i in 0 until deleteCount) {
            try {
                sorted[i].delete()
            } catch (_: Exception) {}
        }
    }

    private fun cacheBitmap(
        bitmap: Bitmap,
        key: String,
        maxSize: Int,
        format: Bitmap.CompressFormat,
        quality: Int
    ): String? {
        return try {
            val dir = ensureCacheDir()
            val hash = md5(key)
            val ext = if (format == Bitmap.CompressFormat.PNG) "png" else "jpg"
            val file = File(dir, "$hash.$ext")
            if (!file.exists() || file.length() == 0L) {
                val scaled = if (bitmap.width > maxSize || bitmap.height > maxSize) {
                    val ratio = minOf(maxSize.toFloat() / bitmap.width, maxSize.toFloat() / bitmap.height)
                    Bitmap.createScaledBitmap(
                        bitmap,
                        (bitmap.width * ratio).toInt(),
                        (bitmap.height * ratio).toInt(),
                        true
                    )
                } else {
                    bitmap
                }
                FileOutputStream(file).use { out ->
                    scaled.compress(format, quality, out)
                    out.flush()
                }
                if (scaled !== bitmap) {
                    scaled.recycle()
                }
            } else {
                file.setLastModified(System.currentTimeMillis())
            }
            trimCache(dir)
            "file://${file.absolutePath}"
        } catch (e: Exception) {
            Log.w(TAG, "Failed to cache bitmap", e)
            null
        }
    }

    private fun cacheDrawable(
        drawable: Drawable,
        key: String,
        maxSize: Int,
        format: Bitmap.CompressFormat,
        quality: Int
    ): String? {
        val isBitmapDrawable = drawable is BitmapDrawable && drawable.bitmap != null
        val bitmap = if (isBitmapDrawable) drawable.bitmap else drawableToBitmap(drawable)
        val uri = cacheBitmap(bitmap, key, maxSize, format, quality)
        if (!isBitmapDrawable) {
            bitmap.recycle()
        }
        return uri
    }

    private fun getPlaybackStateString(state: Int?): String {
        return when (state) {
            PlaybackState.STATE_PLAYING -> "playing"
            PlaybackState.STATE_PAUSED -> "paused"
            PlaybackState.STATE_BUFFERING -> "buffering"
            PlaybackState.STATE_STOPPED -> "stopped"
            PlaybackState.STATE_CONNECTING -> "buffering"
            PlaybackState.STATE_SKIPPING_TO_NEXT,
            PlaybackState.STATE_SKIPPING_TO_PREVIOUS,
            PlaybackState.STATE_SKIPPING_TO_QUEUE_ITEM -> "buffering"
            else -> "none"
        }
    }

    private fun getTitle(metadata: MediaMetadata?): String {
        return metadata?.getString(MediaMetadata.METADATA_KEY_TITLE)
            ?: metadata?.getString(MediaMetadata.METADATA_KEY_DISPLAY_TITLE)
            ?: ""
    }

    private fun getArtist(metadata: MediaMetadata?): String {
        return metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST)
            ?: metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM_ARTIST)
            ?: metadata?.getString(MediaMetadata.METADATA_KEY_AUTHOR)
            ?: metadata?.getString(MediaMetadata.METADATA_KEY_COMPOSER)
            ?: ""
    }

    private fun getAlbum(metadata: MediaMetadata?): String {
        return metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM)
            ?: metadata?.getString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE)
            ?: ""
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

    // Map action ID to human-readable name and icon type
    private fun getActionInfo(actionId: String): Pair<String, String> {
        val lowerAction = actionId.lowercase()

        return when {
            // Dislike actions (check FIRST before like, because "dislike" contains "like")
            lowerAction.contains("dislike") ||
            lowerAction.contains("thumbs_down") ||
            lowerAction.contains("thumbsdown") ||
            lowerAction.contains("thumb_down") ||
            (lowerAction.contains("thumb") && lowerAction.contains("down")) ||
            lowerAction.contains("ban") ||
            lowerAction.contains("not_like") ||
            lowerAction.contains("notlike") ||
            lowerAction.contains("unlike") ->
                Pair("Не нравится", "thumbs_down")

            // Like/favorite actions
            lowerAction.contains("like") || lowerAction.contains("favorite") ||
            lowerAction.contains("thumbs_up") ||
            lowerAction.contains("thumbsup") ||
            lowerAction.contains("thumb_up") ||
            (lowerAction.contains("thumb") && lowerAction.contains("up")) ||
            lowerAction.contains("heart") || lowerAction.contains("love") ->
                Pair("Нравится", "heart")

            // Shuffle
            lowerAction.contains("shuffle") ->
                Pair("Перемешать", "shuffle")

            // Repeat
            lowerAction.contains("repeat") ->
                Pair("Повтор", "repeat")

            // Add to playlist/library
            lowerAction.contains("add") || lowerAction.contains("save") ||
            lowerAction.contains("library") || lowerAction.contains("playlist") ->
                Pair("Сохранить", "plus")

            // Share
            lowerAction.contains("share") ->
                Pair("Поделиться", "share")

            // Lyrics
            lowerAction.contains("lyric") ->
                Pair("Текст", "text")

            // Radio/station
            lowerAction.contains("radio") || lowerAction.contains("station") ->
                Pair("Радио", "radio")

            // Sleep timer
            lowerAction.contains("sleep") || lowerAction.contains("timer") ->
                Pair("Таймер", "clock")

            // Queue
            lowerAction.contains("queue") ->
                Pair("Очередь", "list")

            // Equalizer
            lowerAction.contains("equal") || lowerAction.contains("sound") ->
                Pair("Эквалайзер", "sliders")

            // Download
            lowerAction.contains("download") || lowerAction.contains("offline") ->
                Pair("Скачать", "download")

            // Default - clean up the action name
            else -> {
                val cleanName = actionId
                    .replace("_", " ")
                    .replace(".", " ")
                    .replace("-", " ")
                    .split(" ")
                    .filter { it.isNotEmpty() }
                    .joinToString(" ") { word ->
                        word.replaceFirstChar { it.uppercase() }
                    }
                Pair(cleanName.ifEmpty { actionId }, "custom")
            }
        }
    }

    private fun buildActionsArray(playbackState: PlaybackState?, packageName: String?): WritableArray {
        val actionsArray = WritableNativeArray()
        if (playbackState == null) return actionsArray

        val actionFlags = playbackState.actions
        val addedActions = mutableSetOf<String>()

        // Add standard actions based on flags
        fun addStandardAction(id: String, name: String, icon: String) {
            if (!addedActions.contains(id)) {
                addedActions.add(id)
                actionsArray.pushMap(WritableNativeMap().apply {
                    putString("id", id)
                    putString("name", name)
                    putString("icon", icon)
                    putBoolean("isCustom", false)
                })
            }
        }

        if (actionFlags and PlaybackState.ACTION_PLAY != 0L) {
            addStandardAction("play", "Воспроизвести", "play")
        }
        if (actionFlags and PlaybackState.ACTION_PAUSE != 0L) {
            addStandardAction("pause", "Пауза", "pause")
        }
        if (actionFlags and PlaybackState.ACTION_PLAY_PAUSE != 0L) {
            // Add both if play_pause is supported
            if (!addedActions.contains("play")) addStandardAction("play", "Воспроизвести", "play")
            if (!addedActions.contains("pause")) addStandardAction("pause", "Пауза", "pause")
        }
        if (actionFlags and PlaybackState.ACTION_SKIP_TO_NEXT != 0L) {
            addStandardAction("skip_next", "Следующий", "skip_next")
        }
        if (actionFlags and PlaybackState.ACTION_SKIP_TO_PREVIOUS != 0L) {
            addStandardAction("skip_previous", "Предыдущий", "skip_previous")
        }
        if (actionFlags and PlaybackState.ACTION_STOP != 0L) {
            addStandardAction("stop", "Остановить", "stop")
        }
        if (actionFlags and PlaybackState.ACTION_FAST_FORWARD != 0L) {
            addStandardAction("fast_forward", "Вперёд", "fast_forward")
        }
        if (actionFlags and PlaybackState.ACTION_REWIND != 0L) {
            addStandardAction("rewind", "Назад", "rewind")
        }

        // Add custom actions from the app
        playbackState.customActions?.forEach { customAction ->
            val actionId = customAction.action
            val actionName = customAction.name?.toString() ?: ""

            Log.d(TAG, "Custom action: id='$actionId', name='$actionName', iconRes=${customAction.icon}")

            // Skip if it's a standard action disguised as custom
            if (STANDARD_ACTIONS.any { actionId.lowercase().contains(it) }) {
                Log.d(TAG, "Skipping standard action: $actionId")
                return@forEach
            }

            // Skip if already added
            if (addedActions.contains(actionId)) {
                return@forEach
            }

            addedActions.add(actionId)

            // Get native icon from the custom action
            var nativeIconBase64: String? = null
            try {
                val iconResId = customAction.icon
                if (iconResId != 0 && packageName != null) {
                    // The icon resource belongs to the media app, not our app
                    // We need to load it from the media app's resources
                    val pm = reactApplicationContext.packageManager
                    val resources = pm.getResourcesForApplication(packageName)
                    val drawable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        resources.getDrawable(iconResId, null)
                    } else {
                        @Suppress("DEPRECATION")
                        resources.getDrawable(iconResId)
                    }
                    if (drawable != null) {
                        // Use PNG for icons to preserve transparency
                        val cacheKey = "action|$packageName|$actionId|$iconResId"
                        nativeIconBase64 = cacheDrawable(drawable, cacheKey, 64, Bitmap.CompressFormat.PNG, 100)
                        Log.d(TAG, "Successfully loaded native icon for action $actionId")
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to get native icon for action $actionId from package $packageName", e)
            }

            actionsArray.pushMap(WritableNativeMap().apply {
                putString("id", actionId)
                putString("name", actionName.ifEmpty { actionId })
                putString("icon", "custom") // Always custom, we use nativeIcon
                putBoolean("isCustom", true)
                if (nativeIconBase64 != null) {
                    putString("nativeIcon", nativeIconBase64)
                }
            })
        }

        return actionsArray
    }

    private fun mediaControllerToMap(controller: MediaController): WritableMap {
        val result = WritableNativeMap()
        val metadata = controller.metadata
        val playbackState = controller.playbackState

        result.putString("packageName", controller.packageName)

        // Get app name and icon
        try {
            val pm = reactApplicationContext.packageManager
            val appInfo = pm.getApplicationInfo(controller.packageName, 0)
            result.putString("appName", pm.getApplicationLabel(appInfo).toString())

            try {
                val icon = pm.getApplicationIcon(controller.packageName)
                val iconUri = cacheDrawable(icon, "app|${controller.packageName}", 64, Bitmap.CompressFormat.PNG, 100)
                if (iconUri != null) {
                    result.putString("appIcon", iconUri)
                }
            } catch (e: Exception) {
                Log.w(TAG, "Failed to get app icon", e)
            }
        } catch (e: Exception) {
            result.putString("appName", controller.packageName)
        }

        // Active state - more lenient check
        val state = playbackState?.state
        val isActive = state == PlaybackState.STATE_PLAYING ||
                       state == PlaybackState.STATE_PAUSED ||
                       state == PlaybackState.STATE_BUFFERING ||
                       state == PlaybackState.STATE_CONNECTING ||
                       (metadata != null && metadata.getString(MediaMetadata.METADATA_KEY_TITLE) != null)

        result.putBoolean("isActive", isActive)
        result.putString("playbackState", getPlaybackStateString(state))

        // Metadata with fallbacks
        val title = getTitle(metadata)
        val artist = getArtist(metadata)
        val album = getAlbum(metadata)

        result.putString("title", title)
        result.putString("artist", artist)
        result.putString("album", album)

        val duration = metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L

        // Album art with multiple fallbacks
        val albumArt = metadata?.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
            ?: metadata?.getBitmap(MediaMetadata.METADATA_KEY_ART)
            ?: metadata?.getBitmap(MediaMetadata.METADATA_KEY_DISPLAY_ICON)

        if (albumArt != null) {
            val artKey = listOf(
                controller.packageName,
                title,
                artist,
                album,
                duration.toString(),
                metadata?.getString(MediaMetadata.METADATA_KEY_MEDIA_ID) ?: "",
                metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM_ART_URI) ?: "",
                metadata?.getString(MediaMetadata.METADATA_KEY_ART_URI) ?: "",
                metadata?.getString(MediaMetadata.METADATA_KEY_DISPLAY_ICON_URI) ?: ""
            ).joinToString("|")
            val artUri = cacheBitmap(albumArt, artKey, 320, Bitmap.CompressFormat.JPEG, 85)
            if (artUri != null) {
                result.putString("albumArt", artUri)
            }
        }

        // Duration and position
        val rawPosition = getEffectivePosition(playbackState)
        val position = if (duration > 0L) rawPosition.coerceAtMost(duration) else rawPosition
        result.putDouble("duration", duration.toDouble())
        result.putDouble("position", position.toDouble())

        // Actions - now returns full action objects, not just strings
        result.putArray("actions", buildActionsArray(playbackState, controller.packageName))

        // Seek support
        val supportsSeek = (playbackState?.actions ?: 0L) and PlaybackState.ACTION_SEEK_TO != 0L
        result.putBoolean("supportsSeek", supportsSeek)

        return result
    }

    // Generate a hash for detecting changes
    private fun getSessionHash(controller: MediaController?): Int {
        if (controller == null) return 0
        val state = controller.playbackState
        val metadata = controller.metadata
        val sessionToken = controller.sessionToken?.hashCode() ?: 0
        val duration = metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L
        val title = getTitle(metadata)
        val artist = getArtist(metadata)
        val album = getAlbum(metadata)
        val customActionsSignature = getCustomActionsSignature(state)
        return listOf(
            controller.packageName,
            sessionToken,
            state?.state,
            state?.actions,
            customActionsSignature,
            title,
            artist,
            album,
            duration
        ).hashCode()
    }

    private fun getCustomActionsSignature(state: PlaybackState?): String {
        val actions = state?.customActions ?: return ""
        return actions.joinToString("|") { action ->
            val id = action.action ?: ""
            val name = action.name?.toString() ?: ""
            val icon = action.icon
            "$id:$name:$icon"
        }
    }

    @ReactMethod
    fun hasNotificationListenerPermission(promise: Promise) {
        try {
            val cn = ComponentName(reactApplicationContext, MediaNotificationListenerService::class.java)
            val enabledListeners = Settings.Secure.getString(
                reactApplicationContext.contentResolver,
                "enabled_notification_listeners"
            )
            val hasPermission = enabledListeners?.contains(cn.flattenToString()) == true
            promise.resolve(hasPermission)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to check notification listener permission", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestNotificationListenerPermission(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open notification listener settings", e)
            promise.reject("ERROR", e.message)
        }
    }

    private fun getActiveControllers(): List<MediaController> {
        return try {
            val cn = ComponentName(reactApplicationContext, MediaNotificationListenerService::class.java)
            mediaSessionManager?.getActiveSessions(cn) ?: emptyList()
        } catch (e: SecurityException) {
            Log.w(TAG, "No notification listener permission")
            emptyList()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get active sessions", e)
            emptyList()
        }
    }

    private fun findBestController(): MediaController? {
        val controllers = getActiveControllers()

        // Priority 1: Currently playing
        controllers.find { it.playbackState?.state == PlaybackState.STATE_PLAYING }?.let { return it }

        // Priority 2: Paused
        controllers.find { it.playbackState?.state == PlaybackState.STATE_PAUSED }?.let { return it }

        // Priority 3: Buffering/Connecting
        controllers.find {
            val state = it.playbackState?.state
            state == PlaybackState.STATE_BUFFERING || state == PlaybackState.STATE_CONNECTING
        }?.let { return it }

        // Priority 4: Has metadata (title)
        controllers.find {
            it.metadata?.getString(MediaMetadata.METADATA_KEY_TITLE) != null
        }?.let { return it }

        // Priority 5: First available
        return controllers.firstOrNull()
    }

    @ReactMethod
    fun getActiveMediaSession(promise: Promise) {
        try {
            val controller = findBestController()

            if (controller != null) {
                activeController = controller
                promise.resolve(mediaControllerToMap(controller))
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get active media session", e)
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun getAllMediaSessions(promise: Promise) {
        try {
            val controllers = getActiveControllers()
            val result = WritableNativeArray()

            controllers.forEach { controller ->
                result.pushMap(mediaControllerToMap(controller))
            }

            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get all media sessions", e)
            promise.resolve(WritableNativeArray())
        }
    }

    @ReactMethod
    fun getMusicApps(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val result = WritableNativeArray()
            val addedPackages = mutableSetOf<String>()

            // Known music app packages
            val musicPackages = listOf(
                "ru.yandex.music",
                "com.spotify.music",
                "com.google.android.apps.youtube.music",
                "com.apple.android.music",
                "deezer.android.app",
                "com.soundcloud.android",
                "com.amazon.mp3",
                "com.pandora.android",
                "com.tidal.android",
                "ru.zaycev.net",
                "com.vkontakte.android",
                "com.vk.music",
                "com.zvooq.openplay",
                "com.google.android.youtube"
            )

            // Also find apps that handle audio
            val audioIntent = Intent(Intent.ACTION_VIEW).apply {
                type = "audio/*"
            }
            val audioApps = pm.queryIntentActivities(audioIntent, 0)
                .map { it.activityInfo.packageName }
                .toSet()

            // Get all launcher apps and filter
            val mainIntent = Intent(Intent.ACTION_MAIN, null).apply {
                addCategory(Intent.CATEGORY_LAUNCHER)
            }
            val allApps = pm.queryIntentActivities(mainIntent, 0)

            for (app in allApps) {
                val packageName = app.activityInfo.packageName

                // Check if it's a known music app or handles audio
                val isMusicApp = musicPackages.contains(packageName) || audioApps.contains(packageName)
                if (!isMusicApp) continue

                // Skip duplicates
                if (addedPackages.contains(packageName)) continue
                addedPackages.add(packageName)

                try {
                    val appInfo = WritableNativeMap().apply {
                        putString("packageName", packageName)
                        putString("appName", app.loadLabel(pm).toString())

                        // Get icon
                        val icon = app.loadIcon(pm)
                        val iconUri = cacheDrawable(icon, "musicapp|$packageName", 72, Bitmap.CompressFormat.PNG, 100)
                        if (iconUri != null) {
                            putString("icon", iconUri)
                        }
                        putBoolean("isMediaApp", true)
                    }
                    result.pushMap(appInfo)
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to load app info for $packageName", e)
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to get music apps", e)
            promise.resolve(WritableNativeArray())
        }
    }

    private fun getControllerForPackage(packageName: String): MediaController? {
        val direct = getActiveControllers().find { it.packageName == packageName }
        if (direct != null) return direct
        return findBestController()
    }

    @ReactMethod
    fun performAction(packageName: String, actionId: String, promise: Promise) {
        try {
            val controller = getControllerForPackage(packageName)
            if (controller == null) {
                Log.w(TAG, "No controller found for package: $packageName")
                promise.resolve(false)
                return
            }

            val transportControls = controller.transportControls
            val lowerAction = actionId.lowercase()

            when {
                lowerAction == "play" -> transportControls.play()
                lowerAction == "pause" -> transportControls.pause()
                lowerAction == "stop" -> transportControls.stop()
                lowerAction in listOf("skip_next", "skip_to_next", "next") -> transportControls.skipToNext()
                lowerAction in listOf("skip_previous", "skip_to_previous", "previous") -> transportControls.skipToPrevious()
                lowerAction == "fast_forward" -> transportControls.fastForward()
                lowerAction == "rewind" -> transportControls.rewind()
                else -> {
                    // Custom action - send as-is
                    Log.d(TAG, "Sending custom action: $actionId")
                    transportControls.sendCustomAction(actionId, null)
                }
            }

            // Trigger an update after action
            handler.postDelayed({
                sendSessionUpdate()
            }, 300)

            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to perform action $actionId", e)
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun play(packageName: String, promise: Promise) {
        performAction(packageName, "play", promise)
    }

    @ReactMethod
    fun pause(packageName: String, promise: Promise) {
        performAction(packageName, "pause", promise)
    }

    @ReactMethod
    fun skipNext(packageName: String, promise: Promise) {
        performAction(packageName, "skip_next", promise)
    }

    @ReactMethod
    fun skipPrevious(packageName: String, promise: Promise) {
        performAction(packageName, "skip_previous", promise)
    }

    @ReactMethod
    fun seekTo(packageName: String, position: Double, promise: Promise) {
        try {
            val controller = getControllerForPackage(packageName)
            if (controller == null) {
                promise.resolve(false)
                return
            }
            controller.transportControls.seekTo(position.toLong())
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "Failed to seek", e)
            promise.resolve(false)
        }
    }

    private fun sendSessionUpdate() {
        val controller = findBestController()
        val newHash = getSessionHash(controller)

        if (newHash != lastSessionHash) {
            lastSessionHash = newHash
            if (controller != null) {
                sendEvent(EVENT_MEDIA_SESSION_CHANGED, mediaControllerToMap(controller))
            } else {
                sendEvent(EVENT_MEDIA_SESSION_CHANGED, null)
            }
        }
    }

    private fun sendPositionUpdate() {
        val controller = findBestController() ?: return
        val playbackState = controller.playbackState
        val metadata = controller.metadata
        val duration = metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L
        val rawPosition = getEffectivePosition(playbackState)
        val position = if (duration > 0L) rawPosition.coerceAtMost(duration) else rawPosition
        val payload = WritableNativeMap().apply {
            putDouble("position", position.toDouble())
            putDouble("duration", duration.toDouble())
        }
        sendEvent(EVENT_PLAYBACK_POSITION_CHANGED, payload)
    }

    @ReactMethod
    fun startPolling(intervalMs: Double, promise: Promise) {
        if (isPolling) {
            promise.resolve(true)
            return
        }

        isPolling = true
        val interval = intervalMs.toLong().coerceIn(500, 5000)

        sessionUpdateRunnable = object : Runnable {
            override fun run() {
                if (isPolling) {
                    sendSessionUpdate()
                    handler.postDelayed(this, interval)
                }
            }
        }

        handler.post(sessionUpdateRunnable!!)
        positionUpdateRunnable = object : Runnable {
            override fun run() {
                if (isPolling) {
                    sendPositionUpdate()
                    handler.postDelayed(this, interval)
                }
            }
        }
        handler.post(positionUpdateRunnable!!)
        promise.resolve(true)
    }

    @ReactMethod
    fun stopPolling(promise: Promise) {
        isPolling = false
        sessionUpdateRunnable?.let { handler.removeCallbacks(it) }
        sessionUpdateRunnable = null
        positionUpdateRunnable?.let { handler.removeCallbacks(it) }
        positionUpdateRunnable = null
        promise.resolve(true)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN NativeEventEmitter
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN NativeEventEmitter
    }
}
