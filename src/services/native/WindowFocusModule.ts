import { NativeModules, NativeEventEmitter } from 'react-native';

interface WindowFocusModuleInterface {
  getWindowFocus(): Promise<boolean>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const { WindowFocusModule } = NativeModules as { WindowFocusModule: WindowFocusModuleInterface };

const emitter = new NativeEventEmitter(WindowFocusModule);

export async function getWindowFocus(): Promise<boolean> {
  try {
    return await WindowFocusModule.getWindowFocus();
  } catch {
    return true;
  }
}

export function subscribeWindowFocus(listener: (hasFocus: boolean) => void): () => void {
  const sub = emitter.addListener('windowFocusChanged', listener);
  return () => sub.remove();
}
