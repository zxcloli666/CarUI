/**
 * Driver Main Weather Card - "CALM GIANT"
 *
 * DESIGN:
 * - Subdued background to let the Alert Bar dominate.
 * - Massive Temperature for legibility.
 * - Minimalist styling.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CurrentWeather } from '../../types/weather';
import { formatTemperature, getWeatherDescription } from '../../services/WeatherService';
import { WeatherIcon } from './WeatherIcon';
import { GradientView } from '../ui/GradientView';

export function MainWeatherCard({ weather }: { weather: CurrentWeather }) {
  const t = weather.temperature;

  // Background Logic: VERY SUBTLE now.
  // We want depth, not distraction.
  let bgColors = ['rgba(255,255,255,0.05)', 'rgba(0,0,0,0)'];

  if (t <= -10) {
    // Deep Cold -> Subtle Navy
    bgColors = ['rgba(0, 50, 100, 0.2)', 'rgba(0,0,0,0)'];
  } else if (t >= 30) {
    // Heat -> Subtle Red
    bgColors = ['rgba(100, 20, 0, 0.2)', 'rgba(0,0,0,0)'];
  } else if (t >= 20) {
    // Warm -> Subtle Amber
    bgColors = ['rgba(100, 70, 0, 0.15)', 'rgba(0,0,0,0)'];
  }

  return (
      <View style={styles.card}>
        <GradientView
            colors={bgColors}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.8 }}
        />

        <View style={styles.content}>

          {/* 1. ICON AREA */}
          <View style={styles.topSection}>
            <WeatherIcon code={weather.weatherCode} isDay={weather.isDay} size={140} animated={true} />
          </View>

          {/* 2. TEMP (HERO) */}
          <View style={styles.midSection}>
            <Text style={styles.tempText}>
              {Math.round(t)}°
            </Text>
          </View>

          {/* 3. DETAILS */}
          <View style={styles.botSection}>
            <View style={styles.pill}>
              <Text style={styles.descText} numberOfLines={1} adjustsFontSizeToFit={true}>
                {getWeatherDescription(weather.weatherCode)}
              </Text>
            </View>
            <Text style={styles.feelsText}>
              Ощущается {formatTemperature(weather.apparentTemperature)}
            </Text>
          </View>

        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', // Neutral border
    backgroundColor: '#000', // Pure black base
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24,
  },

  topSection: {
    flex: 1,
    justifyContent: 'center',
    // Slight shadow to pop from black
    shadowColor: "#FFF",
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },

  midSection: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -20, // Pull closer to icon
  },
  tempText: {
    fontSize: 140,
    fontWeight: '900',
    color: '#FFF',
    includeFontPadding: false,
    lineHeight: 140,
    letterSpacing: -6,
  },

  botSection: {
    alignItems: 'center',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  descText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#DDD',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feelsText: {
    fontSize: 16,
    color: '#888',
    fontWeight: '500',
  }
});