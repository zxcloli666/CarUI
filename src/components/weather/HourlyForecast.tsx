import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Droplet, Snowflake, CloudRain, Wind, Eye } from 'lucide-react-native';

import { HourlyForecast as HourlyForecastType } from '../../types/weather';
import { formatTemperature, formatTime, formatVisibility } from '../../services/WeatherService';
import { WeatherIconSmall } from './WeatherIcon';
import { GlassView } from '../ui/GlassView';

/**
 * УЛЬТРА-КОМПАКТНАЯ СЕТКА
 * Общая ширина ~600dp — влезет даже на вертикальный планшет.
 */
const COL = {
  time: 75,
  weather: 145, // Сдвинули ветер ближе к прогнозу
  wind: 95,
  precip: 110,
  vis: 100,     // Сдвинули шанс ближе к видимости
  status: 75,
};

const COLORS = {
  textMain: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.4)',
  accentBlue: '#64D2FF',
  accentRed: '#FF453A',
  accentYellow: '#FFD60A',
};

const HourlyRow = React.memo(({ item, isNow }: { item: HourlyForecastType; isNow: boolean }) => {
  const isHighWind = item.windSpeed > 35;
  const isLowVis = item.visibility < 1500;

  return (
      <GlassView
          intensity={isNow ? 'medium' : 'dark'}
          style={[styles.row, isNow && styles.activeRow]}
      >
        {/* 1. ВРЕМЯ */}
        <View style={{ width: COL.time }}>
          <Text style={[styles.timeText, isNow && styles.textActive]}>
            {isNow ? 'СЕЙЧАС' : formatTime(item.time)}
          </Text>
        </View>

        {/* 2. ПРОГНОЗ */}
        <View style={[styles.cell, { width: COL.weather, gap: 8 }]}>
          <WeatherIconSmall code={item.weatherCode} size={36} isDay={item.isDay} />
          <View>
            <Text style={styles.tempMain}>{formatTemperature(item.temperature)}</Text>
            <Text style={styles.tempFeels}>ощущ. {formatTemperature(item.apparentTemperature)}</Text>
          </View>
        </View>

        {/* 3. ВЕТЕР */}
        <View style={[styles.cell, { width: COL.wind, gap: 6 }]}>
          <Wind size={18} color={isHighWind ? COLORS.accentYellow : COLORS.textMuted} strokeWidth={2.5} />
          <View>
            <View style={styles.rowBase}>
              <Text style={[styles.valText, isHighWind && { color: COLORS.accentYellow }]}>
                {Math.round(item.windSpeed)}
              </Text>
              {item.windGusts > item.windSpeed + 5 && (
                  <Text style={styles.gustText}>/{Math.round(item.windGusts)}</Text>
              )}
            </View>
            <Text style={styles.subLabel}>км/ч</Text>
          </View>
        </View>

        {/* 4. ОСАДКИ */}
        <View style={[styles.cell, { width: COL.precip, gap: 6 }]}>
          {item.snowDepth > 0 ? (
              <>
                <Snowflake size={18} color={COLORS.accentBlue} strokeWidth={2.5} />
                <View>
                  <Text style={[styles.valText, { color: COLORS.accentBlue }]}>
                    {Math.round(item.snowDepth * 100)}<Text style={styles.unitTiny}>см</Text>
                  </Text>
                  <Text style={styles.subLabel}>глубина</Text>
                </View>
              </>
          ) : item.rain > 0 ? (
              <>
                <CloudRain size={18} color={COLORS.accentBlue} strokeWidth={2.5} />
                <View>
                  <Text style={[styles.valText, { color: COLORS.accentBlue }]}>
                    {item.rain.toFixed(1)}<Text style={styles.unitTiny}>мм</Text>
                  </Text>
                  <Text style={styles.subLabel}>дождь</Text>
                </View>
              </>
          ) : (
              <Text style={styles.dash}>—</Text>
          )}
        </View>

        {/* 5. ВИДИМОСТЬ */}
        <View style={[styles.cell, { width: COL.vis, gap: 6 }]}>
          <Eye size={18} color={isLowVis ? COLORS.accentRed : COLORS.textMuted} strokeWidth={2.2} />
          <Text style={[styles.visText, isLowVis && { color: COLORS.accentRed }]}>
            {formatVisibility(item.visibility)}
          </Text>
        </View>

        {/* 6. ШАНС */}
        <View style={[styles.cellEnd, { width: COL.status }]}>
          <Text style={styles.chanceText}>{item.precipitationProbability}%</Text>
        </View>
      </GlassView>
  );
});

export function HourlyForecast({ hourly }: { hourly: HourlyForecastType[] }) {
  const data = useMemo(() => hourly.slice(0, 12), [hourly]);

  return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={[styles.th, { width: COL.time }]}>ВРЕМЯ</Text>
          <Text style={[styles.th, { width: COL.weather }]}>ПРОГНОЗ</Text>
          <Text style={[styles.th, { width: COL.wind }]}>ВЕТЕР</Text>
          <Text style={[styles.th, { width: COL.precip }]}>ОСАДКИ</Text>
          <Text style={[styles.th, { width: COL.vis }]}>ВИДИМ.</Text>
          <Text style={[styles.th, { width: COL.status, textAlign: 'right' }]}>ШАНС</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {data.map((h, i) => (
              <HourlyRow key={h.time} item={h} isNow={i === 0} />
          ))}
        </ScrollView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 8 },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    marginTop: 20,
    marginBottom: 8,
  },
  th: {
    fontSize: 10,
    fontWeight: '900',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  list: { gap: 6, paddingBottom: 40 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  activeRow: {
    borderColor: 'rgba(100, 210, 255, 0.2)',
    height: 78,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },

  cell: { flexDirection: 'row', alignItems: 'center' },
  cellEnd: { alignItems: 'flex-end', justifyContent: 'center' },
  rowBase: { flexDirection: 'row', alignItems: 'baseline' },

  // Текст
  timeText: { fontSize: 15, fontWeight: '700', color: COLORS.textMuted },
  textActive: { color: COLORS.accentBlue, fontSize: 16 },

  // Погода
  tempMain: { fontSize: 26, fontWeight: '800', color: COLORS.textMain, lineHeight: 28 },
  tempFeels: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginTop: -2 },

  // Значения
  valText: { fontSize: 20, fontWeight: '800', color: COLORS.textMain, lineHeight: 22 },
  gustText: { fontSize: 15, fontWeight: '700', color: COLORS.accentYellow },
  subLabel: { fontSize: 9, fontWeight: '800', color: COLORS.textMuted, marginTop: -1, textTransform: 'uppercase' },
  unitTiny: { fontSize: 11, fontWeight: '600', color: COLORS.textMuted, marginLeft: 1 },

  visText: { fontSize: 17, fontWeight: '700', color: COLORS.textMain },
  dash: { color: 'rgba(255,255,255,0.06)', fontSize: 20, marginLeft: 10 },

  chanceText: { fontSize: 13, fontWeight: '800', color: COLORS.textMuted },
});