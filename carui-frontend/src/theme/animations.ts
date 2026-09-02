import { Easing } from 'react-native-reanimated';

export const animations = {
  duration: {
    instant: 100,
    fast: 200,
    normal: 300,
    slow: 500,
  },

  spring: {
    default: { damping: 15, stiffness: 150 },
    bouncy: { damping: 10, stiffness: 100 },
    stiff: { damping: 20, stiffness: 300 },
    gentle: { damping: 20, stiffness: 100 },
  },

  easing: {
    easeOut: Easing.out(Easing.cubic),
    easeIn: Easing.in(Easing.cubic),
    easeInOut: Easing.inOut(Easing.cubic),
  },
};
