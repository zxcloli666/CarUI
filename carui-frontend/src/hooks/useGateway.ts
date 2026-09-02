import { useEffect, useRef } from 'react';
import { gatewayService } from '../services';
import { fetchWeather } from '../services/WeatherService';
import { useCarStore, useConnectionStore } from '../app/store';
import type { WsEvent, DoorState, Position } from '../types';

const GPS_THROTTLE_MS = 150; // ~6 updates/sec

export function useGateway() {
  // Store actions
  const setPosition = useCarStore((s) => s.setPosition);
  const setDoors = useCarStore((s) => s.setDoors);
  const setReverse = useCarStore((s) => s.setReverse);
  const setParkingSensors = useCarStore((s) => s.setParkingSensors);
  const setRadarAlert = useCarStore((s) => s.setRadarAlert);

  const setStatus = useConnectionStore((s) => s.setStatus);
  const setLastConnected = useConnectionStore((s) => s.setLastConnected);

  // Refs
  const lastPosUpdate = useRef<number>(0);

  useEffect(() => {
    // 1. Инициируем соединение
    gatewayService.connect();

    // 2. Обработчик данных
    const handleDataEvent = (event: WsEvent) => {
      const { topic, type, data } = event;
      // Иногда тип приходит в поле event (legacy support)
      const evtType = type || (event as any).event;

      switch (topic) {
        case 'speed':
          if (evtType === 'position') {
            const now = Date.now();
            if (now - lastPosUpdate.current > GPS_THROTTLE_MS) {
              const raw = data as any;
              // Конвертация m/s -> km/h
              const position: Position = {
                lat: raw.lat,
                lon: raw.lon,
                bearing: raw.bearing,
                speed_kmh: (raw.speed_ms || 0) * 3.6,
              };

              setPosition(position);
              lastPosUpdate.current = now;

              // Сайд-эффект: погода (лучше вынести в отдельный listener в useLocation, но ок)
              fetchWeather(position.lat, position.lon).catch(() => {});
            }
          }
          break;

        case 'gpio':
        case 'state':
          // Оптимизация: switch внутри switch быстрее, чем if-else chain
          switch (evtType) {
            case 'doors':
              setDoors(data as DoorState);
              break;
            case 'reverse':
              const active = typeof data === 'boolean' ? data : (data as any).active;
              setReverse(!!active);
              break;
            case 'parking':
              setParkingSensors((data as any).sensors || []);
              break;
          }
          break;

        case 'radar':
          if (evtType === 'alert') {
            setRadarAlert(data as any);
          }
          break;
      }
    };

    // 3. Обработчик статуса соединения
    const handleStatusEvent = (status: 'connected' | 'disconnected' | 'connecting' | 'initial') => {
      setStatus(status);
      if (status === 'connected') {
        setLastConnected(new Date());
      }
    };

    // 4. Подписки
    const unsubscribeData = gatewayService.subscribe(handleDataEvent);
    const unsubscribeStatus = gatewayService.subscribeToStatus(handleStatusEvent);

    return () => {
      unsubscribeData();
      unsubscribeStatus();
    };
  }, []);
}