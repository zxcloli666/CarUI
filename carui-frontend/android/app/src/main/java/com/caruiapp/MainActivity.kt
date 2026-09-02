package com.caruiapp

import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.caruiapp.modules.MusicOverlayManager
import com.caruiapp.modules.WindowFocusModule

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "CarUIApp"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {
        override fun onPause() {
          val activity = getPlainActivity()
          val keepActive = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            activity.isInMultiWindowMode ||
              (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && activity.isInPictureInPictureMode)
          } else {
            false
          }
          if (!keepActive || activity.isFinishing) {
            super.onPause()
          }
        }
      }

  override fun onCreate(savedInstanceState: Bundle?) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(
        WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
      )
    }

    // Keep the display awake while CarUI is visible.
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    super.onCreate(savedInstanceState)
    hideSystemUI()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    ReactActivityState.hasWindowFocus = hasFocus
    WindowFocusModule.emitWindowFocusChanged(hasFocus)
    if (hasFocus) {
      hideSystemUI()
    }
  }

  override fun onResume() {
    super.onResume()
    ReactActivityState.isInForeground = true
    MusicOverlayManager.onAppStateChanged(true)
  }

  override fun onPause() {
    ReactActivityState.isInForeground = false
    MusicOverlayManager.onAppStateChanged(false)
    super.onPause()
  }

  private fun hideSystemUI() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      window.insetsController?.let {
        it.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
        it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      }
    } else {
      @Suppress("DEPRECATION")
      window.decorView.systemUiVisibility = (
        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
        or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
        or View.SYSTEM_UI_FLAG_FULLSCREEN
      )
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }
}
