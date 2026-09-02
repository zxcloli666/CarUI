/**
 * Weather Service (Production Grade)
 *
 * Responsibilities:
 * 1. Data Fetching (OpenMeteo)
 * 2. Caching Strategy (Time & Distance based)
 * 3. Data Transformation & Business Logic (Road Conditions)
 *
 * SAFETY CRITICAL:
 * - This service powers the driver alerts.
 * - getRoadCondition() is the Single Source of Truth for HMI warnings.
 */

import { useCarStore } from '../app/store';
import type {
  CurrentWeather,
  DailyForecast,
  DriverAlert,
  HourlyForecast,
  OpenMeteoResponse,
  WeatherData,
  WMOCode,
} from '../types/weather';

// --- CONFIGURATION ---
const API_BASE = 'https://api.open-meteo.com/v1/forecast';
// Aggressive caching for driver context
const CACHE_TIME_MS = 20 * 60 * 1000; // 20 minutes
const CACHE_DIST_KM = 5; // 5 km radius

// --- TYPES ---

export type RoadStatusLevel = 'ideal' | 'good' | 'wet' | 'warning' | 'danger';

export interface RoadStatus {
  level: RoadStatusLevel;
  title: string;
  subtitle: string;
  color: string;
  icon: string; // Lucide icon name
  audioKey: string | null;
  ttsText: string | null;
  severity: 'info' | 'warning' | 'danger';
}

// --- STATE MANAGEMENT (Module Level) ---
// Using module variables to persist cache outside React lifecycle
const cache = {
  weather: {
    time: 0,
    coords: { lat: 0, lon: 0 },
    data: null as WeatherData | null,
    promise: null as Promise<WeatherData> | null,
  },
};

/**
 * Haversine formula for distance calculation
 */
export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// =============================================================================
// API ACTIONS
// =============================================================================

/**
 * Fetches weather data with caching strategy.
 * Updates the global zustand store automatically.
 */
export async function fetchWeather(
    latitude: number,
    longitude: number,
    forceRefresh = false
): Promise<WeatherData> {
  if (!latitude || !longitude) throw new Error('Invalid coordinates');

  const now = Date.now();
  const dist = getDistanceKm(latitude, longitude, cache.weather.coords.lat, cache.weather.coords.lon);
  const isFresh = (now - cache.weather.time < CACHE_TIME_MS);
  const isClose = (dist < CACHE_DIST_KM);

  // Return Cache if valid
  if (!forceRefresh && isFresh && isClose && cache.weather.data) {
    // Sync store just in case
    const storeData = useCarStore.getState().weatherData;
    if (!storeData || storeData.timestamp !== cache.weather.data.timestamp) {
      useCarStore.getState().setWeatherData(cache.weather.data);
      useCarStore.getState().setWeather(cache.weather.data.current);
    }
    return cache.weather.data;
  }

  // Deduplicate in-flight requests
  if (cache.weather.promise) return cache.weather.promise;

  cache.weather.promise = (async () => {
    try {
      // Params optimized for automotive use (Visibility, Gusts, Ice)
      const params = new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        current: [
          'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
          'precipitation', 'rain', 'showers', 'snowfall', 'weather_code', 'cloud_cover',
          'pressure_msl', 'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
        ].join(','),
        hourly: [
          'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation',
          'rain', 'snow_depth', 'weather_code', 'wind_speed_10m', 'wind_gusts_10m', 'relative_humidity_2m',
          'visibility', 'dew_point_2m', 'is_day',
        ].join(','),
        daily: [
          'weather_code', 'temperature_2m_max', 'temperature_2m_min',
          'sunrise', 'sunset', 'uv_index_max',
        ].join(','),
        timezone: 'auto',
        forecast_days: '2', // Reduced for payload size, we only need 24h
      });

      const res = await fetch(`${API_BASE}?${params}`);
      if (!res.ok) throw new Error(`Weather API Error ${res.status}`);

      const rawData = await res.json();
      const parsed = parseWeatherResponse(rawData);

      // Update Cache
      cache.weather.time = Date.now();
      cache.weather.coords = { lat: latitude, lon: longitude };
      cache.weather.data = parsed;

      // Update Store
      useCarStore.getState().setWeatherData(parsed);
      useCarStore.getState().setWeather(parsed.current);

      return parsed;
    } catch (e) {
      console.error('[WeatherService] Fetch error:', e);
      // Return stale data if available, otherwise throw
      if (cache.weather.data) return cache.weather.data;
      throw e;
    } finally {
      cache.weather.promise = null;
    }
  })();

  return cache.weather.promise;
}

