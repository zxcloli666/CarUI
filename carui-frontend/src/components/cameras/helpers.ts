import { NativeModules } from 'react-native';
import { CameraId } from '../../types';

export const CAMERAS: { id: CameraId; name: string }[] = [
  { id: 'front', name: 'Передняя' },
  { id: 'rear', name: 'Задняя' },
  { id: 'left', name: 'Левая' },
  { id: 'right', name: 'Правая' },
];

const MONTHS = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

export function formatTimestamp(ts: number): string {
  if (!ts) return '—';
  const { time, date } = formatTimestampParts(ts);
  return `${time} · ${date}`;
}

export function formatTimestampParts(ts: number): { time: string; date: string } {
  if (!ts) return { time: '—', date: '' };
  const d = new Date(ts);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  if (dayStart === todayStart) return { time, date: 'Сегодня' };
  if (dayStart === todayStart - 86_400_000) return { time, date: 'Вчера' };
  return { time, date: `${d.getDate()} ${MONTHS[d.getMonth()]}` };
}

export function downloadFile(url: string, filename: string) {
  NativeModules.DownloadModule.download(url, filename);
}
