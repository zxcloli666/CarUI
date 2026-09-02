import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Cloud,
  CloudRain,
  CloudSnow,
  CloudFog,
  Sun,
  CloudLightning,
  Snowflake,
  CloudDrizzle,
  Moon,
} from 'lucide-react-native';
import { BASE_COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, ICON_SIZE } from '../../theme/constants';
import { useCarStore, useUiStore } from '../../app/store';
import { GlassCard } from '../common';
import { WMOCode } from '../../types/weather';

// Get weather icon based on WMO code
function getWeatherIcon(code: WMOCode, isDay: boolean, size: number) {
  const props = { size, strokeWidth: 1.5 };

  // Clear
  if (code <= 1) {
    return isDay
      ? <Sun {...props} color={BASE_COLORS.weather.clear} />
      : <Moon {...props} color="#8B9DC3" />;
  }
  // Partly cloudy
  if (code === 2) {
    return isDay
      ? <Sun {...props} color={BASE_COLORS.weather.clear} />
      : <Moon {...props} color="#8B9DC3" />;
  }
  // Overcast
  if (code === 3) return <Cloud {...props} color={BASE_COLORS.weather.cloudy} />;
  // Fog
  if (code === 45 || code === 48) return <CloudFog {...props} color={BASE_COLORS.weather.fog} />;
  // Drizzle
  if (code >= 51 && code <= 55) return <CloudDrizzle {...props} color={BASE_COLORS.weather.rain} />;
  // Freezing drizzle
  if (code >= 56 && code <= 57) return <Snowflake {...props} color={BASE_COLORS.weather.ice} />;
  // Rain
  if (code >= 61 && code <= 65) return <CloudRain {...props} color={BASE_COLORS.weather.rain} />;
  // Freezing rain
  if (code >= 66 && code <= 67) return <Snowflake {...props} color={BASE_COLORS.weather.ice} />;
  // Snow
  if (code >= 71 && code <= 77) return <CloudSnow {...props} color={BASE_COLORS.weather.snow} />;
  // Rain showers
  if (code >= 80 && code <= 82) return <CloudRain {...props} color={BASE_COLORS.weather.rain} />;
  // Snow showers
  if (code >= 85 && code <= 86) return <CloudSnow {...props} color={BASE_COLORS.weather.snow} />;
  // Thunderstorm
  if (code >= 95) return <CloudLightning {...props} color={BASE_COLORS.weather.storm} />;

  return <Cloud {...props} color={BASE_COLORS.text.tertiary} />;
}

export const WeatherWidget = React.memo(() => {
  const openWeather = useUiStore((s) => s.openWeather);
  const weather = useCarStore((s) => s.weather);

  if (!weather) {
    return (
      <TouchableOpacity onPress={openWeather} activeOpacity={0.8}>
        <GlassCard style={styles.container}>
          <Cloud size={ICON_SIZE.lg} color={BASE_COLORS.text.tertiary} />
          <Text style={styles.noData}>Нет данных</Text>
        </GlassCard>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity onPress={openWeather} activeOpacity={0.8}>
      <GlassCard style={styles.container}>
        {getWeatherIcon(weather.weatherCode, weather.isDay, ICON_SIZE.xl)}
        <Text style={styles.temperature} numberOfLines={1} adjustsFontSizeToFit={true}>
          {Math.round(weather.temperature)}°C
        </Text>
      </GlassCard>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minWidth: 100,
  },
  temperature: {
    fontSize: FONT_SIZE.h2,
    fontWeight: FONT_WEIGHT.bold,
    color: BASE_COLORS.text.primary,
    marginTop: SPACING.xs,
  },
  noData: {
    fontSize: FONT_SIZE.sm,
    color: BASE_COLORS.text.tertiary,
    marginTop: SPACING.xs,
  },
});
