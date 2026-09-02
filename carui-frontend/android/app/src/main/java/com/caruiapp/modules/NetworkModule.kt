package com.caruiapp.modules

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.telephony.SignalStrength
import android.telephony.TelephonyManager
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap

class NetworkModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NetworkModule"

    @ReactMethod
    fun getNetworkInfo(promise: Promise) {
        try {
            val connectivityManager = reactApplicationContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            val wifiManager = reactApplicationContext.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

            val result = WritableNativeMap()

            val network = connectivityManager.activeNetwork
            val capabilities = connectivityManager.getNetworkCapabilities(network)

            if (capabilities == null) {
                result.putString("type", "none")
                result.putBoolean("isConnected", false)
                result.putInt("signalStrength", 0)
                promise.resolve(result)
                return
            }

            val isConnected = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            result.putBoolean("isConnected", isConnected)

            when {
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> {
                    result.putString("type", "wifi")

                    val wifiInfo = wifiManager.connectionInfo
                    val rssi = wifiInfo.rssi
                    val signalLevel = WifiManager.calculateSignalLevel(rssi, 5)
                    result.putInt("signalStrength", signalLevel)
                    result.putString("wifiSSID", wifiInfo.ssid?.replace("\"", "") ?: "")
                }
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> {
                    result.putString("type", "cellular")

                    // Get cellular signal strength and type
                    val telephonyManager = reactApplicationContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
                    val signalLevel = getCellularSignalLevel(telephonyManager)
                    result.putInt("signalStrength", signalLevel)
                    result.putString("cellularType", getCellularNetworkType(telephonyManager))
                }
                else -> {
                    result.putString("type", "other")
                    result.putInt("signalStrength", 4)
                }
            }

            promise.resolve(result)
        } catch (e: Exception) {
            promise.reject("NETWORK_ERROR", e.message)
        }
    }

    private fun getCellularSignalLevel(telephonyManager: TelephonyManager): Int {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                val signalStrength = telephonyManager.signalStrength
                signalStrength?.level ?: 2
            } else {
                2 // Default medium signal
            }
        } catch (e: SecurityException) {
            2
        }
    }

    private fun getCellularNetworkType(telephonyManager: TelephonyManager): String {
        return try {
            val networkType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                telephonyManager.dataNetworkType
            } else {
                @Suppress("DEPRECATION")
                telephonyManager.networkType
            }

            when (networkType) {
                TelephonyManager.NETWORK_TYPE_NR -> "5G"
                TelephonyManager.NETWORK_TYPE_LTE -> "LTE"
                TelephonyManager.NETWORK_TYPE_HSPAP,
                TelephonyManager.NETWORK_TYPE_HSPA,
                TelephonyManager.NETWORK_TYPE_HSDPA,
                TelephonyManager.NETWORK_TYPE_HSUPA -> "H+"
                TelephonyManager.NETWORK_TYPE_UMTS,
                TelephonyManager.NETWORK_TYPE_EVDO_0,
                TelephonyManager.NETWORK_TYPE_EVDO_A,
                TelephonyManager.NETWORK_TYPE_EVDO_B -> "3G"
                TelephonyManager.NETWORK_TYPE_EDGE -> "E"
                TelephonyManager.NETWORK_TYPE_GPRS,
                TelephonyManager.NETWORK_TYPE_CDMA,
                TelephonyManager.NETWORK_TYPE_1xRTT -> "2G"
                TelephonyManager.NETWORK_TYPE_UNKNOWN -> ""
                else -> ""
            }
        } catch (e: SecurityException) {
            ""
        }
    }
}
