import { NativeModules } from 'react-native';

interface SystemModuleInterface {
  isIgnoringBatteryOptimizations(): Promise<boolean>;
  requestIgnoreBatteryOptimizations(): Promise<boolean>;
  isDefaultLauncher(): Promise<boolean>;
  openHomeSettings(): Promise<boolean>;
  startKeepAliveService(): Promise<boolean>;
  stopKeepAliveService(): Promise<boolean>;
  isKeepAliveRunning(): Promise<boolean>;
  isKeepAliveEnabled(): Promise<boolean>;
}

const { SystemModule } = NativeModules as { SystemModule: SystemModuleInterface };

export async function isIgnoringBatteryOptimizations(): Promise<boolean> {
  try {
    return await SystemModule.isIgnoringBatteryOptimizations();
  } catch {
    return false;
  }
}

export async function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  try {
    return await SystemModule.requestIgnoreBatteryOptimizations();
  } catch {
    return false;
  }
}

export async function isDefaultLauncher(): Promise<boolean> {
  try {
    return await SystemModule.isDefaultLauncher();
  } catch {
    return false;
  }
}

export async function openHomeSettings(): Promise<boolean> {
  try {
    return await SystemModule.openHomeSettings();
  } catch {
    return false;
  }
}

export async function startKeepAliveService(): Promise<boolean> {
  try {
    return await SystemModule.startKeepAliveService();
  } catch {
    return false;
  }
}

export async function stopKeepAliveService(): Promise<boolean> {
  try {
    return await SystemModule.stopKeepAliveService();
  } catch {
    return false;
  }
}

export async function isKeepAliveRunning(): Promise<boolean> {
  try {
    return await SystemModule.isKeepAliveRunning();
  } catch {
    return false;
  }
}

export async function isKeepAliveEnabled(): Promise<boolean> {
  try {
    return await SystemModule.isKeepAliveEnabled();
  } catch {
    return false;
  }
}
