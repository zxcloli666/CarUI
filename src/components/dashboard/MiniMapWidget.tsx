import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Navigation as NavIcon } from 'lucide-react-native';
import distance from '@turf/distance';
import { useCarStore, useUiStore } from '../../app/store';
import { useAccentColor } from '../../hooks/useTheme';
import { GeoService } from '../../services/GeoService';
import { MAPBOX_TOKEN } from '../../services/config';
import { BASE_COLORS, FONT_SIZE, SPACING, RADIUS, scale } from '../../theme/constants';
import { NativeMiniMap } from '../../services/native/NativeMiniMap';

// --- CONFIGURATION ---
const OVERPASS_API = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';

const CAM_MODES = {
    PARKING: {
        maxSpeed: 20,
        zoom: 18.5, // Очень близко, чтобы видеть парковку
        pitch: 50   // Умеренный наклон
    },
    CITY: {
        maxSpeed: 80,
        zoom: 17.5, // Идеально для 3D зданий
        pitch: 62   // Сильный наклон, видно горизонт и фасады
    },
    HIGHWAY: {
        zoom: 16.0, // Чуть дальше, чтобы видеть дорогу впереди
        pitch: 60   // Все еще наклон
    }
};

// --- HELPERS ---
const fetchRoadEvents = async (lat: number, lon: number) => {
    // Используем out geom, чтобы получить координаты для полигонов (парковки)
    const query = `
    [out:json][timeout:15];
    (
      // --- ТОЧКИ ---
      // Камеры (скорость и контроль)
      node["highway"="speed_camera"](around:5000, ${lat}, ${lon});
      node["man_made"="surveillance"]["surveillance:type"~"speed_camera|lane|red_light"](around:5000, ${lat}, ${lon});
      
      // Знаки и препятствия
      node["highway"~"^(stop|give_way|traffic_signals)$"](around:4000, ${lat}, ${lon});
      node["barrier"~"^(bollard)$"](around:4000, ${lat}, ${lon});
      node["traffic_calming"](around:4000, ${lat}, ${lon});
      node["railway"="level_crossing"](around:4000, ${lat}, ${lon});

      // --- ПОЛИГОНЫ ---
      // Парковки (ways и relations)
      way["amenity"="parking"](around:4000, ${lat}, ${lon});
      relation["amenity"="parking"](around:4000, ${lat}, ${lon});
    );
    out geom;
  `;

    try {
        const res = await fetch(OVERPASS_API, {
            method: 'POST',
            body: query
        });
        const data = await res.json();
        if (!data.elements) return null;

        const features = data.elements.map((el: any) => {
            const tags = el.tags || {};

            // 1. Обработка ПАРКОВОК (Polygon)
            if (el.type === 'way' && tags.amenity === 'parking' && el.geometry) {
                // Преобразуем массив объектов {lat, lon} в массив массивов [lon, lat]
                const coords = el.geometry.map((p: any) => [p.lon, p.lat]);
                // GeoJSON Polygon требует, чтобы первая и последняя точка совпадали.
                // Обычно Overpass это делает, но для надежности можно не проверять, Mapbox умный.

                let centerLon, centerLat;
                if (el.center) {
                    centerLon = el.center.lon;
                    centerLat = el.center.lat;
                } else if (el.bounds) {
                    centerLon = (el.bounds.minlon + el.bounds.maxlon) / 2;
                    centerLat = (el.bounds.minlat + el.bounds.maxlat) / 2;
                } else {
                    centerLon = coords[0][0];
                    centerLat = coords[0][1];
                }

                let group = 'public'; // по умолчанию
                let icon = 'park_public';

                const access = tags.access || 'yes';

                if (access === 'private' || access === 'customers') {
                    group = 'private';
                    icon = 'park_private';
                } else if (access === 'permit') {
                    group = 'permit';
                    icon = 'park_permit';
                } else {
                    // public, yes, unknown, other
                    group = 'public';
                    icon = 'park_public';
                }

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Polygon',
                        coordinates: [coords] // Внимание: массив массивов массивов
                    },
                    properties: {
                        type: 'parking',
                        parking_group: group,
                        icon: icon,
                        center_point: [centerLon, centerLat]
                    }
                };
            }

            // 2. Обработка ТОЧЕК (Point)
            if (el.type === 'node') {
                let iconKey = 'cam_default'; // фолбек
                let isCamera = false;

                // Логика выбора иконки
                if (tags.highway === 'traffic_signals') iconKey = 'traffic_light';
                else if (tags.traffic_calming) iconKey = 'bump';
                else if (tags.highway === 'stop') iconKey = 'stop_sign';
                else if (tags.highway === 'give_way') iconKey = 'give_way';
                else if (tags.barrier) iconKey = 'barrier';
                else if (tags.railway === 'level_crossing') iconKey = 'railway';
                else if (tags.highway === 'speed_camera' || tags.man_made === 'surveillance') {
                    isCamera = true;
                    const speed = tags.maxspeed ? parseInt(tags.maxspeed, 10) : null;
                    iconKey = speed ? `limit_${speed}` : 'cam_default';
                }

                // Логика направления (Direction)
                let bearing = 0;
                if (tags.direction) {
                    // Пытаемся распарсить число
                    const deg = parseInt(tags.direction, 10);
                    // Если число валидное и не 0 (и не NaN)
                    if (!isNaN(deg) && deg !== 0) {
                        bearing = deg;
                    }
                    // Если там "forward"/"backward", bearing остается null, стрелка не рисуется
                }

                return {
                    type: 'Feature',
                    geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
                    properties: {
                        type: 'point', // метка типа
                        icon: iconKey,
                        bearing: bearing ?? 0,
                        is_camera: isCamera
                    }
                };
            }
            return null;
        }).filter((f: any) => f !== null); // Убираем пустые (например, relations без геометрии)

        return {
            type: 'FeatureCollection',
            features: features
        };
    } catch (e) {
        console.error(e);
        return null;
    }
};

