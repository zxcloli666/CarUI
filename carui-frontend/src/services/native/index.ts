export { getBatteryInfo } from './BatteryModule';
export { getNetworkInfo } from './NetworkModule';
export { requestDuckFocus, abandonDuckFocus } from './AudioFocusModule';
export type { InstalledApp } from '../../types';
export {
  getInstalledApps,
  launchApp,
  launchAppInFreeform,
  openSettings,
  getScreenDimensions,
  isAppInstalled,
  getNavigatorApps,
  openInStore,
  KNOWN_APPS,
} from './AppLauncherModule';
export {
  canDrawOverlays,
  requestOverlayPermission,
  bringToFront,
  setKeepScreenOn,
  setFullscreen,
  showBackToCarUIButton,
  hideBackToCarUIButton,
  showParkingOverlay,
  updateParkingOverlay,
  hideParkingOverlay,
  showMusicOverlay,
  updateMusicOverlay,
  hideMusicOverlay,
  closeAllFreeformWindows,
} from './OverlayModule';
export {
  getActiveMediaSession,
  getAllMediaSessions,
  getMusicApps,
  performMediaAction,
  seekTo,
  play,
  pause,
  skipNext,
  skipPrevious,
  hasNotificationListenerPermission,
  requestNotificationListenerPermission,
  subscribeToMediaSessionUpdates,
  subscribeToPlaybackPositionUpdates,
  startPolling,
  stopPolling,
} from './MediaSessionModule';
export {
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
  isDefaultLauncher,
  openHomeSettings,
  startKeepAliveService,
  stopKeepAliveService,
  isKeepAliveRunning,
  isKeepAliveEnabled,
} from './SystemModule';
export { getWindowFocus, subscribeWindowFocus } from './WindowFocusModule';
export { captureRef, captureScreen, releaseCapture } from './ScreenCaptureModule';
export type { CaptureOptions } from './ScreenCaptureModule';
