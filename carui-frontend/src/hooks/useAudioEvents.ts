import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useCarStore, useConnectionStore, useSettingsStore } from '../app/store';
import { getAudioService } from '../services/AudioService';
import { getRoadCondition } from '../services/WeatherService';
import type { DoorState } from '../types';

// --- Configuration Constants ---

const SPEED_WARNING_COOLDOWN_MS = 15_000;
const SPEED_AHEAD_DISTANCE_M = 800;
const PARKING_CRITICAL_DISTANCE_CM = 35;
const PARKING_ALERT_COOLDOWN_MS = 2_000;
const REVERSE_GEAR_DEBOUNCE_MS = 1_000;

/**
 * Map door state keys to audio resource keys.
 */
const DOOR_AUDIO_KEYS: Partial<Record<keyof DoorState, string>> = {
  front_left: 'door_driver',
  front_right: 'door_passenger',
  rear_left: 'door_rear_left',
  rear_right: 'door_rear_right',
};

/**
 * Safely executes audio playback without crashing the component on rejection.
 */
const safePlay = (promise: Promise<void>) => {
  promise.catch((error) => {
    if (__DEV__) console.warn('[AudioEvents] Playback failed:', error);
  });
};

// --- Logic Hooks ---

/**
 * Synchronizes store settings with the AudioService instance.
 * Updates only when specific configuration values change.
 */
function useSettingsSync() {
  const audioService = getAudioService();

  // Select each primitive value individually from the store.
  // This is the most robust way to prevent re-renders from new object references.
  const enabled = useSettingsStore((s) => s.audioEnabled);
  const volume = useSettingsStore((s) => s.audioVolume);
  const pack = useSettingsStore((s) => s.audioPack);
  const weather = useSettingsStore((s) => s.weatherAudioEnabled);
  const speed = useSettingsStore((s) => s.speedAudioEnabled);
  const gpio = useSettingsStore((s) => s.gpioAudioEnabled);
  const connection = useSettingsStore((s) => s.connectionAudioEnabled);

  useEffect(() => {
    // Reconstruct the settings object here, inside the effect.
    // The effect itself depends only on stable primitive values.
    audioService.updateSettings({
      enabled,
      volume,
      pack,
      categoryEnabled: {
        weather,
        speed,
        gpio,
        connection,
      },
    });
    // The dependency array contains only primitives, preventing loops caused by object reference changes.
  }, [enabled, volume, pack, weather, speed, gpio, connection, audioService]);
}

/**
 * Handles door open/close events.
 * Uses strict state comparison to trigger audio only on status changes.
 */
function useDoorEvents() {
  const audioService = getAudioService();

  // Select doors object with shallow comparison to avoid rerenders on new object references
  const doors = useCarStore(useShallow((s) => s.doors));

  // Refs to track previous state for edge detection
  const prevDoors = useRef<DoorState>(doors);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      isInitialized.current = true;
      prevDoors.current = doors;
      return;
    }

    let hasOpened = false;
    const previous = prevDoors.current;

    // Detect Rising Edge (Closed -> Open)
    for (const key in DOOR_AUDIO_KEYS) {
      const k = key as keyof DoorState;
      if (doors[k] && !previous[k]) {
        safePlay(audioService.playDoorOpen(DOOR_AUDIO_KEYS[k]!));
        hasOpened = true;
      }
    }

    // Detect Falling Edge (Any Open -> All Closed)
    if (!hasOpened) {
      const wasAnyOpen = Object.values(previous).some((isOpen) => isOpen);
      const isNowAllClosed = !Object.values(doors).some((isOpen) => isOpen);

      if (wasAnyOpen && isNowAllClosed) {
        safePlay(audioService.playDoorsClosed());
      }
    }

    prevDoors.current = doors;
  }, [doors, audioService]);
}

/**
 * Handles speed limits and warnings.
 * Implements latching logic to prevent audio spam during high-frequency GPS updates.
 */
