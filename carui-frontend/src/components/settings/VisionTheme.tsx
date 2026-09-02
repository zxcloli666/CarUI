import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { BASE_COLORS, RADIUS, SPACING, ACCENT_PRESETS, DEFAULT_ACCENT, FONT_SIZE, TOUCH_TARGET, scale } from '../../theme/constants';

// Статичный объект темы для использования в StyleSheet
// Для динамического accent используйте useAccentColor() хук
export const VisionTheme = {
    colors: {
        background: BASE_COLORS.background.primary,
        glass: BASE_COLORS.glass.background,
        glassPressed: BASE_COLORS.glass.backgroundPressed,
        border: BASE_COLORS.glass.border,
        text: BASE_COLORS.text.primary,
        textSecondary: BASE_COLORS.text.secondary,
        // Default accent - для статичных стилей
        accent: ACCENT_PRESETS[DEFAULT_ACCENT].primary,
        accentGlow: ACCENT_PRESETS[DEFAULT_ACCENT].glow,
        success: BASE_COLORS.semantic.success,
        warning: BASE_COLORS.semantic.warning,
        danger: BASE_COLORS.semantic.danger,
        dgis: BASE_COLORS.brand.dgis,
        yandex: BASE_COLORS.brand.yandex,
    },
    layout: {
        radius: RADIUS.xl,
        spacing: SPACING.lg,
    }
};

// === VISION CARD (GLASSMORPHISM) ===
export const VisionCard = ({ children, style, title }: { children: React.ReactNode, style?: ViewStyle, title?: string }) => (
    <View style={[styles.cardContainer, style]}>
        {title && <Text style={styles.cardTitle}>{title}</Text>}
        <View style={styles.glassPanel}>
            {children}
        </View>
    </View>
);

// === VISION ROW ===
interface VisionRowProps {
    label: string;
    value?: string;
    icon?: React.ReactNode;
    rightElement?: React.ReactNode;
    onPress?: () => void;
    isLast?: boolean;
}

export const VisionRow = ({ label, value, icon, rightElement, onPress, isLast }: VisionRowProps) => {
    const content = (
        <View style={[styles.rowContent, !isLast && styles.rowBorder]}>
            <View style={styles.leftSide}>
                {icon && <View style={styles.iconContainer}>{icon}</View>}
                <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
                    {label}
                </Text>
            </View>

            <View style={styles.rightSide}>
                {value && (
                    <Text style={styles.value} numberOfLines={1} ellipsizeMode="tail">
                        {value}
                    </Text>
                )}
                {rightElement}
                {onPress && <ChevronRight size={20} color={VisionTheme.colors.textSecondary} style={{ marginLeft: 8 }} />}
            </View>
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity activeOpacity={0.6} onPress={onPress} style={styles.touchable}>
                {content}
            </TouchableOpacity>
        );
    }
    return <View style={styles.touchable}>{content}</View>;
};

const styles = StyleSheet.create({
    cardContainer: {
        marginBottom: SPACING.xl,
    },
    cardTitle: {
        fontSize: FONT_SIZE.sm,
        fontWeight: '700',
        color: VisionTheme.colors.textSecondary,
        marginBottom: SPACING.sm,
        marginLeft: SPACING.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    glassPanel: {
        backgroundColor: VisionTheme.colors.glass,
        borderRadius: VisionTheme.layout.radius,
        borderWidth: 1,
        borderColor: VisionTheme.colors.border,
        overflow: 'hidden',
    },
    touchable: {
        minHeight: TOUCH_TARGET.lg,
    },
    rowContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: scale(20),
        paddingVertical: scale(16),
    },
    rowBorder: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    leftSide: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        flexShrink: 1,
        minWidth: 0,
    },
    rightSide: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    iconContainer: {
        width: scale(32),
        height: scale(32),
        alignItems: 'center',
        justifyContent: 'center',
    },
    label: {
        fontSize: FONT_SIZE.xl,
        fontWeight: '500',
        color: VisionTheme.colors.text,
        flexShrink: 1,
        minWidth: 0,
    },
    value: {
        fontSize: FONT_SIZE.xl,
        color: VisionTheme.colors.textSecondary,
        flexShrink: 1,
        minWidth: 0,
    },
});
