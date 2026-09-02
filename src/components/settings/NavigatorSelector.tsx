import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MapPinned, Navigation2, Navigation } from 'lucide-react-native';
import { VisionTheme } from './VisionTheme';
import { InstalledApp } from '../../types';
import { NAVIGATOR_APPS } from '../../app/store';
import { FONT_SIZE, SPACING, ICON_SIZE, scale } from '../../theme/constants';

interface Props {
    apps: InstalledApp[];
    selectedPackage: string | null | undefined;
    onSelect: (pkg: string) => void;
    yandexInstalled: boolean;
    dgisInstalled: boolean;
}

export function NavigatorSelector({ apps, selectedPackage, onSelect, yandexInstalled, dgisInstalled }: Props) {
    const renderBrandFallback = (type: 'dgis' | 'yandex') => (
        <View style={[styles.brandIcon, { backgroundColor: type === 'dgis' ? VisionTheme.colors.dgis : VisionTheme.colors.yandex }]}>
            {type === 'dgis' ? (
                <MapPinned size={ICON_SIZE.md} color="#FFF" />
            ) : (
                <Navigation2 size={ICON_SIZE.md} color="#FFF" />
            )}
        </View>
    );

    const renderItem = (pkg: string, name: string, type: 'dgis' | 'yandex' | 'custom', iconUri?: string) => {
        // Определяем, выбран ли этот пак
        const isSelected = selectedPackage === pkg;

        // Определяем, установлен ли
        const isInstalled = type === 'custom' ? true : (type === 'dgis' ? dgisInstalled : yandexInstalled);

        return (
            <TouchableOpacity
                key={pkg}
                style={[
                    styles.item,
                    isSelected && styles.itemSelected,
                    !isInstalled && styles.itemDisabled
                ]}
                onPress={() => isInstalled && onSelect(pkg)}
                activeOpacity={0.7}
            >
                <View style={[styles.iconBox, isSelected && styles.iconBoxSelected]}>
                    {iconUri ? (
                        <Image source={{ uri: iconUri }} style={styles.appIcon} />
                    ) : type === 'dgis' || type === 'yandex' ? (
                        renderBrandFallback(type)
                    ) : (
                        <View style={[styles.brandIcon, { backgroundColor: '#333' }]}>
                            <Navigation size={ICON_SIZE.md} color="#FFF" />
                        </View>
                    )}

                    {isSelected && <View style={styles.glow} />}
                </View>

                <Text style={[styles.label, isSelected && styles.labelSelected]} numberOfLines={1}>
                    {name}
                </Text>

                {!isInstalled && <Text style={styles.missing}>НЕТ</Text>}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {renderItem(NAVIGATOR_APPS.dgis.packageName, '2GIS', 'dgis', apps.find(a => a.packageName === NAVIGATOR_APPS.dgis.packageName)?.icon)}
            {renderItem(NAVIGATOR_APPS.yandex.packageName, 'Яндекс', 'yandex', apps.find(a => a.packageName === NAVIGATOR_APPS.yandex.packageName)?.icon)}

            {apps
                .filter(a => a.packageName !== NAVIGATOR_APPS.dgis.packageName && a.packageName !== NAVIGATOR_APPS.yandex.packageName)
                .map(a => renderItem(a.packageName, a.appName, 'custom', a.icon))
            }
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SPACING.lg,
        padding: SPACING.lg,
    },
    item: {
        alignItems: 'center',
        width: scale(70),
    },
    itemSelected: {},
    itemDisabled: { opacity: 0.3 },
    iconBox: {
        width: scale(64),
        height: scale(64),
        borderRadius: scale(20),
        backgroundColor: '#1C1C1E',
        borderWidth: 1,
        borderColor: VisionTheme.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: SPACING.sm,
        position: 'relative',
        overflow: 'hidden',
    },
    iconBoxSelected: {
        borderColor: VisionTheme.colors.accent,
        borderWidth: 2,
    },
    brandIcon: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    appIcon: {
        width: '100%',
        height: '100%',
    },
    glow: {
        ...StyleSheet.absoluteFill,
        backgroundColor: VisionTheme.colors.accent,
        opacity: 0.1,
    },
    label: {
        fontSize: FONT_SIZE.sm,
        color: VisionTheme.colors.textSecondary,
        fontWeight: '500',
    },
    labelSelected: {
        color: VisionTheme.colors.accent,
        fontWeight: '700',
    },
    missing: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: VisionTheme.colors.danger,
        fontSize: FONT_SIZE.xs,
        fontWeight: 'bold',
        color: '#FFF',
        paddingHorizontal: SPACING.xs,
        borderRadius: scale(4),
    }
});
