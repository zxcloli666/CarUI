/**
 * Animated Weather Icon System
 *
 * ARCHITECTURE:
 * - Uses SVG icons (Lucide) wrapped in Reanimated views.
 * - Logic: Maps WMO codes to visual metaphors.
 * - Performance: Animations run 100% on the UI thread (worklet).
 */

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import {
  Sun, Moon, Cloud, CloudRain, CloudSnow, CloudFog,
  CloudDrizzle, CloudLightning, CloudSun, CloudMoon,
  Snowflake, Wind, Thermometer, AlertTriangle, Droplets
} from 'lucide-react-native';
import { BASE_COLORS } from '../../theme/constants';
import { WMOCode } from '../../types/weather';

interface WeatherIconProps {
  code: WMOCode;
  isDay?: boolean;
  size?: number;
  animated?: boolean;
  color?: string; // Optional override
}

// --- COLOR LOGIC ---
function getWeatherColor(code: WMOCode, isDay: boolean): string {
  if (code <= 1) return isDay ? '#FFD60A' : '#F2F2F7'; // Clear: Golden Sun / White Moon
  if (code === 2) return isDay ? '#FFD60A' : '#F2F2F7'; // Partly Cloudy
  if (code === 3) return '#AEB5C0'; // Overcast: Grey
  if (code === 45 || code === 48) return '#BF5AF2'; // Fog: Purple (High contrast in fog)
  if (code >= 51 && code <= 67) return '#64D2FF'; // Rain: Cyan/Blue
  if (code >= 71 && code <= 77) return '#FFFFFF'; // Snow: White
  if (code >= 80 && code <= 86) return '#64D2FF'; // Showers
  if (code >= 95) return '#FFD60A'; // Storm: Yellow/Orange Lightning
  return BASE_COLORS.text.secondary;
}

export function WeatherIcon({ code, isDay = true, size = 48, animated = true, color }: WeatherIconProps) {
  const iconColor = color || getWeatherColor(code, isDay);

  // Animation Shared Values
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!animated) return;

    // Reset animations
    cancelAnimation(rotation);
    cancelAnimation(scale);
    cancelAnimation(translateY);
    cancelAnimation(opacity);

    // 1. Sun/Moon Rotation (Slow, ambient)
    if (code <= 1 && isDay) {
      rotation.value = withRepeat(
          withTiming(360, { duration: 40000, easing: Easing.linear }),
          -1,
          false
      );
    }

    // 2. Cloud Pulse (Breathing effect)
    if (code >= 2 && code <= 3) {
      scale.value = withRepeat(
          withSequence(
              withTiming(1.05, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
              withTiming(1.0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
      );
    }

    // 3. Precipitation (Falling effect)
    if ((code >= 51 && code <= 86)) {
      translateY.value = withRepeat(
          withSequence(
              withTiming(4, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
              withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) })
          ),
          -1,
          true
      );
    }

    // 4. Storm (Flash)
    if (code >= 95) {
      opacity.value = withRepeat(
          withSequence(
              withTiming(0.4, { duration: 100 }),
              withTiming(1, { duration: 50 }),
              withTiming(1, { duration: 3000 })
          ),
          -1,
          false
      );
    }
  }, [code, isDay, animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  const iconProps = { size, color: iconColor, strokeWidth: 2 };

  const renderIcon = () => {
    // Clear
    if (code === 0 || code === 1) return isDay ? <Sun {...iconProps} /> : <Moon {...iconProps} />;

    // Partly Cloudy
    if (code === 2) return isDay ? <CloudSun {...iconProps} /> : <CloudMoon {...iconProps} />;

    // Overcast
    if (code === 3) return <Cloud {...iconProps} />;

    // Fog
    if (code === 45 || code === 48) return <CloudFog {...iconProps} />;

    // Drizzle / Rain
    if (code >= 51 && code <= 67) return <CloudRain {...iconProps} />;

    // Snow
    if (code >= 71 && code <= 77) return <CloudSnow {...iconProps} />;

    // Showers
    if (code >= 80 && code <= 86) return <CloudRain {...iconProps} />;

    // Storm
    if (code >= 95) return <CloudLightning {...iconProps} />;

    return <Cloud {...iconProps} />;
  };

  return (
      <Animated.View style={[styles.container, { width: size, height: size }, animatedStyle]}>
        {renderIcon()}
        {/* Overlay for Ice/Freezing Rain */}
        {(code === 56 || code === 57 || code === 66 || code === 67) && (
            <View style={styles.overlay}>
              <Snowflake size={size * 0.4} color={BASE_COLORS.weather.ice} strokeWidth={2.5} />
            </View>
        )}
      </Animated.View>
  );
}

export function WeatherIconSmall({ code, isDay = true }: { code: WMOCode; isDay?: boolean }) {
  return <WeatherIcon code={code} isDay={isDay} size={24} animated={false} />;
}

// Icon mapper for Dashboard Alerts
export function AlertIcon({ type, size = 24, color }: { type: string; size?: number; color?: string }) {
  const props = { size, color: color || BASE_COLORS.text.primary, strokeWidth: 2 };

  switch (type) {
    case 'ice':
    case 'snowflake': return <Snowflake {...props} />;
    case 'fog':
    case 'cloud-fog': return <CloudFog {...props} />;
    case 'wind': return <Wind {...props} />;
    case 'rain':
    case 'cloud-rain': return <CloudRain {...props} />;
    case 'snow':
    case 'cloud-snow': return <CloudSnow {...props} />;
    case 'storm':
    case 'cloud-lightning': return <CloudLightning {...props} />;
    case 'heat':
    case 'thermometer': return <Thermometer {...props} />;
    case 'droplets': return <Droplets {...props} />;
    case 'eye-off': return <AlertTriangle {...props} />; // Using generic alert for eye-off if icon missing
    default: return <AlertTriangle {...props} />;
  }
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    padding: 1,
  },
});