import React, { memo, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  requireNativeComponent,
} from 'react-native';
import { Download, X } from 'lucide-react-native';
import { downloadFile } from './helpers';
import {
  BASE_COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  ICON_SIZE,
} from '../../theme/constants';

const NativeVideoPlayer = requireNativeComponent<any>('NativeVideoPlayer');

import type { RecordingSource } from '../../app/store/camerasStore';

interface VideoPlayerModalProps {
  url: string;
  title: string;
  source?: RecordingSource;
  onClose: () => void;
}

export const VideoPlayerModal = memo(function VideoPlayerModal({
  url,
  title,
  source = 'video',
  onClose,
}: VideoPlayerModalProps) {
  const [loading, setLoading] = useState(true);

  const onLoad = useCallback(() => setLoading(false), []);

  const safeFilename = `${title.replace(/[^a-zA-Z0-9_а-яА-Я -]/g, '_')}.mp4`;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose} hardwareAccelerated>
      <View style={s.overlay}>
        <View style={s.container}>
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Text style={s.title}>{title}</Text>
              {source === 'raw' ? (
                <View style={s.rawBadge}>
                  <Text style={s.rawBadgeText}>RAW</Text>
                </View>
              ) : (
                <View style={s.optimizedBadge}>
                  <Text style={s.optimizedBadgeText}>HD</Text>
                </View>
              )}
            </View>
            <View style={s.headerRight}>
              <TouchableOpacity
                onPress={() => downloadFile(url, safeFilename)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Download size={ICON_SIZE.sm} color={BASE_COLORS.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={ICON_SIZE.md} color={BASE_COLORS.text.primary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.video}>
            {loading && (
              <View style={s.loadingOverlay}>
                <ActivityIndicator size="large" color={BASE_COLORS.text.tertiary} />
              </View>
            )}
            <NativeVideoPlayer
              url={url}
              style={{ flex: 1 }}
              onLoad={onLoad}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
});

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  container: {
    width: '100%',
    maxWidth: 960,
    aspectRatio: 16 / 9,
    backgroundColor: BASE_COLORS.background.primary,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BASE_COLORS.glass.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: BASE_COLORS.glass.background,
    borderBottomWidth: 1,
    borderBottomColor: BASE_COLORS.glass.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BASE_COLORS.text.primary,
  },
  rawBadge: {
    backgroundColor: BASE_COLORS.semantic.danger + '20',
    borderWidth: 1,
    borderColor: BASE_COLORS.semantic.danger + '40',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rawBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
    color: BASE_COLORS.semantic.danger,
    letterSpacing: 0.5,
  },
  optimizedBadge: {
    backgroundColor: BASE_COLORS.semantic.success + '20',
    borderWidth: 1,
    borderColor: BASE_COLORS.semantic.success + '40',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  optimizedBadgeText: {
    fontSize: 10,
    fontWeight: FONT_WEIGHT.bold,
    color: BASE_COLORS.semantic.success,
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  video: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BASE_COLORS.background.primary,
  },
});
