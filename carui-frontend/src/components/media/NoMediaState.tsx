import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Disc3, Music } from 'lucide-react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing
} from 'react-native-reanimated';
import { BASE_COLORS, SPACING, FONT_SIZE } from '../../theme/constants';

interface NoMediaStateProps {
    accentColor: string;
}

export const NoMediaState = ({ accentColor }: NoMediaStateProps) => {
    const rotation = useSharedValue(0);

    useEffect(() => {
        rotation.value = withRepeat(
            withTiming(360, { duration: 8000, easing: Easing.linear }),
            -1,
            false
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${rotation.value}deg` }]
    }));

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.iconContainer, animatedStyle]}>
                <Disc3 size={100} color={BASE_COLORS.text.tertiary} strokeWidth={1} />
            </Animated.View>
            <View style={styles.textContainer}>
                {/* Красим нотку */}
                <Music size={24} color={accentColor} style={styles.noteIcon} />
                <Text style={styles.title}>Медиа не выбрано</Text>
                <Text style={styles.subtitle}>
                    Запустите музыку через приложение снизу
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.xl,
    },
    iconContainer: {
        opacity: 0.5,
    },
    textContainer: {
        alignItems: 'center',
        gap: SPACING.xs,
    },
    noteIcon: {
        marginBottom: SPACING.xs,
    },
    title: {
        fontSize: FONT_SIZE.xl,
        color: BASE_COLORS.text.primary,
        fontWeight: '600',
    },
    subtitle: {
        fontSize: FONT_SIZE.md,
        color: BASE_COLORS.text.tertiary,
        textAlign: 'center',
        maxWidth: 250,
    },
});