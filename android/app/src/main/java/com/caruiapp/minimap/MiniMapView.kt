package com.caruiapp.minimap

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.widget.FrameLayout
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ReadableMap
import java.util.concurrent.CopyOnWriteArrayList
import com.mapbox.maps.plugin.locationcomponent.LocationConsumer
import com.mapbox.maps.plugin.locationcomponent.LocationProvider
import com.mapbox.maps.extension.style.layers.properties.generated.IconRotationAlignment

// Mapbox Core
import com.mapbox.common.MapboxOptions
import com.mapbox.geojson.Point
import com.mapbox.maps.CameraOptions
import com.mapbox.maps.MapView
import com.mapbox.maps.MapInitOptions
import com.mapbox.maps.MapOptions
import com.mapbox.maps.Style
import com.mapbox.maps.plugin.animation.flyTo
import com.mapbox.maps.plugin.animation.MapAnimationOptions
import com.mapbox.maps.plugin.attribution.attribution
import com.mapbox.maps.plugin.logo.logo
import com.mapbox.maps.plugin.locationcomponent.location
import com.mapbox.maps.plugin.locationcomponent.createDefault2DPuck

// Bindgen & DSL
import com.mapbox.bindgen.Value
import com.mapbox.maps.extension.style.sources.addSource
import com.mapbox.maps.extension.style.sources.generated.GeoJsonSource
import com.mapbox.maps.extension.style.sources.generated.VectorSource
import com.mapbox.maps.extension.style.sources.getSourceAs
import com.mapbox.maps.extension.style.layers.addLayer
import com.mapbox.maps.extension.style.layers.generated.LineLayer
import com.mapbox.maps.extension.style.layers.generated.SymbolLayer
import com.mapbox.maps.extension.style.layers.properties.generated.IconAnchor
import com.mapbox.maps.extension.style.layers.properties.generated.LineCap
import com.mapbox.maps.extension.style.layers.properties.generated.LineJoin
import com.mapbox.maps.extension.style.expressions.dsl.generated.match
import com.mapbox.maps.extension.style.expressions.generated.Expression
import com.mapbox.maps.plugin.PuckBearing
import com.mapbox.maps.plugin.animation.easeTo
import androidx.core.graphics.toColorInt
import com.mapbox.maps.extension.style.sources.getSource
import androidx.core.graphics.createBitmap
import com.mapbox.maps.extension.style.StyleContract
import com.mapbox.maps.extension.style.layers.addLayerAt
import com.mapbox.maps.extension.style.layers.addLayerBelow
import com.mapbox.maps.extension.style.layers.generated.FillLayer
import com.mapbox.maps.extension.style.layers.getLayer
import com.mapbox.maps.extension.style.types.StyleTransition

class MiniMapView(context: Context) : FrameLayout(context) {
    private var mapView: MapView? = null
    private var isMapReady = false
    private var pendingCamera: ReadableMap? = null

    // 1. Создаем свой провайдер локации
    private val manualLocationProvider = object : LocationProvider {
        val consumers = CopyOnWriteArrayList<LocationConsumer>()

        override fun registerLocationConsumer(locationConsumer: LocationConsumer) {
            consumers.add(locationConsumer)
        }

        override fun unRegisterLocationConsumer(locationConsumer: LocationConsumer) {
            consumers.remove(locationConsumer)
        }
    }

    fun initializeMap(token: String) {
        if (mapView != null) return

        MapboxOptions.accessToken = token
        // Опции для оптимизации
        val mapOptions = MapOptions.Builder()
            .glyphsRasterizationOptions(null) // Векторные шрифты
            .build()

        val mv = MapView(context, MapInitOptions(context, mapOptions))
        mapView = mv
        addView(mv)

        // Убираем Лого и Attribution
        mv.logo.updateSettings { enabled = false }
        mv.attribution.updateSettings { enabled = false }

        mv.mapboxMap.loadStyle(Style.STANDARD) { style ->
            isMapReady = true
            setupStandardConfig(style)
            setupTrafficLayer(style)
            setupIconsAndEvents(style)
            setupLocationComponent()

            pendingCamera?.let { updateCamera(it) }
            pendingCamera = null
        }

        mv?.onStart()
    }

