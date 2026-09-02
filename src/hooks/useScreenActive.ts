import { useIsFocused } from '@react-navigation/native';
import { useUiStore } from '../app/store';

export function useScreenActive(): boolean {
  const isFocused = useIsFocused();
  const isOverlayOpen = useUiStore((s) =>
    s.isWeatherOpen || s.isNavigationOpen || s.isSettingsOpen || s.isPermissionsOpen
  );

  return isFocused && !isOverlayOpen;
}
