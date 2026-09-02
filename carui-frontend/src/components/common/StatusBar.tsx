import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Wifi,
  WifiOff,
  Signal,
  SignalLow,
  SignalMedium,
  SignalHigh,
  SignalZero,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudFog,
  Sun,
  CloudLightning,
  Thermometer,
  Battery,
  BatteryCharging,
  BatteryLow,
  BatteryMedium,
  BatteryFull,
  Settings,
} from 'lucide-react-native';
import { BASE_COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, ICON_SIZE } from '../../theme/constants';
import { useCarStore, useConnectionStore, useUiStore } from '../../app/store';
import { useBattery } from '../../hooks/useBattery';
import { useNetwork } from '../../hooks/useNetwork';
import { WMOCode } from '../../types/weather';

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getWeatherIcon(code: WMOCode, isDay: boolean) {
  const iconProps = { size: ICON_SIZE.md };

  // Clear
  if (code <= 1) return <Sun {...iconProps} color={BASE_COLORS.weather.clear} />;
  // Partly cloudy / Overcast
  if (code <= 3) return <Cloud {...iconProps} color={BASE_COLORS.weather.cloudy} />;
  // Fog
  if (code === 45 || code === 48) return <CloudFog {...iconProps} color={BASE_COLORS.weather.fog} />;
  // Drizzle / Rain
  if (code >= 51 && code <= 67) return <CloudRain {...iconProps} color={BASE_COLORS.weather.rain} />;
  // Snow
  if (code >= 71 && code <= 77) return <CloudSnow {...iconProps} color={BASE_COLORS.weather.snow} />;
  // Rain/snow showers
  if (code >= 80 && code <= 86) return <CloudRain {...iconProps} color={BASE_COLORS.weather.rain} />;
  // Thunderstorm
  if (code >= 95) return <CloudLightning {...iconProps} color={BASE_COLORS.weather.storm} />;

  return <Cloud {...iconProps} color={BASE_COLORS.text.secondary} />;
}

function getBatteryIcon(level: number, isCharging: boolean) {
  const color =
    level <= 20
      ? BASE_COLORS.semantic.danger
      : level <= 50
      ? BASE_COLORS.semantic.warning
      : BASE_COLORS.semantic.success;
  const iconProps = { size: ICON_SIZE.md, color };

  if (isCharging) {
    return <BatteryCharging {...iconProps} />;
  }
  if (level <= 20) {
    return <BatteryLow {...iconProps} />;
  }
  if (level <= 50) {
    return <BatteryMedium {...iconProps} />;
  }
  if (level <= 80) {
    return <Battery {...iconProps} />;
  }
  return <BatteryFull {...iconProps} />;
}

function getBackendConnectionIcon(isConnected: boolean) {
  const iconProps = { size: ICON_SIZE.md };

  if (isConnected) {
    return <Wifi {...iconProps} color={BASE_COLORS.semantic.success} />;
  }
  return <WifiOff {...iconProps} color={BASE_COLORS.text.disabled} />;
}

function getCellularIcon(strength: number, isConnected: boolean) {
  const iconProps = { size: ICON_SIZE.md };

  if (!isConnected) {
    return <SignalZero {...iconProps} color={BASE_COLORS.text.disabled} />;
  }

  if (strength >= 3) {
    return <SignalHigh {...iconProps} color={BASE_COLORS.semantic.success} />;
  } else if (strength >= 2) {
    return <SignalMedium {...iconProps} color={BASE_COLORS.semantic.warning} />;
  } else if (strength >= 1) {
    return <SignalLow {...iconProps} color={BASE_COLORS.semantic.warning} />;
  }
  return <SignalLow {...iconProps} color={BASE_COLORS.semantic.danger} />;
}

export function AppStatusBar() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const openSettings = useUiStore((s) => s.openSettings);
  const weather = useCarStore((s) => s.weather);
  const connectionStatus = useConnectionStore((s) => s.status);
  const battery = useBattery();
  const network = useNetwork();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isGatewayConnected = connectionStatus === 'connected';

  return (
    <>
      <View style={styles.container}>
        {/* Left: Time */}
        <View style={styles.leftSection}>
          <Text style={styles.time}>{formatTime(currentTime)}</Text>
        </View>

        {/* Center: Weather */}
        <View style={styles.centerSection}>
          {weather && (
            <View style={styles.weatherContainer}>
              {getWeatherIcon(weather.weatherCode, weather.isDay)}
              <View style={styles.temperatureContainer}>
                <Thermometer size={ICON_SIZE.xs} color={BASE_COLORS.text.tertiary} />
                <Text style={styles.temperature}>
                  {Math.round(weather.temperature)}°
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Right: Status icons */}
        <View style={styles.rightSection}>
          {/* Cellular network with type label */}
          <View style={styles.networkContainer}>
            {getCellularIcon(network.signalStrength, network.isConnected)}
            {network.isConnected && network.cellularType && (
              <Text style={styles.networkTypeText}>{network.cellularType}</Text>
            )}
          </View>

          {/* Backend connection (WiFi icon) */}
          {getBackendConnectionIcon(isGatewayConnected)}

          {/* Battery */}
          <View style={styles.batteryContainer}>
            {getBatteryIcon(battery.level, battery.isCharging)}
            <Text style={styles.batteryText}>{battery.level}%</Text>
          </View>

          {/* Settings gear */}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={openSettings}
            activeOpacity={0.7}
          >
            <Settings size={ICON_SIZE.sm} color={BASE_COLORS.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: BASE_COLORS.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: BASE_COLORS.glass.border,
  },
  leftSection: {
    flex: 1,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 2,
    alignItems: 'center',
  },
  rightSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: SPACING.md,
  },
  time: {
    fontSize: FONT_SIZE.h2,
    fontWeight: FONT_WEIGHT.bold,
    color: BASE_COLORS.text.primary,
    fontVariant: ['tabular-nums'],
  },
  weatherContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  temperatureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  temperature: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.medium,
    color: BASE_COLORS.text.secondary,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  batteryText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: BASE_COLORS.text.secondary,
  },
  networkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  networkTypeText: {
    fontSize: FONT_SIZE.md,
    color: BASE_COLORS.text.secondary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  settingsButton: {
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    backgroundColor: BASE_COLORS.glass.background,
  },
});
