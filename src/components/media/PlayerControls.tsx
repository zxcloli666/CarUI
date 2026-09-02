import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import {
    Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, ThumbsDown,
    Plus, Share2, List, Radio, Circle
} from 'lucide-react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring
} from 'react-native-reanimated';
import { BASE_COLORS, SPACING, RADIUS } from '../../theme/constants';
import { MediaAction, PlaybackState } from '../../types';

interface PlayerControlsProps {
    playbackState: PlaybackState;
    actions: MediaAction[];
    onPlay: () => void;
    onPause: () => void;
    onSkipNext: () => void;
    onSkipPrevious: () => void;
    onAction: (actionId: string) => void;
    accentColor: string;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const ControlButton = ({
                           onPress,
                           children,
                           size = 60,
                           primary = false,
                           disabled = false,
                           accentColor
                       }: any) => {
    const scale = useSharedValue(1);

    const handlePressIn = () => { scale.value = withSpring(0.9); };
    const handlePressOut = () => { scale.value = withSpring(1); };

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
        opacity: disabled ? 0.4 : 1
    }));

    return (
        <AnimatedTouchable
            onPress={onPress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            activeOpacity={0.8}
            style={[
                styles.button,
                { width: size, height: size, borderRadius: size / 2 },
                primary && {
                    backgroundColor: accentColor,
                    borderColor: accentColor,
                    shadowColor: accentColor,
                    shadowOpacity: 0.5,
                    shadowRadius: 15,
                    elevation: 8,
                    borderWidth: 0
                },
                animatedStyle
            ]}
        >
            {children}
        </AnimatedTouchable>
    );
};

// Хелпер для иконок
function getIconForAction(action: MediaAction, color: string, size: number) {
    if (action.nativeIcon) {
        return <Image source={{ uri: action.nativeIcon }} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" />;
    }
    const props = { size, color, strokeWidth: 2.5 }; // Чуть жирнее иконки

    switch (action.icon) {
        case 'heart': return <Heart {...props} />;
        case 'thumbs_down': return <ThumbsDown {...props} />;
        case 'shuffle': return <Shuffle {...props} />;
        case 'repeat': return <Repeat {...props} />;
        case 'plus': return <Plus {...props} />;
        case 'share': return <Share2 {...props} />;
        case 'list': return <List {...props} />;
        case 'radio': return <Radio {...props} />;
        default: return <Circle {...props} />;
    }
}

export const PlayerControls = React.memo(({
                                              playbackState,
                                              actions,
                                              onPlay,
                                              onPause,
                                              onSkipNext,
                                              onSkipPrevious,
                                              onAction,
                                              accentColor
                                          }: PlayerControlsProps) => {
    const isPlaying = playbackState === 'playing';
    const hasSkipNext = actions.some(a => a.id === 'skip_next');
    const hasSkipPrev = actions.some(a => a.id === 'skip_previous');

    // Берем первые 4 кастомных действия
    const customActions = actions.filter(a => a.isCustom).slice(0, 4);

    return (
        <View style={styles.container}>
            {/* Ряд доп. действий (Лайки, Шаффл) */}
            {customActions.length > 0 && (
                <View style={styles.secondaryRow}>
                    {customActions.map((action) => (
                        <TouchableOpacity
                            key={action.id}
                            style={styles.secondaryBtn}
                            onPress={() => onAction(action.id)}
                            activeOpacity={0.6}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} // Увеличенная зона нажатия
                        >
                            {getIconForAction(action, BASE_COLORS.text.secondary, 26)}
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Основные кнопки */}
            <View style={styles.mainRow}>
                <ControlButton
                    onPress={onSkipPrevious}
                    disabled={!hasSkipPrev}
                    size={56}
                >
                    <SkipBack size={28} color={BASE_COLORS.text.primary} fill={BASE_COLORS.text.primary} />
                </ControlButton>

                <ControlButton
                    onPress={isPlaying ? onPause : onPlay}
                    primary
                    size={78} // Кнопка Play стала еще больше
                    accentColor={accentColor}
                >
                    {isPlaying ? (
                        <Pause size={38} color="#fff" fill="#fff" />
                    ) : (
                        <Play size={38} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
                    )}
                </ControlButton>

                <ControlButton
                    onPress={onSkipNext}
                    disabled={!hasSkipNext}
                    size={56}
                >
                    <SkipForward size={28} color={BASE_COLORS.text.primary} fill={BASE_COLORS.text.primary} />
                </ControlButton>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        gap: SPACING.lg,
        width: '100%',
        marginTop: SPACING.sm,
    },
    mainRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xl,
    },
    secondaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xxl, // Больше отступ между кнопками
        backgroundColor: 'rgba(255,255,255,0.05)', // Немного видный фон
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.xl,
        borderRadius: RADIUS.full,
        marginBottom: SPACING.sm,
    },
    secondaryBtn: {
        opacity: 0.9,
        padding: SPACING.xs, // Доп паддинг
    },
    button: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BASE_COLORS.glass.background,
        borderWidth: 1,
        borderColor: BASE_COLORS.glass.border,
    },
});