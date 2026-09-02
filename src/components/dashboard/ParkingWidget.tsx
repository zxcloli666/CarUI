import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BASE_COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../theme/constants';
import { useCarStore } from '../../app/store';
import { GlassCard } from '../common';
import { SensorPosition } from '../../types';

function getDistanceColor(distance: number): string {
  if (distance < 30) return BASE_COLORS.parking.danger;
  if (distance < 60) return BASE_COLORS.parking.warning;
  if (distance < 100) return BASE_COLORS.parking.caution;
  return BASE_COLORS.parking.safe;
}

function formatDistance(cm: number): string {
  if (cm >= 999) return '---';
  if (cm >= 100) return `${(cm / 100).toFixed(1)}м`;
  return `${cm}см`;
}

const ZONES = {
  REAR: ['rear_left', 'rear_center_left', 'rear_center_right', 'rear_right'],
  FRONT: ['front_left', 'front_center_left', 'front_center_right', 'front_right'],
  LEFT: ['left_front', 'left_rear'],
  RIGHT: ['right_front', 'right_rear'],
};

export const ParkingWidget = React.memo(() => {
  const sensors = useCarStore((s) => s.parkingSensors);

  const data = useMemo(() => {
    if (sensors.length === 0) return null;

    const getMin = (positions: string[]) => {
      const filtered = sensors.filter(s => positions.includes(s.position));
      return filtered.length > 0 ? Math.min(...filtered.map(s => s.distance_cm)) : 999;
    };

    return {
      front: getMin(ZONES.FRONT),
      rear: getMin(ZONES.REAR),
      left: getMin(ZONES.LEFT),
      right: getMin(ZONES.RIGHT),
    };
  }, [sensors]);

  if (!data) return null;

  return (
      <GlassCard style={styles.container}>
        <View style={styles.row}>
          {data.left < 999 && (
              <View style={styles.sideBlock}>
                <View style={[styles.sideDot, { backgroundColor: getDistanceColor(data.left) }]} />
                <Text style={[styles.sideValue, { color: getDistanceColor(data.left) }]}>{formatDistance(data.left)}</Text>
              </View>
          )}

          <View style={styles.mainBlock}>
            <View style={styles.distanceItem}>
              <Text style={styles.label}>↑</Text>
              <Text style={[styles.distance, { color: getDistanceColor(data.front) }]}>{formatDistance(data.front)}</Text>
            </View>
            <View style={styles.distanceItem}>
              <Text style={styles.label}>↓</Text>
              <Text style={[styles.distance, { color: getDistanceColor(data.rear) }]}>{formatDistance(data.rear)}</Text>
            </View>
          </View>

          {data.right < 999 && (
              <View style={styles.sideBlock}>
                <View style={[styles.sideDot, { backgroundColor: getDistanceColor(data.right) }]} />
                <Text style={[styles.sideValue, { color: getDistanceColor(data.right) }]}>{formatDistance(data.right)}</Text>
              </View>
          )}
        </View>
      </GlassCard>
  );
});

const styles = StyleSheet.create({
  container: { paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  sideBlock: { alignItems: 'center', gap: SPACING.xs },
  sideDot: { width: 10, height: 10, borderRadius: 5 },
  sideValue: { fontSize: FONT_SIZE.lg, fontWeight: FONT_WEIGHT.semibold },
  mainBlock: { flexDirection: 'row', gap: SPACING.lg },
  distanceItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  label: { fontSize: FONT_SIZE.xl, color: BASE_COLORS.text.tertiary },
  distance: { fontSize: FONT_SIZE.h2, fontWeight: FONT_WEIGHT.bold },
});