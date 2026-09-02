import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch, Text, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { useShallow } from 'zustand/shallow';
import { ArrowLeft, Wifi, Volume2, Camera, Navigation, Palette, Gauge, Radar, CloudRain, Settings, MapPin } from 'lucide-react-native';
import Slider from '@react-native-community/slider';

import { useSettingsStore, useConnectionStore, useUiStore, NAVIGATOR_APPS } from '../app/store';
import { openSettings, getNavigatorApps, isAppInstalled } from '../services/native';
import { InstalledApp } from '../types';
import { useAccentColor } from '../hooks/useTheme';

import { VisionTheme, VisionCard, VisionRow } from '../components/settings/VisionTheme';
import { AudioSelector } from '../components/settings/AudioSelector';
import { NavigatorSelector } from '../components/settings/NavigatorSelector';
import { SpeedThresholdSelector } from '../components/settings/SpeedThresholdSelector';
import { AccentColorPicker } from '../components/settings/AccentColorPicker';
import { BASE_COLORS, FONT_SIZE, FONT_WEIGHT, ICON_SIZE, RADIUS, SPACING, TOUCH_TARGET, scale } from '../theme/constants';

const SettingsHeader = React.memo(() => {
  const closeSettings = useUiStore((s) => s.closeSettings);

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={closeSettings} activeOpacity={0.7}>
        <ArrowLeft size={ICON_SIZE.md} color={BASE_COLORS.text.primary} />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit={true}>
        Настройки
      </Text>
      <View style={styles.headerSpacer} />
    </View>
  );
});

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  rightElement?: React.ReactNode;
  accentColor: string;
};

