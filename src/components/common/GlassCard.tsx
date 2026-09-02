import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BASE_COLORS, RADIUS, SPACING } from '../../theme/constants';
import { useAccentColor } from '../../hooks/useTheme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /** Add accent glow border effect */
  glowing?: boolean;
}

const paddingValues = {
  none: 0,
  sm: SPACING.sm,
  md: SPACING.lg,
  lg: SPACING.xl,
};

export function GlassCard({ children, style, padding = 'md', glowing = false }: GlassCardProps) {
  const accent = useAccentColor();

  return (
    <View
      style={[
        styles.container,
        { padding: paddingValues[padding] },
        glowing && {
          borderColor: accent.primary,
          shadowColor: accent.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          elevation: 8,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BASE_COLORS.glass.background,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: BASE_COLORS.glass.border,
  },
});
