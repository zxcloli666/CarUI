import { findNodeHandle, NativeModules } from 'react-native';

type CaptureFormat = 'png' | 'jpg' | 'webm' | 'raw';
type CaptureResult = 'tmpfile' | 'base64' | 'data-uri' | 'zip-base64';

export type CaptureOptions = {
  format?: CaptureFormat;
  quality?: number;
  result?: CaptureResult;
  snapshotContentContainer?: boolean;
  handleGLSurfaceViewOnAndroid?: boolean;
  width?: number;
  height?: number;
  fileName?: string;
};

type ScreenCaptureModuleNative = {
  captureRef: (tag: number, options: CaptureOptions) => Promise<string>;
  captureScreen: (options: CaptureOptions) => Promise<string>;
  releaseCapture?: (uri: string) => void;
};

const { ScreenCaptureModule } = NativeModules as {
  ScreenCaptureModule?: ScreenCaptureModuleNative;
};

const DEFAULT_OPTIONS: Required<Pick<CaptureOptions, 'format' | 'quality' | 'result'>> = {
  format: 'jpg',
  quality: 0.7,
  result: 'tmpfile',
};

function normalizeOptions(options: CaptureOptions = {}): CaptureOptions {
  const quality =
    typeof options.quality === 'number'
      ? Math.min(Math.max(options.quality, 0), 1)
      : DEFAULT_OPTIONS.quality;
  return {
    ...DEFAULT_OPTIONS,
    ...options,
    quality,
  };
}

function requireModule(): ScreenCaptureModuleNative {
  if (!ScreenCaptureModule) {
    throw new Error('ScreenCaptureModule is not available');
  }
  return ScreenCaptureModule;
}

export async function captureRef(
  view: number | { current?: any } | any,
  options?: CaptureOptions
): Promise<string> {
  const mod = requireModule();
  let tag = view;
  if (tag && typeof tag === 'object' && 'current' in tag) {
    tag = tag.current;
  }
  if (typeof tag !== 'number') {
    const handle = findNodeHandle(tag);
    if (!handle) {
      throw new Error(`findNodeHandle failed to resolve view=${String(tag)}`);
    }
    tag = handle;
  }
  return mod.captureRef(tag, normalizeOptions(options));
}

export async function captureScreen(options?: CaptureOptions): Promise<string> {
  return requireModule().captureScreen(normalizeOptions(options));
}

export function releaseCapture(uri: string): void {
  requireModule().releaseCapture?.(uri);
}
