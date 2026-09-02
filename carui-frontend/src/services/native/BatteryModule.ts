import { NativeModules } from 'react-native';
import { BatteryInfo } from '../../types';

interface BatteryModuleInterface {
  getBatteryInfo(): Promise<{
    level: number;
    isCharging: boolean;
    usbCharge: boolean;
    acCharge: boolean;
  }>;
}

const { BatteryModule } = NativeModules as { BatteryModule: BatteryModuleInterface };

export async function getBatteryInfo(): Promise<BatteryInfo> {
  try {
    const info = await BatteryModule.getBatteryInfo();
    return {
      level: info.level,
      isCharging: info.isCharging,
    };
  } catch (error) {
    console.error('Failed to get battery info:', error);
    return {
      level: -1,
      isCharging: false,
    };
  }
}
