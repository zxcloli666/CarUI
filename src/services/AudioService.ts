import Sound from 'react-native-sound';
import Speech from '@mhpdev/react-native-speech';
import { abandonDuckFocus, requestDuckFocus } from './native/AudioFocusModule';

// Включаем воспроизведение в беззвучном режиме (важно для iOS, но полезно и для Android)
Sound.setCategory('Playback', true);


/**
 * Настройки для воспроизведения аудио
 */
export interface AudioSettings {
  enabled: boolean;
  volume: number;
  pack: string;
  categoryEnabled: {
    weather: boolean;
    speed: boolean;
    gpio: boolean;
    connection: boolean;
  };
}

/**
 * Категории аудио событий
 */
export type AudioCategory = 'weather' | 'speed' | 'gpio' | 'connection';

/**
 * Информация о голосовом паке
 */
export interface AudioPack {
  id: string;
  name: string;
}

/**
 * Доступные голосовые паки
 */
export const AUDIO_PACKS: AudioPack[] = [
  { id: 'default', name: 'Стандартный (TTS)' },
  { id: 'loli', name: 'Лоля' },
  { id: 'moriarty', name: 'Мориарти' },
  { id: 'putin', name: 'Путин' },
];

/**
 * TTS тексты для озвучки
 */
const TTS_TEXTS: Record<string, string> = {
  // Скорость
  speed_warning: 'Превышение скорости',
  speed_limit_ahead: 'Впереди ограничение',
  speed_limit: 'Ограничение скорости',

  // Числа
  '10': 'десять',
  '20': 'двадцать',
  '30': 'тридцать',
  '40': 'сорок',
  '50': 'пятьдесят',
  '60': 'шестьдесят',
  '70': 'семьдесят',
  '80': 'восемьдесят',
  '90': 'девяносто',
  '100': 'сто',
  '110': 'сто десять',
  '120': 'сто двадцать',
  '130': 'сто тридцать',

  // Двери
  door_open: 'Дверь открыта',
  doors_closed: 'Двери закрыты',
  door_driver: 'Водительская дверь',
  door_passenger: 'Пассажирская дверь',
  door_rear_left: 'Задняя левая дверь',
  door_rear_right: 'Задняя правая дверь',

  // Задний ход
  reverse_on: 'Задний ход',

  // Парктроник
  parking_danger: 'Внимание! Препятствие!',
  cm: 'сантиметров',

  // Соединение
  connected: 'Подключено',
  disconnected: 'Соединение потеряно',
  reconnecting: 'Переподключение',
};

/**
 * Элемент очереди воспроизведения
 */
interface QueueItem {
  segments: string[];
  category: AudioCategory;
  ttsOverrides?: Record<string, string>;
}

/**
 * Сервис для воспроизведения аудио и TTS
 */
class AudioServiceClass {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private currentSettings: AudioSettings | null = null;
  private activeSound: Sound | null = null;

  updateSettings(settings: AudioSettings): void {
    this.currentSettings = settings;
    if (this.activeSound) {
      this.activeSound.setVolume(settings.volume);
    }
    try {
      Speech.configure({ volume: settings.volume });
    } catch (e) {
      console.warn('[AudioService] Failed to update TTS volume', e);
    }
  }

  /**
   * Получить путь к файлу по паку и коду.
   */
  private getAudioResourceName(pack: string, code: string): string {
    return `${pack}_${code}`.toLowerCase();
  }

  private async withDuckFocus<T>(fn: () => Promise<T>): Promise<T> {
    await requestDuckFocus();
    try {
      return await fn();
    } finally {
      await abandonDuckFocus();
    }
  }

  /**
   * Воспроизвести один сегмент.
   * Сначала пробует файл, если не вышло — TTS.
   */
  private async playSegment(
      code: string,
      pack: string,
      volume: number,
      ttsOverride?: string
  ): Promise<void> {
    let playedFile = false;

    if (pack !== 'default') {
      const resourceName = this.getAudioResourceName(pack, code);
      playedFile = await this.playAudioFile(resourceName, volume);
    }

    if (!playedFile) {
      const text = ttsOverride ?? TTS_TEXTS[code];
      if (text) await this.speakTTS(text, volume);
    }
  }

  /**
   * Проиграть файл через react-native-sound
   */
  private playAudioFile(resourceName: string, volume: number): Promise<boolean> {
    return new Promise((resolve) => {
      // Очистка предыдущего звука
      if (this.activeSound) {
        try {
          this.activeSound.stop();
          this.activeSound.release();
        } finally {
          this.activeSound = null;
        }
      }

      console.log(`[Audio] Loading res/raw: ${resourceName}`);

      const sound = new Sound(resourceName, Sound.MAIN_BUNDLE, (error) => {
        if (error) {
          console.log('[Audio] Failed to load:', error);
          resolve(false);
          return;
        }

        // Привязка к инстансу класса
        this.activeSound = sound;
        sound.setVolume(volume);

        // sound.setSpeakerphoneOn(true); // Если нужно

        console.log(`[Audio] Playing duration: ${sound.getDuration()}`);

        sound.play((success) => {
          // Освобождаем только если это все еще текущий звук
          if (this.activeSound === sound) {
            sound.release();
            this.activeSound = null;
          }
          resolve(success);
        });
      });
    });
  }