// --- COMPONENT: MAP CONTROLLER (LOGIC ONLY) ---
// Вынесли логику обновлений сюда, чтобы не перегружать основной компонент
const MapController = React.memo(({ mapRef }: { mapRef: any }) => {
    const lastFetchRef = useRef<{lat: number, lon: number} | null>(null);
    const lastUpdateRef = useRef<number>(0);
    const avgIntervalRef = useRef<number>(500);

    useEffect(() => {
        return useCarStore.subscribe((state) => {
            if (!state.position) return;
            const { lat, lon, bearing, speed_kmh } = state.position;

            // 1. РАСЧЕТ УМНОГО DURATION (Плавность движения)
            const now = Date.now();
            const rawInterval = now - lastUpdateRef.current;
            lastUpdateRef.current = now;

            if (rawInterval > 2000) {
                avgIntervalRef.current = 500;
            } else {
                avgIntervalRef.current = (avgIntervalRef.current * 0.8) + (rawInterval * 0.2);
            }

            // Duration чуть больше интервала для эффекта плавного преследования
            const smartDuration = Math.max(200, Math.min(avgIntervalRef.current * 1.2, 1500));

            // 2. РЕЖИМЫ КАМЕРЫ (Zoom/Pitch от скорости)
            let mode = CAM_MODES.HIGHWAY;
            if (speed_kmh <= CAM_MODES.PARKING.maxSpeed) mode = CAM_MODES.PARKING;
            else if (speed_kmh <= CAM_MODES.CITY.maxSpeed) mode = CAM_MODES.CITY;

            // Прямое управление нативным модулем без ререндера React
            if (mapRef.current) {
                mapRef.current.updateUserLocation(lat, lon, bearing);
                mapRef.current.moveCamera(lat, lon, mode.zoom, mode.pitch, bearing, Math.round(smartDuration));
            }

            // 3. ПОДГРУЗКА СОБЫТИЙ (Каждые 2км)
            const prev = lastFetchRef.current;
            if (!prev || distance([prev.lon, prev.lat], [lon, lat], { units: 'kilometers' }) > 2) {
                lastFetchRef.current = { lat, lon };
                fetchRoadEvents(lat, lon).then(geo => {
                    if (geo && mapRef.current) {
                        mapRef.current.setNativeProps({
                            eventsJson: JSON.stringify(geo)
                        });
                    }
                });
            }
        });
    }, [mapRef]);

    return null;
});

// --- COMPONENT: INFO OVERLAY (UI) ---
const InfoOverlay = React.memo(() => {
    const accent = useAccentColor();
    const [info, setInfo] = useState({ lat: 0, lon: 0, speed: 0 });
    const [locationName, setLocationName] = useState(() => GeoService.getCached()?.displayName || '...');

    useEffect(() => {
        // Подписка только на нужные данные для UI
        const updateInfo = (pos: { lat: number; lon: number; speed_kmh: number }) => {
            const next = {
                lat: pos.lat,
                lon: pos.lon,
                speed: Math.round(pos.speed_kmh),
            };
            setInfo((prev) => (
                prev.lat === next.lat && prev.lon === next.lon && prev.speed === next.speed ? prev : next
            ));
        };

        const initial = useCarStore.getState().position;
        if (initial) updateInfo(initial);

        return useCarStore.subscribe((s) => {
            if (s.position) updateInfo(s.position);
        });
    }, []);

    useEffect(() => {
        if (!info.lat || !info.lon) return;
        let active = true;
        // Реверс геокодинг
        GeoService.reverseGeocode(info.lat, info.lon).then((res) => {
            if (!active || !res) return;
            setLocationName((prev) => (prev === res.displayName ? prev : res.displayName));
        });
        return () => { active = false; };
    }, [info.lat, info.lon]);

    return (
        <View style={styles.locationCard}>
            <View style={styles.locationRow}>
                <View style={[styles.locationIcon, { backgroundColor: accent.primary + '20', borderColor: accent.primary + '55' }]}>
                    <MapPin size={14} color={accent.primary} />
                </View>
                <Text style={styles.locationName} numberOfLines={1} ellipsizeMode="tail">
                    {locationName || '...'}
                </Text>
            </View>
            <Text style={styles.coordText} numberOfLines={1}>
                {info.lat ? `${info.lat.toFixed(4)}, ${info.lon.toFixed(4)}` : 'GPS...'}
            </Text>
        </View>
    );
});

