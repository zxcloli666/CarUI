package com.caruiapp.modules

import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.app.role.RoleManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SystemModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "SystemModule"

    @ReactMethod
    fun isIgnoringBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(true)
                return
            }
            val pm = reactApplicationContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            val isIgnoring = pm.isIgnoringBatteryOptimizations(reactApplicationContext.packageName)
            promise.resolve(isIgnoring)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimizations(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
                promise.resolve(true)
                return
            }
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${reactApplicationContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("BATTERY_OPT_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isDefaultLauncher(promise: Promise) {
        try {
            val isDefault = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = reactApplicationContext.getSystemService(Context.ROLE_SERVICE) as RoleManager
                roleManager.isRoleHeld(RoleManager.ROLE_HOME)
            } else {
                val intent = Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_HOME)
                }
                val resolveInfo = reactApplicationContext.packageManager.resolveActivity(
                    intent,
                    PackageManager.MATCH_DEFAULT_ONLY
                )
                resolveInfo?.activityInfo?.packageName == reactApplicationContext.packageName
            }
            promise.resolve(isDefault)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openHomeSettings(promise: Promise) {
        try {
            val pm = reactApplicationContext.packageManager
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = reactApplicationContext.getSystemService(Context.ROLE_SERVICE) as RoleManager
                if (roleManager.isRoleAvailable(RoleManager.ROLE_HOME)) {
                    roleManager.createRequestRoleIntent(RoleManager.ROLE_HOME).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                } else {
                    null
                }
            } else {
                null
            } ?: run {
                val primaryIntent = Intent(Settings.ACTION_HOME_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                if (primaryIntent.resolveActivity(pm) != null) {
                    primaryIntent
                } else {
                    val fallback = Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    if (fallback.resolveActivity(pm) != null) fallback else Intent(Settings.ACTION_SETTINGS).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                }
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("HOME_SETTINGS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun startKeepAliveService(promise: Promise) {
        try {
            CarUIKeepAliveService.setKeepAliveEnabled(reactApplicationContext, true)
            val intent = Intent(reactApplicationContext, CarUIKeepAliveService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(reactApplicationContext, intent)
            } else {
                reactApplicationContext.startService(intent)
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("KEEP_ALIVE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopKeepAliveService(promise: Promise) {
        try {
            CarUIKeepAliveService.setKeepAliveEnabled(reactApplicationContext, false)
            val intent = Intent(reactApplicationContext, CarUIKeepAliveService::class.java)
            val stopped = reactApplicationContext.stopService(intent)
            promise.resolve(stopped)
        } catch (e: Exception) {
            promise.reject("KEEP_ALIVE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun isKeepAliveRunning(promise: Promise) {
        try {
            promise.resolve(CarUIKeepAliveService.isRunning)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isKeepAliveEnabled(promise: Promise) {
        try {
            promise.resolve(CarUIKeepAliveService.isKeepAliveEnabled(reactApplicationContext))
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }
}
