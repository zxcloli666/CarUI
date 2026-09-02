package com.caruiapp.modules

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.ModuleSpec
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider
import com.facebook.react.uimanager.ViewManager

class CarUIPackage : BaseReactPackage() {
    override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? {
        return when (name) {
            "BatteryModule" -> BatteryModule(reactContext)
            "AudioFocusModule" -> AudioFocusModule(reactContext)
            "AppLauncherModule" -> AppLauncherModule(reactContext)
            "NetworkModule" -> NetworkModule(reactContext)
            "OverlayModule" -> OverlayModule(reactContext)
            "MediaSessionModule" -> MediaSessionModule(reactContext)
            "SystemModule" -> SystemModule(reactContext)
            "WindowFocusModule" -> WindowFocusModule(reactContext)
            "ScreenCaptureModule" -> ScreenCaptureModule(reactContext)
            "DownloadModule" -> DownloadModule(reactContext)
            else -> null
        }
    }

    override fun getReactModuleInfoProvider(): ReactModuleInfoProvider = ReactModuleInfoProvider {
        val moduleList = listOf(
            BatteryModule::class.java,
            AudioFocusModule::class.java,
            AppLauncherModule::class.java,
            NetworkModule::class.java,
            OverlayModule::class.java,
            MediaSessionModule::class.java,
            SystemModule::class.java,
            WindowFocusModule::class.java,
            ScreenCaptureModule::class.java,
            DownloadModule::class.java
        )

        val moduleInfoMap = HashMap<String, ReactModuleInfo>()
        for (moduleClass in moduleList) {
            val name = moduleClass.simpleName ?: moduleClass.name
            moduleInfoMap[name] = ReactModuleInfo(
                name,
                moduleClass.name,
                false,
                false,
                false,
                ReactModuleInfo.classIsTurboModule(moduleClass)
            )
        }

        moduleInfoMap
    }

    override fun getViewManagers(reactContext: ReactApplicationContext): List<ModuleSpec> = listOf(
        ModuleSpec.viewManagerSpec { MjpegViewManager() },
        ModuleSpec.viewManagerSpec { VideoPlayerViewManager() }
    )
}