    // 1. Конфиг Standard (Dusk + 3D)
    private fun setupStandardConfig(style: Style) {
        style.setStyleImportConfigProperty("basemap", "lightPreset", Value.valueOf("dusk"))
        style.setStyleImportConfigProperty("basemap", "show3dObjects", Value.valueOf(true))
        // Убираем POI лейблы, чтобы карта была чище
        // style.setStyleImportConfigProperty("basemap", "showPointOfInterestLabels", Value.valueOf(false))
    }

    // 2. Слой пробок
    private fun setupTrafficLayer(style: Style) {
        val trafficSourceId = "traffic-source"
        val trafficSource = VectorSource.Builder(trafficSourceId)
            .url("mapbox://mapbox.mapbox-traffic-v1")
            .build()
        style.addSource(trafficSource)

        val trafficLayer = LineLayer("traffic-layer", trafficSourceId)
        trafficLayer.sourceLayer("traffic")
        trafficLayer.lineCap(LineCap.ROUND)
        trafficLayer.lineJoin(LineJoin.ROUND)

        trafficLayer.lineWidth(4.0)
        // Полная непрозрачность
        trafficLayer.lineOpacity(1.0)
        trafficLayer.slot("middle")

        trafficLayer.lineColor(match {
            get("congestion")
            literal("low"); rgb(0.0, 255.0, 120.0)
            literal("moderate"); rgb(255.0, 220.0, 0.0)
            literal("heavy"); rgb(255.0, 50.0, 50.0)
            literal("severe"); rgb(180.0, 0.0, 80.0)
            rgb(0.0, 0.0, 0.0)
        })

        // Добавляем glow-эффект через Emissive Strength (доступно в Standard style)
        // Это заставит линии "светиться" в ночном режиме
        trafficLayer.lineEmissiveStrength(1.0)

        style.addLayer(trafficLayer)
    }

    // Генерирует Bitmap с простой стрелкой (треугольником)
    private fun createArrowBitmap(context: Context): Bitmap {
        val width = 64
        val height = 64

        val bitmap = createBitmap(width, height)
        val canvas = Canvas(bitmap)

        val paint = Paint().apply {
            color = Color.WHITE
            style = Paint.Style.FILL
            isAntiAlias = true
        }

        val path = android.graphics.Path()

        val cx = width / 2f
        val headHeight = height * 0.5f // Высота острия (50%)

        // --- ИЗМЕНЕНИЕ: Делаем ножку тоньше ---
        val stemWidth = width * 0.18f
        val stemHalf = stemWidth / 2f

        // Рисуем
        path.moveTo(cx, 0f)                          // Острие
        path.lineTo(width.toFloat(), headHeight)     // Правый край острия
        path.lineTo(cx + stemHalf, headHeight)       // Внутренний угол
        path.lineTo(cx + stemHalf, height.toFloat()) // Низ ножки справа
        path.lineTo(cx - stemHalf, height.toFloat()) // Низ ножки слева
        path.lineTo(cx - stemHalf, headHeight)       // Внутренний угол
        path.lineTo(0f, headHeight)                  // Левый край острия
        path.close()

        canvas.drawPath(path, paint)
        return bitmap
    }

