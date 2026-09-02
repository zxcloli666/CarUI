import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';
import { Check, Palette } from 'lucide-react-native';
import { useSettingsStore } from '../../app/store';
import { useAccentColor } from '../../hooks/useTheme';
import {
  ACCENT_PRESETS,
  AccentPresetId,
  BASE_COLORS,
  FONT_SIZE,
  ICON_SIZE,
  SPACING,
  RADIUS,
  hueToHex,
  scale,
} from '../../theme/constants';

const presetList = Object.values(ACCENT_PRESETS);

// Rainbow colors для HUE слайдера
const RAINBOW_COLORS = [
  '#FF0000', '#FF4000', '#FF8000', '#FFC000',
  '#FFFF00', '#C0FF00', '#80FF00', '#40FF00',
  '#00FF00', '#00FF40', '#00FF80', '#00FFC0',
  '#00FFFF', '#00C0FF', '#0080FF', '#0040FF',
  '#0000FF', '#4000FF', '#8000FF', '#C000FF',
  '#FF00FF', '#FF00C0', '#FF0080', '#FF0040',
];

export function AccentColorPicker() {
  const accentPreset = useSettingsStore((s) => s.accentPreset);
  const accentHue = useSettingsStore((s) => s.accentHue);
  const setAccentPreset = useSettingsStore((s) => s.setAccentPreset);
  const setAccentHue = useSettingsStore((s) => s.setAccentHue);

  const currentAccent = useAccentColor();
  const isCustom = accentPreset === 'custom';

  // Preview цвет для слайдера
  const previewColor = useMemo(() => hueToHex(accentHue), [accentHue]);

  const handlePresetSelect = useCallback((id: AccentPresetId) => {
    setAccentPreset(id);
  }, [setAccentPreset]);

  const handleCustomSelect = useCallback(() => {
    setAccentPreset('custom');
  }, [setAccentPreset]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Palette size={ICON_SIZE.sm} color={BASE_COLORS.text.secondary} />
          <Text style={styles.title}>АКЦЕНТНЫЙ ЦВЕТ</Text>
        </View>
        <View style={[styles.previewDot, { backgroundColor: currentAccent.primary, shadowColor: currentAccent.primary }]} />
      </View>

      {/* Presets Grid */}
      <View style={styles.presetsGrid}>
        {presetList.map((preset) => {
          const isSelected = accentPreset === preset.id;
          return (
            <TouchableOpacity
              key={preset.id}
              style={[
                styles.presetItem,
                isSelected && styles.presetItemSelected,
                isSelected && { borderColor: preset.primary },
              ]}
              onPress={() => handlePresetSelect(preset.id as AccentPresetId)}
              activeOpacity={0.7}
            >
              <View style={[styles.presetColor, { backgroundColor: preset.primary, shadowColor: preset.primary }]} />
              <Text style={[styles.presetName, isSelected && { color: preset.primary }]} numberOfLines={1}>
                {preset.name}
              </Text>
              {isSelected && (
                <View style={[styles.checkmark, { backgroundColor: preset.primary }]}>
                  <Check size={scale(10)} color="#FFF" strokeWidth={3} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Custom option */}
        <TouchableOpacity
          style={[
            styles.presetItem,
            styles.customItem,
            isCustom && styles.presetItemSelected,
            isCustom && { borderColor: previewColor },
          ]}
          onPress={handleCustomSelect}
          activeOpacity={0.7}
        >
          <View style={styles.customGradient}>
            <View style={[styles.gradientSlice, { backgroundColor: '#FF0000' }]} />
            <View style={[styles.gradientSlice, { backgroundColor: '#FFFF00' }]} />
            <View style={[styles.gradientSlice, { backgroundColor: '#00FF00' }]} />
            <View style={[styles.gradientSlice, { backgroundColor: '#00FFFF' }]} />
            <View style={[styles.gradientSlice, { backgroundColor: '#0000FF' }]} />
            <View style={[styles.gradientSlice, { backgroundColor: '#FF00FF' }]} />
          </View>
          <Text style={[styles.presetName, isCustom && { color: previewColor }]} numberOfLines={1}>
            Свой
          </Text>
          {isCustom && (
            <View style={[styles.checkmark, { backgroundColor: previewColor }]}>
              <Check size={scale(10)} color="#FFF" strokeWidth={3} />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* HUE Slider (показываем только если выбран custom) */}
      {isCustom && (
        <View style={styles.sliderContainer}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>ОТТЕНОК</Text>
            <View style={[styles.sliderPreview, { backgroundColor: previewColor }]} />
          </View>
          <View style={styles.sliderTrackContainer}>
            <View style={styles.rainbowTrack}>
              {RAINBOW_COLORS.map((color, i) => (
                <View key={i} style={[styles.rainbowSegment, { backgroundColor: color }]} />
              ))}
            </View>
            <Slider
              style={styles.slider}
              value={accentHue}
              onValueChange={setAccentHue}
              minimumValue={0}
              maximumValue={360}
              step={1}
              minimumTrackTintColor="transparent"
              maximumTrackTintColor="transparent"
              thumbTintColor="#FFF"
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  title: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: BASE_COLORS.text.secondary,
    letterSpacing: scale(1),
  },
  previewDot: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: scale(8),
    elevation: 8,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  presetItem: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    backgroundColor: BASE_COLORS.glass.background,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
  },
  presetItemSelected: {
    backgroundColor: BASE_COLORS.glass.backgroundHover,
  },
  customItem: {
    overflow: 'hidden',
  },
  presetColor: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    marginBottom: SPACING.sm,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: scale(6),
    elevation: 6,
  },
  presetName: {
    fontSize: FONT_SIZE.sm,
    fontWeight: '600',
    color: BASE_COLORS.text.secondary,
  },
  checkmark: {
    position: 'absolute',
    top: scale(6),
    right: scale(6),
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  customGradient: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  gradientSlice: {
    flex: 1,
    height: '100%',
  },
  sliderContainer: {
    marginTop: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: BASE_COLORS.glass.border,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sliderLabel: {
    fontSize: FONT_SIZE.xs,
    fontWeight: '700',
    color: BASE_COLORS.text.secondary,
    letterSpacing: scale(1),
  },
  sliderPreview: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
  },
  sliderTrackContainer: {
    position: 'relative',
    height: scale(40),
    justifyContent: 'center',
  },
  rainbowTrack: {
    position: 'absolute',
    left: scale(14),
    right: scale(14),
    height: scale(8),
    borderRadius: scale(4),
    flexDirection: 'row',
    overflow: 'hidden',
  },
  rainbowSegment: {
    flex: 1,
    height: '100%',
  },
  slider: {
    width: '100%',
    height: scale(40),
  },
});
