package com.caruiapp.modules

import com.caruiapp.ReactActivityState
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.lang.ref.WeakReference

class WindowFocusModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val EVENT_WINDOW_FOCUS_CHANGED = "windowFocusChanged"
        private var reactContextRef: WeakReference<ReactApplicationContext>? = null

        fun emitWindowFocusChanged(hasFocus: Boolean) {
            val context = reactContextRef?.get() ?: return
            context
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_WINDOW_FOCUS_CHANGED, hasFocus)
        }
    }

    init {
        reactContextRef = WeakReference(reactContext)
    }

    override fun getName(): String = "WindowFocusModule"

    @ReactMethod
    fun getWindowFocus(promise: Promise) {
        promise.resolve(ReactActivityState.hasWindowFocus)
    }

    @ReactMethod
    fun addListener(eventName: String) {
        // Required for RN NativeEventEmitter.
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        // Required for RN NativeEventEmitter.
    }
}