    private fun String.setupParkingLayers(style: Style) {
        // 1. Ищем слой зданий, чтобы подсунуть парковку под него
        val buildingLayerId = style.styleLayers.find { it.id.contains("building") }?.id

        // Функция для безопасного добавления слоя "вниз"
        fun addLayerSafe(layer: StyleContract.StyleLayerExtension) {
            if (buildingLayerId != null && style.getLayer(buildingLayerId) != null) {
                style.addLayerBelow(layer, buildingLayerId)
            } else {
                // Если зданий нет, кладем в самый низ (индекс 0)
                style.addLayerAt(layer, 0)
            }
        }

        // 2. Цвета для групп
        val groupColors = Expression.switchCase(
            Expression.eq(Expression.get("parking_group"), Expression.literal("private")),
            Expression.color(Color.parseColor("#444444")), // Серый
            Expression.eq(Expression.get("parking_group"), Expression.literal("permit")),
            Expression.color(Color.parseColor("#FFD700")), // Золотой/Желтый
            Expression.color(Color.parseColor("#0066FF"))  // Синий (public)
        )

        val strokeColors = Expression.switchCase(
            Expression.eq(Expression.get("parking_group"), Expression.literal("private")),
            Expression.color(Color.parseColor("#FF4444")), // Красный борт
            Expression.eq(Expression.get("parking_group"), Expression.literal("permit")),
            Expression.color(Color.parseColor("#FFA500")), // Оранжевый борт
            Expression.color(Color.parseColor("#00FFFF"))  // Циан борт
        )

        // ЗАЛИВКА
        if (style.getLayer("parking-fill") == null) {
            val fill = FillLayer("parking-fill", this)
            fill.fillColor(groupColors)
            fill.fillOpacity(0.4)
            fill.filter(Expression.eq(Expression.get("type"), Expression.literal("parking")))
            addLayerSafe(fill) // <--- ПОД ЗДАНИЯ
        }

        // ОБВОДКА
        if (style.getLayer("parking-line") == null) {
            val line = LineLayer("parking-line", this)
            line.lineColor(strokeColors)
            line.lineWidth(2.0)
            line.filter(Expression.eq(Expression.get("type"), Expression.literal("parking")))
            addLayerSafe(line) // <--- ТОЖЕ ПОД ЗДАНИЯ
        }

        // ИКОНКИ ПАРКОВКИ (Их рисуем ПОВЕРХ зданий, чтобы водитель видел их)
        if (style.getLayer("parking-icon-layer") == null) {
            val icons = SymbolLayer("parking-icon-layer", this)
            icons.iconImage(Expression.get("icon"))
            icons.iconAllowOverlap(false)
            icons.iconIgnorePlacement(false)

            // 1. УПРАВЛЯЕМ ВИДИМОСТЬЮ (Плавное проявление)
            // 16.0 -> 0 (скрыто)
            // 17.5 -> 0.6 (полупрозрачно, "вдалеке")
            // 18.5 -> 1.0 (полная видимость)
            icons.iconOpacity(
                Expression.interpolate(
                    Expression.linear(),
                    Expression.zoom(),
                    Expression.literal(16.0), Expression.literal(0.0),
                    Expression.literal(17.5), Expression.literal(0.6),
                    Expression.literal(18.5), Expression.literal(1.0)
                )
            )

            // 2. УПРАВЛЯЕМ ПЛОТНОСТЬЮ (Padding) - заменяет фильтр 500м
            // На зуме 17.5 ставим гигантский отступ в 150 пикселей.
            // Из-за этого иконки, которые "толпятся", будут скрывать друг друга.
            // На зуме 18.5 уменьшаем отступ до 10, чтобы показать всё.
            icons.iconPadding(
                Expression.interpolate(
                    Expression.linear(),
                    Expression.zoom(),
                    Expression.literal(16.0), Expression.literal(300.0), // Почти всё скрыто
                    Expression.literal(17.5), Expression.literal(100.0), // Редкие иконки
                    Expression.literal(18.5), Expression.literal(10.0)   // Плотная застройка
                )
            )

            // 3. УПРАВЛЯЕМ РАЗМЕРОМ (Чтобы вдалеке они были чуть меньше)
            icons.iconSize(
                Expression.interpolate(
                    Expression.linear(),
                    Expression.zoom(),
                    Expression.literal(16.0), Expression.literal(0.0),
                    Expression.literal(17.5), Expression.literal(0.5),
                    Expression.literal(18.5), Expression.literal(0.8)
                )
            )

            // при зуме меньше 17 скроет иконку
            icons.minZoom(17.0)

            // Приоритет: чем больше число, тем скорее иконка скроется при конфликте
            icons.symbolSortKey(10.0)

            // Плавное появление/исчезновение при движении
            icons.iconOpacityTransition(
                StyleTransition.Builder()
                    .duration(300L)
                    .delay(0L)
                    .build()
            )

            // Фильтр: только те объекты парковки, у которых есть иконка (наши центры)
            icons.filter(Expression.all(
                Expression.eq(Expression.get("type"), Expression.literal("parking")),
                Expression.has("icon")
            ))
            style.addLayer(icons) // В самый верх
        }
    }



