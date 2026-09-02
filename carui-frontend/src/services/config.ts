import { GATEWAY_HOST as ENV_HOST, GATEWAY_PORT as ENV_PORT, MAPBOX_TOKEN as ENV_MAPBOX_TOKEN, OVERPASS_URL as ENV_OVERPASS_URL } from '@env';

// Gateway configuration from .env file
// For Android emulator use: 10.0.2.2
// For physical device use your Pi IP: 192.168.x.x
export const GATEWAY_HOST = ENV_HOST || '10.0.2.2';
export const GATEWAY_PORT = ENV_PORT || '8080';

export const MAPBOX_TOKEN = ENV_MAPBOX_TOKEN;

export const OVERPASS_URL = ENV_OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

export const GATEWAY_URL = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;
export const GATEWAY_WS_URL = `ws://${GATEWAY_HOST}:${GATEWAY_PORT}/ws`;

export const API = {
  gpio: `${GATEWAY_URL}/api/gpio`,
  cameras: `${GATEWAY_URL}/api/cameras`,
};

export const CAMERA_STREAMS = {
  front: `${API.cameras}/stream/front`,
  rear: `${API.cameras}/stream/rear`,
  left: `${API.cameras}/stream/left`,
  right: `${API.cameras}/stream/right`,
};
