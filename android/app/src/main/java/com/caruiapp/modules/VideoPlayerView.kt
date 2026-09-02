package com.caruiapp.modules

import android.content.Context
import android.widget.FrameLayout
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.events.RCTEventEmitter

@OptIn(UnstableApi::class)
class VideoPlayerView(context: Context) : FrameLayout(context) {

    private var player: ExoPlayer? = null
    private val playerView = PlayerView(context).apply {
        useController = true
        setShowBuffering(PlayerView.SHOW_BUFFERING_WHEN_PLAYING)
    }
    private var sourceUrl: String? = null
    private var prepared = false

    init {
        addView(playerView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    }

    fun setUrl(url: String?) {
        if (url == sourceUrl && player != null) return
        sourceUrl = url
        release()
        if (url.isNullOrEmpty()) return

        val exo = ExoPlayer.Builder(context).build()
        player = exo
        playerView.player = exo

        val httpFactory = DefaultHttpDataSource.Factory()
            .setConnectTimeoutMs(15_000)
            .setReadTimeoutMs(30_000)

        val source = ProgressiveMediaSource.Factory(httpFactory)
            .createMediaSource(MediaItem.fromUri(url))

        exo.addListener(object : Player.Listener {
            override fun onPlaybackStateChanged(state: Int) {
                if (state == Player.STATE_READY && !prepared) {
                    prepared = true
                    val durMs = exo.duration
                    if (durMs > 0) {
                        emit("onLoad", Arguments.createMap().apply {
                            putDouble("duration", durMs / 1000.0)
                        })
                    }
                }
            }

            override fun onPlayerError(error: PlaybackException) {
                emit("onError", Arguments.createMap().apply {
                    putString("message", error.message ?: "Playback error")
                })
            }
        })

        exo.setMediaSource(source)
        exo.prepare()
        exo.playWhenReady = true
    }

    fun release() {
        prepared = false
        playerView.player = null
        player?.release()
        player = null
    }

    override fun onDetachedFromWindow() {
        super.onDetachedFromWindow()
        release()
        sourceUrl = null
    }

    private fun emit(name: String, data: com.facebook.react.bridge.WritableMap) {
        (context as? ReactContext)
            ?.getJSModule(RCTEventEmitter::class.java)
            ?.receiveEvent(id, name, data)
    }
}
