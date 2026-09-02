import { NativeModules, Platform } from 'react-native';

interface AudioFocusModuleInterface {
  requestDuckFocus(): Promise<boolean>;
  abandonDuckFocus(): Promise<boolean>;
}

const { AudioFocusModule } = NativeModules as {
  AudioFocusModule?: AudioFocusModuleInterface;
};

export async function requestDuckFocus(): Promise<boolean> {
  if (Platform.OS !== 'android' || !AudioFocusModule) return false;
  try {
    return await AudioFocusModule.requestDuckFocus();
  } catch (error) {
    console.error('[AudioFocus] request failed:', error);
    return false;
  }
}

export async function abandonDuckFocus(): Promise<boolean> {
  if (Platform.OS !== 'android' || !AudioFocusModule) return false;
  try {
    return await AudioFocusModule.abandonDuckFocus();
  } catch (error) {
    console.error('[AudioFocus] abandon failed:', error);
    return false;
  }
}