  /**
   * Озвучить текст через TTS.
   */
  private async speakTTS(text: string, volume: number): Promise<void> {
    console.log(`[TTS] Speaking: ${text}`);

    try {
      await Speech.speakWithOptions(text, {
        language: 'ru',
        rate: 1.0,
        volume,
        ducking: true,
      });
    } catch (e) {
      console.error('[TTS] Error', e);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    const settings = this.currentSettings;
    if (!settings?.enabled) {
      this.queue = [];
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0) {
        const item = this.queue.shift();
        if (!item) break;

        if (settings.categoryEnabled[item.category]) {
          await this.withDuckFocus(async () => {
            for (const segment of item.segments) {
              if (!this.currentSettings?.enabled) break;

              // Безопасное воспроизведение с таймаутом (минута для интро и долгих монологов)
              await Promise.race([
                this.playSegment(segment, settings.pack, settings.volume, item.ttsOverrides?.[segment]),
                new Promise((_, reject) => setTimeout(() => reject('Timeout'), 30_000))
              ]).catch(e => console.warn(`[AudioService] Segment ${segment} failed or timed out`, e));
            }
          });
        }
      }
    } catch (error) {
      console.error('[AudioService] Critical queue error:', error);
    } finally {
      // ВАЖНО: всегда сбрасываем флаг, чтобы следующие события могли озвучиваться
      this.isProcessing = false;
      // Если в очереди что-то появилось пока мы вылетали по ошибке - запускаем снова
      if (this.queue.length > 0) this.processQueue();
    }
  }

  async play(
      segments: string | string[],
      category: AudioCategory,
      ttsOverrides?: Record<string, string>
  ): Promise<void> {
    const segmentArray = Array.isArray(segments) ? segments : [segments];

    // Анти-спам (ограничиваем очередь)
    if (this.queue.length > 5) {
      this.queue = this.queue.slice(-5);
    }

    this.queue.push({
      segments: segmentArray,
      category,
      ttsOverrides,
    });

    await this.processQueue();
  }

  /**
   * Метод для немедленного прерывания и проигрывания (например, при парковке)
   */
  async interruptAndPlay(segments: string[], category: AudioCategory, ttsOverrides?: Record<string, string>) {
    await this.stopCurrent();
    return this.play(segments, category, ttsOverrides);
  }

  /**
   * Воспроизвести интро пака (для превью в настройках)
   */
  async playIntro(packId: string, volume: number): Promise<void> {
    await this.stopCurrent();
    await this.withDuckFocus(async () => {
      const resourceName = this.getAudioResourceName(packId, 'intro');
      const success = await this.playAudioFile(resourceName, volume);

      if (!success) {
        const pack = AUDIO_PACKS.find((p) => p.id === packId);
        if (pack) {
          await this.speakTTS(`Пак озвучки ${pack.name}`, volume);
        }
      }
    });
  }

  async stopCurrent(): Promise<void> {
    this.queue = [];
    try { await Speech.stop(); } catch {}

    if (this.activeSound) {
      try {
        this.activeSound.stop();
        this.activeSound.release();
      } finally {
        this.activeSound = null;
      }
    }
    try { await abandonDuckFocus(); } catch {}
  }

  // ============ Хелперы ============

  async playSpeedWarning(): Promise<void> { await this.play('speed_warning', 'speed'); }

  async playSpeedLimit(limit: number): Promise<void> {
    const roundedLimit = String(Math.round(limit / 10) * 10);
    await this.play(['speed_limit', roundedLimit], 'speed');
  }

  async playSpeedLimitAhead(limit: number): Promise<void> {
    const roundedLimit = String(Math.round(limit / 10) * 10);
    await this.play(['speed_limit_ahead', roundedLimit], 'speed');
  }

  async playDoorOpen(doorKey: string): Promise<void> { await this.play([doorKey, 'door_open'], 'gpio'); }
  async playDoorsClosed(): Promise<void> { await this.play('doors_closed', 'gpio'); }
  async playReverseOn(): Promise<void> { await this.play('reverse_on', 'gpio'); }
  async playParkingDanger(): Promise<void> { await this.play('parking_danger', 'gpio'); }
  async playConnected(): Promise<void> { await this.play('connected', 'connection'); }
  async playDisconnected(): Promise<void> { await this.play('disconnected', 'connection'); }
  async playReconnecting(): Promise<void> { await this.play('reconnecting', 'connection'); }

  async playWeather(warningKey: string, warningText?: string): Promise<void> {
    const overrides = warningText ? { [warningKey]: warningText } : undefined;
    await this.play(warningKey, 'weather', overrides);
  }
}

let instance: AudioServiceClass | null = null;
export function getAudioService(): AudioServiceClass {
  if (!instance) {
    instance = new AudioServiceClass();
  }
  return instance;
}

export const audioService = getAudioService();
