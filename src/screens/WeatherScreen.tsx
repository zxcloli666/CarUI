/**
 * Weather Screen - "TRUCK COCKPIT" Edition
 *
 * PHILOSOPHY:
 * - NO scroll on the main container.
 * - Maximize screen real estate usage.
 * - True Black background for OLED/Night driving safety.
 */

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { ArrowLeft, MapPin, RefreshCw } from 'lucide-react-native';

import { useCarStore, useUiStore } from '../app/store';
import {
  MainWeatherCard,
  WeatherStats,
  HourlyForecast
} from '../components/weather';
import { fetchWeather } from '../services/WeatherService';
import { GeoService } from '../services/GeoService';
import { WeatherData } from '../types/weather';

// Hardcoded constants for safety sizing
const SAFE_HIT_SLOP = { top: 20, bottom: 20, left: 20, right: 20 };

const WeatherHeader = React.memo(({
  locationName,
  lastUpdate,
  refreshing,
  onRefresh,
}: {
  locationName: string;
  lastUpdate: string;
  refreshing: boolean;
  onRefresh: (force?: boolean) => void;
}) => {
  const closeWeather = useUiStore((s) => s.closeWeather);

  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={closeWeather}
        hitSlop={SAFE_HIT_SLOP}
      >
        <ArrowLeft size={36} color="#fff" />
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <View style={styles.locRow}>
          <MapPin size={20} color="#888" />
          <Text style={styles.locText} numberOfLines={1}>
            {locationName}
          </Text>
        </View>
        <Text style={styles.updateText}>{lastUpdate}</Text>
      </View>

      <TouchableOpacity
        style={styles.refreshButton}
        onPress={() => onRefresh(true)}
        hitSlop={SAFE_HIT_SLOP}
      >
        <RefreshCw size={30} color={refreshing ? '#FFF' : '#666'} />
      </TouchableOpacity>
    </View>
  );
});

const WeatherContent = React.memo(({ weatherData }: { weatherData: WeatherData }) => (
  <View style={styles.grid}>
    <View style={styles.leftCol}>
      <MainWeatherCard weather={weatherData.current} />
    </View>

    <View style={styles.rightCol}>
      <View style={styles.statsContainer}>
        <WeatherStats
          weather={weatherData.current}
          hourly={weatherData.hourly}
        />
      </View>

      <View style={styles.listContainer}>
        <HourlyForecast hourly={weatherData.hourly} />
      </View>
    </View>
  </View>
));

export function WeatherScreen() {
  const weatherData = useCarStore((s) => s.weatherData);

  const [refreshing, setRefreshing] = useState(false);
  const [locationName, setLocationName] = useState(() => GeoService.getCached()?.displayName || '...');

  const refreshInFlight = useRef<Promise<unknown> | null>(null);
  const geoKeyRef = useRef<string>('');
  const posRef = useRef<{ lat: number; lon: number } | null>(null);

  const handleRefresh = useCallback(async (force = false) => {
    const p = posRef.current;
    if (!p) return;
    if (!force && refreshInFlight.current) return;
    try {
      if (force) setRefreshing(true);
      const request = fetchWeather(p.lat, p.lon, force);
      refreshInFlight.current = request;
      await request;
    } finally {
      refreshInFlight.current = null;
      setRefreshing(false);
    }
  }, []);

  const handleGeoUpdate = useCallback((lat: number, lon: number) => {
    const geoKey = `${lat.toFixed(2)}:${lon.toFixed(2)}`;
    if (geoKeyRef.current === geoKey) return;
    geoKeyRef.current = geoKey;
    GeoService.reverseGeocode(lat, lon).then((res) => {
      if (!res) return;
      setLocationName((prev) => (prev === res.displayName ? prev : res.displayName));
    });
  }, []);

  useEffect(() => {
    const initial = useCarStore.getState().position;
    if (initial) {
      posRef.current = { lat: initial.lat, lon: initial.lon };
      handleGeoUpdate(initial.lat, initial.lon);
    }

    let active = true;
    const unsubscribe = useCarStore.subscribe((state) => {
      if (!active || !state.position) return;
      posRef.current = { lat: state.position.lat, lon: state.position.lon };
      handleGeoUpdate(state.position.lat, state.position.lon);
      if (!state.weatherData) {
        handleRefresh(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [handleGeoUpdate, handleRefresh]);

  useEffect(() => {
    if (!weatherData && posRef.current) {
      handleRefresh(false);
    }
  }, [weatherData, handleRefresh]);

  const lastUpdate = useMemo(() => {
    if (!weatherData) return '';
    return new Date(weatherData.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [weatherData]);

  if (!weatherData) return <View style={styles.blackScreen} />;

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <WeatherHeader
        locationName={locationName}
        lastUpdate={lastUpdate}
        refreshing={refreshing}
        onRefresh={handleRefresh}
      />
      <WeatherContent weatherData={weatherData} />
    </View>
  );
}

const styles = StyleSheet.create({
  blackScreen: { flex: 1, backgroundColor: '#000' },
  container: { flex: 1, backgroundColor: '#000', padding: 10 },

  // Header
  header: {
    height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 10, marginBottom: 10,
  },
  backButton: {
    width: 60, height: 60, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 12,
  },
  refreshButton: {
    width: 60, height: 60, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1A1A1A', borderRadius: 12,
  },
  headerCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 20 },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locText: { fontSize: 20, fontWeight: '700', color: '#fff', letterSpacing: 0.5 },
  updateText: { fontSize: 14, color: '#666', marginTop: 4 },

  // Grid Layout
  grid: { flex: 1, flexDirection: 'row', gap: 16 },

  // Columns
  leftCol: { flex: 0.4 },
  rightCol: { flex: 0.6, gap: 16 },

  // Containers
  statsContainer: {
    // Height determined by content, roughly 30% of right side
  },
  listContainer: {
    flex: 1, // Takes all remaining height
    backgroundColor: '#111',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#222',
    overflow: 'hidden'
  }
});
