import React from 'react';
import {
  requireNativeComponent,
  ViewProps,
  NativeSyntheticEvent,
} from 'react-native';

export type MjpegStatus = 'idle' | 'connecting' | 'streaming' | 'error';

export interface MjpegViewProps extends ViewProps {
  url: string;
  paused?: boolean;
  maxFps?: number;
  retryDelayMs?: number;
  resizeMode?: 'contain' | 'cover' | 'stretch';
  onStatus?: (event: NativeSyntheticEvent<{ status: MjpegStatus }>) => void;
}

const NativeMjpegView = requireNativeComponent<MjpegViewProps>('MjpegView');

export function MjpegView(props: MjpegViewProps) {
  return <NativeMjpegView {...props} />;
}
