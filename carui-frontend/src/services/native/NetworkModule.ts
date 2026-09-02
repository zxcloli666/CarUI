import { NativeModules } from 'react-native';
import { NetworkInfo, CellularNetworkType } from '../../types';

interface NetworkModuleInterface {
  getNetworkInfo(): Promise<{
    type: 'wifi' | 'cellular' | 'none' | 'other';
    isConnected: boolean;
    signalStrength: number;
    wifiSSID?: string;
    cellularType?: string;
  }>;
}

const { NetworkModule } = NativeModules as { NetworkModule: NetworkModuleInterface };

export async function getNetworkInfo(): Promise<NetworkInfo> {
  try {
    const info = await NetworkModule.getNetworkInfo();
    return {
      type: info.type === 'other' ? 'wifi' : (info.type as NetworkInfo['type']),
      isConnected: info.isConnected,
      signalStrength: info.signalStrength,
      wifiSSID: info.wifiSSID,
      cellularType: (info.cellularType || '') as CellularNetworkType,
    };
  } catch (error) {
    console.error('Failed to get network info:', error);
    return {
      type: 'none',
      isConnected: false,
      signalStrength: 0,
    };
  }
}
