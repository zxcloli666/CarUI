export const colors = {
  background: {
    primary: '#0A0A0F',
    secondary: '#12121A',
    tertiary: '#1A1A24',
    elevated: '#22222E',
  },

  glass: {
    background: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
    highlight: 'rgba(255, 255, 255, 0.15)',
  },

  accent: {
    primary: '#6366F1',
    secondary: '#8B5CF6',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#3B82F6',
  },

  text: {
    primary: '#FFFFFF',
    secondary: 'rgba(255, 255, 255, 0.7)',
    tertiary: 'rgba(255, 255, 255, 0.5)',
    disabled: 'rgba(255, 255, 255, 0.3)',
  },

  gradients: {
    primary: ['#6366F1', '#8B5CF6'] as const,
    success: ['#10B981', '#34D399'] as const,
    warning: ['#F59E0B', '#FBBF24'] as const,
    danger: ['#EF4444', '#F87171'] as const,
    glass: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)'] as const,
  },

  weather: {
    clear: '#FFD700',
    cloudy: '#94A3B8',
    rain: '#60A5FA',
    snow: '#E2E8F0',
    fog: '#CBD5E1',
    ice: '#06B6D4',
    storm: '#A855F7',
  },

  parking: {
    safe: '#10B981',
    caution: '#84CC16',
    warning: '#F59E0B',
    danger: '#EF4444',
  },
};
