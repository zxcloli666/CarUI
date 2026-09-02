import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GATEWAY_HOST, GATEWAY_PORT } from '../../services/config';
import { AccentPresetId, DEFAULT_ACCENT } from '../../theme/constants';

// Known navigator apps with their package names
export const NAVIGATOR_APPS = {
  dgis: {
    packageName: 'ru.dublgis.dgismobile',
    name: '2ГИС',
  },
  yandex: {
    packageName: 'ru.yandex.yandexnavi',
    name: 'Яндекс Навигатор',
  },
} as const;

export type NavigatorAppId = keyof typeof NAVIGATOR_APPS | 'custom';

interface SettingsState {
  // Gateway settings
  gatewayHost: string;
  gatewayPort: string;
  setGateway: (host: string, port: string) => void;

  // Audio settings
  audioEnabled: boolean;
  audioPack: string;
  audioVolume: number;
  weatherAudioEnabled: boolean;
  speedAudioEnabled: boolean;
  gpioAudioEnabled: boolean;
  connectionAudioEnabled: boolean;
  speedWarningThreshold: number; // Порог превышения скорости для предупреждения (км/ч)
  setAudioEnabled: (enabled: boolean) => void;
  setAudioPack: (pack: string) => void;
  setAudioVolume: (volume: number) => void;
  setWeatherAudioEnabled: (enabled: boolean) => void;
  setSpeedAudioEnabled: (enabled: boolean) => void;
  setGpioAudioEnabled: (enabled: boolean) => void;
  setConnectionAudioEnabled: (enabled: boolean) => void;
  setSpeedWarningThreshold: (threshold: number) => void;

  // Camera settings
  recordingQuality: '720p' | '1080p';
  segmentDuration: number;
  autoCleanup: boolean;
  retentionDays: number;
  setRecordingQuality: (quality: '720p' | '1080p') => void;
  setSegmentDuration: (duration: number) => void;
  setAutoCleanup: (enabled: boolean) => void;
  setRetentionDays: (days: number) => void;

  // Navigator settings
  navigatorApp: NavigatorAppId;
  customNavigatorPackage: string | null;
  setNavigatorApp: (app: NavigatorAppId, customPackage?: string) => void;

  // Appearance settings
  accentPreset: AccentPresetId | 'custom';
  accentHue: number; // 0-360 для кастомного цвета
  setAccentPreset: (preset: AccentPresetId | 'custom') => void;
  setAccentHue: (hue: number) => void;

  // Load/save
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
}

const SETTINGS_KEY = 'carui_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  gatewayHost: GATEWAY_HOST,
  gatewayPort: GATEWAY_PORT,
  setGateway: (gatewayHost, gatewayPort) => {
    set({ gatewayHost, gatewayPort });
    get().saveSettings();
  },

  audioEnabled: true,
  audioPack: 'loli',
  audioVolume: 0.8,
  weatherAudioEnabled: true,
  speedAudioEnabled: true,
  gpioAudioEnabled: true,
  connectionAudioEnabled: true,
  speedWarningThreshold: 5,
  setAudioEnabled: (audioEnabled) => {
    set({ audioEnabled });
    get().saveSettings();
  },
  setAudioPack: (audioPack) => {
    set({ audioPack });
    get().saveSettings();
  },
  setAudioVolume: (audioVolume) => {
    set({ audioVolume });
    get().saveSettings();
  },
  setWeatherAudioEnabled: (weatherAudioEnabled) => {
    set({ weatherAudioEnabled });
    get().saveSettings();
  },
  setSpeedAudioEnabled: (speedAudioEnabled) => {
    set({ speedAudioEnabled });
    get().saveSettings();
  },
  setGpioAudioEnabled: (gpioAudioEnabled) => {
    set({ gpioAudioEnabled });
    get().saveSettings();
  },
  setConnectionAudioEnabled: (connectionAudioEnabled) => {
    set({ connectionAudioEnabled });
    get().saveSettings();
  },
  setSpeedWarningThreshold: (speedWarningThreshold) => {
    set({ speedWarningThreshold });
    get().saveSettings();
  },

  recordingQuality: '1080p',
  segmentDuration: 300,
  autoCleanup: true,
  retentionDays: 7,
  setRecordingQuality: (recordingQuality) => {
    set({ recordingQuality });
    get().saveSettings();
  },
  setSegmentDuration: (segmentDuration) => {
    set({ segmentDuration });
    get().saveSettings();
  },
  setAutoCleanup: (autoCleanup) => {
    set({ autoCleanup });
    get().saveSettings();
  },
  setRetentionDays: (retentionDays) => {
    set({ retentionDays });
    get().saveSettings();
  },

  navigatorApp: 'dgis',
  customNavigatorPackage: null,
  setNavigatorApp: (navigatorApp, customPackage) => {
    set({
      navigatorApp,
      customNavigatorPackage: customPackage || null,
    });
    get().saveSettings();
  },

  accentPreset: DEFAULT_ACCENT,
  accentHue: 270, // Фиолетовый по умолчанию
  setAccentPreset: (accentPreset) => {
    set({ accentPreset });
    get().saveSettings();
  },
  setAccentHue: (accentHue) => {
    set({ accentHue, accentPreset: 'custom' });
    get().saveSettings();
  },

  loadSettings: async () => {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      if (json) {
        const settings = JSON.parse(json);
        set(settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  },

  saveSettings: async () => {
    try {
      const state = get();
      const settings = {
        gatewayHost: state.gatewayHost,
        gatewayPort: state.gatewayPort,
        audioEnabled: state.audioEnabled,
        audioPack: state.audioPack,
        audioVolume: state.audioVolume,
        weatherAudioEnabled: state.weatherAudioEnabled,
        speedAudioEnabled: state.speedAudioEnabled,
        gpioAudioEnabled: state.gpioAudioEnabled,
        connectionAudioEnabled: state.connectionAudioEnabled,
        speedWarningThreshold: state.speedWarningThreshold,
        recordingQuality: state.recordingQuality,
        segmentDuration: state.segmentDuration,
        autoCleanup: state.autoCleanup,
        retentionDays: state.retentionDays,
        navigatorApp: state.navigatorApp,
        customNavigatorPackage: state.customNavigatorPackage,
        accentPreset: state.accentPreset,
        accentHue: state.accentHue,
      };
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  },
}));
