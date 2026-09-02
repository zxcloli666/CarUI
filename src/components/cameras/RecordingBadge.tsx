import React, { memo, useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import {
  BASE_COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../../theme/constants';

export const RecordingBadge = memo(function RecordingBadge() {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={s.badge}>
      <Animated.View style={[s.dot, { opacity: pulse }]} />
      <Text style={s.text} numberOfLines={1} adjustsFontSizeToFit>REC</Text>
    </View>
  );
});

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: BASE_COLORS.semantic.danger + '50',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BASE_COLORS.semantic.danger,
  },
  text: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.bold,
    color: BASE_COLORS.semantic.danger,
    letterSpacing: 1,
  },
});
