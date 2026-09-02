package com.caruiapp.modules

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class VideoPlayerViewManager : SimpleViewManager<VideoPlayerView>() {
    override fun getName(): String = "NativeVideoPlayer"

    override fun createViewInstance(ctx: ThemedReactContext) = VideoPlayerView(ctx)

    @ReactProp(name = "url")
    fun setUrl(view: VideoPlayerView, url: String?) = view.setUrl(url)

    override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> = mutableMapOf(
        "onLoad" to mapOf("registrationName" to "onLoad"),
        "onError" to mapOf("registrationName" to "onError"),
    )

    override fun onDropViewInstance(view: VideoPlayerView) {
        view.release()
        super.onDropViewInstance(view)
    }
}
