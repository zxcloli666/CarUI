import { requireNativeComponent, ViewProps, UIManager, findNodeHandle } from 'react-native';
import React, { Component } from 'react';

interface NativeMiniMapProps extends ViewProps {
    accessToken: string;
    camera: {
        center: [number, number];
        zoom: number;
        pitch: number;
        heading: number;
    };
    eventsJson: string;
}

const ComponentName = 'MiniMapView';

const NativeComponent = requireNativeComponent<NativeMiniMapProps>(ComponentName);

export class NativeMiniMap extends Component<NativeMiniMapProps> {
    private _ref: any;

    setNativeProps = (props: any) => {
        this._ref && this._ref.setNativeProps(props);
    }

    // Быстрый метод для обновления позиции без ре-рендера через пропсы
    updateUserLocation = (lat: number, lon: number, bearing: number) => {
        if (!this._ref) return;
        const handle = findNodeHandle(this._ref);
        if (handle) {
            UIManager.dispatchViewManagerCommand(
                handle,
                'updateLocation',
                [lat, lon, bearing]
            );
        }
    }

    // duration - время анимации в мс (обычно чуть больше интервала обновления координат, например 500-1000мс)
    moveCamera = (lat: number, lon: number, zoom: number, pitch: number, heading: number, duration: number = 500) => {
        if (!this._ref) return;
        const handle = findNodeHandle(this._ref);
        if (handle) {
            UIManager.dispatchViewManagerCommand(
                handle,
                'moveCamera',
                [lat, lon, zoom, pitch, heading, duration]
            );
        }
    }

    render() {
        return (
            <NativeComponent
                {...this.props}
                ref={r => this._ref = r}
            />
        );
    }
}