/**
 * Driver Alerts Widget for Dashboard
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  Snowflake,
  CloudFog,
  Wind,
  CloudRain,
  CloudSnow,
  Thermometer,
  Zap,
  EyeOff,
  CheckCircle,
  Droplets,
  Info,
} from 'lucide-react-native';
import {
  BASE_COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../../theme/constants';
import { useCarStore } from '../../app/store';
import { getDriverAlerts } from '../../services/WeatherService';

function getAlertIcon(iconName: string, color: string) {
  const props = { size: 20, color, strokeWidth: 2.5 }; // Чуть жирнее иконки

  switch (iconName) {
    case 'eye-off': return <EyeOff {...props} />;
    case 'snowflake': return <Snowflake {...props} />;
    case 'cloud-snow': return <CloudSnow {...props} />;
    case 'wind': return <Wind {...props} />;
    case 'cloud-rain': return <CloudRain {...props} />;
    case 'droplets': return <Droplets {...props} />;
    case 'cloud-fog': return <CloudFog {...props} />;
    case 'cloud-lightning': return <Zap {...props} />;
    case 'thermometer': return <Thermometer {...props} />;
    case 'check-circle': return <CheckCircle {...props} />;
    default: return <Info {...props} />;
  }
}

export const DriverAlertsWidget = React.memo(() => {
  const weatherData = useCarStore(s => s.weatherData);

  const alerts = useMemo(() => {
    if (!weatherData) return [];
    return getDriverAlerts(weatherData);
  }, [weatherData]);

  if (alerts.length === 0) {
    return null;
  }

  // Limit to 1 alert to maintain center symmetry, or 2 if they fit
  const visibleAlerts = alerts.slice(0, 2);

  return (
      <View style={styles.container}>
        {visibleAlerts.map(alert => {
          const isDanger = alert.severity === 'danger';
          const isWarning = alert.severity === 'warning';

          // Dynamic Colors based on severity
          // Danger: Red | Warning: Orange | Info: Blue
          const bgColor = isDanger
              ? 'rgba(239, 68, 68, 0.2)'
              : isWarning
                  ? 'rgba(245, 158, 11, 0.2)'
                  : 'rgba(59, 130, 246, 0.2)';

          const borderColor = isDanger
              ? BASE_COLORS.semantic.danger
              : isWarning
                  ? BASE_COLORS.semantic.warning
                  : BASE_COLORS.semantic.info;

          const textColor = isDanger
              ? '#FF8888'
              : isWarning
                  ? '#FFCC80' // Светлее для читаемости на темном
                  : '#88CCFF';

          return (
              <View
                  key={alert.id}
                  style={[
                    styles.alertCard,
                    { backgroundColor: bgColor, borderColor: borderColor }
                  ]}
              >
                {getAlertIcon(alert.icon, borderColor)}
                <Text style={[styles.alertText, { color: textColor }]}>
                  {alert.title}
                </Text>
              </View>
          );
        })}
      </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Чуть больше отступ между иконкой и текстом
    paddingHorizontal: 16, // БОЛЬШЕ отступов по бокам, чтобы текст не прилипал
    paddingVertical: 8,    // Достаточно высоты
    borderRadius: RADIUS.full, // Полностью круглые края (Pill shape)
    borderWidth: 1,
    minHeight: 36,
  },
  alertText: {
    fontSize: FONT_SIZE.md,
    fontWeight: '800', // Жирный шрифт для читаемости
    textTransform: 'uppercase', // Всегда капсом, как на знаках
    letterSpacing: 0.5,
    includeFontPadding: false, // ФИКС ДЛЯ ANDROID (убирает лишние отступы шрифта)
    textAlignVertical: 'center',
  },
});