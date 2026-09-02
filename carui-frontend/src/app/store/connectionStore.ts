import { create } from 'zustand';

type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'initial';

interface ConnectionState {
  status: ConnectionStatus;
  setStatus: (status: ConnectionStatus) => void;

  lastConnected: Date | null;
  setLastConnected: (date: Date) => void;

  errorMessage: string | null;
  setError: (message: string | null) => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'initial',
  setStatus: (status) => set({ status }),

  lastConnected: null,
  setLastConnected: (lastConnected) => set({ lastConnected }),

  errorMessage: null,
  setError: (errorMessage) => set({ errorMessage }),
}));
