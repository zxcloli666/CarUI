import React, { memo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Play, Trash2 } from 'lucide-react-native';
import { RecordingItem } from '../../app/store/camerasStore';
import { formatTimestampParts } from './helpers';
import {
  BASE_COLORS,
  SPACING,
  RADIUS,
  FONT_SIZE,
  FONT_WEIGHT,
  TOUCH_TARGET,
  scale,
} from '../../theme/constants';

interface RecordingRowProps {
  item: RecordingItem;
  isLast: boolean;
  onPress: () => void;
  onDelete: () => void;
}

export const RecordingRow = memo(function RecordingRow({
  item,
  isLast,
  onPress,
  onDelete,
}: RecordingRowProps) {
  const { time, date } = formatTimestampParts(item.timestamp);
  const isRaw = item.source === 'raw';

  return (
    <View style={[s.row, !isLast && s.mb]}>
      <TouchableOpacity style={s.playArea} onPress={onPress} activeOpacity={0.55}>
        <View style={s.playIcon}>
          <Play size={scale(12)} color="#fff" fill="#fff" />
        </View>

        <Text style={s.time}>{time}</Text>
        <Text style={s.date}>{date}</Text>

        <View style={[s.badge, isRaw ? s.badgeRaw : s.badgeVideo]}>
          <Text
              style={[s.badgeText, isRaw ? s.badgeTextRaw : s.badgeTextVideo]}
              numberOfLines={1}
              adjustsFontSizeToFit={true}
          >
            {isRaw ? 'RAW' : 'MP4'}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.trashBtn}
        onPress={onDelete}
        activeOpacity={0.55}
        hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
      >
        <Trash2 size={scale(13)} color={BASE_COLORS.semantic.danger} />
      </TouchableOpacity>
    </View>
  );
});

const ROW_H = TOUCH_TARGET.min;

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_H,
    backgroundColor: BASE_COLORS.background.elevated,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: BASE_COLORS.glass.border,
    overflow: 'hidden',
  },
  mb: {
    marginBottom: SPACING.xs,
  },
  playArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: SPACING.sm,
    paddingLeft: SPACING.sm,
  },
  playIcon: {
    width: scale(22),
    height: scale(22),
    borderRadius: scale(11),
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  time: {
    fontSize: FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.semibold,
    color: BASE_COLORS.text.primary,
  },
  date: {
    flex: 1,
    fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.normal,
    color: BASE_COLORS.text.tertiary,
  },
  badge: {
    borderRadius: scale(4),
    paddingHorizontal: scale(5),
    paddingVertical: 1,
    marginRight: SPACING.xs,
  },
  badgeRaw: {
    backgroundColor: BASE_COLORS.semantic.warning + '25',
  },
  badgeVideo: {
    backgroundColor: BASE_COLORS.semantic.success + '20',
  },
  badgeText: {
    fontSize: scale(9),
    fontWeight: FONT_WEIGHT.bold,
    letterSpacing: 0.6,
  },
  badgeTextRaw: {
    color: BASE_COLORS.semantic.warning,
  },
  badgeTextVideo: {
    color: BASE_COLORS.semantic.success,
  },
  trashBtn: {
    width: ROW_H,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: BASE_COLORS.glass.border,
    backgroundColor: BASE_COLORS.semantic.danger + '08',
  },
});
