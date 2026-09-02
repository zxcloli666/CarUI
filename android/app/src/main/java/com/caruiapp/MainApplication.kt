package com.caruiapp

import android.app.Application
import com.caruiapp.minimap.MiniMapPackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.caruiapp.modules.CarUIPackage
import com.caruiapp.modules.MusicOverlayManager

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          add(CarUIPackage())
          add(MiniMapPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // MapKit is initialized via react-native-yamap package
    loadReactNative(this)
    MusicOverlayManager.init(this)
  }
}