function useSpeedEvents() {
  const audioService = getAudioService();

  // Extract only necessary primitives to minimize dependency footprint
  const { currentLimit, currentSpeed, warningThreshold } = useCarStore(useShallow((s) => ({
    currentLimit: s.speedLimit?.limit,
    currentSpeed: s.position?.speed_kmh ?? 0,
    warningThreshold: useSettingsStore.getState().speedWarningThreshold, // Read directly to avoid subscribe
  })));

  // Extract "Speed Limit Ahead" data separately
  const nextChange = useCarStore(useShallow((s) => ({
    newLimit: s.speedLimit?.next_change?.new_limit,
    distance: s.speedLimit?.next_change?.distance_m,
    // Fallback to current limit if 'current_limit' is missing in the change object
    activeLimit: s.speedLimit?.next_change?.current_limit ?? s.speedLimit?.limit ?? 999,
  })));

  // State Latches
  const prevLimit = useRef<number | null>(null);
  const lastWarningTime = useRef<number>(0);
  const announcedNextLimit = useRef<number | null>(null);

  // 1. New Speed Limit Detected
  useEffect(() => {
    if (typeof currentLimit === 'number' && currentLimit !== prevLimit.current) {
      // Only announce if it's not the initial load
      if (prevLimit.current !== null) {
        safePlay(audioService.playSpeedLimit(currentLimit));
      }
      prevLimit.current = currentLimit;

      // Reset the "Ahead" latch because we have now reached that limit
      if (announcedNextLimit.current === currentLimit) {
        announcedNextLimit.current = null;
      }
    }
  }, [currentLimit, audioService]);

  // 2. Overspeed Warning
  // Logic: Trigger only if speed exceeds limit + threshold AND cooldown has passed.
  // Using interruptAndPlay for high priority.
  useEffect(() => {
    if (!currentLimit) return;

    // Sanity check: ignore unrealistic speeds (GPS glitches)
    if (currentSpeed > 1000) return;

    if (currentSpeed > (currentLimit + warningThreshold)) {
      const now = Date.now();
      if (now - lastWarningTime.current > SPEED_WARNING_COOLDOWN_MS) {
        safePlay(audioService.interruptAndPlay(['speed_warning'], 'speed'));
        lastWarningTime.current = now;
      }
    }
  }, [currentSpeed, currentLimit, warningThreshold, audioService]);

  // 3. Speed Limit Ahead
  // Logic: Trigger only if new limit is LOWER and within distance.
  // Latch ensures we only say it once per specific limit value.
  useEffect(() => {
    const { newLimit, distance, activeLimit } = nextChange;

    if (!newLimit || !distance) return;

    // Latch check: Don't repeat if already announced
    if (announcedNextLimit.current === newLimit) return;

    if (newLimit < activeLimit && distance <= SPEED_AHEAD_DISTANCE_M) {
      safePlay(audioService.playSpeedLimitAhead(newLimit));
      announcedNextLimit.current = newLimit;
    }
  }, [nextChange, audioService]);
}

/**
 * Handles parking sensor events.
 * Computes minimum distance inside the selector to prevent unnecessary re-renders.
 */
function useParkingEvents() {
  const audioService = getAudioService();
  const isReverse = useCarStore((s) => s.isReverse);

  // Derived state: calculate minimum distance.
  // This prevents the effect from running if the array changes but min distance remains safe.
  const minDistance = useCarStore((s) => {
    const sensors = s.parkingSensors;
    if (!sensors || sensors.length === 0) return 999;
    let min = 999;
    for (let i = 0; i < sensors.length; i++) {
      if (sensors[i].distance_cm < min) min = sensors[i].distance_cm;
    }
    return min;
  });

  const lastReverseTime = useRef<number>(0);
  const lastAlertTime = useRef<number>(0);
  const prevReverse = useRef(isReverse);

  // Reverse Gear Engagement
  useEffect(() => {
    if (isReverse && !prevReverse.current) {
      const now = Date.now();
      // Debounce to prevent sound on rapid gear shifting (R-N-R)
      if (now - lastReverseTime.current > REVERSE_GEAR_DEBOUNCE_MS) {
        safePlay(audioService.playReverseOn());
        lastReverseTime.current = now;
      }
    }
    prevReverse.current = isReverse;
  }, [isReverse, audioService]);

  // Proximity Alert
  useEffect(() => {
    if (!isReverse) return;

    if (minDistance < PARKING_CRITICAL_DISTANCE_CM) {
      const now = Date.now();
      if (now - lastAlertTime.current > PARKING_ALERT_COOLDOWN_MS) {
        safePlay(audioService.interruptAndPlay(['parking_danger'], 'gpio'));
        lastAlertTime.current = now;
      }
    }
  }, [isReverse, minDistance, audioService]);
}

