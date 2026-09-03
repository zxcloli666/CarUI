import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppState,
  Modal,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  StyleProp,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import {
  BatteryCharging,
  Bell,
  Home,
  Layers,
  MapPin,
  Phone,
  Radio,
  Signal,
  X,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Button } from '../components/common/Button';
import { useAccentColor } from '../hooks/useTheme';
import { useUiStore } from '../app/store';
import {
  canDrawOverlays,
  requestOverlayPermission,
  hasNotificationListenerPermission,
  requestNotificationListenerPermission,
  isIgnoringBatteryOptimizations,
  requestIgnoreBatteryOptimizations,
  isDefaultLauncher,
  openHomeSettings,
  startKeepAliveService,
  stopKeepAliveService,
  isKeepAliveRunning,
  isKeepAliveEnabled,
} from '../services/native';
import { BASE_COLORS, FONT_SIZE, FONT_WEIGHT, ICON_SIZE, RADIUS, SPACING, scale } from '../theme/constants';

type PermissionKey =
  | 'location'
  | 'phoneState'
  | 'notifications'
  | 'notificationListener'
  | 'overlay'
  | 'battery'
  | 'home'
  | 'keepAlive';

type PermissionStatus = Record<PermissionKey, boolean>;

const INITIAL_STATUS: PermissionStatus = {
  location: false,
  phoneState: false,
  notifications: false,
  notificationListener: false,
  overlay: false,
  battery: false,
  home: false,
  keepAlive: false,
};

const ANDROID_TIRAMISU = 33;
const PERMISSIONS_SETUP_KEY = 'carui_permissions_setup_completed';

