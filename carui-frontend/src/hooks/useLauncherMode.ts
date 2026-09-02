import { useEffect } from 'react';
import { setKeepScreenOn, setFullscreen } from '../services/native';

/**
 * Initialize launcher mode settings:
 * - Keep screen always on
 * - Fullscreen immersive mode
 */
export function useLauncherMode() {
  useEffect(() => {
    // Keep screen always on for car display
    setKeepScreenOn(true);

    // Enter fullscreen immersive mode
    setFullscreen(true);

    return () => {
      // Cleanup on unmount (shouldn't happen for launcher)
      setKeepScreenOn(false);
      setFullscreen(false);
    };
  }, []);
}
