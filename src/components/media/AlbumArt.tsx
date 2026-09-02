import React, { useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Disc3 } from 'lucide-react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    Easing,
    FadeIn,
} from 'react-native-reanimated';
import { BASE_COLORS, RADIUS } from '../../theme/constants';

interface AlbumArtProps {
    uri?: string;
    isPlaying: boolean;
    accentColor: string; // <-- Динамический цвет
    size?: number;
}

export const AlbumArt = React.memo(({
                                        uri,
                                        isPlaying,
                                        accentColor,
                                        size = 300,
                                    }: AlbumArtProps) => {
    const glowOpacity = useSharedValue(0.3);
    const scale = useSharedValue(1);

    useEffect(() => {
        if (isPlaying) {
            glowOpacity.value = withRepeat(
                withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
                -1,
                true
            );
            scale.value = withTiming(1.02, { duration: 500, easing: Easing.out(Easing.cubic) });
        } else {
            glowOpacity.value = withTiming(0.2, { duration: 500 });
            scale.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
        }
    }, [isPlaying]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    const glowStyle = useAnimatedStyle(() => ({
        opacity: glowOpacity.value,
    }));

    const hasArt = uri && uri.length > 0;

    return (
        <Animated.View style={[styles.container, animatedStyle, { width: size, height: size }]}>
            {/* Dynamic Glow Background */}
            <Animated.View style={[styles.glowContainer, glowStyle]}>
                {hasArt ? (
                    <Image
                        source={{ uri }}
                        style={[styles.glowImage]}
                        blurRadius={40}
                    />
                ) : (
                    // Если нет обложки - светимся цветом темы
                    <View style={[styles.glowPlaceholder, { backgroundColor: accentColor }]} />
                )}
            </Animated.View>

            {/* Main Art Card */}
            <View style={[styles.artCard, { borderColor: BASE_COLORS.glass.border }]}>
                {hasArt ? (
                    <Animated.Image
                        entering={FadeIn.duration(500)}
                        source={{ uri }}
                        style={styles.image}
                        resizeMode="cover"
                    />
                ) : (
                    <View style={styles.placeholder}>
                        <Disc3 size={size * 0.4} color={BASE_COLORS.text.tertiary} strokeWidth={1} />
                        {/* Центр пластинки красим в цвет темы */}
                        <View style={[styles.vinylCenter, { backgroundColor: accentColor }]} />
                    </View>
                )}

                {/* Glossy Overlay */}
                <View style={styles.glossOverlay} />
            </View>
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    glowContainer: {
        position: 'absolute',
        width: '110%',
        height: '110%',
        borderRadius: RADIUS.xl,
        zIndex: -1,
    },
    glowImage: {
        width: '100%',
        height: '100%',
        opacity: 0.6,
    },
    glowPlaceholder: {
        width: '100%',
        height: '100%',
        opacity: 0.3,
        borderRadius: RADIUS.xl,
        blurRadius: 50,
    },
    artCard: {
        width: '100%',
        height: '100%',
        borderRadius: RADIUS.xl,
        overflow: 'hidden',
        backgroundColor: BASE_COLORS.background.elevated,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
        elevation: 10,
    },
    image: {
        width: '100%',
        height: '100%',
    },
    placeholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BASE_COLORS.background.tertiary,
    },
    vinylCenter: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderRadius: 12,
        opacity: 0.9,
        shadowColor: '#000',
        shadowOpacity: 0.5,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
    },
    glossOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '40%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderTopLeftRadius: RADIUS.xl,
        borderTopRightRadius: RADIUS.xl,
    },
});