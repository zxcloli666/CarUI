import { useMemo } from 'react';
import { useSettingsStore } from '../app/store';
import {
  ACCENT_PRESETS,
  BASE_COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  ICON_SIZE,
  TOUCH_TARGET,
  hueToHex,
  createSecondaryColor,
  createGlowColor,
} from '../theme/constants';

export interface AccentColors {
  primary: string;
  secondary: string;
  glow: string;
}

export interface ThemeColors {
  // Dynamic accent
  accent: AccentColors;

  // Static colors from constants
  background: typeof BASE_COLORS.background;
  glass: typeof BASE_COLORS.glass;
  text: typeof BASE_COLORS.text;
  semantic: typeof BASE_COLORS.semantic;
  parking: typeof BASE_COLORS.parking;
  weather: typeof BASE_COLORS.weather;
  brand: typeof BASE_COLORS.brand;
}

export interface Theme {
  colors: ThemeColors;
  spacing: typeof SPACING;
  radius: typeof RADIUS;
  fontSize: typeof FONT_SIZE;
  fontWeight: typeof FONT_WEIGHT;
  iconSize: typeof ICON_SIZE;
  touchTarget: typeof TOUCH_TARGET;
}

/**
 * Хук для получения темы с динамическим акцентным цветом
 */
export function useTheme(): Theme {
  const accentPreset = useSettingsStore((s) => s.accentPreset);
  const accentHue = useSettingsStore((s) => s.accentHue);

  const accent = useMemo((): AccentColors => {
    if (accentPreset === 'custom') {
      const primary = hueToHex(accentHue);
      return {
        primary,
        secondary: createSecondaryColor(primary),
        glow: createGlowColor(primary),
      };
    }

    const preset = ACCENT_PRESETS[accentPreset];
    return {
      primary: preset.primary,
      secondary: preset.secondary,
      glow: preset.glow,
    };
  }, [accentPreset, accentHue]);

  const theme = useMemo((): Theme => ({
    colors: {
      accent,
      background: BASE_COLORS.background,
      glass: BASE_COLORS.glass,
      text: BASE_COLORS.text,
      semantic: BASE_COLORS.semantic,
      parking: BASE_COLORS.parking,
      weather: BASE_COLORS.weather,
      brand: BASE_COLORS.brand,
    },
    spacing: SPACING,
    radius: RADIUS,
    fontSize: FONT_SIZE,
    fontWeight: FONT_WEIGHT,
    iconSize: ICON_SIZE,
    touchTarget: TOUCH_TARGET,
  }), [accent]);

  return theme;
}

/**
 * Хук только для акцентного цвета (оптимизация)
 */
export function useAccentColor(): AccentColors {
  const accentPreset = useSettingsStore((s) => s.accentPreset);
  const accentHue = useSettingsStore((s) => s.accentHue);

  return useMemo((): AccentColors => {
    if (accentPreset === 'custom') {
      const primary = hueToHex(accentHue);
      return {
        primary,
        secondary: createSecondaryColor(primary),
        glow: createGlowColor(primary),
      };
    }

    const preset = ACCENT_PRESETS[accentPreset];
    return {
      primary: preset.primary,
      secondary: preset.secondary,
      glow: preset.glow,
    };
  }, [accentPreset, accentHue]);
}
