package com.caruiapp.minimap

import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class MiniMapManager(private val context: com.facebook.react.bridge.ReactApplicationContext) : SimpleViewManager<MiniMapView>() {
    override fun getName() = "MiniMapView"

    override fun createViewInstance(reactContext: ThemedReactContext): MiniMapView {
        return MiniMapView(reactContext)
    }

    @ReactProp(name = "accessToken")
    fun setAccessToken(view: MiniMapView, token: String?) {
        if (!token.isNullOrEmpty()) view.initializeMap(token)
    }

    @ReactProp(name = "camera")
    fun setCamera(view: MiniMapView, camera: ReadableMap?) {
        camera?.let { view.updateCamera(it) }
    }

    @ReactProp(name = "eventsJson")
    fun setEventsJson(view: MiniMapView, json: String?) {
        view.updateEvents(json)
    }

    // --- COMMANDS ---
    override fun receiveCommand(view: MiniMapView, commandId: String, args: ReadableArray?) {
        when (commandId) {
            "updateLocation" -> {
                if (args != null && args.size() >= 3) {
                    view.updateUserLocation(
                        args.getDouble(0), // lat
                        args.getDouble(1), // lon
                        args.getDouble(2) // bearing
                    )
                }
            }
            "moveCamera" -> {
                if (args != null && args.size() >= 6) {
                    view.moveCamera(
                        args.getDouble(0), // lat
                        args.getDouble(1), // lon
                        args.getDouble(2), // zoom
                        args.getDouble(3), // pitch
                        args.getDouble(4), // heading (bearing)
                        args.getInt(5).toLong() // duration (ms)
                    )
                }
            }

        }
    }
}