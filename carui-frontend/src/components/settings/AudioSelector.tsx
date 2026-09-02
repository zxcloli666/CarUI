import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Play, Square, Mic, Check } from 'lucide-react-native';
import { audioService, AUDIO_PACKS } from '../../services/AudioService';
import { VisionTheme } from './VisionTheme';
import { FONT_SIZE, RADIUS, SPACING, scale } from '../../theme/constants';

interface Props {
    selectedPack: string;
    onSelect: (id: string) => void;
    volume: number;
}

export function AudioSelector({ selectedPack, onSelect, volume }: Props) {
    const [playingId, setPlayingId] = useState<string | null>(null);

    const togglePlay = async (packId: string) => {
        if (playingId === packId) {
            await audioService.stopCurrent();
            setPlayingId(null);
        } else {
            setPlayingId(packId);
            try {
                await audioService.playIntro(packId, volume);
            } catch (e) {
                console.error(e);
            } finally {
                setPlayingId((curr) => (curr === packId ? null : curr));
            }
        }
    };

    // Градиентные подложки для красоты, если нет картинки
    const getGradientColor = (id: string) => {
        switch(id) {
            case 'loli': return '#ff00cc';
            case 'putin': return '#0055ff';
            case 'moriarty': return '#6600ff';
            default: return '#444';
        }
    };

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scrollContainer}
            style={{ marginHorizontal: -SPACING.lg }} // Компенсация паддинга родителя
        >
            {AUDIO_PACKS.map((pack) => {
                const isSelected = selectedPack === pack.id;
                const isPlaying = playingId === pack.id;

                return (
                    <TouchableOpacity
                        key={pack.id}
                        style={[
                            styles.card,
                            isSelected && styles.cardSelected,
                            { borderColor: isSelected ? VisionTheme.colors.accent : VisionTheme.colors.border }
                        ]}
                        onPress={() => onSelect(pack.id)}
                        activeOpacity={0.9}
                    >
                        {/* BACKGROUND / IMAGE */}
                        <View style={[styles.bgContainer, { backgroundColor: getGradientColor(pack.id) + '20' }]}>
                            {/* Пробуем загрузить картинку, если нет - показываем букву */}
                            <Image
                                source={{ uri: `asset:///audio/${pack.id}/avatar.jpg` }}
                                style={styles.bgImage}
                                resizeMode="cover"
                                onError={(e) => {
                                    // Скрываем элемент через opacity при ошибке, чтобы было видно цвет фона
                                    e.currentTarget.setNativeProps({ style: { opacity: 0 } });
                                }}
                            />
                            {/* Fallback Icon */}
                            <View style={styles.fallbackIcon}>
                                {pack.id === 'default' ? (
                                    <Mic size={scale(32)} color="rgba(255,255,255,0.8)" />
                                ) : (
                                    <Text style={styles.fallbackText}>{pack.name[0]}</Text>
                                )}
                            </View>
                        </View>

                        {/* OVERLAY CONTENT */}
                        <View style={styles.overlay}>
                            <View style={styles.info}>
                                <Text style={styles.name}>{pack.name}</Text>
                                {isSelected && (
                                    <View style={styles.selectedBadge}>
                                        <Check size={scale(12)} color="#000" strokeWidth={3} />
                                        <Text style={styles.selectedText}>ACTIVE</Text>
                                    </View>
                                )}
                            </View>

                            <TouchableOpacity
                                style={styles.playBtn}
                                onPress={() => togglePlay(pack.id)}
                            >
                                {isPlaying ? (
                                    <Square size={scale(16)} color="#FFF" fill="#FFF" />
                                ) : (
                                    <Play size={scale(16)} color="#FFF" fill="#FFF" />
                                )}
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                );
            })}
            <View style={{ width: SPACING.md }} />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    scrollContainer: {
        paddingHorizontal: SPACING.lg,
        paddingBottom: SPACING.lg,
        gap: SPACING.md,
    },
    card: {
        width: scale(140),
        height: scale(180),
        borderRadius: scale(20),
        borderWidth: 1,
        overflow: 'hidden',
        backgroundColor: '#111',
    },
    cardSelected: {
        borderWidth: 2,
        shadowColor: VisionTheme.colors.accent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: scale(10),
        elevation: 5,
    },
    bgContainer: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    bgImage: {
        ...StyleSheet.absoluteFill,
        zIndex: 2,
    },
    fallbackIcon: {
        position: 'absolute',
        zIndex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    fallbackText: {
        fontSize: FONT_SIZE.display,
        fontWeight: '900',
        color: 'rgba(255,255,255,0.1)',
    },
    overlay: {
        flex: 1,
        justifyContent: 'space-between',
        padding: SPACING.md,
        zIndex: 3,
        backgroundColor: 'rgba(0,0,0,0.3)', // Затемнение
    },
    info: {
        marginTop: 'auto',
    },
    name: {
        color: '#FFF',
        fontSize: FONT_SIZE.lg,
        fontWeight: '700',
        textShadowColor: 'rgba(0,0,0,0.8)',
        textShadowRadius: 4,
    },
    selectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: VisionTheme.colors.accent,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.xs,
        borderRadius: RADIUS.md,
        alignSelf: 'flex-start',
        marginTop: SPACING.xs,
        gap: SPACING.xs,
    },
    selectedText: {
        color: '#000',
        fontSize: FONT_SIZE.xs,
        fontWeight: '900',
    },
    playBtn: {
        position: 'absolute',
        top: SPACING.md,
        right: SPACING.md,
        width: scale(36),
        height: scale(36),
        borderRadius: scale(18),
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
});
