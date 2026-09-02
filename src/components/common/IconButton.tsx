import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { BASE_COLORS, RADIUS, TOUCH_TARGET } from '../../theme/constants';
import { useAccentColor } from '../../hooks/useTheme';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'glass' | 'primary' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const sizeValues = {
  sm: TOUCH_TARGET.min,
  md: TOUCH_TARGET.md,
  lg: TOUCH_TARGET.lg,
};

export function IconButton({
  icon,
  onPress,
  size = 'md',
  variant = 'default',
  disabled = false,
  style,
}: IconButtonProps) {
  const accent = useAccentColor();

  const variantStyles: Record<string, ViewStyle> = {
    default: {
      backgroundColor: 'transparent',
    },
    glass: {
      backgroundColor: BASE_COLORS.glass.background,
      borderWidth: 1,
      borderColor: BASE_COLORS.glass.border,
    },
    primary: {
      backgroundColor: accent.primary,
      shadowColor: accent.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    danger: {
      backgroundColor: BASE_COLORS.semantic.danger,
    },
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles[variant],
        {
          width: sizeValues[size],
          height: sizeValues[size],
        },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {icon}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
  },
  disabled: {
    opacity: 0.5,
  },
});
