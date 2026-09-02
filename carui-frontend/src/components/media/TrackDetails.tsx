import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BASE_COLORS, SPACING, FONT_SIZE, FONT_WEIGHT } from '../../theme/constants';

interface TrackDetailsProps {
    title: string;
    artist: string;
    album?: string;
    accentColor: string;
}

// Убрал memo, чтобы обновлялось всегда
export const TrackDetails = ({ title, artist, album, accentColor }: TrackDetailsProps) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {title || 'Нет данных'}
            </Text>
            <Text
                style={[styles.artist, { color: accentColor }]}
                numberOfLines={1}
                ellipsizeMode="tail"
            >
                {artist || 'Неизвестный исполнитель'}
            </Text>
            {album ? (
                <Text style={styles.album} numberOfLines={1} ellipsizeMode="tail">
                    {album}
                </Text>
            ) : null}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        gap: SPACING.xs,
        paddingHorizontal: SPACING.lg,
    },
    title: {
        fontSize: FONT_SIZE.xxl,
        fontWeight: FONT_WEIGHT.bold,
        color: BASE_COLORS.text.primary,
        textAlign: 'center',
        letterSpacing: -0.5,
    },
    artist: {
        fontSize: FONT_SIZE.lg,
        fontWeight: FONT_WEIGHT.medium,
        textAlign: 'center',
        opacity: 0.9,
    },
    album: {
        fontSize: FONT_SIZE.sm,
        color: BASE_COLORS.text.tertiary,
        textAlign: 'center',
    },
});