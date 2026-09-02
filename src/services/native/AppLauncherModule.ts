import { NativeModules, Linking } from 'react-native';
import { InstalledApp } from '../../types';

interface ScreenDimensions {
  width: number;
  height: number;
  density: number;
  statusBarHeight: number;
  navBarHeight: number;
}

interface AppLauncherModuleInterface {
  getInstalledApps(): Promise<Array<{
    packageName: string;
    appName: string;
    activityName: string;
    category: string;
    icon: string;
  }>>;
  launchApp(packageName: string): Promise<boolean>;
  launchAppInFreeform(
    packageName: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<boolean>;
  openSettings(): Promise<boolean>;
  getScreenDimensions(): Promise<ScreenDimensions>;
}

const { AppLauncherModule } = NativeModules as { AppLauncherModule: AppLauncherModuleInterface };

function normalizeIcon(icon?: string): string {
  if (!icon) return '';
  if (icon.startsWith('data:') || icon.startsWith('content://') || icon.startsWith('file://')) {
    return icon;
  }
  return `data:image/png;base64,${icon}`;
}

export async function getInstalledApps(): Promise<InstalledApp[]> {
  try {
    const apps = await AppLauncherModule.getInstalledApps();
    return apps.map(app => ({
      packageName: app.packageName,
      appName: app.appName,
      category: app.category,
      icon: normalizeIcon(app.icon),
    }));
  } catch (error) {
    console.error('Failed to get installed apps:', error);
    return [];
  }
}

export async function launchApp(packageName: string): Promise<boolean> {
  try {
    return await AppLauncherModule.launchApp(packageName);
  } catch (error) {
    console.error('Failed to launch app:', error);
    return false;
  }
}

export async function launchAppInFreeform(
  packageName: string,
  x: number,
  y: number,
  width: number,
  height: number
): Promise<boolean> {
  try {
    return await AppLauncherModule.launchAppInFreeform(packageName, x, y, width, height);
  } catch (error) {
    console.error('Failed to launch app in freeform:', error);
    return false;
  }
}

export async function openSettings(): Promise<boolean> {
  try {
    return await AppLauncherModule.openSettings();
  } catch (error) {
    console.error('Failed to open settings:', error);
    return false;
  }
}

export async function getScreenDimensions(): Promise<ScreenDimensions> {
  try {
    return await AppLauncherModule.getScreenDimensions();
  } catch (error) {
    console.error('Failed to get screen dimensions:', error);
    return { width: 1920, height: 1080, density: 2, statusBarHeight: 0, navBarHeight: 0 };
  }
}

// Known app package names for quick access
export const KNOWN_APPS = {
  yandexNavigator: 'ru.yandex.yandexnavi',
  dgisNavigator: 'ru.dublgis.dgismobile',
  yandexMusic: 'ru.yandex.music',
  spotify: 'com.spotify.music',
  youtube: 'com.google.android.youtube',
  telegram: 'org.telegram.messenger',
  chrome: 'com.android.chrome',
  settings: 'com.android.settings',
  camera: 'com.android.camera',
};

export async function isAppInstalled(packageName: string): Promise<boolean> {
  try {
    const apps = await AppLauncherModule.getInstalledApps();
    return apps.some(app => app.packageName === packageName);
  } catch (error) {
    console.error('Failed to check if app is installed:', error);
    return false;
  }
}

export async function getNavigatorApps(): Promise<InstalledApp[]> {
  const navigatorPackages = [
    'ru.dublgis.dgismobile',      // 2GIS
    'ru.yandex.yandexnavi',       // Yandex Navigator
    'com.google.android.apps.maps', // Google Maps
    'com.waze',                    // Waze
    'com.sygic.aura',             // Sygic
    'osmand.net',                  // OsmAnd
    'com.here.app.maps',          // HERE WeGo
  ];

  try {
    const allApps = await getInstalledApps();
    return allApps.filter(app => navigatorPackages.includes(app.packageName));
  } catch (error) {
    console.error('Failed to get navigator apps:', error);
    return [];
  }
}

export async function openInStore(packageName: string): Promise<boolean> {
  // Try RuStore first, then Play Store
  const ruStoreUrl = `rustore://apps.rustore.ru/app/${packageName}`;
  const playStoreUrl = `market://details?id=${packageName}`;
  const webPlayStoreUrl = `https://play.google.com/store/apps/details?id=${packageName}`;

  try {
    // Try RuStore
    const canOpenRuStore = await Linking.canOpenURL(ruStoreUrl);
    if (canOpenRuStore) {
      await Linking.openURL(ruStoreUrl);
      return true;
    }

    // Try Play Store app
    const canOpenPlayStore = await Linking.canOpenURL(playStoreUrl);
    if (canOpenPlayStore) {
      await Linking.openURL(playStoreUrl);
      return true;
    }

    // Fallback to web Play Store
    await Linking.openURL(webPlayStoreUrl);
    return true;
  } catch (error) {
    console.error('Failed to open store:', error);
    return false;
  }
}
