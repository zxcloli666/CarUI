import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { BASE_COLORS, SCALE } from '../../theme/constants';
import { useCarStore } from '../../app/store';
import { GlassCard } from '../common';
import { useShallow } from 'zustand/shallow';

const BASE_WIDTH = 180;
const BASE_HEIGHT = 240;
const WIDTH = Math.round(BASE_WIDTH * SCALE);
const HEIGHT = Math.round(BASE_HEIGHT * SCALE);

// Static SVG Body to prevent re-creation
const StaticCarBody = React.memo(() => (
    <>
      <Rect x="30" y="215" width="120" height="20" rx="10" fill="rgba(0,0,0,0.2)" />
      <Rect x="30" y="20" width="120" height="190" rx="22" fill={BASE_COLORS.background.elevated} stroke={BASE_COLORS.glass.border} strokeWidth="2" />
      <Path d="M45 45 L135 45 L128 75 L52 75 Z" fill={BASE_COLORS.semantic.info + '30'} stroke={BASE_COLORS.glass.border} strokeWidth="1" />
      <Path d="M52 160 L128 160 L135 185 L45 185 Z" fill={BASE_COLORS.semantic.info + '30'} stroke={BASE_COLORS.glass.border} strokeWidth="1" />
      <Rect x="15" y="40" width="15" height="40" rx="5" fill={BASE_COLORS.text.tertiary} />
      <Rect x="150" y="40" width="15" height="40" rx="5" fill={BASE_COLORS.text.tertiary} />
      <Rect x="15" y="150" width="15" height="40" rx="5" fill={BASE_COLORS.text.tertiary} />
      <Rect x="150" y="150" width="15" height="40" rx="5" fill={BASE_COLORS.text.tertiary} />
      <Rect x="45" y="25" width="25" height="8" rx="2" fill={BASE_COLORS.semantic.warning} />
      <Rect x="110" y="25" width="25" height="8" rx="2" fill={BASE_COLORS.semantic.warning} />
      <Rect x="45" y="197" width="25" height="8" rx="2" fill={BASE_COLORS.semantic.danger} />
      <Rect x="110" y="197" width="25" height="8" rx="2" fill={BASE_COLORS.semantic.danger} />
    </>
));

const DoorIndicator = React.memo(({ isOpen, x, y }: { isOpen: boolean, x: number, y: number }) => (
    <Rect
        x={x} y={y} width={6} height={30} rx={2}
        fill={isOpen ? BASE_COLORS.semantic.danger : BASE_COLORS.semantic.success}
    />
));

export const CarVisualization = React.memo(() => {
  // Use shallow comparison to avoid re-render if other store parts change
  const doors = useCarStore(useShallow((s) => s.doors));

  return (
      <GlassCard style={styles.container}>
        <View style={styles.svgContainer}>
          <Svg width={WIDTH} height={HEIGHT} viewBox="0 0 180 240">
            <StaticCarBody />
            <DoorIndicator isOpen={doors.front_left} x={32} y={50} />
            <DoorIndicator isOpen={doors.front_right} x={142} y={50} />
            <DoorIndicator isOpen={doors.rear_left} x={32} y={130} />
            <DoorIndicator isOpen={doors.rear_right} x={142} y={130} />
          </Svg>
        </View>
      </GlassCard>
  );
});

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 0 },
  svgContainer: { alignItems: 'center', justifyContent: 'center' },
});