import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, PanResponder, Text } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    runOnJS,
} from 'react-native-reanimated';
import { Move, Maximize2 } from 'lucide-react-native';
import { RADIUS, scale } from '../../theme/constants';

type LayoutConfig = { x: number; y: number; width: number; height: number };

type Props = {
    children: React.ReactNode;
    initialLayout: LayoutConfig;
    editable: boolean;
    containerSize: { width: number; height: number };
    onLayoutChange?: (layout: LayoutConfig) => void;
    accentColor?: string;
    minSize?: { width: number; height: number };
};

export const DraggableWidget = React.memo(({
                                               children,
                                               initialLayout,
                                               editable,
                                               containerSize,
                                               onLayoutChange,
                                               accentColor = '#007AFF',
                                               minSize = { width: scale(200), height: scale(150) }
                                           }: Props) => {

    // 1. SHARED VALUES (Работают вне React-цикла)
    const x = useSharedValue(initialLayout.x);
    const y = useSharedValue(initialLayout.y);
    const width = useSharedValue(initialLayout.width);
    const height = useSharedValue(initialLayout.height);

    // Рефы для JS-потока (чтобы не было замыканий)
    const layoutRef = useRef(initialLayout);

    // Синхронизация при первом рендере или смене режима
    useEffect(() => {
        x.value = initialLayout.x;
        y.value = initialLayout.y;
        width.value = initialLayout.width;
        height.value = initialLayout.height;
        layoutRef.current = initialLayout;
    }, [initialLayout]);

    // Функция для сохранения (вызываем только в конце жеста)
    const persistChange = () => {
        const finalLayout = {
            x: x.value,
            y: y.value,
            width: width.value,
            height: height.value
        };
        if (onLayoutChange) {
            onLayoutChange(finalLayout);
        }
    };

    // 2. MOVE RESPONDER (Создаем один раз через useRef)
    const moveResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                // Фиксируем точку старта
                layoutRef.current = { x: x.value, y: y.value, width: width.value, height: height.value };
            },
            onPanResponderMove: (_, gesture) => {
                const nextX = layoutRef.current.x + gesture.dx;
                const nextY = layoutRef.current.y + gesture.dy;

                // Быстрое обновление без участия React State
                x.value = Math.max(0, Math.min(nextX, containerSize.width - width.value));
                y.value = Math.max(0, Math.min(nextY, containerSize.height - height.value));
            },
            onPanResponderRelease: () => {
                runOnJS(persistChange)();
            }
        })
    ).current;

    // 3. RESIZE RESPONDER
    const resizeResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                layoutRef.current = { x: x.value, y: y.value, width: width.value, height: height.value };
            },
            onPanResponderMove: (_, gesture) => {
                const nextW = layoutRef.current.width + gesture.dx;
                const nextH = layoutRef.current.height + gesture.dy;

                width.value = Math.max(minSize.width, Math.min(nextW, containerSize.width - x.value));
                height.value = Math.max(minSize.height, Math.min(nextH, containerSize.height - y.value));
            },
            onPanResponderRelease: () => {
                runOnJS(persistChange)();
            }
        })
    ).current;

    // Анимированные стили (Нативный поток)
    const containerStyle = useAnimatedStyle(() => ({
        position: 'absolute',
        left: 0,
        top: 0,
        width: width.value,
        height: height.value,
        transform: [{ translateX: x.value }, { translateY: y.value }],
        zIndex: editable ? 1000 : 1,
        elevation: editable ? 10 : 0,
        opacity: editable ? 0.9 : 1,
    }));

    return (
        <Animated.View
            style={[containerStyle, editable && styles.editableShadow]}
            renderToHardwareTextureAndroid={editable}
        >
            {/* Контент */}
            <View
                style={styles.full}
                pointerEvents={editable ? "none" : "auto"}
                collapsable={!editable}
            >
                {children}
            </View>

            {/* Индикаторы и тач-слои (только если editable) */}
            {editable && (
                <>
                    <View
                        style={[styles.overlay, { borderColor: accentColor }]}
                        {...moveResponder.panHandlers}
                    >
                        <View style={[styles.dragBadge, { backgroundColor: accentColor }]}>
                            <Move size={16} color="white" />
                            <Text style={styles.dragText}>DRAG</Text>
                        </View>
                    </View>

                    <View
                        style={styles.resizeHandle}
                        {...resizeResponder.panHandlers}
                    >
                        <View style={[styles.resizeIcon, { backgroundColor: accentColor }]}>
                            <Maximize2 size={16} color="white" />
                        </View>
                    </View>
                </>
            )}
        </Animated.View>
    );
});

const styles = StyleSheet.create({
    full: { flex: 1, borderRadius: RADIUS.xl, overflow: 'hidden' },
    editableShadow: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderRadius: RADIUS.xl,
        backgroundColor: 'rgba(0,0,0,0.4)',
        zIndex: 10,
    },
    dragBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    dragText: { color: 'white', fontSize: 10, fontWeight: '900' },
    resizeHandle: {
        position: 'absolute',
        right: -10,
        bottom: -10,
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 20,
    },
    resizeIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    }
});