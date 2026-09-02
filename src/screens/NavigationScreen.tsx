import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, AppState, LayoutChangeEvent } from 'react-native';
import { ArrowLeft, Play, Minimize2, Edit3, Check, Navigation as NavIcon } from 'lucide-react-native';

import { BASE_COLORS, FONT_SIZE, SPACING, RADIUS, ICON_SIZE, scale } from '../theme/constants';
import { useAccentColor } from '../hooks/useTheme';
import { useUiStore, useSettingsStore, useCarStore, NAVIGATOR_APPS, useLayoutStore } from '../app/store';
import {
  launchAppInFreeform,
  showBackToCarUIButton,
  hideBackToCarUIButton,
  showParkingOverlay,
  hideParkingOverlay,
  getScreenDimensions,
  openInStore,
  isAppInstalled,
  updateParkingOverlay
} from '../services/native';
import { ParkingSensor } from '../types';

// Components
import { MusicWidget } from '../components/navigation/MusicWidget';
import { ParkingWidget } from '../components/navigation/ParkingWidget';
import { DraggableWidget } from '../components/navigation/DraggableWidget';

const PARKING_THRESHOLD = 150;

export function NavigationScreen() {
  const accent = useAccentColor();
  const closeNavigation = useUiStore((s) => s.closeNavigation);

  const [navLaunched, setNavLaunched] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const appState = useRef(AppState.currentState);
  const parkingOverlayActive = useRef(false);

  const navigatorApp = useSettingsStore((s) => s.navigatorApp);
  const customPkg = useSettingsStore((s) => s.customNavigatorPackage);
  const currentPkg = navigatorApp === 'custom' ? customPkg : NAVIGATOR_APPS[navigatorApp as keyof typeof NAVIGATOR_APPS]?.packageName;

  const layouts = useLayoutStore((s) => s.layouts);
  const updateLayout = useLayoutStore((s) => s.updateLayout);

  // Sync Logic
  const syncNativeOverlay = useCallback((sensorData: ParkingSensor[]) => {
    const getMin = (prefix: string) => {
      const f = sensorData.filter(s => s.position.startsWith(prefix));
      return f.length ? Math.min(...f.map(s => s.distance_cm)) : 999;
    };
    const minFront = getMin('front');
    const minRear = getMin('rear');
    const minLeft = getMin('left');
    const minRight = getMin('right');
    const minAll = Math.min(minFront, minRear, minLeft, minRight);

    const shouldShow = minAll < PARKING_THRESHOLD;
    const isBackground = appState.current !== 'active';

    if (isBackground && shouldShow) {
      if (!parkingOverlayActive.current) {
        showParkingOverlay(minFront, minRear, minLeft, minRight);
        parkingOverlayActive.current = true;
      } else {
        updateParkingOverlay(minFront, minRear, minLeft, minRight);
      }
    } else {
      if (parkingOverlayActive.current) {
        hideParkingOverlay();
        parkingOverlayActive.current = false;
      }
    }
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      appState.current = next;
      syncNativeOverlay(useCarStore.getState().parkingSensors);
    });
    const unsubStore = useCarStore.subscribe((state) => {
      syncNativeOverlay(state.parkingSensors);
    });
    return () => {
      sub.remove();
      unsubStore();
      if (parkingOverlayActive.current) hideParkingOverlay();
    };
  }, [syncNativeOverlay]);

  useEffect(() => {
    if (navLaunched) {
      showBackToCarUIButton();
    } else {
      hideBackToCarUIButton();
    }
    return () => {
      hideBackToCarUIButton();
    };
  }, [navLaunched]);

  const handleLaunchNavigator = async () => {
    if (!currentPkg) return;
    const installed = await isAppInstalled(currentPkg);

    if (!installed) {
      openInStore(currentPkg);
      return;
    }

    const dims = await getScreenDimensions();
    const headerHeight = scale(80);
    await launchAppInFreeform(currentPkg, 0, headerHeight, dims.width, dims.height - headerHeight);
    setNavLaunched(true);
  };

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setStageSize({ width, height });
    }
  };

  return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={closeNavigation} style={styles.backButton}>
            <ArrowLeft size={ICON_SIZE.md} color={BASE_COLORS.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>Навигация</Text>
            <Text style={styles.headerSubtitle}>{navLaunched ? 'Активно' : 'Ожидание'}</Text>
          </View>
          <TouchableOpacity
              style={[styles.editBtn, editMode && { backgroundColor: accent.primary, borderColor: accent.primary }]}
              onPress={() => setEditMode(!editMode)}
          >
            {editMode ? <Check size={18} color="#FFF" /> : <Edit3 size={18} color={BASE_COLORS.text.secondary} />}
            <Text style={[styles.editBtnText, editMode && { color: '#FFF' }]}>{editMode ? 'ГОТОВО' : 'ВИДЖЕТЫ'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={styles.sidebar}>
            <View style={styles.controlCard}>
              <View style={styles.cardHeader}>
                <NavIcon size={22} color={accent.primary} />
                <Text style={styles.cardTitle}>Навигатор</Text>
              </View>
              <Text style={styles.appName} numberOfLines={1}>
                {navigatorApp === 'custom' ? 'Стороннее' : (NAVIGATOR_APPS as any)[navigatorApp]?.name || 'App'}
              </Text>
              <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: accent.primary }]}
                  onPress={handleLaunchNavigator}
              >
                <Play size={18} color="#FFF" fill="#FFF" />
                <Text style={styles.actionBtnText}>Старт</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hintText}>
              {editMode ? 'Виджеты отображаются поверх окна.' : 'Нажмите "ВИДЖЕТЫ" чтобы перемещать и менять размер.'}
            </Text>
          </View>

          <View style={styles.stage} onLayout={onStageLayout}>
            {editMode && (
                <View style={styles.gridBackground} pointerEvents="none">
                  <Text style={styles.gridText}>ZONE</Text>
                </View>
            )}

            {stageSize.width > 0 && (
                <>
                  <DraggableWidget
                      initialLayout={layouts.music}
                      editable={editMode}
                      containerSize={stageSize}
                      accentColor={accent.primary}
                      onLayoutChange={(l) => updateLayout('music', l)} // Используем стор
                      minSize={{ width: scale(300), height: scale(300) }}
                  >
                    <MusicWidget />
                  </DraggableWidget>

                  <DraggableWidget
                      initialLayout={layouts.parking}
                      editable={editMode}
                      containerSize={stageSize}
                      accentColor={accent.primary}
                      onLayoutChange={(l) => updateLayout('parking', l)} // Используем стор
                      minSize={{ width: scale(200), height: scale(150) }}
                  >
                    <ParkingWidget />
                  </DraggableWidget>
                </>
            )}
          </View>
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BASE_COLORS.background.primary },
  header: { height: scale(80), flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, backgroundColor: BASE_COLORS.background.secondary, borderBottomWidth: 1, borderBottomColor: BASE_COLORS.glass.border, gap: SPACING.md },
  backButton: { padding: SPACING.sm, borderRadius: RADIUS.lg, backgroundColor: 'rgba(255,255,255,0.05)' },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: FONT_SIZE.h3, fontWeight: 'bold', color: BASE_COLORS.text.primary },
  headerSubtitle: { fontSize: FONT_SIZE.sm, color: BASE_COLORS.text.secondary },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  editBtnText: { fontSize: FONT_SIZE.sm, fontWeight: '700', color: BASE_COLORS.text.secondary },
  body: { flex: 1, flexDirection: 'row' },
  sidebar: { width: scale(260), padding: SPACING.lg, borderRightWidth: 1, borderRightColor: BASE_COLORS.glass.border, backgroundColor: 'rgba(0,0,0,0.2)', gap: SPACING.lg },
  stage: { flex: 1, position: 'relative' },
  controlCard: { padding: SPACING.md, backgroundColor: BASE_COLORS.glass.background, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: BASE_COLORS.glass.border, gap: SPACING.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  cardTitle: { fontSize: FONT_SIZE.lg, fontWeight: '600', color: BASE_COLORS.text.primary },
  appName: { fontSize: FONT_SIZE.h2, fontWeight: 'bold', color: '#FFF' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.md, borderRadius: RADIUS.lg, gap: SPACING.xs },
  actionBtnText: { color: '#FFF', fontWeight: '700', fontSize: FONT_SIZE.md },
  hintText: { color: BASE_COLORS.text.tertiary, fontSize: FONT_SIZE.sm },
  gridBackground: { ...StyleSheet.absoluteFillObject, margin: SPACING.lg, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', borderStyle: 'dashed', borderRadius: RADIUS.xl, alignItems: 'center', justifyContent: 'center' },
  gridText: { color: 'rgba(255,255,255,0.05)', fontSize: 60, fontWeight: '900' }
});
