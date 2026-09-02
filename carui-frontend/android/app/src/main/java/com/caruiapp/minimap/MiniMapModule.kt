package com.caruiapp.minimap

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.mapbox.common.TileStore
import com.mapbox.bindgen.Value

class MiniMapModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "MiniMapModule"

    @ReactMethod
    fun clearCache(promise: Promise) {
        // Хак для v11: ставим квоту 0, чтобы Mapbox сам удалил всё, потом возвращаем
        val store = TileStore.create()
        // 1. Ставим 0
        store.setOption("mapbox.tile_store.disk_quota", Value.valueOf(0L))

        // 2. Возвращаем дефолт (например 500Мб), чтобы карта снова работала
        // Можно вынести в константу или брать из настроек
        store.setOption("mapbox.tile_store.disk_quota", Value.valueOf(500L * 1024 * 1024))

        promise.resolve(true)
    }

    @ReactMethod
    fun setCacheQuota(sizeInBytes: Double, promise: Promise) {
        val store = TileStore.create()
        // ВАЖНО: Оборачиваем Long в Value.valueOf
        store.setOption("mapbox.tile_store.disk_quota", Value.valueOf(sizeInBytes.toLong()))
        promise.resolve(true)
    }
}