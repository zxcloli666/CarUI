import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { NavigationContainer, Theme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createMaterialTopTabNavigator, MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolate,
  Extrapolation,
  WithSpringConfig,
} from 'react-native-reanimated';
import {
  LayoutDashboard,
  Camera,
  Music,
  Grid3X3,
  LucideIcon,
} from 'lucide-react-native';

import { useAccentColor } from '../hooks/useTheme';
import { BASE_COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, ICON_SIZE, TOUCH_TARGET } from '../theme/constants';
import {
  DashboardScreen,
  CamerasScreen,
  MediaScreen,
  AppsScreen,
} from '../screens';
import { AppStatusBar } from '../components/common';
import { ModalHost } from './ModalHost';

// -----------------------------------------------------------------------------
// CONFIGURATION & TYPES
// -----------------------------------------------------------------------------

interface TabConfigItem {
  label: string;
  Icon: LucideIcon;
}

// O(1) Lookup Map
const TAB_CONFIG: Record<string, TabConfigItem> = {
  Dashboard: { label: 'Главная', Icon: LayoutDashboard },
  Cameras:   { label: 'Камеры', Icon: Camera },
  Media:     { label: 'Музыка', Icon: Music },
  Apps:      { label: 'Приложения', Icon: Grid3X3 },
};

const ANIMATION_CONFIG: WithSpringConfig = {
  damping: 15,
  stiffness: 120,
};

const Stack = createNativeStackNavigator();
const Tab = createMaterialTopTabNavigator();
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// -----------------------------------------------------------------------------
// SUB-COMPONENT: TAB BAR ITEM (Highly Optimized)
// -----------------------------------------------------------------------------

interface TabBarItemProps {
  routeName: string;
  isFocused: boolean;
  accentColor: string;
  onPress: (key: string, name: string) => void;
  onLongPress: (key: string) => void;
  routeKey: string;
}

const TabBarItem = React.memo(({
                                 routeName,
                                 isFocused,
                                 accentColor,
                                 onPress,
                                 onLongPress,
                                 routeKey,
                               }: TabBarItemProps) => {
  const config = TAB_CONFIG[routeName];
  if (!config) return null;

  const { Icon, label } = config;

  // Shared Values
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(isFocused ? 1 : 0);

  // React to focus changes
  React.useEffect(() => {
    glowOpacity.value = withSpring(isFocused ? 1 : 0, ANIMATION_CONFIG);
  }, [isFocused]);

  // Interaction Handlers
  const handlePress = useCallback(() => onPress(routeKey, routeName), [onPress, routeKey, routeName]);
  const handleLongPress = useCallback(() => onLongPress(routeKey), [onLongPress, routeKey]);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.92, { damping: 10 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, ANIMATION_CONFIG);
  }, []);

  // Animated Styles
  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const bgGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowOpacity.value, [0, 1], [0, 0.15], Extrapolation.CLAMP),
    backgroundColor: accentColor,
  }));

  const iconGlowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glowOpacity.value, [0, 1], [0, 0.4]),
    backgroundColor: accentColor,
    transform: [{ scale: interpolate(glowOpacity.value, [0, 1], [0.8, 1.2]) }]
  }));

  return (
      <AnimatedPressable
          onPress={handlePress}
          onLongPress={handleLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[styles.tabItem, containerStyle]}
      >
        <Animated.View style={[styles.tabGlow, bgGlowStyle]} />

        <View style={styles.iconContainer}>
          <Animated.View style={[styles.iconBacklight, iconGlowStyle]} />
          <Icon
              size={ICON_SIZE.lg}
              color={isFocused ? accentColor : BASE_COLORS.text.tertiary}
              strokeWidth={isFocused ? 2.5 : 2}
          />
        </View>

        <Text
            style={[
              styles.tabLabel,
              {
                color: isFocused ? accentColor : BASE_COLORS.text.tertiary,
                fontWeight: isFocused ? FONT_WEIGHT.bold : FONT_WEIGHT.medium,
              },
            ]}
        >
          {label}
        </Text>
      </AnimatedPressable>
  );
}, (prev, next) => {
  return (
      prev.isFocused === next.isFocused &&
      prev.accentColor === next.accentColor &&
      prev.routeName === next.routeName
  );
});

