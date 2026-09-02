import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BASE_COLORS, RADIUS, FONT_SIZE, scale } from '../../theme/constants';
import { useCarStore } from '../../app/store';

const SAFE_COLOR = 'rgba(255,255,255,0.3)';
const WARNING_COLOR = '#FFD500';
const DANGER_COLOR = '#FF3B30';

function getZoneStyle(distance: number) {
    if (distance >= 250) return { color: SAFE_COLOR, labelColor: SAFE_COLOR, active: false };
    if (distance < 40) return { color: DANGER_COLOR, labelColor: '#FFF', active: true };
    if (distance < 120) return { color: WARNING_COLOR, labelColor: '#FFF', active: true };
    return { color: BASE_COLORS.semantic.success, labelColor: '#FFF', active: true };
}

const RadarZone = ({ distance, label, style }: { distance: number, label: string, style: any }) => {
    const { color, labelColor, active } = getZoneStyle(distance);
    // Show value mostly always
    const displayValue = distance >= 999 ? '---' : (distance < 100 ? `${distance}` : `${(distance/100).toFixed(1)}`);

    return (
        <View style={[styles.zoneContainer, style, { borderColor: color, backgroundColor: active ? color + '15' : 'transparent' }]}>
            <Text style={[styles.zoneLabel, { color: labelColor }]}>{label}</Text>
            <Text style={[styles.zoneValue, { color: active ? color : labelColor }]}>{displayValue}</Text>
        </View>
    );
};

export const ParkingWidget = React.memo(() => {
    const sensors = useCarStore((s) => s.parkingSensors);

    const data = useMemo(() => {
        let d = { front: 999, rear: 999, left: 999, right: 999 };
        if (sensors.length) {
            const getMin = (prefix: string) => {
                const filtered = sensors.filter(s => s.position.startsWith(prefix));
                return filtered.length ? Math.min(...filtered.map(s => s.distance_cm)) : 999;
            };
            d.front = getMin('front');
            d.rear = getMin('rear');
            d.left = getMin('left');
            d.right = getMin('right');
        }
        return d;
    }, [sensors]);

    return (
        <View style={styles.container}>
            {/* NO CAR. JUST ZONES. */}
            <RadarZone distance={data.front} label="FRONT" style={styles.posFront} />
            <RadarZone distance={data.rear} label="REAR" style={styles.posRear} />
            <RadarZone distance={data.left} label="L" style={styles.posLeft} />
            <RadarZone distance={data.right} label="R" style={styles.posRight} />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(15, 15, 20, 0.8)',
        borderRadius: RADIUS.xl,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        position: 'relative',
        minHeight: scale(150),
    },
    zoneContainer: { position: 'absolute', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: RADIUS.md, padding: 6, minWidth: scale(64) },
    zoneLabel: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
    zoneValue: { fontSize: FONT_SIZE.h3, fontWeight: 'bold' },

    posFront: { top: scale(16), left: '50%', transform: [{ translateX: -scale(32) }] },
    posRear: { bottom: scale(16), left: '50%', transform: [{ translateX: -scale(32) }] },
    posLeft: { left: scale(16), top: '50%', transform: [{ translateY: -scale(20) }] },
    posRight: { right: scale(16), top: '50%', transform: [{ translateY: -scale(20) }] },
});