// --- COMPONENT: NAVIGATION HINT (UI) ---
const NavigationHint = React.memo(() => (
    <View style={styles.bottomHint}>
        <View style={styles.hintPill}>
            <NavIcon size={12} color={BASE_COLORS.text.inverse} />
            <Text style={styles.hintText} numberOfLines={1} adjustsFontSizeToFit={true}>
                OPEN NAVIGATION
            </Text>
        </View>
    </View>
));

// --- ROOT WIDGET ---
export const MiniMapWidget = React.memo(() => {
    const openNavigation = useUiStore((s) => s.openNavigation);
    const mapRef = useRef<any>(null);

    // Вычисляем начальную камеру один раз при создании компонента
    const initialCamera = useMemo(() => {
        const pos = useCarStore.getState().position;

        const lat = pos?.lat ?? 0;
        const lon = pos?.lon ?? 0;
        const bearing = pos?.bearing ?? 0;
        const speed = pos?.speed_kmh ?? 0;

        let mode = CAM_MODES.HIGHWAY;
        if (speed <= CAM_MODES.PARKING.maxSpeed) mode = CAM_MODES.PARKING;
        else if (speed <= CAM_MODES.CITY.maxSpeed) mode = CAM_MODES.CITY;

        return {
            center: [lon, lat] as [number, number],
            zoom: mode.zoom,
            pitch: mode.pitch,
            heading: bearing
        };
    }, []); // Пустой массив зависимостей гарантирует "получить один раз"

    return (
        <View style={styles.containerWrapper}>
            <TouchableOpacity
                style={styles.container}
                onPress={openNavigation}
                activeOpacity={0.95}
            >
                {/* Native Map */}
                <NativeMiniMap
                    ref={mapRef}
                    style={{ flex: 1 }}
                    accessToken={MAPBOX_TOKEN}
                    camera={initialCamera}
                    eventsJson='{"type":"FeatureCollection","features":[]}'
                />

                {/* Logic Controller (No UI) */}
                <MapController mapRef={mapRef} />

                {/* Visual Overlay Effects */}
                <View style={styles.glassReflections} pointerEvents="none" />

                {/* UI Overlays */}
                <InfoOverlay />
                <NavigationHint />

            </TouchableOpacity>
        </View>
    );
});

const styles = StyleSheet.create({
    containerWrapper: {
        shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
    },
    container: {
        width: '100%', aspectRatio: 1.5, backgroundColor: '#0F0F12', borderRadius: RADIUS.lg,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', overflow: 'hidden',
    },
    glassReflections: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255,255,255,0.02)',
        zIndex: 1,
    },

    // Info Overlay Styles
    locationCard: {
        position: 'absolute',
        top: SPACING.md,
        left: SPACING.md,
        maxWidth: '80%',
        paddingVertical: SPACING.sm,
        paddingHorizontal: SPACING.md,
        backgroundColor: 'rgba(16, 16, 20, 0.78)',
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
        zIndex: 2,
    },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    locationIcon: {
        width: scale(26),
        height: scale(26),
        borderRadius: scale(13),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
    },
    locationName: {
        flexShrink: 1,
        color: BASE_COLORS.text.primary,
        fontSize: FONT_SIZE.sm,
        fontWeight: '700',
        letterSpacing: 0.4,
    },
    coordText: {
        marginTop: SPACING.xs,
        color: BASE_COLORS.text.secondary,
        fontSize: FONT_SIZE.lg,
        fontFamily: 'SFPro-Medium',
        fontVariant: ['tabular-nums'],
        includeFontPadding: false,
    },

    // Navigation Hint Styles
    bottomHint: { position: 'absolute', bottom: SPACING.md, left: 0, right: 0, alignItems: 'center', zIndex: 2 },
    hintPill: {
        flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: BASE_COLORS.text.primary,
        paddingVertical: 6, paddingHorizontal: 14, borderRadius: 100, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8,
    },
    hintText: {
        color: BASE_COLORS.text.inverse,
        fontSize: FONT_SIZE.xs,
        fontWeight: '700',
        letterSpacing: 0.6,
        includeFontPadding: false,
        flexShrink: 0,
    },
});