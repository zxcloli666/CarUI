import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useShallow } from 'zustand/shallow';

import { BASE_COLORS, SPACING } from '../theme/constants';
import { useCarStore, getOpenDoors } from '../app/store';
import { useScreenActive } from '../hooks';
import { FrozenScreen, WarningBanner } from '../components/common';
import {
  ParkingWidget,
  MusicWidget,
  MiniMapWidget,
  WeatherWidget,
  DriverAlertsWidget,
  CarVisualization,
  SpeedWidget,
} from '../components/dashboard';

// -----------------------------------------------------------------------------
// HOOK: AUTO-NAVIGATION LOGIC
// -----------------------------------------------------------------------------
function useReverseGearRedirect() {
  const navigation = useNavigation<any>();
  const isReverse = useCarStore((s) => s.isReverse);

  useEffect(() => {
    if (isReverse) {
      navigation.navigate('Cameras');
    }
  }, [isReverse, navigation]);
}

// -----------------------------------------------------------------------------
// COMPONENT: DOOR STATUS OVERLAY (ISOLATED)
// -----------------------------------------------------------------------------
const DoorStatusLayer = React.memo(() => {
  const doors = useCarStore(useShallow((s) => s.doors));
  const openDoorsList = useMemo(() => getOpenDoors(doors), [doors]);
  const hasOpenDoors = openDoorsList.length > 0;

  if (!hasOpenDoors) return null;

  return (
      <Animated.View
          style={styles.overlayContainer}
          entering={FadeInUp.duration(300).springify()}
          exiting={FadeOutUp.duration(200)}
      >
        <WarningBanner
            message={`Открыто: ${openDoorsList.join(', ')}`}
            variant="warning"
            style={styles.bannerShadow}
        />
      </Animated.View>
  );
});

// -----------------------------------------------------------------------------
// COMPONENT: MAIN DASHBOARD LAYOUT
// -----------------------------------------------------------------------------
export const DashboardScreen = React.memo(() => {
  useReverseGearRedirect();
  const isActive = useScreenActive();

  return (
      <FrozenScreen active={isActive} style={styles.container}>
        {/* Слой уведомлений (не влияет на layout) */}
        <View style={styles.notificationZone}>
          <DoorStatusLayer />
        </View>

        {/* Основная сетка */}
        <View style={styles.content}>

          {/*
           LEFT COLUMN: Compact & Centered
           Flex меньше, чтобы погода и скорость были собраны кучно.
        */}
          <View style={styles.leftColumn}>
            <WeatherWidget />
            <View style={styles.spacerLarge} />
            <SpeedWidget />
          </View>

          {/*
           CENTER COLUMN: Compact & Centered
           Машина по центру, алерты ПРЯМО над ней.
        */}
          <View style={styles.centerColumn}>
            {/* Контейнер для алертов с фиксированной высотой, чтобы не скакало */}
            <View style={styles.alertsWrapper}>
              <DriverAlertsWidget />
            </View>

            <CarVisualization />

            <View style={styles.spacer} />
            <ParkingWidget />
          </View>

          {/*
           RIGHT COLUMN: Dominant & Stretched
           Занимает больше всего места. Карта и музыка растягиваются на всю ширину.
        */}
          <View style={styles.rightColumn}>
            <MiniMapWidget />
            <View style={styles.spacer} />
            <MusicWidget />
          </View>

        </View>
      </FrozenScreen>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BASE_COLORS.background.primary,
  },

  // Notification Overlay
  notificationZone: {
    position: 'absolute',
    top: SPACING.md,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  overlayContainer: {
    width: '50%',
    pointerEvents: 'auto',
  },
  bannerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },

  // Main Grid Layout
  content: {
    flex: 1,
    flexDirection: 'row',
    padding: SPACING.md,
    paddingTop: SPACING.lg,
    gap: SPACING.lg, // Чуть больше gap между колонками
  },

  // --- COLUMN STYLES ---

  leftColumn: {
    flex: 0.7, // Узкая колонка
    justifyContent: 'center',
    alignItems: 'center', // ВАЖНО: Центрируем виджеты по горизонтали внутри колонки
  },

  centerColumn: {
    flex: 1, // Средняя колонка
    justifyContent: 'center',
    alignItems: 'center', // ВАЖНО: Машина должна быть по центру
  },

  rightColumn: {
    flex: 1.8, // Широкая колонка (почти половина экрана)
    justifyContent: 'center',
    // ВАЖНО: НЕТ alignItems: 'center'.
    // Нам нужно stretch по умолчанию, чтобы карта и музыка были на всю ширину блока.
  },

  // --- SPACERS ---
  spacer: {
    height: SPACING.md,
  },
  spacerLarge: {
    height: SPACING.xxl, // Большой отступ между погодой и скоростью
  },

  alertsWrapper: {
    height: 40,
    justifyContent: 'flex-end',
    marginBottom: SPACING.sm,
    width: '100%',
    alignItems: 'center', // Центруем сами чипсы алертов
  },
});
