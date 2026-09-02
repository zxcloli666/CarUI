import React, { memo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Camera } from 'lucide-react-native';
import { MjpegView, MjpegStatus } from './MjpegView';
import {
  BASE_COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  ICON_SIZE,
} from '../../theme/constants';

interface CameraStreamProps {
  name: string;
  url: string;
  active: boolean;
  fullscreen?: boolean;
  maxFps?: number;
}

export const CameraStream = memo(function CameraStream({
  name,
  url,
  active,
  fullscreen,
  maxFps = 30,
}: CameraStreamProps) {
  const [status, setStatus] = useState<MjpegStatus>('connecting');

  useEffect(() => {
    setStatus(active ? 'connecting' : 'idle');
  }, [active, url]);

  return (
    <View style={[styles.container, fullscreen && styles.fullscreen]}>
      <MjpegView
        style={styles.stream}
        url={url}
        paused={!active}
        resizeMode="contain"
        maxFps={maxFps}
        retryDelayMs={1000}
        onStatus={(e) => setStatus(e.nativeEvent.status)}
      />

      {active && status !== 'streaming' && (
        <View style={styles.statusOverlay}>
          {status === 'error' ? (
            <>
              <Camera size={ICON_SIZE.xl} color={BASE_COLORS.text.tertiary} />
              <Text style={styles.errorText}>Нет сигнала</Text>
            </>
          ) : (
            <>
              <ActivityIndicator color={BASE_COLORS.text.secondary} size="small" />
              <Text style={styles.statusText}>Подключение...</Text>
            </>
          )}
        </View>
      )}

      <View style={styles.label}>
        <Text style={styles.labelText}>{name}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BASE_COLORS.background.tertiary,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fullscreen: {
    borderRadius: 0,
  },
  stream: {
    width: '100%',
    height: '100%',
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  statusText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BASE_COLORS.text.tertiary,
  },
  errorText: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,
    color: BASE_COLORS.text.tertiary,
  },
  label: {
    position: 'absolute',
    bottom: SPACING.sm,
    left: SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: BASE_COLORS.glass.border,
  },
  labelText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: BASE_COLORS.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
