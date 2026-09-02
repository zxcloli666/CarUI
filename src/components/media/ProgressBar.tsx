import React, { useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    runOnJS,
    cancelAnimation,
    Easing
} from 'react-native-reanimated';
import { BASE_COLORS, SPACING, FONT_SIZE } from '../../theme/constants';

interface ProgressBarProps {
    position: number;
    duration: number;
    onSeek: (position: number) => void;
    accentColor: string;
    disabled?: boolean;
}

function formatTime(ms: number): string {
    'worklet';
    const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const ProgressBar = ({
                                position,
                                duration,
                                onSeek,
                                accentColor,
                                disabled = false,
                            }: ProgressBarProps) => {
    const [layoutWidth, setLayoutWidth] = useState(0);

    const progress = useSharedValue(0);
    const isDragging = useSharedValue(false);

    // UI Animations
    const thumbScale = useSharedValue(1);
    const trackHeight = useSharedValue(6);

    // Обновление от пропсов (плеера)
    useEffect(() => {
        if (isDragging.value || duration <= 0) return;

        const target = Math.max(0, Math.min(position / duration, 1));

        // Анимация 800мс чтобы "доехать" до следующей точки поллинга
        progress.value = withTiming(target, {
            duration: 800,
            easing: Easing.linear
        });
    }, [position, duration]);

    // JS колбек
    const handleSeekEnd = useCallback((val: number) => {
        if (disabled || duration <= 0) return;
        onSeek(Math.floor(val * duration));
    }, [duration, onSeek, disabled]);

    // Gestures
    const pan = Gesture.Pan()
        .enabled(!disabled)
        .onBegin((e) => {
            isDragging.value = true;
            cancelAnimation(progress);
            thumbScale.value = withSpring(1.3);
            trackHeight.value = withSpring(12);

            if (layoutWidth > 0) {
                progress.value = Math.max(0, Math.min(e.x / layoutWidth, 1));
            }
        })
        .onUpdate((e) => {
            if (layoutWidth > 0) {
                progress.value = Math.max(0, Math.min(e.x / layoutWidth, 1));
            }
        })
        .onEnd(() => {
            thumbScale.value = withSpring(1);
            trackHeight.value = withSpring(6);
            runOnJS(handleSeekEnd)(progress.value);

            // Небольшая задержка перед возвратом контроля плееру
            setTimeout(() => {
                isDragging.value = false;
            }, 500);
        });

    const tap = Gesture.Tap()
        .enabled(!disabled)
        .onEnd((e) => {
            if (layoutWidth > 0) {
                const p = Math.max(0, Math.min(e.x / layoutWidth, 1));
                progress.value = withTiming(p, { duration: 200 });
                runOnJS(handleSeekEnd)(p);
            }
        });

    const gesture = Gesture.Race(pan, tap);

    const fillStyle = useAnimatedStyle(() => ({
        width: `${progress.value * 100}%`,
        backgroundColor: accentColor,
    }));

    const thumbStyle = useAnimatedStyle(() => ({
        left: `${progress.value * 100}%`,
        transform: [{ translateX: -10 }, { scale: thumbScale.value }],
        backgroundColor: accentColor,
    }));

    const trackStyle = useAnimatedStyle(() => ({
        height: trackHeight.value,
        borderRadius: trackHeight.value / 2,
    }));

    return (
        <View style={styles.container}>
            <GestureDetector gesture={gesture}>
                <View
                    style={styles.touchArea}
                    onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
                >
                    <Animated.View style={[styles.trackBg, trackStyle]}>
                        <Animated.View style={fillStyle} />
                    </Animated.View>

                    {!disabled && (
                        <Animated.View style={[styles.thumb, thumbStyle]}>
                            <View style={styles.thumbDot} />
                        </Animated.View>
                    )}
                </View>
            </GestureDetector>

            <View style={styles.labels}>
                <Text style={styles.timeText}>{formatTime(position)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%', paddingVertical: SPACING.md },
    touchArea: { height: 40, justifyContent: 'center', width: '100%' },
    trackBg: { backgroundColor: 'rgba(255,255,255,0.15)', overflow: 'hidden', width: '100%' },
    thumb: { position: 'absolute', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4, elevation: 4 },
    thumbDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
    labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -8 },
    timeText: { fontSize: FONT_SIZE.xs, color: BASE_COLORS.text.secondary, fontVariant: ['tabular-nums'], fontWeight: '500' },
});