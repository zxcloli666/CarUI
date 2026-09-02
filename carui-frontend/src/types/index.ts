// Car state types
export interface DoorState {
  front_left: boolean;
  front_right: boolean;
  rear_left: boolean;
  rear_right: boolean;
}

// Sensor positions on the vehicle
export type SensorPosition =
  // Rear sensors (left to right)
  | 'rear_left'
  | 'rear_center_left'
  | 'rear_center_right'
  | 'rear_right'
  // Front sensors (left to right)
  | 'front_left'
  | 'front_center_left'
  | 'front_center_right'
  | 'front_right'
  // Side sensors (near doors)
  | 'left_front'
  | 'left_rear'
  | 'right_front'
  | 'right_rear';

export interface ParkingSensor {
  position: SensorPosition;
  distance_cm: number;
}

export interface Position {
  lat: number;
  lon: number;
  bearing: number;
  speed_kmh: number;
}

export interface SpeedLimit {
  limit: number;
  gps_source: string;
  next_change?: {
    distance_m: number;
    current_limit: number;
    new_limit: number;
  };
}

// Radar types
export interface RadarAlert {
  source: 'camera' | 'radar';
  distance_m: number;
  speed_limit: number;
}

// WebSocket event types
export interface WsEvent {
  topic: string;    // "gpio", "speed", "weather", etc.
  type: string;     // "doors", "parking", "reverse", etc.
  data: unknown;
  // Aliases for backwards compat
  service?: string;
  event?: string;
}

export interface DoorsEvent {
  service: 'gpio';
  event: 'doors';
  data: DoorState;
  timestamp: number;
}

export interface ReverseEvent {
  service: 'gpio';
  event: 'reverse';
  data: { active: boolean };
  timestamp: number;
}

export interface ParkingEvent {
  service: 'gpio';
  event: 'parking';
  data: { sensors: ParkingSensor[] };
  timestamp: number;
}

export interface SpeedEvent {
  service: 'speed';
  event: 'speed_limit';
  data: SpeedLimit;
  timestamp: number;
}

// App types
export interface InstalledApp {
  packageName: string;
  appName: string;
  category: string;
  icon: string; // base64
}

// Battery types
export interface BatteryInfo {
  level: number;
  isCharging: boolean;
}

// Network types
export type CellularNetworkType = '5G' | 'LTE' | 'H+' | '3G' | 'E' | '2G' | '';

export interface NetworkInfo {
  type: 'wifi' | 'cellular' | 'none';
  isConnected: boolean;
  signalStrength: number; // 0-4
  wifiSSID?: string;
  cellularType?: CellularNetworkType;
}

// Recording types
export interface Recording {
  id: string;
  filename: string;
  size_bytes: number;
  duration_sec: number;
  created_at: string;
}

// Camera types
export type CameraId = 'front' | 'rear' | 'left' | 'right';

export interface CameraConfig {
  id: CameraId;
  name: string;
  url: string;
}

// Media Session types
export type PlaybackState = 'none' | 'playing' | 'paused' | 'buffering' | 'stopped';

export interface MediaAction {
  id: string;
  name: string;
  icon: 'play' | 'pause' | 'skip_next' | 'skip_previous' | 'stop' | 'fast_forward' | 'rewind' | 'shuffle' | 'repeat' | 'heart' | 'thumbs_down' | 'plus' | 'share' | 'download' | 'list' | 'clock' | 'sliders' | 'text' | 'radio' | 'custom';
  isCustom?: boolean;
  nativeIcon?: string; // base64 PNG from the media app's native icon
}

export interface MediaMetadata {
  title: string;
  artist: string;
  album: string;
  albumArt?: string; // base64 or URI
  duration: number; // milliseconds
  position: number; // milliseconds
}

export interface MediaSession {
  packageName: string;
  appName: string;
  appIcon?: string; // base64
  isActive: boolean;
  playbackState: PlaybackState;
  metadata: MediaMetadata;
  actions: MediaAction[];
  supportsSeek: boolean;
}

export interface MusicApp {
  packageName: string;
  appName: string;
  icon: string; // base64
  isMediaApp: boolean;
}
