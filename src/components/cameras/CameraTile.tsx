import React, { memo } from 'react';
import { TouchableOpacity, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { AccentColors } from '../../hooks/useTheme';
import {
  BASE_COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
} from '../../theme/constants';

interface CameraTileProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  accent: AccentColors;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export const CameraTile = memo(function CameraTile({
  icon,
  label,
  active,
  accent,
  onPress,
  style,
}: CameraTileProps) {
  return (
    <TouchableOpacity
      style={[
        s.tile,
        active && {
          backgroundColor: accent.primary + '18',
          borderColor: accent.primary + '55',
          shadowColor: accent.primary,
          shadowOpacity: 0.3,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: 6,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      {icon}
      <Text style={[s.label, active && { color: accent.primary }]}>{label}</Text>
    </TouchableOpacity>
  );
});

const s = StyleSheet.create({
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: BASE_COLORS.background.elevated,
    borderWidth: 1,
    borderColor: BASE_COLORS.glass.border,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BASE_COLORS.text.secondary,
  },
});