/**
 * Reverse Geocoding with throttling and strict error handling.
 */

// =============================================================================
// PARSING & LOGIC
// =============================================================================

function parseWeatherResponse(data: OpenMeteoResponse): WeatherData {
  const c = data.current!;
  const h = data.hourly!;
  const d = data.daily!;

  const current: CurrentWeather = {
    temperature: c.temperature_2m,
    apparentTemperature: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    precipitation: c.precipitation,
    rain: c.rain,
    snowfall: c.snowfall,
    weatherCode: c.weather_code,
    cloudCover: c.cloud_cover,
    pressureMsl: c.pressure_msl,
    surfacePressure: c.surface_pressure || 0,
    windSpeed: c.wind_speed_10m,
    windDirection: c.wind_direction_10m,
    windGusts: c.wind_gusts_10m,
    isDay: c.is_day === 1,
    time: c.time,
  };

  // ROBUST TIME MATCHING
  // OpenMeteo hourly array starts at 00:00 local time of the requested day.
  // c.time is e.g. "2026-01-10T17:15"
  // We need to find the index that matches the current hour.
  const currentHourIso = c.time.split(':')[0]; // "2026-01-10T17"
  let startIndex = h.time.findIndex((t: string) => t.startsWith(currentHourIso));

  // Fallback if loose matching fails (e.g. day boundary issues)
  if (startIndex === -1) {
    // Attempt to match just by hour integer if date alignment is tricky
    // But OpenMeteo is usually consistent. Default to 0 as fail-safe.
    startIndex = 0;
  }

  // Create Forecast Array (Next 24h)
  const hourly: HourlyForecast[] = [];
  for (let i = startIndex; i < startIndex + 24; i++) {
    if (!h.time[i]) break; // End of data

    hourly.push({
      time: h.time[i],
      timestamp: 0, // Legacy field
      temperature: h.temperature_2m[i],
      apparentTemperature: h.apparent_temperature[i],
      precipitationProbability: h.precipitation_probability[i],
      precipitation: h.precipitation[i],
      rain: h.rain[i],              // mm
      snowDepth: h.snow_depth[i],   // meters
      weatherCode: h.weather_code[i],
      windSpeed: h.wind_speed_10m[i],
      windGusts: h.wind_gusts_10m[i],
      humidity: h.relative_humidity_2m[i],
      visibility: h.visibility[i],
      dewPoint: h.dew_point_2m[i],
      isDay: h.is_day[i] === 1,

      // Pre-calculated risks for fast UI rendering
      iceRisk: h.temperature_2m[i] <= 3 && (h.precipitation_probability[i] > 20 || h.relative_humidity_2m[i] > 90),
      fogRisk: h.visibility[i] < 1000,
      windDanger: h.wind_gusts_10m[i] > 60,
    });
  }

  const daily: DailyForecast[] = d.time.map((t: string, i: number) => ({
    date: t,
    weatherCode: d.weather_code[i],
    temperatureMax: d.temperature_2m_max[i],
    temperatureMin: d.temperature_2m_min[i],
    apparentTemperatureMax: d.temperature_2m_max[i], // Fallback as OpenMeteo Basic doesn't always provide apparent daily
    apparentTemperatureMin: d.temperature_2m_min[i],
    sunrise: d.sunrise[i],
    sunset: d.sunset[i],
    precipitationSum: 0,
    precipitationProbabilityMax: 0,
    windSpeedMax: 0,
    uvIndexMax: d.uv_index_max[i],
  }));

  return {
    current,
    hourly,
    daily,
    latitude: data.latitude,
    longitude: data.longitude,
    timezone: data.timezone,
    utcOffsetSeconds: data.utc_offset_seconds,
    elevation: data.elevation,
    timestamp: Date.now(),
  };
}

