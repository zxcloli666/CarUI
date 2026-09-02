import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  ActivityIndicator,
} from 'react-native';
import { BASE_COLORS, RADIUS, TOUCH_TARGET, FONT_SIZE, FONT_WEIGHT, SPACING } from '../../theme/constants';
import { useAccentColor } from '../../hooks/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  icon,
}: ButtonProps) {
  const accent = useAccentColor();

  const sizeStyles = {
    sm: { height: TOUCH_TARGET.min, paddingHorizontal: SPACING.md },
    md: { height: TOUCH_TARGET.md, paddingHorizontal: SPACING.xl },
    lg: { height: TOUCH_TARGET.lg, paddingHorizontal: SPACING.xxl },
  };

  const textSizes = {
    sm: FONT_SIZE.sm,
    md: FONT_SIZE.md,
    lg: FONT_SIZE.lg,
  };

  const variantStyles: Record<string, ViewStyle> = {
    primary: {
      backgroundColor: accent.primary,
      shadowColor: accent.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    secondary: {
      backgroundColor: BASE_COLORS.glass.background,
      borderWidth: 1,
      borderColor: BASE_COLORS.glass.border,
    },
    danger: {
      backgroundColor: BASE_COLORS.semantic.danger,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
  };

  const textColors = {
    primary: BASE_COLORS.text.primary,
    secondary: BASE_COLORS.text.primary,
    danger: BASE_COLORS.text.primary,
    ghost: BASE_COLORS.text.secondary,
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={BASE_COLORS.text.primary} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              { fontSize: textSizes[size], color: disabled ? BASE_COLORS.text.disabled : textColors[variant] },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: BASE_COLORS.text.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
