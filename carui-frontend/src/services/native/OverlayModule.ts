import { NativeModules } from 'react-native';

interface OverlayModuleInterface {
  canDrawOverlays(): Promise<boolean>;
  requestOverlayPermission(): Promise<boolean>;
  bringToFront(): Promise<boolean>;
  setKeepScreenOn(enabled: boolean): Promise<boolean>;
  setFullscreen(enabled: boolean): Promise<boolean>;
  showBackToCarUIButton(): Promise<boolean>;
  hideBackToCarUIButton(): Promise<boolean>;
  showParkingOverlay(frontDistance: number, rearDistance: number, leftDistance: number, rightDistance: number): Promise<boolean>;
  updateParkingOverlay(frontDistance: number, rearDistance: number, leftDistance: number, rightDistance: number): Promise<boolean>;
  hideParkingOverlay(): Promise<boolean>;
  showMusicOverlay(title: string, artist: string, isPlaying: boolean): Promise<boolean>;
  updateMusicOverlay(title: string, artist: string, isPlaying: boolean): Promise<boolean>;
  hideMusicOverlay(): Promise<boolean>;
  closeAllFreeformWindows(): Promise<boolean>;
}

const { OverlayModule } = NativeModules as { OverlayModule: OverlayModuleInterface };

export async function canDrawOverlays(): Promise<boolean> {
  try {
    return await OverlayModule.canDrawOverlays();
  } catch {
    return false;
  }
}

export async function requestOverlayPermission(): Promise<boolean> {
  try {
    return await OverlayModule.requestOverlayPermission();
  } catch {
    return false;
  }
}

export async function bringToFront(): Promise<boolean> {
  try {
    return await OverlayModule.bringToFront();
  } catch {
    return false;
  }
}

export async function setKeepScreenOn(enabled: boolean): Promise<boolean> {
  try {
    return await OverlayModule.setKeepScreenOn(enabled);
  } catch {
    return false;
  }
}

export async function setFullscreen(enabled: boolean): Promise<boolean> {
  try {
    return await OverlayModule.setFullscreen(enabled);
  } catch {
    return false;
  }
}

export async function showBackToCarUIButton(): Promise<boolean> {
  try {
    return await OverlayModule.showBackToCarUIButton();
  } catch {
    return false;
  }
}

export async function hideBackToCarUIButton(): Promise<boolean> {
  try {
    return await OverlayModule.hideBackToCarUIButton();
  } catch {
    return false;
  }
}

export async function closeAllFreeformWindows(): Promise<boolean> {
  try {
    return await OverlayModule.closeAllFreeformWindows();
  } catch {
    return false;
  }
}

export async function showParkingOverlay(
  frontDistance: number,
  rearDistance: number,
  leftDistance: number,
  rightDistance: number
): Promise<boolean> {
  try {
    return await OverlayModule.showParkingOverlay(frontDistance, rearDistance, leftDistance, rightDistance);
  } catch {
    return false;
  }
}

export async function updateParkingOverlay(
  frontDistance: number,
  rearDistance: number,
  leftDistance: number,
  rightDistance: number
): Promise<boolean> {
  try {
    return await OverlayModule.updateParkingOverlay(frontDistance, rearDistance, leftDistance, rightDistance);
  } catch {
    return false;
  }
}

export async function hideParkingOverlay(): Promise<boolean> {
  try {
    return await OverlayModule.hideParkingOverlay();
  } catch {
    return false;
  }
}

export async function showMusicOverlay(
  title: string,
  artist: string,
  isPlaying: boolean
): Promise<boolean> {
  try {
    return await OverlayModule.showMusicOverlay(title, artist, isPlaying);
  } catch {
    return false;
  }
}

export async function updateMusicOverlay(
  title: string,
  artist: string,
  isPlaying: boolean
): Promise<boolean> {
  try {
    return await OverlayModule.updateMusicOverlay(title, artist, isPlaying);
  } catch {
    return false;
  }
}

export async function hideMusicOverlay(): Promise<boolean> {
  try {
    return await OverlayModule.hideMusicOverlay();
  } catch {
    return false;
  }
}
