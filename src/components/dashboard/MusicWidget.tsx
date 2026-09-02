import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Play, Pause, SkipBack, SkipForward, Music2, Disc,
  Heart, ThumbsDown, Shuffle, Repeat, Plus, Share2, List, Radio, Circle
} from 'lucide-react-native';
import Animated, {
  useAnimatedStyle, useSharedValue, withSpring, withTiming, Easing
} from 'react-native-reanimated';
import { BASE_COLORS, SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, ICON_SIZE, scale } from '../../theme/constants';
import { useAccentColor } from '../../hooks/useTheme';
import {
  getActiveMediaSession,
  play,
  pause,
  skipNext,
  skipPrevious,
  performMediaAction,
  startPolling,
  stopPolling,
  subscribeToMediaSessionUpdates,
} from '../../services/native';
import { MediaSession, MediaAction } from '../../types';

// Увеличенная зона нажатия для всех кнопок
const HIT_SLOP = { top: 15, bottom: 15, left: 15, right: 15 };

function getActionIcon(action: MediaAction, size: number, color: string) {
  const props = { size, color, strokeWidth: 2.5 };
  if (action.nativeIcon) {
    return <Image source={{ uri: action.nativeIcon }} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />;
  }
  switch (action.icon) {
    case 'heart': return <Heart {...props} fill={action.active ? color : 'transparent'} />;
    case 'shuffle': return <Shuffle {...props} color={action.active ? color : 'rgba(255,255,255,0.4)'} />;
    case 'repeat': return <Repeat {...props} color={action.active ? color : 'rgba(255,255,255,0.4)'} />;
    default: return <Circle {...props} />;
  }
}

const ActionButton = React.memo(({ onPress, disabled, children, size = scale(56), secondary = false }: any) => {
  const scaleAnim = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleAnim.value }],
    opacity: disabled ? 0.3 : 1
  }));

  return (
      <TouchableOpacity
          onPress={onPress}
          onPressIn={() => (scaleAnim.value = withSpring(0.85))}
          onPressOut={() => (scaleAnim.value = withSpring(1))}
          disabled={disabled}
          activeOpacity={0.7}
          hitSlop={HIT_SLOP}
          style={[
            styles.btnBase,
            { width: size, height: size, borderRadius: size / 2 },
            secondary ? styles.btnSecondary : styles.btnGlass
          ]}
      >
        <Animated.View style={animStyle}>{children}</Animated.View>
      </TouchableOpacity>
  );
});

const PlayButton = React.memo(({ isPlaying, onPress, accentColor }: any) => {
  const scaleAnim = useSharedValue(1);
  const size = scale(76); // Увеличенный размер
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleAnim.value }] }));

  return (
      <TouchableOpacity
          onPress={onPress}
          onPressIn={() => (scaleAnim.value = withSpring(0.85))}
          onPressOut={() => (scaleAnim.value = withSpring(1))}
          activeOpacity={0.9}
          hitSlop={HIT_SLOP}
      >
        <Animated.View style={[styles.playButton, { width: size, height: size, borderRadius: size / 2, backgroundColor: accentColor, shadowColor: accentColor }, animStyle]}>
          {isPlaying ? (
              <Pause size={scale(34)} color="#fff" fill="#fff" />
          ) : (
              <Play size={scale(34)} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
          )}
        </Animated.View>
      </TouchableOpacity>
  );
});

const ProgressBar = React.memo(({ position, duration, accentColor }: any) => {
  const width = useSharedValue(0);
  useEffect(() => {
    if (duration <= 0) return;
    const pct = Math.max(0, Math.min(position / duration, 1));
    width.value = withTiming(pct, { duration: 900, easing: Easing.linear });
  }, [position, duration]);

  const style = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, style, { backgroundColor: accentColor }]} />
        </View>
      </View>
  );
});

