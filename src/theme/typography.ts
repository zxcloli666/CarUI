import type { TextStyle } from 'react-native';

export const typography = {
  display: {
    large: { fontSize: 96, fontWeight: '700', lineHeight: 104 } as TextStyle,
    medium: { fontSize: 72, fontWeight: '600', lineHeight: 80 } as TextStyle,
    small: { fontSize: 48, fontWeight: '600', lineHeight: 56 } as TextStyle,
  },

  heading: {
    h1: { fontSize: 32, fontWeight: '600', lineHeight: 40 } as TextStyle,
    h2: { fontSize: 24, fontWeight: '600', lineHeight: 32 } as TextStyle,
    h3: { fontSize: 20, fontWeight: '500', lineHeight: 28 } as TextStyle,
  },

  body: {
    large: { fontSize: 18, fontWeight: '400', lineHeight: 28 } as TextStyle,
    medium: { fontSize: 16, fontWeight: '400', lineHeight: 24 } as TextStyle,
    small: { fontSize: 14, fontWeight: '400', lineHeight: 20 } as TextStyle,
  },

  caption: { fontSize: 12, fontWeight: '500', lineHeight: 16 } as TextStyle,
  overline: { fontSize: 10, fontWeight: '600', lineHeight: 14, letterSpacing: 1 } as TextStyle,
};
