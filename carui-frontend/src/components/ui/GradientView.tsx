/**
 * UI Adapter for Linear Gradient
 * Wraps 'react-native-linear-gradient' to decouple app code from the specific library.
 */

import React from 'react';
import { ViewStyle, ViewProps } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface GradientViewProps extends ViewProps {
    colors: string[];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    style?: ViewStyle | ViewStyle[];
    children?: React.ReactNode;
}

export const GradientView = React.memo(({
                                            colors,
                                            start = { x: 0, y: 0 },
                                            end = { x: 0, y: 1 },
                                            style,
                                            children,
                                            ...props
                                        }: GradientViewProps) => {
    return (
        <LinearGradient
            colors={colors}
            start={start}
            end={end}
            style={style}
            {...props}
        >
            {children}
        </LinearGradient>
    );
});