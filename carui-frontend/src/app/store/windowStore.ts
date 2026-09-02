import { create } from 'zustand';

export interface FreeformWindow {
  id: string;
  packageName: string;
  appName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  isMinimized: boolean;
}

interface WindowState {
  windows: FreeformWindow[];
  activeWindowId: string | null;
  nextZIndex: number;

  // Actions
  addWindow: (packageName: string, appName: string, x: number, y: number, width: number, height: number) => string;
  removeWindow: (id: string) => void;
  removeWindowByPackage: (packageName: string) => void;
  focusWindow: (id: string) => void;
  updateWindowPosition: (id: string, x: number, y: number) => void;
  updateWindowSize: (id: string, width: number, height: number) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  clearAllWindows: () => void;
}

let windowIdCounter = 0;

export const useWindowStore = create<WindowState>((set, get) => ({
  windows: [],
  activeWindowId: null,
  nextZIndex: 1,

  addWindow: (packageName, appName, x, y, width, height) => {
    const id = `window_${++windowIdCounter}`;
    const { nextZIndex } = get();

    set((state) => ({
      windows: [
        ...state.windows,
        {
          id,
          packageName,
          appName,
          x,
          y,
          width,
          height,
          zIndex: nextZIndex,
          isMinimized: false,
        },
      ],
      activeWindowId: id,
      nextZIndex: nextZIndex + 1,
    }));

    return id;
  },

  removeWindow: (id) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.id !== id),
      activeWindowId: state.activeWindowId === id ? null : state.activeWindowId,
    }));
  },

  removeWindowByPackage: (packageName) => {
    set((state) => ({
      windows: state.windows.filter((w) => w.packageName !== packageName),
      activeWindowId: state.windows.find((w) => w.packageName === packageName)?.id === state.activeWindowId
        ? null
        : state.activeWindowId,
    }));
  },

  focusWindow: (id) => {
    const { nextZIndex } = get();
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, zIndex: nextZIndex } : w
      ),
      activeWindowId: id,
      nextZIndex: nextZIndex + 1,
    }));
  },

  updateWindowPosition: (id, x, y) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, x, y } : w
      ),
    }));
  },

  updateWindowSize: (id, width, height) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, width, height } : w
      ),
    }));
  },

  minimizeWindow: (id) => {
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, isMinimized: true } : w
      ),
    }));
  },

  restoreWindow: (id) => {
    const { nextZIndex } = get();
    set((state) => ({
      windows: state.windows.map((w) =>
        w.id === id ? { ...w, isMinimized: false, zIndex: nextZIndex } : w
      ),
      activeWindowId: id,
      nextZIndex: nextZIndex + 1,
    }));
  },

  clearAllWindows: () => {
    set({ windows: [], activeWindowId: null });
  },
}));
