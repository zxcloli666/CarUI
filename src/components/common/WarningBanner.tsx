import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import { colors, typography, spacing, borderRadius, iconSize } from '../../theme';

interface WarningBannerProps {
  message: string;
  onDismiss?: () => void;
  variant?: 'warning' | 'danger' | 'info';
}

export function WarningBanner({
  message,
  onDismiss,
  variant = 'warning',
}: WarningBannerProps) {
  const variantColors = {
    warning: colors.accent.warning,
    danger: colors.accent.danger,
    info: colors.accent.info,
  };

  const backgroundColor = `${variantColors[variant]}20`;
  const borderColor = `${variantColors[variant]}40`;

  return (
    <View style={[styles.container, { backgroundColor, borderColor }]}>
      <AlertTriangle
        size={iconSize.md}
        color={variantColors[variant]}
      />
      <Text style={[styles.message, { color: variantColors[variant] }]}>
        {message}
      </Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
          <X size={iconSize.sm} color={variantColors[variant]} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
    marginHorizontal: spacing.md,
  },
  message: {
    flex: 1,
    ...typography.body.medium,
    fontWeight: '500',
  },
  closeButton: {
    padding: spacing.xs,
  },
});
