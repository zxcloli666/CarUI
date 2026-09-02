/**
 * CarUI Theme Constants
 * Единый источник правды для всех констант приложения
 */

import { Dimensions } from 'react-native';

// ============================================================================
// RESPONSIVE SCALING
// Base design: 1280x800 (standard 10" tablet landscape)
// Scales up for larger tablets, maintains minimum for smaller
// ============================================================================

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 800;
const MIN_SCALE = 0.85;
const MAX_SCALE = 1.4;

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isLandscape = screenWidth > screenHeight;
const effectiveWidth = isLandscape ? screenWidth : screenHeight;
const effectiveHeight = isLandscape ? screenHeight : screenWidth;

const widthScale = effectiveWidth / BASE_WIDTH;
const heightScale = effectiveHeight / BASE_HEIGHT;
const rawScale = Math.min(widthScale, heightScale);

/** Global scale factor based on screen size */
export const SCALE = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale));

/** Font scale (slightly more aggressive for readability) */
export const FONT_SCALE = Math.max(MIN_SCALE, Math.min(MAX_SCALE, rawScale * 1.05));

/** Helper to scale a value */
export const scale = (value: number) => Math.round(value * SCALE);
export const fontScale = (value: number) => Math.round(value * FONT_SCALE);

// ============================================================================
// ACCENT COLOR PRESETS (Neon Style)
// ============================================================================

export const ACCENT_PRESETS = {
  violet: {
    id: 'violet',
    name: 'Фиолетовый',
    primary: '#8B5CF6',
    secondary: '#A78BFA',
    glow: 'rgba(139, 92, 246, 0.3)',
  },
  blue: {
    id: 'blue',
    name: 'Синий',
    primary: '#0EA5E9',
    secondary: '#38BDF8',
    glow: 'rgba(14, 165, 233, 0.3)',
  },
  pink: {
    id: 'pink',
    name: 'Розовый',
    primary: '#EC4899',
    secondary: '#F472B6',
    glow: 'rgba(236, 72, 153, 0.3)',
  },
  cyan: {
    id: 'cyan',
    name: 'Бирюзовый',
    primary: '#06B6D4',
    secondary: '#22D3EE',
    glow: 'rgba(6, 182, 212, 0.3)',
  },
  emerald: {
    id: 'emerald',
    name: 'Изумруд',
    primary: '#10B981',
    secondary: '#34D399',
    glow: 'rgba(16, 185, 129, 0.3)',
  },
  orange: {
    id: 'orange',
    name: 'Оранжевый',
    primary: '#F97316',
    secondary: '#FB923C',
    glow: 'rgba(249, 115, 22, 0.3)',
  },
} as const;

export type AccentPresetId = keyof typeof ACCENT_PRESETS;

export const DEFAULT_ACCENT = 'violet';

// ============================================================================
// BASE COLORS (Static, never change)
// ============================================================================

export const BASE_COLORS = {
  // Backgrounds
  background: {
    primary: '#000000',
    secondary: '#0A0A0F',
    tertiary: '#121218',
    elevated: '#1A1A22',
  },

  // Glass / Glassmorphism
  glass: {
    background: 'rgba(255, 255, 255, 0.06)',
    backgroundHover: 'rgba(255, 255, 255, 0.10)',
    backgroundPressed: 'rgba(255, 255, 255, 0.14)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderLight: 'rgba(255, 255, 255, 0.12)',
  },

  // Text
  text: {
    primary: '#FFFFFF',
    inverse: 'rgb(13,18,44)',
    secondary: 'rgba(255, 255, 255, 0.7)',
    tertiary: 'rgba(255, 255, 255, 0.5)',
    disabled: 'rgba(255, 255, 255, 0.3)',
  },

  // Semantic colors
  semantic: {
    success: '#30D158',
    warning: '#FF9F0A',
    danger: '#FF453A',
    info: '#0A84FF',
  },

  // Parking sensor colors
  parking: {
    safe: '#30D158',
    caution: '#84CC16',
    warning: '#FF9F0A',
    danger: '#FF453A',
  },

  // Weather colors
  weather: {
    clear: '#FFD60A',
    cloudy: '#8E8E93',
    rain: '#64D2FF',
    snow: '#E5E5EA',
    fog: '#98989D',
    ice: '#5AC8FA',
    storm: '#BF5AF2',
  },

  // Brand colors
  brand: {
    dgis: '#7BC82E',
    yandex: '#FC3F1D',
  },
} as const;

