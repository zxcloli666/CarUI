import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle, ArrowDown } from 'lucide-react-native'
import Animated, { useAnimatedStyle, withSpring, FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { BASE_COLORS, FONT_SIZE, SPACING, RADIUS, scale } from '../../theme/constants';
import { useCarStore } from '../../app/store';
import { useShallow } from 'zustand/shallow';


// --- HELPER: Vision Pro Style Warning Pill ---
const NextLimitWarning = React.memo(() => {
  // Изолированная подписка: при изменении дистанции ре-рендерится ТОЛЬКО этот компонент
  const nextChange = useCarStore(useShallow(s => s.speedLimit?.next_change));

  // Показываем только если новый лимит МЕНЬШЕ текущего (нужно тормозить)
  if (!nextChange || nextChange.new_limit >= nextChange.current_limit) return null;

  const distance = nextChange.distance_m < 1000
    ? `${Math.round(nextChange.distance_m)} м`
    : `${(nextChange.distance_m / 1000).toFixed(1)} км`;

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(12)}
      exiting={FadeOutUp.duration(200)}
      style={styles.warningPill}
    >
      {/* Левая часть: Новый лимит */}
      <View style={styles.pillBadge}>
        <Text style={styles.pillLimitText}>{nextChange.new_limit}</Text>
      </View>

      {/* Правая часть: Инфо */}
      <View style={styles.pillInfo}>
        <View style={styles.pillRow}>
          <ArrowDown size={12} color={BASE_COLORS.semantic.warning} strokeWidth={3} />
          <Text style={styles.pillTitle}>LIMIT</Text>
        </View>
        <Text style={styles.pillDistance}>{distance}</Text>
      </View>
    </Animated.View>
  );
});

/**
 * 0.5s Glance Rule:
 * Скорость должна быть видна боковым зрением.
 * Используем tabular-nums, чтобы цифры не "скакали" по горизонтали.
 */
export const SpeedWidget = React.memo(() => {
  const speed = useCarStore(s => Math.round(s.position?.speed_kmh || 0));
  const limit = useCarStore(s => s.speedLimit?.limit || 0);

  const isOverSpeed = limit > 0 && speed > limit;

  const animatedContainerStyle = useAnimatedStyle(() => ({
    borderColor: withSpring(isOverSpeed ? BASE_COLORS.semantic.danger : 'rgba(255,255,255,0.1)'),
    backgroundColor: withSpring(isOverSpeed ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.03)'),
    transform: [{ scale: withSpring(isOverSpeed ? 1.05 : 1) }]
  }));

  return (
      <View style={styles.wrapper}>
        <Animated.View style={[styles.container, animatedContainerStyle]}>
          <View style={styles.content}>
            <Text numberOfLines={1} adjustsFontSizeToFit={true} style={[
              styles.speed,
              { color: isOverSpeed ? BASE_COLORS.semantic.danger : BASE_COLORS.text.primary }
            ]} >
              {speed}
            </Text>
            <Text style={styles.unit} numberOfLines={1} adjustsFontSizeToFit={true}>
              КМ/Ч
            </Text>
          </View>

          {limit > 0 && (
              <View style={[styles.limitBadge, isOverSpeed && styles.limitBadgeOver]}>
                <Text style={styles.limitText}>{limit}</Text>
              </View>
          )}

          {isOverSpeed && (
              <View style={styles.warningIcon}>
                <AlertTriangle size={scale(24)} color={BASE_COLORS.semantic.danger} />
              </View>
          )}
        </Animated.View>

        {/* Warning Component (Positioned absolutely below) */}
        <NextLimitWarning />
      </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible' // важно, чтобы pill не обрезался, если wrapper будет ограничен
  },
  container: {
    width: scale(200),
    height: scale(200),
    borderRadius: scale(100),
    borderWidth: scale(2),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(10) },
    shadowOpacity: 0.3,
    shadowRadius: scale(20),
    elevation: scale(10),
  },
  content: {
    alignItems: 'center',
  },
  speed: {
    fontSize: scale(84),
    fontWeight: '800',
    fontVariant: ['tabular-nums'], // Фикс дрожания цифр
    lineHeight: scale(90),
  },
  unit: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    color: BASE_COLORS.text.tertiary,
    letterSpacing: scale(1),
    marginTop: scale(2),
    textAlign: 'center',
    lineHeight: FONT_SIZE.sm + scale(6),
    includeFontPadding: false,
    textTransform: 'uppercase',
  },
  limitBadge: {
    position: 'absolute',
    bottom: scale(-10),
    width: scale(50),
    height: scale(50),
    borderRadius: scale(25),
    borderWidth: scale(3),
    borderColor: BASE_COLORS.semantic.danger,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  limitBadgeOver: {
    backgroundColor: BASE_COLORS.semantic.danger,
  },
  limitText: {
    color: '#000',
    fontSize: scale(20),
    fontWeight: '900',
  },
  warningIcon: {
    position: 'absolute',
    top: scale(20),
    alignSelf: 'center',
  },
  // --- Warning Pill Styles (Vision Pro) ---
  warningPill: {
    position: 'absolute',
    bottom: scale(-50), // Выезжает снизу круга
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 25, 0.85)', // Темное стекло
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)', // Тонкая стеклянная обводка
    gap: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    minWidth: scale(110),
  },
  pillBadge: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Glass background для кружка
    borderWidth: 1.5,
    borderColor: BASE_COLORS.semantic.warning, // Оранжевый ободок
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillLimitText: {
    color: BASE_COLORS.text.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
  },
  pillInfo: {
    justifyContent: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pillTitle: {
    color: BASE_COLORS.semantic.warning,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pillDistance: {
    color: BASE_COLORS.text.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
