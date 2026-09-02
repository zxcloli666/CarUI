import { useEffect, useState, useCallback, useRef } from 'react';
import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';
import Geolocation, { GeoPosition, GeoError } from 'react-native-geolocation-service';
import { useCarStore } from '../app/store';
import { gatewayService } from '../services';
import { fetchWeather } from '../services/WeatherService';
import { Position } from '../types';

// Конфигурация для автомобильного трекинга (высокая точность)
const LOCATION_CONFIG = {
  enableHighAccuracy: true,
  distanceFilter: 5,      // Обновлять событие при смещении на 5 метров
  interval: 1000,         // Желаемый интервал обновлений (ms)
  fastestInterval: 500,   // Минимальный интервал между обновлениями (ms)
  forceRequestLocation: true, // Android: принудительно запрашивать обновление
  showLocationDialog: true,   // Android: показать диалог включения GPS если выключен
  useSignificantChanges: false,
};

type LocationStatus = 'idle' | 'searching' | 'active' | 'denied' | 'error';

export function useLocation() {
  const setPosition = useCarStore((s) => s.setPosition);
  const [status, setStatus] = useState<LocationStatus>('idle');

  // Храним ID подписки. В этой либе watchId — это number.
  const watchId = useRef<number | null>(null);

  /**
   * Единая точка обработки новой позиции
   */
  const handlePositionUpdate = useCallback((position: GeoPosition) => {
    setStatus('active');

    const { latitude, longitude, speed, heading } = position.coords;

    // Формируем чистый объект данных
    const newLocation: Position = {
      lat: latitude,
      lon: longitude,
      // speed приходит в м/с. Если null или < 0 — ставим 0. Переводим в км/ч.
      speed_kmh: Math.max(0, (speed || 0) * 3.6),
      bearing: heading || 0,
    };

    // Логика бизнес-слоя
    if (gatewayService.isConnected) {
      // Если есть шлюз — пусть он решает, когда обновлять стор и запрашивать погоду
      gatewayService.sendPosition(newLocation);
    } else {
      // Fallback: обновляем локальный стейт напрямую
      setPosition(newLocation);

      // Погоду лучше обновлять не чаще чем раз в X минут, но оставим как есть с catch
      fetchWeather(newLocation.lat, newLocation.lon).catch((err) =>
          console.warn('[Location] Weather fetch failed', err)
      );
    }
  }, [setPosition]);

  /**
   * Обработка ошибок геолокации
   */
  const handleError = useCallback((error: GeoError) => {
    console.error(`[Location] Error code: ${error.code}, Msg: ${error.message}`);

    switch (error.code) {
      case 1: // PERMISSION_DENIED
        setStatus('denied');
        break;
      case 2: // POSITION_UNAVAILABLE
      case 3: // TIMEOUT
              // Не меняем статус на error, чтобы не пугать юзера, просто ждем спутники
        console.log('[Location] Searching for satellites...');
        break;
      default:
        setStatus('error');
    }
  }, []);

  /**
   * Запрос разрешений (Android only, iOS через Info.plist)
   */
  const requestPermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      return auth === 'granted';
    }

    if (Platform.OS === 'android') {
      const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );

      if (hasPermission) return true;

      const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Требуется доступ к GPS',
            message: 'Приложению необходим доступ к геолокации для работы спидометра.',
            buttonNeutral: 'Позже',
            buttonNegative: 'Отмена',
            buttonPositive: 'OK',
          }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return false;
  };

  /**
   * Запуск слежения
   */
  const startTracking = useCallback(async () => {
    // Избегаем дублирования подписок
    if (watchId.current !== null) return;

    const hasPermission = await requestPermissions();
    if (!hasPermission) {
      setStatus('denied');
      Alert.alert(
          'Нет доступа к GPS',
          'Пожалуйста, предоставьте доступ к геолокации в настройках.',
          [{ text: 'Настройки', onPress: () => Linking.openSettings() }, { text: 'Отмена' }]
      );
      return;
    }

    setStatus('searching');
    console.log('[Location] Watch started via FusedLocationProvider');

    Geolocation.getCurrentPosition(
        handlePositionUpdate,
        handleError,
        LOCATION_CONFIG
    );

    watchId.current = Geolocation.watchPosition(
        handlePositionUpdate,
        handleError,
        LOCATION_CONFIG
    );
  }, [handlePositionUpdate, handleError]);

  /**
   * Остановка слежения
   */
  const stopTracking = useCallback(() => {
    if (watchId.current !== null) {
      Geolocation.clearWatch(watchId.current);
      watchId.current = null;
      console.log('[Location] Watch stopped');
    }
    setStatus('idle');
  }, []);

  // Управление жизненным циклом
  useEffect(() => {
    startTracking();

    // Cleanup function: вызывается при размонтировании компонента
    return () => {
      stopTracking();
      // Важно: на Android сервис геолокации может висеть, если не остановить принудительно
      Geolocation.stopObserving();
    };
  }, [startTracking, stopTracking]);

  return {
    status,
    startTracking,
    stopTracking
  };
}