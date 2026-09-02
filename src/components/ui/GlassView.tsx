import React from 'react';
import { StyleSheet, View, ViewStyle, Platform } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface GlassViewProps {
    children?: React.ReactNode;
    style?: ViewStyle | ViewStyle[];
    intensity?: 'light' | 'medium' | 'dark';
}

export const GlassView = ({ children, style, intensity = 'medium' }: GlassViewProps) => {
    // Извлекаем borderRadius из входящих стилей, чтобы применить его к градиенту и обводке
    const flattenedStyle = StyleSheet.flatten(style);
    const borderRadius = flattenedStyle?.borderRadius ?? 0;

    const colors = {
        light: ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)'],
        medium: ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.02)'],
        dark: ['rgba(20,20,25,0.6)', 'rgba(0,0,0,0.8)'],
    };

    return (
        <View style={[styles.container, style]}>
            <LinearGradient
                colors={colors[intensity]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius }]}
            />
            <View style={[styles.borderOverlay, { borderRadius }]} />
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        ...Platform.select({
            android: { elevation: 1 },
            ios: { shadowOpacity: 0 },
        }),
    },
    borderOverlay: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    }
});