package com.caruiapp.modules

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Build
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AudioFocusModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "AudioFocusModule"

    private val audioManager: AudioManager by lazy {
        reactApplicationContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    private var focusDepth = 0
    private var focusRequest: AudioFocusRequest? = null
    private var focusChangeListener: AudioManager.OnAudioFocusChangeListener? = null

    @ReactMethod
    fun requestDuckFocus(promise: Promise) {
        try {
            focusDepth += 1
            if (focusDepth > 1) {
                promise.resolve(true)
                return
            }

            focusChangeListener = AudioManager.OnAudioFocusChangeListener { }
            val result = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val attributes = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANCE_ACCESSIBILITY)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
                val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(attributes)
                    .setOnAudioFocusChangeListener(focusChangeListener!!)
                    .setWillPauseWhenDucked(false)
                    .build()
                focusRequest = request
                audioManager.requestAudioFocus(request)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    focusChangeListener,
                    AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }

            promise.resolve(result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED)
        } catch (e: Exception) {
            focusDepth = 0
            focusRequest = null
            focusChangeListener = null
            promise.reject("AUDIO_FOCUS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun abandonDuckFocus(promise: Promise) {
        try {
            if (focusDepth == 0) {
                promise.resolve(true)
                return
            }
            focusDepth -= 1
            if (focusDepth > 0) {
                promise.resolve(true)
                return
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                focusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            } else {
                val listener = focusChangeListener
                if (listener != null) {
                    @Suppress("DEPRECATION")
                    audioManager.abandonAudioFocus(listener)

                }
            }

            focusRequest = null
            focusChangeListener = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("AUDIO_FOCUS_ERROR", e.message)
        }
    }
}