/**
 * Handles weather condition changes.
 * Only triggers when the semantic "audio key" changes (e.g., from 'rain' to 'clear').
 */
function useWeatherEvents() {
  const audioService = getAudioService();

  // Extract minimal required data to compute condition
  const weatherState = useCarStore(useShallow((s) => ({
    code: s.weatherData?.current?.weatherCode,
    temp: s.weatherData?.current?.temperature,
    visibility: s.weatherData?.hourly?.[0]?.visibility,
  })));

  const prevAudioKey = useRef<string | null>(null);

  useEffect(() => {
    if (weatherState.code === undefined) return;

    // Construct a minimal object required by getRoadCondition
    const mockCurrent = {
      weatherCode: weatherState.code,
      temperature: weatherState.temp ?? 20
    };

    const condition = getRoadCondition(mockCurrent as any, weatherState.visibility);
    const newKey = condition.audioKey;

    // Only play if the key has CHANGED and is not null
    if (newKey && newKey !== prevAudioKey.current) {
      safePlay(audioService.playWeather(newKey, condition.ttsText || undefined));
      prevAudioKey.current = newKey;
    } else if (!newKey) {
      // Reset latch if condition clears, allowing notification if it returns
      prevAudioKey.current = null;
    }
  }, [weatherState, audioService]);
}

/**
 * Handles connection status events.
 */
function useConnectionEvents() {
  const audioService = getAudioService();
  const status = useConnectionStore((s) => s.status); // Primitive string
  const prevStatus = useRef(status);
  const reconnectAnnounced = useRef(false);

  useEffect(() => {
    if (status === prevStatus.current) return;

    const prev = prevStatus.current;
    const current = status;

    // --- ЛОГИКА ЗВУКОВ ---

    // 1. Успешное подключение (из любого состояния)
    if (current === 'connected') {
      safePlay(audioService.playConnected());
      reconnectAnnounced.current = false; // сбрасываем, чтобы при следующем разрыве снова озвучить
    }

    // 2. Потеря связи (ТОЛЬКО если мы были подключены)
    // Если мы были connecting (неудача) -> disconnected, звук играть НЕ надо (мы еще и не подключились)
    else if (current === 'disconnected' && prev === 'connected') {
      safePlay(audioService.playDisconnected());
    }

    // 3. Попытка переподключения (ТОЛЬКО после разрыва, и ОДИН раз за шторм)
    // initial -> connecting: МОЛЧИМ (это старт приложения)
    // disconnected -> connecting: ИГРАЕМ один раз, чтобы не орать каждые n секунд,
    // даже если бэкенд недоступен и оффлайн сохраняется
    else if (current === 'connecting' && prev === 'disconnected') {
      if (!reconnectAnnounced.current) {
        safePlay(audioService.playReconnecting());
        reconnectAnnounced.current = true;
      }
    }

    // Обновляем реф
    prevStatus.current = current;
  }, [status, audioService]);
}

// --- Main Export ---

/**
 * Headless component logic for the Audio System.
 * Should be mounted once at the root of the application.
 */
export function useAudioEvents(): void {
  useSettingsSync();
  useConnectionEvents();
  useDoorEvents();
  useWeatherEvents();
  useSpeedEvents();
  useParkingEvents();
}