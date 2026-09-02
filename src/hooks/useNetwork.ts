import { useEffect, useState } from 'react';
import { getNetworkInfo } from '../services/native';
import { NetworkInfo } from '../types';

export function useNetwork(intervalMs = 5000) {
  const [network, setNetwork] = useState<NetworkInfo>({
    type: 'none',
    isConnected: false,
    signalStrength: 0,
  });

  useEffect(() => {
    let mounted = true;

    const fetchNetwork = async () => {
      const info = await getNetworkInfo();
      if (mounted) {
        setNetwork(info);
      }
    };

    fetchNetwork();
    const interval = setInterval(fetchNetwork, intervalMs);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [intervalMs]);

  return network;
}