const MusicWidgetComponent = () => {
  const accent = useAccentColor();
  const navigation = useNavigation<any>();
  const [session, setSession] = useState<MediaSession | null>(null);
  const [position, setPosition] = useState(0);

  useEffect(() => {
    let mounted = true;
    startPolling(1000);
    const sync = async () => {
      const s = await getActiveMediaSession();
      if (mounted && s) { setSession(s); setPosition(s.metadata.position); }
    };
    sync();
    const intervalId = setInterval(sync, 1000);
    const sub = subscribeToMediaSessionUpdates((s) => { if (mounted && s) setSession(s); });
    return () => { mounted = false; clearInterval(intervalId); stopPolling(); sub?.remove(); };
  }, []);

  const isPlaying = session?.playbackState === 'playing';
  const customActions = useMemo(() => session?.actions?.filter(a => a.isCustom).slice(0, 2) || [], [session?.actions]);

  if (!session || !session.isActive) {
    return (
        <TouchableOpacity style={styles.container} onPress={() => navigation.navigate('Media')} activeOpacity={0.8}>
          <View style={styles.emptyState}>
            <Music2 size={scale(40)} color={BASE_COLORS.text.tertiary} />
            <Text style={styles.emptyText}>Нет музыки</Text>
          </View>
        </TouchableOpacity>
    );
  }

  const trackKey = `${session.packageName}-${session.metadata.title}`;

  return (
      <TouchableOpacity style={styles.container} onPress={() => navigation.navigate('Media')} activeOpacity={0.95}>
        <View style={[styles.backgroundGlow, { backgroundColor: accent.primary }]} />

        <View style={styles.content} key={trackKey}>
          {/* Album Art */}
          <View style={styles.artWrapper}>
            {session.metadata.albumArt ? (
                <Image source={{ uri: session.metadata.albumArt }} style={styles.albumArt} />
            ) : (
                <View style={styles.artPlaceholder}><Disc size={scale(36)} color={BASE_COLORS.text.tertiary} /></View>
            )}
          </View>

          {/* Info */}
          <View style={styles.trackInfo}>
            <Text style={styles.trackTitle} numberOfLines={1}>{session.metadata.title || 'Unknown'}</Text>
            <Text style={[styles.trackArtist, { color: accent.primary }]} numberOfLines={1}>
              {session.metadata.artist || 'Unknown Artist'}
            </Text>
          </View>

          {/* Controls Row */}
          <View style={styles.controlsRow}>
            {customActions.length > 0 && (
                <View style={styles.customActionsGroup}>
                  {customActions.map(action => (
                      <ActionButton
                          key={action.id}
                          size={scale(52)}
                          secondary
                          onPress={() => performMediaAction(session.packageName, action.id)}
                      >
                        {getActionIcon(action, scale(24), action.active ? accent.primary : 'rgba(255,255,255,0.7)')}
                      </ActionButton>
                  ))}
                </View>
            )}

            <View style={styles.transportGroup}>
              <ActionButton onPress={() => skipPrevious(session.packageName)}>
                <SkipBack size={scale(28)} color="#fff" fill="#fff" />
              </ActionButton>

              <PlayButton
                  isPlaying={isPlaying}
                  onPress={() => isPlaying ? pause(session.packageName) : play(session.packageName)}
                  accentColor={accent.primary}
              />

              <ActionButton onPress={() => skipNext(session.packageName)}>
                <SkipForward size={scale(28)} color="#fff" fill="#fff" />
              </ActionButton>
            </View>
          </View>
        </View>

        <ProgressBar
            key={`progress-${trackKey}`}
            position={position}
            duration={session.metadata.duration}
            accentColor={accent.primary}
        />
      </TouchableOpacity>
  );
};

export const MusicWidget = React.memo(MusicWidgetComponent);

const styles = StyleSheet.create({
  container: {
    backgroundColor: BASE_COLORS.glass.background,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: BASE_COLORS.glass.border,
    overflow: 'hidden',
    minHeight: scale(110),
    justifyContent: 'center',
  },
  backgroundGlow: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.05 },
  content: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, gap: SPACING.lg },
  emptyState: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, gap: SPACING.md },
  emptyText: { fontSize: scale(20), color: BASE_COLORS.text.tertiary, fontWeight: '600' },
  artWrapper: { width: scale(72), height: scale(72), borderRadius: RADIUS.md, backgroundColor: BASE_COLORS.background.tertiary, overflow: 'hidden', elevation: 4 },
  albumArt: { width: '100%', height: '100%' },
  artPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  trackInfo: { flex: 1, gap: 4 },
  trackTitle: { fontSize: scale(22), fontWeight: 'bold', color: '#fff', letterSpacing: -0.5 },
  trackArtist: { fontSize: scale(18), fontWeight: '500' },

  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xl },
  customActionsGroup: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingRight: SPACING.lg, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)' },
  transportGroup: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },

  btnBase: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  btnGlass: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.1)' },
  btnSecondary: { backgroundColor: 'transparent', borderColor: 'transparent' },

  playButton: {
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8
  },
  progressContainer: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
});