// -----------------------------------------------------------------------------
// COMPONENT: CUSTOM TAB BAR CONTAINER
// -----------------------------------------------------------------------------

const CustomTabBar = React.memo(({ state, descriptors, navigation }: MaterialTopTabBarProps) => {
  const accent = useAccentColor();

  const handleTabPress = useCallback((routeKey: string, routeName: string) => {
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });

    const isFocused = state.routes[state.index].key === routeKey;

    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }, [navigation, state.index, state.routes]);

  const handleTabLongPress = useCallback((routeKey: string) => {
    navigation.emit({
      type: 'tabLongPress',
      target: routeKey,
    });
  }, [navigation]);

  return (
      <View style={styles.tabBarContainer}>
        <View style={styles.tabBarGlass}>
          <View style={[styles.tabBarBorderGlow, { backgroundColor: accent.glow }]} />
          <View style={styles.tabBarContent}>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;
              return (
                  <TabBarItem
                      key={route.key}
                      routeKey={route.key}
                      routeName={route.name}
                      isFocused={isFocused}
                      accentColor={accent.primary}
                      onPress={handleTabPress}
                      onLongPress={handleTabLongPress}
                  />
              );
            })}
          </View>
        </View>
      </View>
  );
});

// -----------------------------------------------------------------------------
// COMPONENT: MAIN NAVIGATORS
// -----------------------------------------------------------------------------

const LazyPlaceholder = () => <View style={styles.lazyPlaceholder} />;

function TabNavigator() {
  return (
      <View style={styles.mainContainer}>
        <AppStatusBar />
        <Tab.Navigator
            initialRouteName="Dashboard"
            tabBarPosition="bottom"
            tabBar={(props) => <CustomTabBar {...props} />}
            screenOptions={{
              swipeEnabled: true,
              lazy: true,
              lazyPlaceholder: LazyPlaceholder,
              sceneStyle: styles.sceneContainer,
              animationEnabled: true,
              unmountOnBlur: true,
            }}
        >
          <Tab.Screen name="Dashboard" component={DashboardScreen} />
          <Tab.Screen name="Cameras" component={CamerasScreen} />
          <Tab.Screen name="Media" component={MediaScreen} />
          <Tab.Screen name="Apps" component={AppsScreen} />
        </Tab.Navigator>
      </View>
  );
}

export function AppNavigation() {
  const accent = useAccentColor();

  // FIX: Добавил ...DarkTheme, чтобы подтянулись fonts, иначе крашится
  const navigationTheme = useMemo((): Theme => ({
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: accent.primary,
      background: BASE_COLORS.background.primary,
      card: BASE_COLORS.background.secondary,
      text: BASE_COLORS.text.primary,
      border: BASE_COLORS.glass.border,
      notification: BASE_COLORS.semantic.danger,
    },
  }), [accent.primary]);

  return (
      <NavigationContainer theme={navigationTheme}>
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'fade',
          }}
        >
          <Stack.Screen name="Main" component={TabNavigator} />
        </Stack.Navigator>
        <ModalHost />
      </NavigationContainer>
  );
}

// -----------------------------------------------------------------------------
// STYLES
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: BASE_COLORS.background.primary,
  },
  sceneContainer: {
    backgroundColor: BASE_COLORS.background.primary,
  },
  lazyPlaceholder: {
    flex: 1,
    backgroundColor: BASE_COLORS.background.primary,
  },
  tabBarContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    backgroundColor: BASE_COLORS.background.primary,
  },
  tabBarGlass: {
    backgroundColor: 'rgba(20, 20, 28, 0.92)',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: BASE_COLORS.glass.border,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  tabBarBorderGlow: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1.5,
    opacity: 0.5,
    borderRadius: 2,
  },
  tabBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    minHeight: TOUCH_TARGET.xl,
    borderRadius: RADIUS.lg,
  },
  tabGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
    margin: 4,
  },
  iconContainer: {
    width: TOUCH_TARGET.md,
    height: TOUCH_TARGET.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconBacklight: {
    position: 'absolute',
    width: ICON_SIZE.xl,
    height: ICON_SIZE.xl,
    borderRadius: RADIUS.full,
    opacity: 0.3,
  },
  tabLabel: {
    fontSize: FONT_SIZE.md,
    letterSpacing: 0.3,
  },
});