const SectionHeader = React.memo(({ title, subtitle, icon, rightElement, accentColor }: SectionHeaderProps) => (
  <View style={styles.sectionHeader}>
    <View style={[styles.sectionIcon, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
      {icon}
    </View>
    <View style={styles.sectionText}>
      <Text style={styles.sectionTitle} numberOfLines={1} adjustsFontSizeToFit={true}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.sectionSubtitle} numberOfLines={1} adjustsFontSizeToFit={true}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {rightElement ? <View style={styles.sectionRight}>{rightElement}</View> : null}
  </View>
));

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function SettingsScreen() {
  const connectionStatus = useConnectionStore((s) => s.status);
  const accent = useAccentColor();
  const openPermissions = useUiStore((s) => s.openPermissions);
  const closeSettings = useUiStore((s) => s.closeSettings);
  const { width } = useWindowDimensions();
  const isCompact = width < 1100;
  const isWide = width >= 1500;
  const retentionSliderWidth = Math.min(
    scale(420),
    Math.round(width * (isWide ? 0.22 : isCompact ? 0.55 : 0.35))
  );

  const settings = useStoreWithEqualityFn(
    useSettingsStore,
      useShallow(
          (s) => ({
            gatewayHost: s.gatewayHost,
            gatewayPort: s.gatewayPort,
            audioEnabled: s.audioEnabled,
            setAudioEnabled: s.setAudioEnabled,
            audioPack: s.audioPack,
            setAudioPack: s.setAudioPack,
            audioVolume: s.audioVolume,
            setAudioVolume: s.setAudioVolume,
            weatherAudioEnabled: s.weatherAudioEnabled,
            setWeatherAudioEnabled: s.setWeatherAudioEnabled,
            speedAudioEnabled: s.speedAudioEnabled,
            setSpeedAudioEnabled: s.setSpeedAudioEnabled,
            gpioAudioEnabled: s.gpioAudioEnabled,
            setGpioAudioEnabled: s.setGpioAudioEnabled,
            connectionAudioEnabled: s.connectionAudioEnabled,
            setConnectionAudioEnabled: s.setConnectionAudioEnabled,
            speedWarningThreshold: s.speedWarningThreshold,
            setSpeedWarningThreshold: s.setSpeedWarningThreshold,
            recordingQuality: s.recordingQuality,
            setRecordingQuality: s.setRecordingQuality,
            retentionDays: s.retentionDays,
            setRetentionDays: s.setRetentionDays,
            navigatorApp: s.navigatorApp,
            customNavigatorPackage: s.customNavigatorPackage,
            setNavigatorApp: s.setNavigatorApp,
          })
      ));

  const isConnected = connectionStatus === 'connected';
  const volumePercent = Math.round(settings.audioVolume * 100);

  const [navApps, setNavApps] = useState<InstalledApp[]>([]);
  const [dgisInstalled, setDgisInstalled] = useState(true);
  const [yandexInstalled, setYandexInstalled] = useState(true);
  const [mapCacheSize, setMapCacheSize] = useState(0);
  const [mapCachePacks, setMapCachePacks] = useState(0);
  const [mapCacheLoading, setMapCacheLoading] = useState(false);

  useEffect(() => {
    getNavigatorApps().then(setNavApps).catch(console.error);
    isAppInstalled(NAVIGATOR_APPS.dgis.packageName).then(setDgisInstalled);
    isAppInstalled(NAVIGATOR_APPS.yandex.packageName).then(setYandexInstalled);
  }, []);

  const refreshMapCache = async () => {
    setMapCacheLoading(true);
    try {
      /*
      todo: получение размера кэша из mapbox
      const { getMapCacheStats } = await loadMapCacheApi();
      const stats = await getMapCacheStats();
      setMapCacheSize(stats.bytes);
      setMapCachePacks(stats.packs);
       */
    } finally {
      setMapCacheLoading(false);
    }
  };

  useEffect(() => {
    refreshMapCache().catch(() => {});
  }, []);

  const handleClearMapCache = async () => {
    if (mapCacheLoading) return;
    setMapCacheLoading(true);
    try {
      /* todo: очистка кэша из mapbox
      const { clearMapCache, getMapCacheStats } = await loadMapCacheApi();
      await clearMapCache();
      const stats = await getMapCacheStats();
      setMapCacheSize(stats.bytes);
      setMapCachePacks(stats.packs);
       */
    } finally {
      setMapCacheLoading(false);
    }
  };

  const handleNavigatorSelect = (pkg: string) => {
    if (pkg === NAVIGATOR_APPS.dgis.packageName) settings.setNavigatorApp('dgis');
    else if (pkg === NAVIGATOR_APPS.yandex.packageName) settings.setNavigatorApp('yandex');
    else settings.setNavigatorApp('custom', pkg);
  };

  return (
      <View style={styles.screen}>
        <View pointerEvents="none" style={styles.backgroundLayer}>
          <View style={[styles.backgroundOrb, { backgroundColor: accent.primary + '12' }]} />
          <View style={[styles.backgroundOrbAlt, { backgroundColor: accent.primary + '0B' }]} />
        </View>
        <SettingsHeader />
        <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}
            showsVerticalScrollIndicator={false}
        >
          <VisionCard style={[styles.sectionCard, styles.heroCard]}>
            <View style={styles.heroInner}>
              <View
                pointerEvents="none"
                style={[styles.heroGlow, { backgroundColor: accent.primary + '1F' }]}
              />
              <View style={styles.heroRow}>
                <View style={styles.heroLeft}>
                  <View style={styles.heroTitleRow}>
                    <View
                      style={[
                        styles.heroIcon,
                        { backgroundColor: accent.primary + '18', borderColor: accent.primary + '40' },
                      ]}
                    >
                      <Wifi size={ICON_SIZE.md} color={isConnected ? accent.primary : VisionTheme.colors.textSecondary} />
                    </View>
                    <View style={styles.heroText}>
                      <Text style={styles.heroEyebrow} numberOfLines={1} adjustsFontSizeToFit={true}>
                        CARUI LINK
                      </Text>
                      <Text style={styles.heroTitle} numberOfLines={1} adjustsFontSizeToFit={true}>
                        {isConnected ? 'Подключено' : 'Поиск машины'}
                      </Text>
                      <Text style={styles.heroSub} numberOfLines={1} adjustsFontSizeToFit={true}>
                        {settings.gatewayHost}:{settings.gatewayPort}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.heroRight}>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor: isConnected ? accent.primary + '22' : 'rgba(255,255,255,0.08)',
                        borderColor: isConnected ? accent.primary + '55' : 'rgba(255,255,255,0.2)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        { color: isConnected ? accent.primary : VisionTheme.colors.textSecondary },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit={true}
                    >
                      {isConnected ? 'ONLINE' : 'OFFLINE'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </VisionCard>

          <View style={[styles.sections, isWide ? styles.sectionsWide : styles.sectionsStack]}>
            <View style={styles.column}>
              <VisionCard style={styles.sectionCard}>
                <SectionHeader
                  title="Ассистент"
                  subtitle="Голосовые подсказки"
                  icon={<Volume2 size={ICON_SIZE.md} color={accent.primary} />}
                  rightElement={
                    <Switch
                      value={settings.audioEnabled}
                      onValueChange={settings.setAudioEnabled}
                      trackColor={{ false: '#2A2A2F', true: accent.primary }}
                      thumbColor="#FFF"
                      style={{
                        transform: [
                          { scaleX: isCompact ? 0.85 : 0.95 },
                          { scaleY: isCompact ? 0.85 : 0.95 },
                        ],
                      }}
                    />
                  }
                  accentColor={accent.primary}
                />

                {settings.audioEnabled ? (
                  <>
                    <View style={styles.sectionBody}>
                      <AudioSelector
                        selectedPack={settings.audioPack}
                        onSelect={settings.setAudioPack}
                        volume={settings.audioVolume}
                      />

                      <View style={styles.volumeBlock}>
                        <View style={styles.volumeRow}>
                          <Text style={styles.volumeLabel} numberOfLines={1} adjustsFontSizeToFit={true}>
                            ГРОМКОСТЬ
                          </Text>
                          <Text
                            style={[styles.volumeValue, { color: accent.primary }]}
                            numberOfLines={1} adjustsFontSizeToFit={true}
                          >
                            {volumePercent}%
                          </Text>
                        </View>
                        <Slider
                          style={styles.volumeSlider}
                          value={settings.audioVolume}
                          onValueChange={settings.setAudioVolume}
                          minimumValue={0}
                          maximumValue={1}
                          minimumTrackTintColor={accent.primary}
                          maximumTrackTintColor="#333"
                          thumbTintColor="#FFF"
                        />
                      </View>

                      <View style={[styles.togglesGrid, isCompact && styles.togglesGridCompact]}>
                        <QuickToggle
                          label="Погода"
                          value={settings.weatherAudioEnabled}
                          onChange={settings.setWeatherAudioEnabled}
                          accentColor={accent.primary}
                          compact={isCompact}
                          icon={
                            <CloudRain
                              size={ICON_SIZE.sm}
                              color={settings.weatherAudioEnabled ? accent.primary : VisionTheme.colors.textSecondary}
                            />
                          }
                        />
                        <QuickToggle
                          label="Скорость"
                          value={settings.speedAudioEnabled}
                          onChange={settings.setSpeedAudioEnabled}
                          accentColor={accent.primary}
                          compact={isCompact}
                          icon={
                            <Gauge
                              size={ICON_SIZE.sm}
                              color={settings.speedAudioEnabled ? accent.primary : VisionTheme.colors.textSecondary}
                            />
                          }
                        />
                        <QuickToggle
                          label="Датчики"
                          value={settings.gpioAudioEnabled}
                          onChange={settings.setGpioAudioEnabled}
                          accentColor={accent.primary}
                          compact={isCompact}
                          icon={
                            <Radar
                              size={ICON_SIZE.sm}
                              color={settings.gpioAudioEnabled ? accent.primary : VisionTheme.colors.textSecondary}
                            />
                          }
                        />
                        <QuickToggle
                          label="Связь"
                          value={settings.connectionAudioEnabled}
                          onChange={settings.setConnectionAudioEnabled}
                          accentColor={accent.primary}
                          compact={isCompact}
                          icon={
                            <Wifi
                              size={ICON_SIZE.sm}
                              color={settings.connectionAudioEnabled ? accent.primary : VisionTheme.colors.textSecondary}
                            />
                          }
                        />
                      </View>
                    </View>

                    {settings.speedAudioEnabled && (
                      <SpeedThresholdSelector
                        value={settings.speedWarningThreshold}
                        onChange={settings.setSpeedWarningThreshold}
                      />
                    )}
                  </>
                ) : (
                  <View style={styles.sectionBodyCompact}>
                    <Text style={styles.sectionHint} numberOfLines={2} allowFontScaling={false}>
                      Выключен. Включите, чтобы получать голосовые подсказки в дороге.
                    </Text>
                  </View>
                )}
              </VisionCard>

              <VisionCard style={styles.sectionCard}>
                <SectionHeader
                  title="Навигация"
                  subtitle="Выбор приложения"
                  icon={<Navigation size={ICON_SIZE.md} color={accent.primary} />}
                  accentColor={accent.primary}
                />
                <NavigatorSelector
                  apps={navApps}
                  selectedPackage={
                    settings.navigatorApp === 'custom'
                      ? settings.customNavigatorPackage
                      : NAVIGATOR_APPS[settings.navigatorApp as 'dgis' | 'yandex']?.packageName
                  }
                  onSelect={handleNavigatorSelect}
                  dgisInstalled={dgisInstalled}
                  yandexInstalled={yandexInstalled}
                />
              </VisionCard>

              <VisionCard style={styles.sectionCard}>
                <SectionHeader
                  title="Карты"
                  subtitle="Оффлайн-кэш"
                  icon={<MapPin size={ICON_SIZE.md} color={accent.primary} />}
                  accentColor={accent.primary}
                />
                <VisionRow
                  label="Размер кэша"
                  value={
                    mapCacheLoading
                      ? '...'
                      : `${formatBytes(mapCacheSize)}${mapCachePacks ? ` • ${mapCachePacks} пак.` : ''}`
                  }
                />
                <VisionRow
                  label="Очистить кэш карт"
                  value={mapCacheLoading ? '...' : 'Удалить'}
                  onPress={handleClearMapCache}
                  isLast
                />
              </VisionCard>
            </View>

            <View style={styles.column}>
              <VisionCard style={styles.sectionCard}>
                <SectionHeader
                  title="Внешний вид"
                  subtitle="Цвет и атмосфера"
                  icon={<Palette size={ICON_SIZE.md} color={accent.primary} />}
                  accentColor={accent.primary}
                />
                <AccentColorPicker />
              </VisionCard>

              <VisionCard style={styles.sectionCard}>
                <SectionHeader
                  title="DVR"
                  subtitle="Запись и хранение"
                  icon={<Camera size={ICON_SIZE.md} color={VisionTheme.colors.warning} />}
                  accentColor={VisionTheme.colors.warning}
                />
                <VisionRow
                  label="Качество"
                  value={settings.recordingQuality}
                  onPress={() =>
                    settings.setRecordingQuality(settings.recordingQuality === '1080p' ? '720p' : '1080p')
                  }
                />
                <VisionRow
                  label="Дней хранения"
                  value={`${settings.retentionDays}`}
                  isLast
                  rightElement={
                    <Slider
                      style={[styles.retentionSlider, { width: retentionSliderWidth }]}
                      value={settings.retentionDays}
                      onValueChange={(v) => settings.setRetentionDays(Math.round(v))}
                      minimumValue={1}
                      maximumValue={30}
                      step={1}
                      minimumTrackTintColor={VisionTheme.colors.warning}
                      maximumTrackTintColor="#333"
                      thumbTintColor="#FFF"
                    />
                  }
                />
              </VisionCard>

              <VisionCard style={styles.sectionCard}>
                <SectionHeader
                  title="Система"
                  subtitle="Android и сервисы"
                  icon={<Settings size={ICON_SIZE.md} color={BASE_COLORS.semantic.info} />}
                  accentColor={BASE_COLORS.semantic.info}
                />
                <VisionRow
                  label="Разрешения и фон"
                  value="Открыть"
                  icon={<Settings size={ICON_SIZE.sm} color={BASE_COLORS.semantic.info} />}
                  onPress={() => {
                    closeSettings();
                    openPermissions();
                  }}
                />
                <VisionRow
                  label="Системные настройки Android"
                  onPress={openSettings}
                  isLast
                />
              </VisionCard>
            </View>
          </View>

          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </View>
  );
}

