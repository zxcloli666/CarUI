import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useShallow } from 'zustand/shallow';
import { Camera, Grid2X2, RefreshCw } from 'lucide-react-native';
import { FrozenScreen } from '../components/common';
import { ParkingWidget } from '../components/dashboard';
import {
  QuadView,
  SingleView,
  RearView,
  RecordingBadge,
  CameraTile,
  RecordingRow,
  VideoPlayerModal,
  formatTimestamp,
  CAMERAS,
} from '../components/cameras';
import { useScreenActive } from '../hooks';
import { useAccentColor } from '../hooks/useTheme';
import { useCarStore } from '../app/store';
import { useCamerasStore, RecordingItem } from '../app/store/camerasStore';
import { gatewayService } from '../services';
import { API } from '../services/config';
import { WsEvent } from '../types';
import {
  BASE_COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  ICON_SIZE,
  scale,
} from '../theme/constants';

const SIDEBAR_W = scale(260);

export function CamerasScreen() {
  const screenActive = useScreenActive();
  const accent = useAccentColor();
  const isReverse = useCarStore((state) => state.isReverse);

  const {
    viewMode, selectedCamera,
    isRecording, recordingBusy,
    recordings, recordingsLoading,
  } = useCamerasStore(useShallow((state) => ({
    viewMode: state.viewMode,
    selectedCamera: state.selectedCamera,
    isRecording: state.isRecording,
    recordingBusy: state.recordingBusy,
    recordings: state.recordings,
    recordingsLoading: state.recordingsLoading,
  })));

  const actions = useCamerasStore(useShallow((state) => ({
    setViewMode: state.setViewMode,
    selectCamera: state.selectCamera,
    toggleRecording: state.toggleRecording,
    syncRecordingStatus: state.syncRecordingStatus,
    refreshRecordings: state.refreshRecordings,
    deleteRecording: state.deleteRecording,
    handleWsEvent: state.handleWsEvent,
  })));

  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [playbackTitle, setPlaybackTitle] = useState('');
  const [playbackSource, setPlaybackSource] = useState<RecordingItem['source']>('video');

  useEffect(() => {
    if (isReverse) actions.setViewMode('rear');
  }, [isReverse, actions]);

  useEffect(() => {
    if (screenActive) {
      actions.syncRecordingStatus();
      actions.refreshRecordings();
    }
  }, [screenActive, actions]);

  useEffect(() => {
    return gatewayService.subscribeToStatus((status) => {
      if (status === 'connected') {
        actions.syncRecordingStatus();
        actions.refreshRecordings();
      }
    });
  }, [actions]);

  useEffect(() => {
    return gatewayService.subscribe((event: WsEvent) => {
      actions.handleWsEvent(event);
      if (event.topic === 'system' && event.type === 'connected') {
        actions.syncRecordingStatus();
        actions.refreshRecordings();
      }
    });
  }, [actions]);

  const handlePlay = useCallback((item: RecordingItem) => {
    setPlaybackUrl(`${API.cameras}/recordings/${item.id}`);
    setPlaybackTitle(formatTimestamp(item.timestamp));
    setPlaybackSource(item.source);
  }, []);

  const handleClosePlayer = useCallback(() => setPlaybackUrl(null), []);

  const handleDelete = useCallback((item: RecordingItem) => {
    Alert.alert('Удалить запись?', formatTimestamp(item.timestamp), [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => actions.deleteRecording(item.id) },
    ]);
  }, [actions]);

  const cameraTiles = useMemo(() => {
    const rows = [CAMERAS.slice(0, 2), CAMERAS.slice(2, 4)];
    return rows.map((row, ri) => (
      <View key={ri} style={s.tileRow}>
        {row.map((cam) => {
          const selected = viewMode === 'single' && selectedCamera === cam.id;
          return (
            <CameraTile
              key={cam.id}
              icon={<Camera size={ICON_SIZE.sm} color={selected ? accent.primary : BASE_COLORS.text.secondary} />}
              label={cam.name}
              active={selected}
              accent={accent}
              onPress={() => actions.selectCamera(cam.id)}
              style={s.tileFlex}
            />
          );
        })}
      </View>
    ));
  }, [viewMode, selectedCamera, accent, actions]);

  return (
    <FrozenScreen active={screenActive} style={s.screen}>
      <View style={s.layout}>
        <View style={s.cameraArea}>
          {viewMode === 'quad' && <QuadView active={screenActive} />}
          {viewMode === 'single' && <SingleView cameraId={selectedCamera} active={screenActive} />}
          {viewMode === 'rear' && <RearView active={screenActive} />}
          {isRecording && (
            <View style={s.recBadgePos}>
              <RecordingBadge />
            </View>
          )}
        </View>

        <View style={s.sidebar}>
          <View style={s.card}>
            <Text style={s.sectionLabel}>КАМЕРЫ</Text>
            <CameraTile
              icon={<Grid2X2 size={ICON_SIZE.sm} color={viewMode === 'quad' ? accent.primary : BASE_COLORS.text.secondary} />}
              label="Все камеры"
              active={viewMode === 'quad'}
              accent={accent}
              onPress={() => actions.setViewMode('quad')}
            />
            {cameraTiles}
          </View>

          <TouchableOpacity
            style={[s.card, s.recordBtn, isRecording && s.recordBtnActive, recordingBusy && { opacity: 0.5 }]}
            onPress={actions.toggleRecording}
            disabled={recordingBusy}
            activeOpacity={0.65}
          >
            {recordingBusy ? (
              <ActivityIndicator size="small" color={BASE_COLORS.text.primary} />
            ) : (
              <View style={[s.recordDot, isRecording && s.recordDotActive]} />
            )}
            <Text style={[s.recordLabel, isRecording && s.recordLabelActive]}>
              {isRecording ? 'Остановить запись' : 'Начать запись'}
            </Text>
          </TouchableOpacity>

          <View style={s.recordingsWrap}>
            <TouchableOpacity
              style={[s.card, s.recordingsHeader]}
              onPress={actions.refreshRecordings}
              disabled={recordingsLoading}
              activeOpacity={0.55}
            >
              <Text style={s.recordingsTitle}>ЗАПИСИ</Text>
              {recordingsLoading ? (
                <ActivityIndicator size="small" color={BASE_COLORS.text.tertiary} />
              ) : (
                <RefreshCw size={ICON_SIZE.xs} color={BASE_COLORS.text.tertiary} />
              )}
            </TouchableOpacity>

            {recordingsLoading && recordings.length === 0 ? (
              <View style={s.placeholder}>
                <ActivityIndicator size="small" color={BASE_COLORS.text.tertiary} />
              </View>
            ) : recordings.length === 0 ? (
              <View style={s.placeholder}>
                <Text style={s.placeholderText}>Нет записей</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={s.recordingsScroll} contentContainerStyle={s.recordingsContent}>
                {recordings.map((item, i) => (
                  <RecordingRow
                    key={item.id}
                    item={item}
                    isLast={i === recordings.length - 1}
                    onPress={() => handlePlay(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </View>

      {playbackUrl && (
        <VideoPlayerModal url={playbackUrl} title={playbackTitle} source={playbackSource} onClose={handleClosePlayer} />
      )}
    </FrozenScreen>
  );
}

const s = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BASE_COLORS.background.primary,
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
  },
  cameraArea: {
    flex: 1,
  },
  recBadgePos: {
    position: 'absolute',
    top: SPACING.md,
    right: SPACING.md,
  },
  sidebar: {
    width: SIDEBAR_W,
    padding: SPACING.sm,
    gap: SPACING.sm,
    backgroundColor: BASE_COLORS.background.secondary,
    borderLeftWidth: 1,
    borderLeftColor: BASE_COLORS.glass.border,
  },
  card: {
    backgroundColor: BASE_COLORS.glass.background,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: BASE_COLORS.glass.border,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  sectionLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
    color: BASE_COLORS.text.tertiary,
    letterSpacing: 1.5,
  },
  tileRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  tileFlex: {
    flex: 1,
  },
  recordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  recordBtnActive: {
    backgroundColor: BASE_COLORS.semantic.danger + '15',
    borderColor: BASE_COLORS.semantic.danger + '40',
  },
  recordDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: BASE_COLORS.text.disabled,
  },
  recordDotActive: {
    backgroundColor: BASE_COLORS.semantic.danger,
  },
  recordLabel: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BASE_COLORS.text.secondary,
  },
  recordLabelActive: {
    color: BASE_COLORS.semantic.danger,
  },
  recordingsWrap: {
    flex: 1,
    gap: SPACING.sm,
  },
  recordingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordingsTitle: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold,
    color: BASE_COLORS.text.tertiary,
    letterSpacing: 1.5,
  },
  recordingsScroll: {
    flex: 1,
  },
  recordingsContent: {
    paddingBottom: SPACING.xs,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  placeholderText: {
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.medium,
    color: BASE_COLORS.text.disabled,
  },
});