// ============================================================================
// SPACING & LAYOUT (Scaled)
// ============================================================================

export const SPACING = {
  /** 4px base */
  xs: scale(4),
  /** 8px base */
  sm: scale(8),
  /** 12px base */
  md: scale(12),
  /** 16px base */
  lg: scale(16),
  /** 24px base */
  xl: scale(24),
  /** 32px base */
  xxl: scale(32),
  /** 48px base */
  xxxl: scale(48),
} as const;

export const RADIUS = {
  /** 8px - Small elements */
  sm: scale(8),
  /** 12px - Buttons, inputs */
  md: scale(12),
  /** 16px - Cards */
  lg: scale(16),
  /** 24px - Large cards, modals */
  xl: scale(24),
  /** 9999px - Pills, circles */
  full: 9999,
} as const;

// ============================================================================
// TYPOGRAPHY (Font Scaled)
// ============================================================================

export const FONT_SIZE = {
  /** 10px base - Overline */
  xs: fontScale(10),
  /** 12px base - Caption */
  sm: fontScale(12),
  /** 14px base - Body small */
  md: fontScale(14),
  /** 16px base - Body */
  lg: fontScale(16),
  /** 18px base - Body large */
  xl: fontScale(18),
  /** 20px base - H3 */
  h3: fontScale(20),
  /** 24px base - H2 */
  h2: fontScale(24),
  /** 32px base - H1 */
  h1: fontScale(32),
  /** 48px base - Display small */
  display: fontScale(48),
  /** 64px base - Display medium */
  displayMd: fontScale(64),
  /** 96px base - Display large */
  displayLg: fontScale(96),
} as const;

export const FONT_WEIGHT = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  black: '800' as const,
};

// ============================================================================
// TOUCH & INTERACTION (Scaled)
// ============================================================================

export const TOUCH_TARGET = {
  /** 44px base - Minimum (maintains min 44 for accessibility) */
  min: Math.max(44, scale(44)),
  /** 48px base - Comfortable */
  md: Math.max(48, scale(48)),
  /** 56px base - Large */
  lg: scale(56),
  /** 72px base - Extra large */
  xl: scale(72),
} as const;

export const ICON_SIZE = {
  /** 14px base */
  xs: fontScale(14),
  /** 18px base */
  sm: fontScale(18),
  /** 24px base */
  md: fontScale(24),
  /** 32px base */
  lg: fontScale(32),
  /** 48px base */
  xl: fontScale(48),
} as const;

// ============================================================================
// ANIMATION
// ============================================================================

export const ANIMATION = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: {
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// ============================================================================
// AUDIO EVENT CONSTANTS
// ============================================================================

export const AUDIO_CONSTANTS = {
  /** Минимальный интервал между предупреждениями о превышении (мс) */
  SPEED_WARNING_COOLDOWN: 30_000,
  /** Дистанция для предупреждения о снижении лимита (м) */
  SPEED_LIMIT_AHEAD_DISTANCE: 300,
  /** Минимальный интервал между предупреждениями о знаке впереди (мс) */
  SPEED_LIMIT_AHEAD_COOLDOWN: 60_000,
  /** Минимальный интервал между предупреждениями парктроника (мс) */
  PARKING_ALERT_COOLDOWN: 3_000,
  /** Дистанция опасности парктроника (см) */
  PARKING_DANGER_DISTANCE: 30,
  /** Debounce для задней передачи (мс) */
  REVERSE_DEBOUNCE: 1_000,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Конвертирует HUE (0-360) в RGB hex цвет
 * Насыщенность и яркость подобраны для неонового стиля
 */
export function hueToHex(hue: number): string {
  const h = hue / 360;
  const s = 0.85; // Высокая насыщенность для неона
  const l = 0.60; // Яркость

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Создаёт secondary цвет (светлее на 15%)
 */
export function createSecondaryColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const lighten = (c: number) => Math.min(255, Math.round(c + (255 - c) * 0.25));

  return `#${lighten(r).toString(16).padStart(2, '0')}${lighten(g).toString(16).padStart(2, '0')}${lighten(b).toString(16).padStart(2, '0')}`.toUpperCase();
}

/**
 * Создаёт glow цвет (с прозрачностью)
 */
export function createGlowColor(hex: string, alpha = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}