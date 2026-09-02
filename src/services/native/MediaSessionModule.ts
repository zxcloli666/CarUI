import { NativeModules, NativeEventEmitter, EmitterSubscription } from 'react-native';
import { MediaSession, MusicApp, PlaybackState, MediaAction } from '../../types';

// Raw action from native module (now includes full info)
interface RawAction {
  id: string;
  name: string;
  icon: string;
  isCustom: boolean;
  nativeIcon?: string; // file:// or data: URI from the media app's native icon
}

interface RawMediaSession {
  packageName: string;
  appName: string;
  appIcon?: string;
  isActive: boolean;
  playbackState: string;
  title: string;
  artist: string;
  album: string;
  albumArt?: string;
  duration: number;
  position: number;
  actions: RawAction[];
  supportsSeek: boolean;
}

interface MediaSessionModuleInterface {
  getActiveMediaSession(): Promise<RawMediaSession | null>;
  getAllMediaSessions(): Promise<RawMediaSession[]>;
  getMusicApps(): Promise<MusicApp[]>;
  performAction(packageName: string, actionId: string): Promise<boolean>;
  seekTo(packageName: string, position: number): Promise<boolean>;
  play(packageName: string): Promise<boolean>;
  pause(packageName: string): Promise<boolean>;
  skipNext(packageName: string): Promise<boolean>;
  skipPrevious(packageName: string): Promise<boolean>;
  hasNotificationListenerPermission(): Promise<boolean>;
  requestNotificationListenerPermission(): Promise<void>;
  startPolling(intervalMs: number): Promise<boolean>;
  stopPolling(): Promise<boolean>;
}

const { MediaSessionModule: NativeMediaSessionModule } = NativeModules as {
  MediaSessionModule: MediaSessionModuleInterface;
};

const eventEmitter = NativeMediaSessionModule
  ? new NativeEventEmitter(NativeModules.MediaSessionModule)
  : null;

function parsePlaybackState(state: string): PlaybackState {
  switch (state?.toLowerCase()) {
    case 'playing':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'buffering':
      return 'buffering';
    case 'stopped':
      return 'stopped';
    default:
      return 'none';
  }
}

// Map icon string from native to our icon type
function mapIconType(icon: string): MediaAction['icon'] {
  const iconMap: Record<string, MediaAction['icon']> = {
    play: 'play',
    pause: 'pause',
    skip_next: 'skip_next',
    skip_previous: 'skip_previous',
    stop: 'stop',
    fast_forward: 'fast_forward',
    rewind: 'rewind',
    shuffle: 'shuffle',
    repeat: 'repeat',
    heart: 'heart',
    thumbs_down: 'thumbs_down',
    plus: 'plus',
    share: 'share',
    download: 'download',
    list: 'list',
    clock: 'clock',
    sliders: 'sliders',
    text: 'text',
    radio: 'radio',
  };

  return iconMap[icon] || 'custom';
}

function parseActions(rawActions: RawAction[]): MediaAction[] {
  if (!rawActions || !Array.isArray(rawActions)) return [];

  return rawActions.map((action) => ({
    id: action.id,
    name: action.name,
    icon: mapIconType(action.icon),
    isCustom: action.isCustom ?? false,
    nativeIcon: action.nativeIcon,
  }));
}

function parseRawSession(raw: RawMediaSession): MediaSession {
  return {
    packageName: raw.packageName,
    appName: raw.appName,
    appIcon: raw.appIcon,
    isActive: raw.isActive,
    playbackState: parsePlaybackState(raw.playbackState),
    metadata: {
      title: raw.title || 'Неизвестный трек',
      artist: raw.artist || 'Неизвестный исполнитель',
      album: raw.album || '',
      albumArt: raw.albumArt,
      duration: raw.duration || 0,
      position: raw.position || 0,
    },
    actions: parseActions(raw.actions),
    supportsSeek: raw.supportsSeek ?? false,
  };
}

export async function getActiveMediaSession(): Promise<MediaSession | null> {
  try {
    if (!NativeMediaSessionModule) {
      console.warn('MediaSessionModule not available');
      return null;
    }
    const raw = await NativeMediaSessionModule.getActiveMediaSession();
    if (!raw) return null;
    return parseRawSession(raw);
  } catch (error) {
    console.error('Failed to get active media session:', error);
    return null;
  }
}

