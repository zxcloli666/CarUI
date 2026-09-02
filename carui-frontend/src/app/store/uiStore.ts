import { create } from 'zustand';

interface UiState {
  isWeatherOpen: boolean;
  isNavigationOpen: boolean;
  isSettingsOpen: boolean;
  isPermissionsOpen: boolean;
  openWeather: () => void;
  closeWeather: () => void;
  openNavigation: () => void;
  closeNavigation: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openPermissions: () => void;
  closePermissions: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isWeatherOpen: false,
  isNavigationOpen: false,
  isSettingsOpen: false,
  isPermissionsOpen: false,
  openWeather: () => set({ isWeatherOpen: true }),
  closeWeather: () => set({ isWeatherOpen: false }),
  openNavigation: () => set({ isNavigationOpen: true }),
  closeNavigation: () => set({ isNavigationOpen: false }),
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),
  openPermissions: () => set({ isPermissionsOpen: true }),
  closePermissions: () => set({ isPermissionsOpen: false }),
}));
