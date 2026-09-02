import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
    Play, Pause, SkipBack, SkipForward, Music2, Disc,
    Heart, Shuffle, Repeat, Circle
} from 'lucide-react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    Easing,
    runOnJS
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { SPACING, RADIUS, scale } from '../../theme/constants';
import { useAccentColor } from '../../hooks/useTheme';
import {
    getActiveMediaSession,
    play,
    pause,
    skipNext,
    skipPrevious,
    performMediaAction,
    seekTo,
    subscribeToMediaSessionUpdates,
    startPolling,
    stopPolling
} from '../../services/native';
import { MediaSession, MediaAction } from '../../types';

// --- ХЕЛПЕРЫ ---
const formatTime = (ms: number) => {
    'worklet';
    const totalSec = Math.floor(Math.max(0, ms) / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s < 10 ? '0' + s : s}`;
};

function getActionIcon(action: MediaAction, size: number, color: string) {
    const props = { size, color, strokeWidth: 2.5 };
    if (action.nativeIcon) {
        return <Image source={{ uri: action.nativeIcon }} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />;
    }
    switch (action.icon) {
        case 'heart': return <Heart {...props} fill={action.active ? color : 'transparent'} />;
        case 'shuffle': return <Shuffle {...props} color={action.active ? '#FFF' : 'rgba(255,255,255,0.4)'} />;
        case 'repeat': return <Repeat {...props} color={action.active ? '#FFF' : 'rgba(255,255,255,0.4)'} />;
        default: return <Circle {...props} />;
    }
}

// --- КНОПКА (ANIMATED PRESSABLE) ---
const ControlButton = React.memo(({ children, onPress, size = scale(56), primary = false, accent, secondary = false }: any) => {
    const scaleAnim = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scaleAnim.value }]
    }));

    return (
        <Pressable
            onPressIn={() => (scaleAnim.value = withSpring(0.9))}
            onPressOut={() => (scaleAnim.value = withSpring(1))}
            onPress={onPress}
            style={styles.pressableHitSlop}
        >
            <Animated.View style={[
                styles.btnBase,
                { width: size, height: size, borderRadius: size / 2 },
                primary ? { backgroundColor: accent, borderWidth: 0 } : styles.glassBtn,
                secondary && { backgroundColor: 'transparent', borderWidth: 0 },
                animatedStyle
            ]}>
                {children}
            </Animated.View>
        </Pressable>
    );
});

// --- ПРОГРЕСС БАР (ВНУТРЕННИЙ) ---
const WidgetProgressBar = React.memo(({ position, duration, accent, onSeek }: any) => {
    const progress = useSharedValue(0);
    const [layoutWidth, setLayoutWidth] = useState(0);

    // Синхронизация с нативом
    useEffect(() => {
        if (duration <= 0) return;
        const target = Math.max(0, Math.min(position / duration, 1));
        // Плавная анимация к новой позиции
        progress.value = withTiming(target, { duration: 900, easing: Easing.linear });
    }, [position, duration]);

    // Жест перемотки
    const pan = Gesture.Pan()
        .onUpdate((e) => {
            if (layoutWidth > 0) {
                progress.value = Math.max(0, Math.min(e.x / layoutWidth, 1));
            }
        })
        .onEnd(() => {
            const ms = Math.floor(progress.value * duration);
            runOnJS(onSeek)(ms);
        });

    const styleBar = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
        backgroundColor: accent
    }));

    return (
        <View style={styles.progressBox}>
            <GestureDetector gesture={pan}>
                <View
                    style={styles.trackArea}
                    onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
                >
                    <View style={styles.trackBase}>
                        <Animated.View style={[styles.trackFill, styleBar]} />
                    </View>
                </View>
            </GestureDetector>

            <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
        </View>
    );
});

// --- ОСНОВНОЙ ВИДЖЕТ ---
const MusicWidgetComponent = () => {
    const accent = useAccentColor();
    const [session, setSession] = useState<MediaSession | null>(null);
    const [pos, setPos] = useState(0);

    useEffect(() => {
        let mounted = true;

        // 1. Запускаем поллинг (важно для обновления прогресса)
        startPolling(1000);

        const sync = async () => {
            try {
                const s = await getActiveMediaSession();
                if (mounted && s) {
                    setSession(s);
                    setPos(s.metadata.position);
                }
            } catch (e) {}
        };

        // Первичный вызов + интервал (бэкап)
        sync();
        const interval = setInterval(sync, 1000);

        // Подписка на быстрые эвенты
        const sub = subscribeToMediaSessionUpdates((s) => {
            if (mounted && s) {
                setSession(s);
                // Позицию берем из поллинга, чтобы не было дёрганий
            }
        });

        return () => {
            mounted = false;
            stopPolling();
            clearInterval(interval);
            sub?.remove();
        };
    }, []);

    const handleSeek = useCallback((ms: number) => {
        if (session) {
            setPos(ms); // Optimistic
            seekTo(session.packageName, ms);
        }
    }, [session]);

    // Нет музыки
    if (!session?.isActive) {
        return (
            <View style={styles.containerEmpty}>
                <Music2 size={scale(48)} color="rgba(255,255,255,0.2)" />
                <Text style={styles.emptyText}>Нет медиа</Text>
            </View>
        );
    }

    const isPlaying = session.playbackState === 'playing';
    const customActions = session.actions.filter(a => a.isCustom).slice(0, 5);
    // Ключ для полного пересоздания UI при смене трека (решает проблему зависания)
    const trackKey = `${session.packageName}-${session.metadata.title}`;

    return (
        <View style={styles.container}>
            {/* Фон */}
            <Image
                key={`bg-${trackKey}`}
                source={{ uri: session.metadata.albumArt }}
                style={StyleSheet.absoluteFill}
                blurRadius={80} // Сильный блюр
            />
            <LinearGradient
                colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.8)']}
                style={StyleSheet.absoluteFill}
            />

            {/* Контент */}
            <View style={styles.content} key={trackKey}>
                {/* 1. Хедер (Обложка + Инфо) */}
                <View style={styles.header}>
                    <View style={styles.artBox}>
                        {session.metadata.albumArt ? (
                            <Image source={{ uri: session.metadata.albumArt }} style={styles.art} />
                        ) : (
                            <View style={[styles.art, styles.artPlaceholder]}>
                                <Disc color="#666" size={scale(32)} />
                            </View>
                        )}
                    </View>
                    <View style={styles.meta}>
                        <Text style={styles.title} numberOfLines={1}>{session.metadata.title || "Unknown"}</Text>
                        <Text style={[styles.artist, { color: accent.primary }]} numberOfLines={1}>
                            {session.metadata.artist || "Unknown Artist"}
                        </Text>
                    </View>
                </View>

                {/* 2. Прогресс */}
                <WidgetProgressBar
                    position={pos}
                    duration={session.metadata.duration}
                    accent={accent.primary}
                    onSeek={handleSeek}
                />

                {/* 3. Доп действия */}
                <View style={styles.actionsRow}>
                    {customActions.map((action) => (
                        <ControlButton
                            key={action.id}
                            size={scale(44)}
                            secondary
                            onPress={() => performMediaAction(session.packageName, action.id)}
                        >
                            {getActionIcon(action, scale(20), action.active ? accent.primary : 'rgba(255,255,255,0.7)')}
                        </ControlButton>
                    ))}
                </View>

                {/* 4. Главные кнопки */}
                <View style={styles.controlsRow}>
                    <ControlButton
                        onPress={() => skipPrevious(session.packageName)}
                        size={scale(60)}
                    >
                        <SkipBack size={scale(26)} color="#FFF" fill="#FFF" />
                    </ControlButton>

                    <ControlButton
                        primary
                        accent={accent.primary}
                        size={scale(76)}
                        onPress={() => isPlaying ? pause(session.packageName) : play(session.packageName)}
                    >
                        {isPlaying
                            ? <Pause size={scale(34)} color="#FFF" fill="#FFF" />
                            : <Play size={scale(34)} color="#FFF" fill="#FFF" style={{ marginLeft: 4 }} />
                        }
                    </ControlButton>

                    <ControlButton
                        onPress={() => skipNext(session.packageName)}
                        size={scale(60)}
                    >
                        <SkipForward size={scale(26)} color="#FFF" fill="#FFF" />
                    </ControlButton>
                </View>
            </View>
        </View>
    );
};

// Экспортируем мемоизированную версию, чтобы родительские ререндеры (scale/move) не трогали виджет
export const MusicWidget = React.memo(MusicWidgetComponent);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderRadius: RADIUS.xl,
        backgroundColor: '#111',
        overflow: 'hidden', // ВАЖНО: чтобы не лезло на статусбар
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        minHeight: scale(320), // Фиксируем минимальную высоту
    },
    containerEmpty: {
        flex: 1,
        borderRadius: RADIUS.xl,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        minHeight: scale(200),
    },
    content: {
        flex: 1,
        padding: SPACING.lg,
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        marginBottom: SPACING.sm,
    },
    artBox: {
        width: scale(80),
        height: scale(80),
        borderRadius: RADIUS.md,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 5,
        backgroundColor: '#222',
    },
    art: {
        width: '100%',
        height: '100%',
        borderRadius: RADIUS.md,
    },
    artPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#333',
    },
    meta: {
        flex: 1,
        justifyContent: 'center',
    },
    title: {
        fontSize: scale(22),
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 4,
    },
    artist: {
        fontSize: scale(16),
        fontWeight: '500',
        opacity: 0.9,
    },
    progressBox: {
        marginVertical: SPACING.sm,
    },
    trackArea: {
        height: 30, // Увеличил зону нажатия
        justifyContent: 'center',
    },
    trackBase: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    trackFill: {
        height: '100%',
        borderRadius: 2,
    },
    timeRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: -6,
    },
    timeText: {
        fontSize: scale(12),
        color: 'rgba(255,255,255,0.4)',
        fontVariant: ['tabular-nums'],
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: SPACING.lg,
        height: scale(44), // Фиксируем высоту ряда
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xl,
        marginTop: SPACING.xs,
    },
    btnBase: {
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    glassBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    pressableHitSlop: {
        padding: 5,
    },
    emptyText: {
        marginTop: SPACING.sm,
        color: 'rgba(255,255,255,0.3)',
        fontSize: scale(16),
    }
});