export async function getAllMediaSessions(): Promise<MediaSession[]> {
  try {
    if (!NativeMediaSessionModule) return [];
    const sessions = await NativeMediaSessionModule.getAllMediaSessions();
    return sessions.map(parseRawSession);
  } catch (error) {
    console.error('Failed to get all media sessions:', error);
    return [];
  }
}

export async function getMusicApps(): Promise<MusicApp[]> {
  try {
    if (!NativeMediaSessionModule) return [];
    return await NativeMediaSessionModule.getMusicApps();
  } catch (error) {
    console.error('Failed to get music apps:', error);
    return [];
  }
}

export async function performMediaAction(
  packageName: string,
  actionId: string
): Promise<boolean> {
  try {
    if (!NativeMediaSessionModule) return false;
    return await NativeMediaSessionModule.performAction(packageName, actionId);
  } catch (error) {
    console.error('Failed to perform media action:', error);
    return false;
  }
}

export async function seekTo(packageName: string, position: number): Promise<boolean> {
  try {
    if (!NativeMediaSessionModule) return false;
    return await NativeMediaSessionModule.seekTo(packageName, position);
  } catch (error) {
    console.error('Failed to seek:', error);
    return false;
  }
}

export async function play(packageName: string): Promise<boolean> {
  try {
    if (!NativeMediaSessionModule) return false;
    return await NativeMediaSessionModule.play(packageName);
  } catch (error) {
    console.error('Failed to play:', error);
    return false;
  }
}

export async function pause(packageName: string): Promise<boolean> {
  try {
    if (!NativeMediaSessionModule) return false;
    return await NativeMediaSessionModule.pause(packageName);
  } catch (error) {
    console.error('Failed to pause:', error);
    return false;
  }
}

export async function skipNext(packageName: string): Promise<boolean> {
  try {
    if (!NativeMediaSessionModule) return false;
    return await NativeMediaSessionModule.skipNext(packageName);
  } catch (error) {
    console.error('Failed to skip next:', error);
    return false;
  }
}

export async function skipPrevious(packageName: string): Promise<boolean> {
  try {
    if (!NativeMediaSessionModule) return false;
    return await NativeMediaSessionModule.skipPrevious(packageName);
  } catch (error) {
    console.error('Failed to skip previous:', error);
    return false;
  }
}

export async function hasNotificationListenerPermission(): Promise<boolean> {
  try {
    if (!NativeMediaSessionModule) return false;
    return await NativeMediaSessionModule.hasNotificationListenerPermission();
  } catch (error) {
    console.error('Failed to check notification listener permission:', error);
    return false;
  }
}

export async function requestNotificationListenerPermission(): Promise<void> {
  try {
    if (!NativeMediaSessionModule) return;
    await NativeMediaSessionModule.requestNotificationListenerPermission();
  } catch (error) {
    console.error('Failed to request notification listener permission:', error);
  }
}

export async function startPolling(intervalMs: number = 1000): Promise<boolean> {
  try {
    if (!NativeMediaSessionModule) return false;
    return await NativeMediaSessionModule.startPolling(intervalMs);
  } catch (error) {
    console.error('Failed to start polling:', error);
    return false;
  }
}

export async function stopPolling(): Promise<boolean> {
  try {
    if (!NativeMediaSessionModule) return false;
    return await NativeMediaSessionModule.stopPolling();
  } catch (error) {
    console.error('Failed to stop polling:', error);
    return false;
  }
}

export type MediaSessionEventCallback = (session: MediaSession | null) => void;

export function subscribeToMediaSessionUpdates(
  callback: MediaSessionEventCallback
): EmitterSubscription | null {
  if (!eventEmitter) return null;

  return eventEmitter.addListener('onMediaSessionChanged', (raw: RawMediaSession | null) => {
    callback(raw ? parseRawSession(raw) : null);
  });
}

export function subscribeToPlaybackPositionUpdates(
  callback: (position: number, duration: number) => void
): EmitterSubscription | null {
  if (!eventEmitter) return null;

  return eventEmitter.addListener(
    'onPlaybackPositionChanged',
    (data: { position: number; duration: number }) => {
      callback(data.position, data.duration);
    }
  );
}
