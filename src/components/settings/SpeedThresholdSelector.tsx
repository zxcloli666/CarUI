import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Gauge } from 'lucide-react-native';
import { useAccentColor } from '../../hooks/useTheme';
import { BASE_COLORS, FONT_SIZE, ICON_SIZE, RADIUS, SPACING, scale } from '../../theme/constants';

interface SpeedThresholdSelectorProps {
  value: number;
  onChange: (value: number) => void;
}

const MIN_VALUE = -10;
const MAX_VALUE = 20;

export function SpeedThresholdSelector({ value, onChange }: SpeedThresholdSelectorProps) {
  const accent = useAccentColor();

  // Описание текущего режима
  const modeInfo = useMemo(() => {
    if (value <= -5) {
      return { label: 'Осторожный', color: accent.primary, desc: 'Предупреждение заранее' };
    } else if (value <= 5) {
      return { label: 'Стандарт', color: BASE_COLORS.semantic.success, desc: 'Небольшой запас' };
    } else if (value <= 15) {
      return { label: 'Комфорт', color: BASE_COLORS.semantic.warning, desc: 'С учётом погрешности' };
    } else {
      return { label: 'РФ 20 км/ч', color: '#FF6B6B', desc: 'Без штрафа в РФ' };
    }
  }, [value, accent.primary]);

  // Форматирование значения
  const displayValue = value >= 0 ? `+${value}` : `${value}`;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Gauge size={ICON_SIZE.sm} color={BASE_COLORS.text.secondary} />
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            ПОРОГ ПРЕВЫШЕНИЯ
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: modeInfo.color + '20' }]}>
          <Text style={[styles.badgeText, { color: modeInfo.color }]}>{modeInfo.label}</Text>
        </View>
      </View>

      {/* Value Display */}
      <View style={styles.valueContainer}>
        <Text style={[styles.valueText, { color: modeInfo.color }]}>{displayValue}</Text>
        <Text style={styles.valueUnit} numberOfLines={1} adjustsFontSizeToFit={true}>
          км/ч
        </Text>
      </View>
      <Text style={styles.description}>{modeInfo.desc}</Text>

      {/* Slider */}
      <View style={styles.sliderContainer}>
        <Slider
          style={styles.slider}
          value={value}
          onValueChange={(v) => onChange(Math.round(v))}
          minimumValue={MIN_VALUE}
          maximumValue={MAX_VALUE}
          step={1}
          minimumTrackTintColor={modeInfo.color}
          maximumTrackTintColor="rgba(255,255,255,0.1)"
          thumbTintColor="#FFF"
        />
      </View>

      {/* Scale Labels */}
      <View style={styles.scaleContainer}>
        <View style={styles.scaleMark}>
          <View style={[styles.scaleDot, { backgroundColor: accent.primary }]} />
          <Text style={styles.scaleLabel}>-10</Text>
          <Text style={styles.scaleHint}>Заранее</Text>
        </View>
        <View style={styles.scaleMark}>
          <View style={[styles.scaleDot, { backgroundColor: BASE_COLORS.semantic.success }]} />
          <Text style={styles.scaleLabel}>0</Text>
          <Text style={styles.scaleHint}>По знаку</Text>
        </View>
        <View style={styles.scaleMark}>
          <View style={[styles.scaleDot, { backgroundColor: BASE_COLORS.semantic.warning }]} />
          <Text style={styles.scaleLabel}>+10</Text>
          <Text style={styles.scaleHint}>Запас</Text>
        </View>
        <View style={styles.scaleMark}>
          <View style={[styles.scaleDot, { backgroundColor: '#FF6B6B' }]} />
          <Text style={styles.scaleLabel}>+20</Text>
          <Text style={styles.scaleHint}>РФ</Text>
        </View>
      </View>

      {/* Example */}
      <View style={styles.exampleContainer}>
        <Text style={styles.exampleText}>
          При знаке 60 км/ч предупреждение на{' '}
          <Text style={[styles.exampleHighlight, { color: modeInfo.color }]}>{60 + value} км/ч</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: BASE_COLORS.glass.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 1,
  },
  title: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: BASE_COLORS.text.secondary,
    letterSpacing: scale(1),
    textTransform: 'uppercase',
    flexShrink: 1,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  valueText: {
    fontSize: FONT_SIZE.display,
    fontWeight: '200',
    letterSpacing: -scale(2),
    lineHeight: FONT_SIZE.display + scale(8),
  },
  valueUnit: {
    fontSize: FONT_SIZE.md,
    color: BASE_COLORS.text.secondary,
    fontWeight: '600',
    lineHeight: FONT_SIZE.md + scale(4),
    includeFontPadding: false,
  },
  description: {
    fontSize: FONT_SIZE.sm,
    color: BASE_COLORS.text.secondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    lineHeight: FONT_SIZE.sm + scale(4),
  },
  sliderContainer: {
    marginHorizontal: -SPACING.xs,
  },
  slider: {
    width: '100%',
    height: scale(36),
  },
  scaleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },
  scaleMark: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  scaleDot: {
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
  },
  scaleLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '600',
    color: BASE_COLORS.text.primary,
  },
  scaleHint: {
    fontSize: FONT_SIZE.xs,
    color: BASE_COLORS.text.secondary,
    opacity: 0.85,
  },
  exampleContainer: {
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: BASE_COLORS.glass.border,
  },
  exampleText: {
    fontSize: FONT_SIZE.sm,
    color: BASE_COLORS.text.secondary,
    textAlign: 'center',
    lineHeight: FONT_SIZE.sm + scale(4),
  },
  exampleHighlight: {
    fontWeight: '700',
  },
});
