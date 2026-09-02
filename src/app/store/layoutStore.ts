import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scale } from '../../theme/constants';

interface LayoutConfig {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface LayoutState {
    layouts: {
        music: LayoutConfig;
        parking: LayoutConfig;
    };
    updateLayout: (name: 'music' | 'parking', layout: LayoutConfig) => void;
    resetLayouts: () => void;
}

const DEFAULT_LAYOUTS = {
    music: { x: scale(20), y: scale(20), width: scale(360), height: scale(450) },
    parking: { x: scale(400), y: scale(20), width: scale(260), height: scale(200) }
};

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set) => ({
            layouts: DEFAULT_LAYOUTS,
            updateLayout: (name, layout) =>
                set((state) => ({
                    layouts: { ...state.layouts, [name]: layout }
                })),
            resetLayouts: () => set({ layouts: DEFAULT_LAYOUTS }),
        }),
        {
            name: 'widget-layouts-storage', // уникальное имя ключа в памяти
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
);