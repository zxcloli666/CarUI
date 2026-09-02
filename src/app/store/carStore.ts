import { create } from 'zustand';
import {
  DoorState,
  ParkingSensor,
  Position,
  SpeedLimit,
  RadarAlert,
} from '../../types';
import { CurrentWeather, WeatherData } from '../../types/weather';

interface CarState {
  // Door state
  doors: DoorState;
  setDoors: (doors: DoorState) => void;

  // Reverse gear
  isReverse: boolean;
  setReverse: (active: boolean) => void;

  // Parking sensors
  parkingSensors: ParkingSensor[];
  setParkingSensors: (sensors: ParkingSensor[]) => void;

  // Position and speed
  position: Position | null;
  setPosition: (position: Position) => void;

  // Speed limit
  speedLimit: SpeedLimit | null;
  setSpeedLimit: (limit: SpeedLimit) => void;

  // Weather (from Open-Meteo via WeatherService)
  weather: CurrentWeather | null;
  setWeather: (weather: CurrentWeather) => void;

  // Full weather data (for WeatherScreen)
  weatherData: WeatherData | null;
  setWeatherData: (data: WeatherData) => void;

  // Radar alert
  radarAlert: RadarAlert | null;
  setRadarAlert: (alert: RadarAlert | null) => void;
}

export const useCarStore = create<CarState>((set) => ({
  doors: {
    front_left: false,
    front_right: false,
    rear_left: false,
    rear_right: false,
  },
  setDoors: (doors) => set({ doors }),

  isReverse: false,
  setReverse: (isReverse) => set({ isReverse }),

  parkingSensors: [],
  setParkingSensors: (parkingSensors) => set({ parkingSensors }),

  position: null,
  setPosition: (position) => set({ position }),

  speedLimit: null,
  setSpeedLimit: (speedLimit) => set({ speedLimit }),

  weather: null,
  setWeather: (weather) => set({ weather }),

  weatherData: null,
  setWeatherData: (weatherData) => set({ weatherData }),

  radarAlert: null,
  setRadarAlert: (radarAlert) => set({ radarAlert }),
}));

// Helper function to get open doors
export function getOpenDoors(doors: DoorState): string[] {
  const openDoors: string[] = [];
  if (doors.front_left) openDoors.push('Водительская');
  if (doors.front_right) openDoors.push('Пассажирская');
  if (doors.rear_left) openDoors.push('Задняя левая');
  if (doors.rear_right) openDoors.push('Задняя правая');
  return openDoors;
}
