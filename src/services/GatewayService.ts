import { GATEWAY_WS_URL } from './config';
import { WsEvent, Position } from '../types';

type EventHandler = (event: WsEvent) => void;
// Добавили 'initial', чтобы отличать холодный старт от разрыва
export type ConnectionStatus = 'initial' | 'connecting' | 'connected' | 'disconnected';
type StatusHandler = (status: ConnectionStatus) => void;

class GatewayService {
  private ws: WebSocket | null = null;
  private eventHandlers: Set<EventHandler> = new Set();
  private statusHandlers: Set<StatusHandler> = new Set();

  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  // Smart Backoff Config
  private retryCount = 0;
  private readonly BASE_DELAY = 3000;
  private readonly MAX_DELAY = 30000; // Максимум 30 сек между попытками

  // Старт со статуса initial
  private currentStatus: ConnectionStatus = 'initial';
  private subscribedTopics: string[] = ['gpio', 'speed', 'cameras', 'radar'];

  constructor() {
    this.connect = this.connect.bind(this);
    this.sendPosition = this.sendPosition.bind(this);
  }

  public connect() {
    // Если сокет жив или открывается — ничего не делаем
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      return;
    }

    // Переходим в connecting.
    // Если это первый запуск, статус сменится с initial -> connecting (без звука в хуке)
    this.updateStatus('connecting');
    console.log(`[Gateway] Connecting to ${GATEWAY_WS_URL} (Attempt ${this.retryCount + 1})`);

    try {
      this.ws = new WebSocket(GATEWAY_WS_URL);
      this.setupHandlers();
    } catch (error) {
      console.error('[Gateway] Init Error:', error);
      this.cleanup();
      this.scheduleReconnect();
    }
  }

  public subscribe(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  public subscribeToStatus(handler: StatusHandler): () => void {
    this.statusHandlers.add(handler);
    handler(this.currentStatus);
    return () => this.statusHandlers.delete(handler);
  }

  public sendPosition(position: Position) {
    this.send({
      type: 'position',
      lat: position.lat,
      lon: position.lon,
      bearing: position.bearing,
      speed_kmh: position.speed_kmh,
    });
  }

  public get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // --- Private Implementation ---

  private setupHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('[Gateway] Connected');
      this.retryCount = 0; // Сбрасываем счетчик попыток
      this.updateStatus('connected');

      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      this.send({ subscribe: this.subscribedTopics });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WsEvent;
        this.eventHandlers.forEach((handler) => handler(data));
      } catch (error) { /**/ }
    };

    this.ws.onerror = (error) => {
      console.log('[Gateway] Socket Error');
    };

    this.ws.onclose = (event) => {
      console.log(`[Gateway] Closed: ${event.code}`);
      this.cleanup();
      this.scheduleReconnect();
    };
  }

  private send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (err) { console.error(err); }
    }
  }

  private updateStatus(status: ConnectionStatus) {
    if (this.currentStatus !== status) {
      this.currentStatus = status;
      this.statusHandlers.forEach((handler) => handler(status));
    }
  }

  private cleanup() {
    // Если мы были initial, не переходим в disconnected, чтобы не триггерить звук
    // Но если мы пытались коннектиться и упали — ставим disconnected
    if (this.currentStatus === 'connected' || this.currentStatus === 'connecting') {
      this.updateStatus('disconnected');
    }
    this.ws = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;

    // Экспоненциальная задержка: 3с -> 6с -> 12с -> 24с -> 30с
    const delay = Math.min(this.BASE_DELAY * Math.pow(2, this.retryCount), this.MAX_DELAY);

    console.log(`[Gateway] Reconnecting in ${delay}ms...`);
    this.retryCount++;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay);
  }
}

export const gatewayService = new GatewayService();