    // 3. Слои событий со стрелкой
    private fun setupIconsAndEvents(style: Style) {
        val sourceId = "events-src"
        // Создаем источник, если он еще не создан
        if (style.getSource(sourceId) == null) {
            val geoJsonSource = GeoJsonSource.Builder(sourceId).build()
            style.addSource(geoJsonSource)
        }

        // Загрузка иконок
        val icons = listOf(
            "icon_cam_default", "icon_traffic_light", "icon_bump",
            "icon_stop_sign", "icon_give_way", "icon_barrier", "icon_railway",
            "icon_park_private", "icon_park_permit", "icon_park_public",
            "icon_limit_20", "icon_limit_40", "icon_limit_60", "icon_limit_80",
            "icon_limit_90", "icon_limit_100", "icon_limit_110", "icon_limit_130"
        )
        icons.forEach { name ->
            val id = name.replace("icon_", "")
            // Проверяем, не добавлена ли уже картинка, чтобы не делать лишнюю работу
            if (style.getStyleImage(id) == null) {
                val resId = resources.getIdentifier(name, "drawable", context.packageName)
                if (resId != 0) {
                    ContextCompat.getDrawable(context, resId)?.let {
                        style.addImage(id, drawableToBitmap(it))
                    }
                }
            }
        }

        // Генерируем и добавляем нашу SDF стрелку
        val arrowImageId = "generated-arrow-sdf"
        if (style.getStyleImage(arrowImageId) == null) {
            val arrowBitmap = createArrowBitmap(context)
            // ВАЖНО: третий параметр true включает SDF режим!
            style.addImage(arrowImageId, arrowBitmap, true)
        }

        sourceId.setupParkingLayers(style)

        // --- ФУНКЦИЯ-ПОМОЩНИК ДЛЯ СОЗДАНИЯ СЛОЕВ СТРЕЛОК ---
        fun addArrowLayer(id: String, isCamera: Boolean, offset: Double, color: String, haloColor: String) {
            if (style.getLayer(id) == null) {
                val layer = SymbolLayer(id, sourceId)
                layer.iconImage(arrowImageId)
                layer.iconSize(0.6)
                layer.iconColor(color)
                layer.iconHaloColor(haloColor)
                layer.iconHaloWidth(1.5)
                layer.iconHaloBlur(0.8)

                // Статичное смещение (список Double) - так не крашится
                layer.iconOffset(listOf(0.0, offset))

                layer.iconAnchor(IconAnchor.TOP)
                layer.iconAllowOverlap(true)
                layer.iconIgnorePlacement(true)
                layer.iconRotationAlignment(IconRotationAlignment.MAP)
                layer.iconRotate(Expression.get("bearing"))

                if (isCamera) {
                    // Приоритет: чем больше число, тем скорее иконка скроется при конфликте
                    layer.symbolSortKey(1.0)
                } else {
                    layer.symbolSortKey(5.0)
                }

                // Фильтр: наличие bearing, bearing != 0 И проверка на тип (камера или нет)
                val typeCondition = if (isCamera) {
                    Expression.eq(Expression.get("is_camera"), Expression.literal(true))
                } else {
                    // Либо false, либо отсутствует
                    Expression.any(
                        Expression.eq(Expression.get("is_camera"), Expression.literal(false)),
                        Expression.not(Expression.has("is_camera"))
                    )
                }

                layer.filter(
                    Expression.all(
                        Expression.neq(Expression.get("type"), Expression.literal("parking")),
                        Expression.has("bearing"),
                        Expression.neq(Expression.get("bearing"), Expression.literal(0.0)),
                        typeCondition
                    )
                )
                style.addLayer(layer)
            }
        }

        // 2. Создаем два слоя стрелок с разными настройками
        // Слой для КАМЕР (Маджента, смещение 17)
        addArrowLayer("arrow-cam", true, 17.0, "#E15FED", "#FFFFFF")
        // Слой для ОСТАЛЬНОГО (Белый, смещение 10)
        addArrowLayer("arrow-other", false, 10.0, "#FFFFFF", "#FF0000")

        // --- СЛОЙ 2: Основная иконка (Рисуем ВТОРОЙ, чтобы была сверху) ---
        if (style.getLayer("events-icon-layer") == null) {
            val mainIconLayer = SymbolLayer("events-icon-layer", sourceId)
            mainIconLayer.iconImage(Expression.get("icon"))

            // Если is_camera == true, размер 1.0, иначе 0.5
            mainIconLayer.iconSize(
                Expression.switchCase(
                    Expression.get("is_camera"), // Условие
                    Expression.literal(1.0),    // Значение, если true
                    Expression.literal(0.5)     // Значение, если false (fallback)
                )
            )

            // ВАЖНО: Тоже разрешаем перекрытие, иначе наличие стрелки под низом может скрыть эту иконку
            mainIconLayer.iconAllowOverlap(true)
            mainIconLayer.iconIgnorePlacement(true) // Опционально: true, если иконки камер важнее названий улиц

            mainIconLayer.iconPadding(2.0)

            // VIEWPORT - чтобы иконка всегда стояла вертикально относительно экрана
            mainIconLayer.iconRotationAlignment(IconRotationAlignment.VIEWPORT)

            // Позиционируем основную иконку чуть выше центра, чтобы стрелка была под ней
            mainIconLayer.iconAnchor(IconAnchor.BOTTOM) // Цепляем за "ножку" иконки

            mainIconLayer.filter(
                Expression.neq(Expression.get("type"), Expression.literal("parking"))
            )

            style.addLayer(mainIconLayer)
        }
    }

