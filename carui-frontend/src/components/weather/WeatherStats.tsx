/**
 * Driver Weather Stats - "ALERT DOMINANCE"
 *
 * CHANGES:
 * - Alert Bar: If Danger, use High Opacity Background (80%).
 * - Visual Hierarchy: This bar must now overpower the Main Weather Card.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Wind, Droplets, Eye } from 'lucide-react-native';
import { CurrentWeather, HourlyForecast } from '../../types/weather';
import { getRoadCondition } from '../../services/WeatherService';
import { AlertIcon } from './WeatherIcon';

export function WeatherStats({ weather, hourly }: { weather: CurrentWeather; hourly: HourlyForecast[] }) {
  const visibility = hourly[0]?.visibility ?? 10000;
  const road = getRoadCondition(weather, visibility);

  const isDanger = road.level === 'danger';
  const isWarning = road.level === 'warning';

  // Alert Styling Logic
  let alertStyle = styles.bannerDefault;
  let iconColor = road.color;
  let titleColor = road.color;
  let descColor = '#AAA';

  if (isDanger) {
    // CRITICAL MODE: Solid Red Background
    alertStyle = styles.bannerDanger;
    iconColor = '#FFF';
    titleColor = '#FFF';
    descColor = 'rgba(255,255,255,0.9)';
  } else if (isWarning) {
    // WARNING MODE: Solid Orange/Yellow
    alertStyle = styles.bannerWarning;
    iconColor = '#111'; // Black text on yellow looks like construction signs
    titleColor = '#111';
    descColor = 'rgba(0,0,0,0.7)';
  }

  return (
      <View style={styles.container}>

        {/* 1. STATUS BANNER */}
        <View style={[styles.bannerBase, alertStyle]}>
          <View style={styles.bannerIcon}>
            <AlertIcon icon={road.icon} size={42} color={iconColor} />
          </View>
          <View style={styles.bannerText}>
            <Text style={[styles.bannerTitle, { color: titleColor }]}>
              {road.title}
            </Text>
            <Text style={[styles.bannerDesc, { color: descColor }]} numberOfLines={1}>
              {road.subtitle}
            </Text>
          </View>
        </View>

        {/* 2. METRICS ROW */}
        <View style={styles.grid}>
          <StatBox
              label="ВЕТЕР"
              value={Math.round(weather.windSpeed)}
              unit="км/ч"
              color="#EEE"
              icon={<Wind size={20} color="#888" />}
          />
          <StatBox
              label="ОСАДКИ"
              value={weather.precipitation.toFixed(1)}
              unit="мм"
              color="#64D2FF"
              icon={<Droplets size={20} color="#64D2FF" />}
          />
          <StatBox
              label="ВИДИМОСТЬ"
              value={(visibility / 1000).toFixed(1)}
              unit="км"
              color={visibility < 1000 ? '#FF453A' : '#EEE'}
              icon={<Eye size={20} color={visibility < 1000 ? '#FF453A' : '#888'} />}
          />
        </View>

      </View>
  );
}

const StatBox = ({ label, value, unit, color, icon }: any) => (
    <View style={styles.box}>
      <View style={styles.boxHeader}>
        {icon}
        <Text style={styles.boxLabel}>{label}</Text>
      </View>
      <View style={styles.boxContent}>
        <Text style={[styles.boxValue, { color }]}>{value}</Text>
        <Text style={styles.boxUnit}>{unit}</Text>
      </View>
    </View>
);

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },

  // Banner Base
  bannerBase: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    minHeight: 80,
    borderWidth: 1,
  },

  // Banner States
  bannerDefault: {
    backgroundColor: '#111',
    borderColor: '#333',
  },
  bannerDanger: {
    backgroundColor: 'rgba(255, 69, 58, 0.9)', // Almost Solid Red
    borderColor: '#FF453A',
    shadowColor: "#FF453A",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  bannerWarning: {
    backgroundColor: 'rgba(255, 214, 10, 0.9)', // Almost Solid Yellow
    borderColor: '#FFD60A',
  },

  bannerIcon: {
    width: 60, alignItems: 'center', justifyContent: 'center', marginRight: 10,
  },
  bannerText: {
    flex: 1, justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 24, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2,
  },
  bannerDesc: {
    fontSize: 16, fontWeight: '600',
  },

  // Grid
  grid: {
    flexDirection: 'row', gap: 12, height: 90,
  },
  box: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 16, borderWidth: 1, borderColor: '#333',
    padding: 10, justifyContent: 'space-between',
  },
  boxHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  boxLabel: {
    fontSize: 11, fontWeight: '700', color: '#888', textTransform: 'uppercase',
  },
  boxContent: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
  },
  boxValue: {
    fontSize: 32, fontWeight: '900',
  },
  boxUnit: {
    fontSize: 14, fontWeight: '600', color: '#666',
  },
});