// Mini component for Grid Toggles
const QuickToggle = ({
  label,
  value,
  onChange,
  accentColor,
  compact,
  icon,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  accentColor: string;
  compact: boolean;
  icon: React.ReactNode;
}) => (
    <TouchableOpacity
        style={[
          styles.toggleItem,
          compact && styles.toggleItemCompact,
          value && { borderColor: accentColor + '66', backgroundColor: accentColor + '12' },
        ]}
        activeOpacity={0.7}
        onPress={() => onChange(!value)}
    >
      <View
        style={[
          styles.toggleIcon,
          value && { borderColor: accentColor + '66', backgroundColor: accentColor + '22' },
        ]}
      >
        {icon}
      </View>
      <Text style={[styles.toggleLabel, value && { color: accentColor }]} numberOfLines={1} adjustsFontSizeToFit={true}>
        {label}
      </Text>
      <Switch
        pointerEvents="none"
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#222', true: VisionTheme.colors.glassPressed }}
        thumbColor={value ? accentColor : '#555'}
        style={{ transform: [{ scaleX: compact ? 0.78 : 0.88 }, { scaleY: compact ? 0.78 : 0.88 }] }}
      />
    </TouchableOpacity>
);

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: VisionTheme.colors.background,
    position: 'relative',
  },
  backgroundLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  backgroundOrb: {
    position: 'absolute',
    top: -scale(120),
    left: -scale(80),
    width: scale(260),
    height: scale(260),
    borderRadius: scale(130),
  },
  backgroundOrbAlt: {
    position: 'absolute',
    bottom: -scale(140),
    right: -scale(80),
    width: scale(240),
    height: scale(240),
    borderRadius: scale(120),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: BASE_COLORS.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: BASE_COLORS.glass.border,
  },
  backButton: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  headerTitle: {
    fontSize: FONT_SIZE.h2,
    fontWeight: FONT_WEIGHT.bold,
    color: BASE_COLORS.text.primary,
    letterSpacing: scale(0.5),
  },
  headerSpacer: {
    width: scale(40),
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    gap: SPACING.lg,
  },
  contentCompact: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    gap: SPACING.md,
  },
  sectionCard: {
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: scale(8) },
    shadowOpacity: 0.25,
    shadowRadius: scale(16),
    elevation: scale(8),
  },
  heroCard: {
    shadowOpacity: 0.35,
    shadowRadius: scale(20),
    elevation: scale(10),
  },
  heroInner: {
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: -scale(90),
    right: -scale(70),
    width: scale(220),
    height: scale(220),
    borderRadius: scale(120),
    opacity: 0.9,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(20),
    paddingVertical: SPACING.lg,
  },
  heroLeft: {
    flex: 1,
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  heroIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(16),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flexShrink: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: VisionTheme.colors.textSecondary,
    letterSpacing: scale(1),
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: FONT_SIZE.h1,
    fontWeight: '700',
    color: VisionTheme.colors.text,
    marginTop: SPACING.xs,
  },
  heroSub: {
    fontSize: FONT_SIZE.sm,
    color: VisionTheme.colors.textSecondary,
    marginTop: SPACING.xs,
  },
  heroRight: {
    alignItems: 'flex-end',
    paddingLeft: SPACING.md,
  },
  statusPill: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    letterSpacing: scale(1),
  },
  sections: {
    gap: SPACING.lg,
  },
  sectionsWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.lg,
  },
  sectionsStack: {
    flexDirection: 'column',
  },
  column: {
    flex: 1,
    gap: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  sectionIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(12),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionText: {
    flex: 1,
    marginLeft: SPACING.md,
    gap: scale(2),
  },
  sectionTitle: {
    fontSize: FONT_SIZE.lg,
    fontWeight: '700',
    color: VisionTheme.colors.text,
  },
  sectionSubtitle: {
    fontSize: FONT_SIZE.sm,
    color: VisionTheme.colors.textSecondary,
  },
  sectionRight: {
    marginLeft: SPACING.md,
  },
  sectionBody: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  sectionBodyCompact: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  sectionHint: {
    fontSize: FONT_SIZE.sm,
    color: VisionTheme.colors.textSecondary,
    lineHeight: FONT_SIZE.sm + scale(6),
  },
  volumeBlock: {
    marginTop: SPACING.md,
    gap: SPACING.xs,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  volumeLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: VisionTheme.colors.textSecondary,
    letterSpacing: scale(1),
    lineHeight: FONT_SIZE.xs + scale(6),
    textTransform: 'uppercase',
  },
  volumeValue: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
    letterSpacing: scale(0.5),
  },
  volumeSlider: {
    height: scale(36),
    width: '100%',
  },
  retentionSlider: {
    height: scale(36),
  },
  togglesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
  },
  togglesGridCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: SPACING.md,
  },
  toggleItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: TOUCH_TARGET.md,
    gap: SPACING.sm,
  },
  toggleItemCompact: {
    width: '100%',
    marginBottom: 0,
  },
  toggleIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(10),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  toggleLabel: {
    fontSize: FONT_SIZE.sm,
    color: VisionTheme.colors.text,
    fontWeight: '600',
    flexShrink: 1,
    flexGrow: 1,
  }
});