export function PermissionsScreen() {
  const accent = useAccentColor();
  const { width } = useWindowDimensions();
  const isWide = width >= 1200;
  const requiresNotificationPermission =
    Platform.OS === 'android' && Number(Platform.Version) >= ANDROID_TIRAMISU;

  const [status, setStatus] = useState<PermissionStatus>(INITIAL_STATUS);
  const [busy, setBusy] = useState(false);
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [setupLoaded, setSetupLoaded] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const isForceOpen = useUiStore((s) => s.isPermissionsOpen);
  const closePermissions = useUiStore((s) => s.closePermissions);

  const refreshStatus = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setStatusLoaded(true);
      closePermissions();
      return;
    }

    const [
      fineLocation,
      coarseLocation,
      phoneState,
      notifications,
      overlay,
      notificationListener,
      battery,
      home,
      keepAliveEnabled,
    ] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE),
      requiresNotificationPermission
        ? PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)
        : Promise.resolve(true),
      canDrawOverlays(),
      hasNotificationListenerPermission(),
      isIgnoringBatteryOptimizations(),
      isDefaultLauncher(),
      isKeepAliveEnabled(),
    ]);

    const nextStatus: PermissionStatus = {
      location: fineLocation || coarseLocation,
      phoneState,
      notifications,
      notificationListener,
      overlay,
      battery,
      home,
      keepAlive: keepAliveEnabled,
    };

    setStatus(nextStatus);
    setStatusLoaded(true);
    if (!isForceOpen && setupLoaded && setupCompleted) {
      closePermissions();
    }
  }, [closePermissions, isForceOpen, setupCompleted, setupLoaded]);

  useEffect(() => {
    let mounted = true;

    const loadSetupState = async () => {
      try {
        const stored = await AsyncStorage.getItem(PERMISSIONS_SETUP_KEY);
        if (!mounted) return;
        setSetupCompleted(stored === 'true');
      } catch {
        if (!mounted) return;
        setSetupCompleted(false);
      } finally {
        if (mounted) setSetupLoaded(true);
      }
    };

    loadSetupState();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!setupLoaded) return;
    refreshStatus();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshStatus();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [refreshStatus, setupLoaded]);

  const runBusyAction = useCallback(
    async (action: () => Promise<void>) => {
      if (busy) return;
      setBusy(true);
      try {
        await action();
      } finally {
        setBusy(false);
      }
    },
    [busy]
  );

  const requestLocation = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION, {
      title: 'Доступ к геолокации',
      message: 'CarUI использует геолокацию для скорости, погоды и навигационных подсказок.',
      buttonPositive: 'Разрешить',
      buttonNegative: 'Позже',
    });
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
    await refreshStatus();
  }, [refreshStatus]);

  const requestPhoneState = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE, {
      title: 'Доступ к состоянию сети',
      message: 'Нужно, чтобы показывать тип сети (LTE/3G) и сигнал.',
      buttonPositive: 'Разрешить',
      buttonNegative: 'Позже',
    });
    await refreshStatus();
  }, [refreshStatus]);

  const requestNotifications = useCallback(async () => {
    if (!requiresNotificationPermission || Platform.OS !== 'android') return;
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS, {
      title: 'Уведомления CarUI',
      message: 'Требуется для фонового режима и управления медиа.',
      buttonPositive: 'Разрешить',
      buttonNegative: 'Позже',
    });
    await refreshStatus();
  }, [refreshStatus, requiresNotificationPermission]);

  const requestOverlay = useCallback(async () => {
    await requestOverlayPermission();
    await refreshStatus();
  }, [refreshStatus]);

  const requestNotificationListener = useCallback(async () => {
    await requestNotificationListenerPermission();
    await refreshStatus();
  }, [refreshStatus]);

  const requestBattery = useCallback(async () => {
    await requestIgnoreBatteryOptimizations();
    await refreshStatus();
  }, [refreshStatus]);

  const requestHome = useCallback(async () => {
    await openHomeSettings();
    await refreshStatus();
  }, [refreshStatus]);

  const toggleKeepAlive = useCallback(async () => {
    if (requiresNotificationPermission && !status.notifications) {
      await requestNotifications();
    }
    if (status.keepAlive) {
      await stopKeepAliveService();
    } else {
      await startKeepAliveService();
    }
    await refreshStatus();
  }, [refreshStatus, requestNotifications, requiresNotificationPermission, status.keepAlive, status.notifications]);

  const requiredKeys = useMemo(() => getRequiredKeys(requiresNotificationPermission), [requiresNotificationPermission]);
  const recommendedKeys = useMemo(() => getRecommendedKeys(), []);

  const missingRequired = requiredKeys.some((key) => !status[key]);
  const missingRecommended = recommendedKeys.some((key) => !status[key]);

  const totalCount = requiredKeys.length + recommendedKeys.length;
  const grantedCount = [...requiredKeys, ...recommendedKeys].filter((key) => status[key]).length;
  const progress = totalCount === 0 ? 0 : grantedCount / totalCount;

  const autoVisible = setupLoaded && statusLoaded && !setupCompleted;
  const visible = isForceOpen || autoVisible;

  useEffect(() => {
    if (!setupLoaded || !setupCompleted || missingRequired || !status.keepAlive) return;
    const ensureKeepAlive = async () => {
      const running = await isKeepAliveRunning();
      if (!running) {
        await startKeepAliveService();
        await refreshStatus();
      }
    };
    ensureKeepAlive();
  }, [missingRequired, refreshStatus, setupCompleted, setupLoaded, status.keepAlive]);

  const handleContinue = useCallback(async () => {
    await AsyncStorage.setItem(PERMISSIONS_SETUP_KEY, 'true');
    setSetupCompleted(true);
    closePermissions();
  }, [closePermissions]);

  const handleClose = useCallback(async () => {
    if (isForceOpen) {
      closePermissions();
      return;
    }
    await AsyncStorage.setItem(PERMISSIONS_SETUP_KEY, 'true');
    setSetupCompleted(true);
    closePermissions();
  }, [closePermissions, isForceOpen]);

  const specialSteps = useMemo(
    () => [
      ...(requiresNotificationPermission
        ? [
            {
              key: 'notifications' as PermissionKey,
              label: 'Уведомления',
              action: requestNotifications,
            },
          ]
        : []),
      { key: 'overlay' as PermissionKey, label: 'Поверх всех приложений', action: requestOverlay },
      { key: 'notificationListener' as PermissionKey, label: 'Доступ к уведомлениям', action: requestNotificationListener },
      { key: 'battery' as PermissionKey, label: 'Не оптимизировать', action: requestBattery },
      { key: 'home' as PermissionKey, label: 'Домашний экран', action: requestHome },
      { key: 'keepAlive' as PermissionKey, label: 'Фоновый режим', action: toggleKeepAlive },
    ],
    [
      requestBattery,
      requestHome,
      requestNotificationListener,
      requestNotifications,
      requestOverlay,
      requiresNotificationPermission,
      toggleKeepAlive,
    ]
  );

  const nextSpecial = useMemo(
    () => specialSteps.find((step) => !status[step.key]) || null,
    [specialSteps, status]
  );

  const requestAll = useCallback(async () => {
    await requestLocation();
    await requestPhoneState();
    await requestNotifications();
    const nextStep = specialSteps.find((step) => step.key !== 'notifications' && !status[step.key]);
    if (nextStep) {
      await nextStep.action();
    }
    await refreshStatus();
  }, [refreshStatus, requestLocation, requestNotifications, requestPhoneState, specialSteps, status]);

  const cards = useMemo(() => {
    const common = [
      {
        key: 'location' as PermissionKey,
        title: 'Геолокация',
        description: 'Скорость, погода и подсказки на маршруте.',
        icon: <MapPin size={ICON_SIZE.md} color={accent.primary} />,
        actionLabel: status.location ? 'Готово' : 'Разрешить',
        onPress: () => runBusyAction(requestLocation),
        required: true,
      },
      {
        key: 'phoneState' as PermissionKey,
        title: 'Состояние сети',
        description: 'Тип сети (LTE/3G) и уровень сигнала.',
        icon: <Signal size={ICON_SIZE.md} color={accent.primary} />,
        actionLabel: status.phoneState ? 'Готово' : 'Разрешить',
        onPress: () => runBusyAction(requestPhoneState),
        required: true,
      },
      {
        key: 'notificationListener' as PermissionKey,
        title: 'Доступ к уведомлениям',
        description: 'Музыкальный виджет и управление плеером.',
        icon: <Bell size={ICON_SIZE.md} color={accent.primary} />,
        actionLabel: status.notificationListener ? 'Готово' : 'Открыть настройки',
        onPress: () => runBusyAction(requestNotificationListener),
        required: true,
      },
      {
        key: 'overlay' as PermissionKey,
        title: 'Поверх всех приложений',
        description: 'Кнопка возврата и быстрые оверлеи поверх других окон.',
        icon: <Layers size={ICON_SIZE.md} color={accent.primary} />,
        actionLabel: status.overlay ? 'Готово' : 'Открыть настройки',
        onPress: () => runBusyAction(requestOverlay),
        required: true,
      },
      {
        key: 'battery' as PermissionKey,
        title: 'Не оптимизировать',
        description: 'CarUI не будет выгружаться в фоне.',
        icon: <BatteryCharging size={ICON_SIZE.md} color={accent.primary} />,
        actionLabel: status.battery ? 'Готово' : 'Открыть настройки',
        onPress: () => runBusyAction(requestBattery),
        required: true,
      },
    ];

    if (requiresNotificationPermission) {
      common.splice(2, 0, {
        key: 'notifications' as PermissionKey,
        title: 'Разрешить уведомления',
        description: 'Нужно для фонового режима и статуса CarUI.',
        icon: <Radio size={ICON_SIZE.md} color={accent.primary} />,
        actionLabel: status.notifications ? 'Готово' : 'Разрешить',
        onPress: () => runBusyAction(requestNotifications),
        required: true,
      });
    }

    const recommended = [
      {
        key: 'home' as PermissionKey,
        title: 'Домашний экран',
        description: 'Сделать CarUI главным лаунчером.',
        icon: <Home size={ICON_SIZE.md} color={accent.primary} />,
        actionLabel: status.home ? 'Готово' : 'Открыть настройки',
        onPress: () => runBusyAction(requestHome),
        required: false,
      },
      {
        key: 'keepAlive' as PermissionKey,
        title: 'Фоновый режим',
        description: 'Стабильный звук и работа при открытых окнах.',
        icon: <Phone size={ICON_SIZE.md} color={accent.primary} />,
        actionLabel: status.keepAlive ? 'Остановить' : 'Включить',
        onPress: () => runBusyAction(toggleKeepAlive),
        required: false,
      },
    ];

    return { required: common, recommended };
  }, [
    accent.primary,
    requestBattery,
    requestHome,
    requestLocation,
    requestNotificationListener,
    requestNotifications,
    requestOverlay,
    requestPhoneState,
    requiresNotificationPermission,
    runBusyAction,
    status.battery,
    status.home,
    status.keepAlive,
    status.location,
    status.notificationListener,
    status.notifications,
    status.overlay,
    status.phoneState,
    toggleKeepAlive,
  ]);

  if (!visible) return null;

  return (
    <Modal visible transparent={false} animationType="fade">
      <View style={styles.screen}>
        <StatusBar barStyle="light-content" backgroundColor={BASE_COLORS.background.primary} />
        <View pointerEvents="none" style={styles.backgroundLayer}>
          <View style={[styles.orb, { backgroundColor: accent.primary + '18' }]} />
          <View style={[styles.orbAlt, { backgroundColor: accent.primary + '0F' }]} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.closeRow}>
              <Button
                title="Закрыть"
                onPress={handleClose}
                variant="ghost"
                size="sm"
                icon={<X size={16} color={BASE_COLORS.text.secondary} />}
              />
            </View>
            <Text style={styles.eyebrow}>CARUI SETUP</Text>
            <Text style={styles.title}>Разрешения и фон</Text>
            <Text style={styles.subtitle}>
              Настроим доступы, чтобы CarUI стабильно работал в дороге и поверх других приложений.
            </Text>

            <View style={styles.progressRow}>
              <Text style={styles.progressText}>
                Готово {grantedCount} из {totalCount}
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: accent.primary }]} />
              </View>
            </View>

            <View style={styles.heroActions}>
              <Button
                title={nextSpecial ? 'Разрешить все и продолжить' : 'Разрешить все'}
                onPress={() => runBusyAction(requestAll)}
                loading={busy}
                disabled={busy}
                size="lg"
              />
              {nextSpecial ? (
                <Text style={styles.nextStepHint}>
                  Следующий шаг: {nextSpecial.label}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Основные</Text>
            <View style={styles.grid}>
              {cards.required.map((item) => (
                <PermissionCard
                  key={item.key}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  actionLabel={item.actionLabel}
                  onPress={item.onPress}
                  granted={status[item.key]}
                  required
                  style={isWide ? styles.cardWide : styles.cardFull}
                />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Рекомендуемые</Text>
            <View style={styles.grid}>
              {cards.recommended.map((item) => (
                <PermissionCard
                  key={item.key}
                  title={item.title}
                  description={item.description}
                  icon={item.icon}
                  actionLabel={item.actionLabel}
                  onPress={item.onPress}
                  granted={status[item.key]}
                  required={false}
                  style={isWide ? styles.cardWide : styles.cardFull}
                />
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <Button
              title="Продолжить в CarUI"
              onPress={handleContinue}
              variant="secondary"
              size="lg"
            />
            {missingRequired || missingRecommended ? (
              <Text style={styles.footerHint}>
                Пропущенные доступы можно включить позже в настройках.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function getRequiredKeys(requiresNotificationPermission: boolean): PermissionKey[] {
  const keys: PermissionKey[] = [
    'location',
    'phoneState',
    'notificationListener',
    'overlay',
    'battery',
  ];
  if (requiresNotificationPermission) {
    keys.splice(2, 0, 'notifications');
  }
  return keys;
}

function getRecommendedKeys(): PermissionKey[] {
  return ['home', 'keepAlive'];
}

interface PermissionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  actionLabel: string;
  onPress: () => void;
  granted: boolean;
  required: boolean;
  style?: StyleProp<ViewStyle>;
}

function PermissionCard({
  title,
  description,
  icon,
  actionLabel,
  onPress,
  granted,
  required,
  style,
}: PermissionCardProps) {
  const accent = useAccentColor();
  const statusColor = granted ? BASE_COLORS.semantic.success : required ? BASE_COLORS.semantic.warning : BASE_COLORS.text.tertiary;
  const statusLabel = granted ? 'Готово' : required ? 'Основной' : 'Советуем';

  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { borderColor: accent.primary + '40' }]}>{icon}</View>
        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardStatus}>
            <Text style={[styles.statusDot, { color: statusColor }]}>● </Text>
            <Text style={{ color: statusColor }}>{statusLabel}</Text>
          </Text>
        </View>
      </View>
      <Text style={styles.cardDescription}>{description}</Text>
      <Button
        title={actionLabel}
        onPress={onPress}
        size="md"
        variant={granted ? 'secondary' : 'primary'}
        disabled={granted}
        style={styles.cardButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BASE_COLORS.background.primary,
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    top: -120,
    right: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  orbAlt: {
    position: 'absolute',
    bottom: -160,
    left: -80,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  hero: {
    backgroundColor: BASE_COLORS.glass.background,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: BASE_COLORS.glass.border,
    padding: SPACING.xl,
    marginBottom: SPACING.xl,
    overflow: 'hidden',
  },
  closeRow: {
    alignItems: 'flex-end',
    marginBottom: SPACING.sm,
  },
  eyebrow: {
    fontSize: FONT_SIZE.xs,
    color: BASE_COLORS.text.tertiary,
    letterSpacing: 1.5,
    fontWeight: FONT_WEIGHT.bold,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: scale(28),
    color: BASE_COLORS.text.primary,
    fontWeight: FONT_WEIGHT.bold,
  },
  subtitle: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZE.md,
    color: BASE_COLORS.text.secondary,
    lineHeight: scale(22),
    maxWidth: 720,
  },
  progressRow: {
    marginTop: SPACING.lg,
  },
  progressText: {
    color: BASE_COLORS.text.secondary,
    fontSize: FONT_SIZE.sm,
    marginBottom: SPACING.sm,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 999,
  },
  heroActions: {
    marginTop: SPACING.lg,
    gap: SPACING.sm,
  },
  nextStepHint: {
    fontSize: FONT_SIZE.sm,
    color: BASE_COLORS.text.tertiary,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    color: BASE_COLORS.text.primary,
    fontWeight: FONT_WEIGHT.semibold,
    marginBottom: SPACING.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.lg,
  },
  card: {
    backgroundColor: BASE_COLORS.background.secondary,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: BASE_COLORS.glass.border,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  cardWide: {
    width: '48%',
  },
  cardFull: {
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  iconWrap: {
    width: scale(44),
    height: scale(44),
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BASE_COLORS.glass.background,
    borderWidth: 1,
  },
  cardMeta: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: FONT_SIZE.md,
    color: BASE_COLORS.text.primary,
    fontWeight: FONT_WEIGHT.semibold,
  },
  cardStatus: {
    fontSize: FONT_SIZE.xs,
    color: BASE_COLORS.text.tertiary,
  },
  statusDot: {
    fontSize: FONT_SIZE.xs,
  },
  cardDescription: {
    fontSize: FONT_SIZE.sm,
    color: BASE_COLORS.text.secondary,
    lineHeight: scale(18),
  },
  cardButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
  },
  footer: {
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  footerHint: {
    fontSize: FONT_SIZE.sm,
    color: BASE_COLORS.text.tertiary,
    textAlign: 'center',
    maxWidth: 640,
  },
});
