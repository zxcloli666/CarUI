import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Music2 } from 'lucide-react-native';
import { BASE_COLORS, RADIUS, SPACING, FONT_SIZE } from '../../theme/constants';
import { MusicApp } from '../../types';

interface MusicAppsListProps {
    apps: MusicApp[];
    activePackage?: string;
    onAppPress: (app: MusicApp) => void;
    accentColor: string;
}

export const MusicAppsList = React.memo(({
                                             apps,
                                             activePackage,
                                             onAppPress,
                                             accentColor
                                         }: MusicAppsListProps) => {
    if (!apps || apps.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.header}>Приложения</Text>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {apps.map((app) => {
                    const isActive = app.packageName === activePackage;
                    const hasIcon = app.icon && app.icon.length > 0;

                    return (
                        <TouchableOpacity
                            key={app.packageName}
                            style={[
                                styles.card,
                                isActive && { borderColor: accentColor, backgroundColor: 'rgba(255,255,255,0.08)' }
                            ]}
                            onPress={() => onAppPress(app)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.iconContainer, isActive && { borderColor: accentColor, borderWidth: 1 }]}>
                                {hasIcon ? (
                                    <Image source={{ uri: app.icon }} style={styles.icon} />
                                ) : (
                                    <View style={[styles.placeholderIcon, { backgroundColor: isActive ? accentColor : BASE_COLORS.background.tertiary }]}>
                                        <Music2 size={24} color={isActive ? '#fff' : BASE_COLORS.text.tertiary} />
                                    </View>
                                )}
                            </View>

                            <View style={styles.info}>
                                <Text style={[styles.name, isActive && { color: accentColor, fontWeight: '700' }]} numberOfLines={1}>
                                    {app.appName}
                                </Text>
                                {isActive && (
                                    <Text style={[styles.status, { color: accentColor }]}>Сейчас играет</Text>
                                )}
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        gap: SPACING.sm,
    },
    header: {
        fontSize: FONT_SIZE.xs,
        color: BASE_COLORS.text.tertiary,
        marginLeft: SPACING.xxl,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '600'
    },
    scrollContent: {
        paddingHorizontal: SPACING.xxl,
        gap: SPACING.md,
        paddingBottom: SPACING.lg, // Больше отступ снизу
    },
    card: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: BASE_COLORS.glass.background,
        borderWidth: 1,
        borderColor: BASE_COLORS.glass.border,
        borderRadius: RADIUS.lg,
        padding: SPACING.md, // Увеличил паддинг
        gap: SPACING.md,
        minWidth: 180, // Шире карточка
    },
    iconContainer: {
        width: 48, // Больше иконка
        height: 48,
        borderRadius: RADIUS.md,
        overflow: 'hidden',
    },
    icon: {
        width: '100%',
        height: '100%',
    },
    placeholderIcon: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    info: {
        justifyContent: 'center',
        flex: 1,
    },
    name: {
        fontSize: FONT_SIZE.md,
        color: BASE_COLORS.text.primary,
        fontWeight: '500',
    },
    status: {
        fontSize: FONT_SIZE.xs,
        marginTop: 2,
        opacity: 0.9,
    },
});