import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraStream } from './CameraStream';
import { ParkingWidget } from '../dashboard';
import { CAMERA_STREAMS } from '../../services/config';
import { CameraId } from '../../types';
import { SPACING } from '../../theme/constants';
import { CAMERAS } from './helpers';

const QUAD_FPS = 15;
const SINGLE_FPS = 30;

export const QuadView = memo(function QuadView({ active }: { active: boolean }) {
  return (
    <View style={s.quadGrid}>
      <View style={s.quadRow}>
        <CameraStream name="Передняя" url={CAMERA_STREAMS.front} active={active} maxFps={QUAD_FPS} />
        <CameraStream name="Задняя" url={CAMERA_STREAMS.rear} active={active} maxFps={QUAD_FPS} />
      </View>
      <View style={s.quadRow}>
        <CameraStream name="Левая" url={CAMERA_STREAMS.left} active={active} maxFps={QUAD_FPS} />
        <CameraStream name="Правая" url={CAMERA_STREAMS.right} active={active} maxFps={QUAD_FPS} />
      </View>
    </View>
  );
});

export const SingleView = memo(function SingleView({
  cameraId,
  active,
}: {
  cameraId: CameraId;
  active: boolean;
}) {
  const name = CAMERAS.find((c) => c.id === cameraId)?.name ?? '';
  return (
    <CameraStream
      name={name}
      url={CAMERA_STREAMS[cameraId]}
      active={active}
      fullscreen
      maxFps={SINGLE_FPS}
    />
  );
});

export const RearView = memo(function RearView({ active }: { active: boolean }) {
  return (
    <View style={s.rearView}>
      <CameraStream
        name="Задняя камера"
        url={CAMERA_STREAMS.rear}
        active={active}
        fullscreen
        maxFps={SINGLE_FPS}
      />
      <View style={s.parkingOverlay}>
        <ParkingWidget />
      </View>
    </View>
  );
});

const s = StyleSheet.create({
  quadGrid: {
    flex: 1,
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  quadRow: {
    flex: 1,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  rearView: {
    flex: 1,
  },
  parkingOverlay: {
    position: 'absolute',
    bottom: SPACING.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
