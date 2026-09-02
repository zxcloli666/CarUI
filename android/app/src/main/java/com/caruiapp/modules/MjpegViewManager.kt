package com.caruiapp.modules

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class MjpegViewManager : SimpleViewManager<MjpegStreamView>() {
    override fun getName(): String = "MjpegView"

    override fun createViewInstance(reactContext: ThemedReactContext): MjpegStreamView {
        return MjpegStreamView(reactContext)
    }

    @ReactProp(name = "url")
    fun setUrl(view: MjpegStreamView, url: String?) {
        view.setUrl(url)
    }

    @ReactProp(name = "paused", defaultBoolean = false)
    fun setPaused(view: MjpegStreamView, paused: Boolean) {
        view.setPaused(paused)
    }

    @ReactProp(name = "maxFps", defaultInt = 0)
    fun setMaxFps(view: MjpegStreamView, maxFps: Int) {
        view.setMaxFps(maxFps)
    }

    @ReactProp(name = "retryDelayMs", defaultInt = 1000)
    fun setRetryDelayMs(view: MjpegStreamView, retryDelayMs: Int) {
        view.setRetryDelayMs(retryDelayMs)
    }

    @ReactProp(name = "resizeMode")
    fun setResizeMode(view: MjpegStreamView, resizeMode: String?) {
        view.setResizeMode(resizeMode)
    }

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> {
        return mutableMapOf(
            "onStatus" to mapOf("registrationName" to "onStatus")
        )
    }
}
