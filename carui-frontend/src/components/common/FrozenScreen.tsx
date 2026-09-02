import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { captureRef, releaseCapture } from '../../services/native';

type FrozenScreenProps = {
  active: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  snapshotStyle?: StyleProp<ViewStyle>;
  snapshotQuality?: number;
};

export const FrozenScreen = React.memo(({
  active,
  children,
  style,
  snapshotStyle,
  snapshotQuality = 0.7,
}: FrozenScreenProps) => {
  const viewRef = useRef<View>(null);
  const [snapshotUri, setSnapshotUri] = useState<string | null>(null);
  const [layoutReady, setLayoutReady] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const hasEverActive = useRef(false);
  const captureInFlight = useRef(false);
  const captureAttempted = useRef(false);

  useEffect(() => {
    if (active) {
      hasEverActive.current = true;
      captureAttempted.current = false;
      if (snapshotUri) {
        releaseCapture(snapshotUri);
        setSnapshotUri(null);
      }
    }
  }, [active, snapshotUri]);

  const captureNow = useCallback(async () => {
    if (captureInFlight.current || !layoutReady) return;
    captureInFlight.current = true;
    setIsCapturing(true);
    try {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const uri = await captureRef(viewRef, {
        format: 'jpg',
        quality: snapshotQuality,
        result: 'tmpfile',
        handleGLSurfaceViewOnAndroid: true,
      });
      setSnapshotUri(uri);
    } catch (_) {
    } finally {
      captureInFlight.current = false;
      setIsCapturing(false);
    }
  }, [layoutReady, snapshotQuality]);

  useEffect(() => {
    if (active || !layoutReady || !hasEverActive.current) return;
    if (snapshotUri || isCapturing || captureAttempted.current) return;
    captureAttempted.current = true;
    captureNow().catch(() => {});
  }, [active, layoutReady, snapshotUri, isCapturing, captureNow]);

  const showSnapshot = !active && !!snapshotUri && !isCapturing;
  const shouldRenderChildren = active || isCapturing || !snapshotUri;

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    if (!layoutReady && width > 0 && height > 0) setLayoutReady(true);
  };

  return (
    <View
      ref={viewRef}
      style={[styles.container, style]}
      collapsable={false}
      onLayout={handleLayout}
      pointerEvents={active ? 'auto' : 'none'}
    >
      {shouldRenderChildren ? children : null}
      {showSnapshot ? (
        <Image
          source={{ uri: snapshotUri! }}
          style={[StyleSheet.absoluteFill, styles.snapshot, snapshotStyle]}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  snapshot: {
    width: '100%',
    height: '100%',
  },
});