// =============================================================================
// FORMATTING HELPERS
// =============================================================================

export function formatTemperature(temp: number, showUnit = true): string {
  if (temp === undefined || temp === null) return '--';
  const t = Math.round(temp);
  return showUnit ? `${t > 0 ? '+' : ''}${t}°` : `${t}`;
}

export function formatTime(isoString: string): string {
  if (!isoString) return '--:--';
  // "2026-01-10T17:00" -> "17:00"
  return isoString.split('T')[1]?.substring(0, 5) || isoString;
}

export function formatVisibility(meters: number): string {
  if (meters >= 10000) return '10+ км';
  if (meters < 1000) return `${Math.round(meters)} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

export function getVisibilityLevel(meters: number): 'danger' | 'warning' | 'good' | 'excellent' {
  if (meters < 500) return 'danger';
  if (meters < 2000) return 'warning';
  if (meters < 8000) return 'good';
  return 'excellent';
}

const WMO_DESCRIPTIONS: Record<number, string> = {
  0: 'Ясно', 1: 'Преим. ясно', 2: 'Облачно', 3: 'Пасмурно',
  45: 'Туман', 48: 'Изморозь',
  51: 'Морось', 53: 'Морось', 55: 'Сил. морось',
  56: 'Лед. морось', 57: 'Сил. лед. морось',
  61: 'Дождь', 63: 'Умер. дождь', 65: 'Ливень',
  66: 'Лед. дождь', 67: 'Сил. лед. дождь',
  71: 'Снег', 73: 'Снегопад', 75: 'Сил. снег',
  77: 'Снежные зерна',
  80: 'Ливень', 81: 'Сил. ливень', 82: 'Жесткий ливень',
  85: 'Снегопад', 86: 'Сил. снегопад',
  95: 'Гроза', 96: 'Гроза с градом', 99: 'Сильная гроза'
};

export function getWeatherDescription(code: WMOCode): string {
  return WMO_DESCRIPTIONS[code] || 'Неизвестно';
}

// Legacy helpers kept for compatibility
export function formatWindDirection(degrees: number): string {
  const directions = ['С', 'СВ', 'В', 'ЮВ', 'Ю', 'ЮЗ', 'З', 'СЗ'];
  return directions[Math.round(degrees / 45) % 8];
}
export function formatDayName(isoString: string): string {
  const date = new Date(isoString);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  return date.toLocaleDateString('ru-RU', { weekday: 'short' });
}
export function hPaToMmHg(hPa: number): number {
  return Math.round(hPa * 0.750062);
}
export function getVisibilityLabel(meters: number): string {
  if (meters < 500) return 'Опасно';
  if (meters < 2000) return 'Плохая';
  if (meters < 8000) return 'Средняя';
  return 'Отличная';
}

// =============================================================================
// ROAD CONDITION ANALYSIS (Critical Logic)
// =============================================================================

export function getRoadCondition(weather: CurrentWeather, visibility?: number): RoadStatus {
  const { weatherCode, temperature, precipitation, windGusts } = weather;

  // 1. CRITICAL VISIBILITY
  if (visibility !== undefined && visibility < 300) {
    return {
      level: 'danger',
      title: 'НУЛЕВАЯ ВИДИМОСТЬ',
      subtitle: `Видимость ${Math.round(visibility)}м. Предельная осторожность.`,
      color: '#FF453A',
      icon: 'eye-off',
      audioKey: 'low_visibility',
      ttsText: 'Внимание! Нулевая видимость.',
      severity: 'danger'
    };
  }

  // 2. ICE / BLACK ICE
  if (
      weatherCode === 56 || weatherCode === 57 ||
      weatherCode === 66 || weatherCode === 67 ||
      (temperature <= 3 && temperature >= -5 && precipitation > 0)
  ) {
    return {
      level: 'danger',
      title: 'ГОЛОЛЕДИЦА',
      subtitle: 'Экстремально скользко. Увеличьте дистанцию.',
      color: '#FF453A',
      icon: 'snowflake',
      audioKey: 'ice_on_roads',
      ttsText: 'Осторожно, гололёд на дорогах.',
      severity: 'danger'
    };
  }

  // 3. HEAVY SNOW
  if (weatherCode >= 71 && weatherCode <= 77 || weatherCode === 85 || weatherCode === 86) {
    return {
      level: 'danger',
      title: 'СНЕГОПАД',
      subtitle: 'Снежный накат. Возможны заносы.',
      color: '#0A84FF',
      icon: 'cloud-snow',
      audioKey: 'fresh_snow',
      ttsText: 'Сильный снегопад.',
      severity: 'danger'
    };
  }

  // 4. STORM / WIND
  if (windGusts > 80 || weatherCode >= 95) {
    return {
      level: 'warning',
      title: 'ШТОРМ',
      subtitle: `Порывы ${Math.round(windGusts)} км/ч.`,
      color: '#FF9F0A',
      icon: 'wind',
      audioKey: 'thunderstorm',
      ttsText: 'Штормовое предупреждение.',
      severity: 'danger'
    };
  }

  // 5. FOG (Non-critical)
  if ((visibility !== undefined && visibility < 1000) || weatherCode === 45 || weatherCode === 48) {
    return {
      level: 'warning',
      title: 'ТУМАН',
      subtitle: 'Включите противотуманные фары.',
      color: '#BF5AF2',
      icon: 'cloud-fog',
      audioKey: 'low_visibility',
      ttsText: 'Туман. Видимость снижена.',
      severity: 'warning'
    };
  }

  // 6. HEAVY RAIN
  if (precipitation > 2.5 || weatherCode === 65 || weatherCode === 82) {
    return {
      level: 'warning',
      title: 'ЛИВЕНЬ',
      subtitle: 'Риск аквапланирования.',
      color: '#5AC8FA',
      icon: 'cloud-rain',
      audioKey: 'rain',
      ttsText: 'Сильный ливень.',
      severity: 'warning'
    };
  }

  // 7. WET ROAD / MINOR PRECIPITATION
  if (precipitation > 0 || (weatherCode >= 51 && weatherCode <= 63)) {
    return {
      level: 'wet',
      title: 'МОКРАЯ ДОРОГА',
      subtitle: 'Дорога скользкая.',
      color: '#64D2FF',
      icon: 'droplets',
      audioKey: null,
      ttsText: null,
      severity: 'info'
    };
  }

  // 8. HEAT
  if (temperature >= 30) {
    return {
      level: 'warning',
      title: 'ЖАРА',
      subtitle: 'Высокая температура.',
      color: '#FFD60A',
      icon: 'thermometer',
      audioKey: null,
      ttsText: null,
      severity: 'info'
    };
  }

  return {
    level: 'ideal',
    title: 'ХОРОШАЯ ДОРОГА',
    subtitle: 'Условия благоприятные.',
    color: '#30D158',
    icon: 'check-circle',
    audioKey: null,
    ttsText: null,
    severity: 'info'
  };
}

/**
 * Adapter for Dashboard Widgets
 */
export function getDriverAlerts(weather: WeatherData): DriverAlert[] {
  const visibility = weather.hourly[0]?.visibility;
  const status = getRoadCondition(weather.current, visibility);

  if (status.level === 'ideal' || status.level === 'good') {
    return [];
  }

  return [{
    id: 'road-cond-alert',
    type: mapIconToAlertType(status.icon),
    severity: status.severity,
    title: status.title,
    description: status.subtitle,
    icon: status.icon
  }];
}

function mapIconToAlertType(icon: string): any {
  if (icon.includes('snow') || icon.includes('ice')) return 'snow';
  if (icon.includes('rain') || icon.includes('droplet')) return 'rain';
  if (icon.includes('fog') || icon.includes('eye')) return 'fog';
  if (icon.includes('wind')) return 'wind';
  if (icon.includes('thermometer')) return 'heat';
  return 'storm';
}
