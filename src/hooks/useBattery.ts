import { useEffect, useState } from 'react';
import { getBatteryInfo } from '../services/native';
import { BatteryInfo } from '../types';

export function useBattery(intervalMs = 30000) {
  const [battery, setBattery] = useState<BatteryInfo>({
    level: 100,
    isCharging: false,
  });

  useEffect(() => {
    let mounted = true;

    const fetchBattery = async () => {
      const info = await getBatteryInfo();
      if (mounted && info.level >= 0) {
        setBattery(info);
      }
    };

    fetchBattery();
    const interval = setInterval(fetchBattery, intervalMs);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [intervalMs]);

  return battery;
}