    // 4. Настройка "Живого маркера"
    private fun setupLocationComponent() {
        val locationPlugin = mapView?.location ?: return

        locationPlugin.updateSettings {
            enabled = true
            pulsingEnabled = true // Легкая пульсация
            pulsingColor = "#FF8800".toColorInt() // оранжевый цвет
            pulsingMaxRadius = 50.0f

            // Настраиваем Puck (шайбу)
            // withBearing = true включает стрелку направления
            locationPuck = createDefault2DPuck(withBearing = true)

            // Включаем вращение шайбы по курсу (heading)
            puckBearingEnabled = true
            puckBearing = PuckBearing.HEADING
        }

        locationPlugin.setLocationProvider(manualLocationProvider)
    }

    // Метод обновления позиции маркера (вызывается через Command)
    fun updateUserLocation(lat: Double, lon: Double, bearing: Double) {
        val point = Point.fromLngLat(lon, lat)
        for (consumer in manualLocationProvider.consumers) {
            consumer.onLocationUpdated(point)
            consumer.onBearingUpdated(bearing)
        }
    }

    fun moveCamera(lat: Double, lon: Double, zoom: Double, pitch: Double, heading: Double, duration: Long) {
        // Создаем Point
        val point = Point.fromLngLat(lon, lat)

        // Настройки камеры
        val camOptions = CameraOptions.Builder()
            .center(point)
            .zoom(zoom)
            .pitch(pitch)
            .bearing(heading)
            .build()

        // Настройки анимации
        // linear = true делает движение равномерным, без ускорений/замедлений в начале/конце
        val animOptions = MapAnimationOptions.Builder()
            .duration(duration)
            .build()

        // easeTo - лучше всего подходит для слежения (flyTo может "укачивать")
        mapView?.mapboxMap?.easeTo(camOptions, animOptions)
    }


    fun updateCamera(data: ReadableMap) {
        if (mapView == null) { pendingCamera = data; return }

        val center = data.getArray("center") ?: return
        val point = Point.fromLngLat(center.getDouble(0), center.getDouble(1))

        // Используем более быстрый Ease или Linear для частых обновлений,
        // но здесь FlyTo ок, так как React вызывает его только при смене режима
        val camOptions = CameraOptions.Builder()
            .center(point)
            .zoom(if (data.hasKey("zoom")) data.getDouble("zoom") else 15.0)
            .pitch(if (data.hasKey("pitch")) data.getDouble("pitch") else 0.0)
            .bearing(if (data.hasKey("heading")) data.getDouble("heading") else 0.0)
            .build()

        // Важно: если мы в режиме навигации, длительность анимации должна быть быстрой
        val animOptions = MapAnimationOptions.Builder().duration(400).build()
        mapView?.mapboxMap?.flyTo(camOptions, animOptions)
    }

    fun updateEvents(json: String?) {
        if (!isMapReady || json == null) return
        mapView?.mapboxMap?.getStyle { style ->
            val source = style.getSourceAs<GeoJsonSource>("events-src")
            source?.data(json)
        }
    }

    private fun drawableToBitmap(drawable: Drawable): Bitmap {
        if (drawable is BitmapDrawable) return drawable.bitmap
        val bitmap = createBitmap(drawable.intrinsicWidth, drawable.intrinsicHeight)
        val canvas = Canvas(bitmap)
        drawable.setBounds(0, 0, canvas.width, canvas.height)
        drawable.draw(canvas)
        return bitmap
    }

    fun onStart() = mapView?.onStart()
    fun onStop() = mapView?.onStop()
    fun onDestroy() = mapView?.onDestroy()
}