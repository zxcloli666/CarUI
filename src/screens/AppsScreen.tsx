import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import { Search, Rocket, X, LayoutGrid, ChevronRight } from 'lucide-react-native';

// UI Компоненты
import { GlassView } from '../components/ui/GlassView';
import {
  getInstalledApps,
  launchApp,
  showBackToCarUIButton,
  KNOWN_APPS,
} from '../services/native';
import { useScreenActive } from '../hooks';

const { width } = Dimensions.get('window');

// Настройки сетки (делаем компактнее)
const COLUMN_COUNT = 8;
const GRID_GAP = 12;
const PADDING = 20;
const CARD_SIZE = (width - PADDING * 2 - GRID_GAP * (COLUMN_COUNT - 1)) / COLUMN_COUNT;

const THEME = {
  bg: '#000000',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.4)',
  accent: '#007AFF', // Vision Blue
};

const CATEGORY_LABELS: Record<string, string> = {
  Navigation: 'Навигация',
  Media: 'Медиа',
  Communication: 'Связь',
  Browsers: 'Браузеры',
  System: 'Система',
  Other: 'Приложения',
};

/**
 * Компактная карточка приложения с Glass-эффектом
 */
const AppCard = React.memo(({ app, onPress }: { app: any; onPress: () => void }) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => (scale.value = withSpring(0.9, { damping: 15 }));
  const handlePressOut = () => (scale.value = withSpring(1));

  return (
      <Animated.View style={[styles.card, animatedStyle]}>
        <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            style={styles.cardInner}
        >
          <GlassView intensity="medium" style={styles.glassCard}>
            <View style={styles.iconWrapper}>
              {app.icon ? (
                  <Image source={{ uri: app.icon }} style={styles.appIcon} />
              ) : (
                  <LayoutGrid size={24} color={THEME.textSecondary} />
              )}
            </View>
            <Text numberOfLines={1} style={styles.appLabel}>{app.appName}</Text>
          </GlassView>
        </Pressable>
      </Animated.View>
  );
});

export const AppsScreen = React.memo(() => {
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const isActive = useScreenActive();

  const loadApps = useCallback(async () => {
    try {
      const data = await getInstalledApps();
      setApps(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isActive) loadApps();
  }, [isActive, loadApps]);

  // Быстрый запуск: динамически проверяем ВСЕ ключи из KNOWN_APPS
  const quickAccessApps = useMemo(() => {
    return Object.entries(KNOWN_APPS)
        .map(([key, pkg]) => {
          const installed = apps.find(a => a.packageName === pkg);
          return installed ? { ...installed, shortName: key } : null;
        })
        .filter(Boolean);
  }, [apps]);

  // Группировка по категориям
  const sections = useMemo(() => {
    const filtered = apps.filter(a =>
        a.appName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const grouped: Record<string, any[]> = {};
    filtered.forEach(app => {
      const cat = app.category || 'Other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(app);
    });

    return Object.entries(grouped).sort(([a], [b]) => {
      if (a === 'Navigation') return -1; // Навигация всегда первая
      return a.localeCompare(b);
    });
  }, [apps, searchQuery]);

  const handleLaunch = async (pkg: string) => {
    await showBackToCarUIButton();
    await launchApp(pkg);
  };

  if (loading && apps.length === 0) {
    return <View style={styles.center}><ActivityIndicator color={THEME.accent} size="large" /></View>;
  }

  return (
      <View style={styles.container}>
        {/* Поиск с GlassView */}
        <View style={styles.header}>
          <GlassView intensity="light" style={styles.searchGlass}>
            <Search size={18} color={THEME.textSecondary} />
            <TextInput
                placeholder="Поиск..."
                placeholderTextColor={THEME.textSecondary}
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <X size={18} color={THEME.textSecondary} />
                </Pressable>
            )}
          </GlassView>
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* Быстрый запуск (Bento-стиль) */}
          {!searchQuery && quickAccessApps.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Rocket size={14} color={THEME.accent} strokeWidth={3} />
                  <Text style={styles.sectionTitle}>Быстрый доступ</Text>
                </View>
                <View style={styles.quickGrid}>
                  {quickAccessApps.map((app: any) => (
                      <Pressable
                          key={app.packageName}
                          onPress={() => handleLaunch(app.packageName)}
                          style={styles.quickPressable}
                      >
                        <GlassView intensity="light" style={styles.quickChip}>
                          <Image source={{ uri: app.icon }} style={styles.quickIcon} />
                          <Text style={styles.quickChipText} numberOfLines={1}>{app.appName}</Text>
                        </GlassView>
                      </Pressable>
                  ))}
                </View>
              </View>
          )}

          {/* Категории */}
          {sections.map(([cat, items]) => (
              <View key={cat} style={styles.section}>
                <Text style={styles.sectionTitle}>{CATEGORY_LABELS[cat] || cat}</Text>
                <View style={styles.grid}>
                  {items.map(app => (
                      <AppCard
                          key={app.packageName}
                          app={app}
                          onPress={() => handleLaunch(app.packageName)}
                      />
                  ))}
                </View>
              </View>
          ))}
        </ScrollView>
      </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { padding: PADDING, paddingBottom: 15 },
  searchGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 15,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    color: THEME.textPrimary,
    fontSize: 16,
    fontWeight: '500',
  },

  scrollBody: { paddingHorizontal: PADDING, paddingBottom: 120 },

  section: { marginBottom: 25 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  sectionTitle: {
    color: THEME.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // Быстрый запуск
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickPressable: { width: '24%' }, // 4 в ряд
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    gap: 8,
  },
  quickIcon: { width: 24, height: 24, borderRadius: 6 },
  quickChipText: { color: THEME.textPrimary, fontWeight: '600', fontSize: 13, flex: 1 },

  // Сетка приложений
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP },
  card: { width: CARD_SIZE, aspectRatio: 0.85 },
  cardInner: { flex: 1 },
  glassCard: {
    flex: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  iconWrapper: {
    width: '55%',
    aspectRatio: 1,
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  appIcon: { width: '100%', height: '100%', resizeMode: 'contain' },
  appLabel: {
    color: THEME.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
    width: '90%',
  },
});