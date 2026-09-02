/**
 * Weather Types
 */

export type WMOCode =
    | 0 | 1 | 2 | 3
    | 45 | 48
    | 51 | 53 | 55
    | 56 | 57
    | 61 | 63 | 65
    | 66 | 67
    | 71 | 73 | 75
    | 77
    | 80 | 81 | 82
    | 85 | 86
    | 95
    | 96 | 99;

export type AlertSeverity = 'info' | 'warning' | 'danger';

export interface DriverAlert {
  id: string;
  type: 'ice' | 'fog' | 'wind' | 'rain' | 'snow' | 'storm' | 'heat';
  severity: AlertSeverity;
  title: string;
  description: string;
  icon: string;
}

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitation: number;
  rain: number;
  snowfall: number;
  weatherCode: WMOCode;
  cloudCover: number;
  pressureMsl: number;
  surfacePressure: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number;
  isDay: boolean;
  time: string; // ISO String in Location Timezone
}

export interface HourlyForecast {
  time: string; // ISO String in Location Timezone
  timestamp: number; // UTC Timestamp (ms) for sorting/filtering
  temperature: number;
  apparentTemperature: number;
  precipitationProbability: number;
  precipitation: number;
  rain: number;        // mm
  snowDepth: number;   // meters (глубина снежного покрова)
  weatherCode: WMOCode;
  windSpeed: number;
  windGusts: number;
  humidity: number;
  visibility: number;
  dewPoint: number;
  isDay: boolean;
  // Computed
  iceRisk: boolean;
  fogRisk: boolean;
  windDanger: boolean;
}

export interface DailyForecast {
  date: string;
  weatherCode: WMOCode;
  temperatureMax: number;
  temperatureMin: number;
  apparentTemperatureMax: number;
  apparentTemperatureMin: number;
  sunrise: string;
  sunset: string;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  uvIndexMax: number;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  latitude: number;
  longitude: number;
  timezone: string;
  utcOffsetSeconds: number;
  elevation: number;
  timestamp: number; // Fetch time
}

// API Response Interfaces
export interface OpenMeteoResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  utc_offset_seconds: number;
  elevation: number;
  current?: any;
  hourly?: any;
  daily?: any;
}