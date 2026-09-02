import { create } from 'zustand';
import { API } from '../../services/config';
import { CameraId, WsEvent } from '../../types';

export type ViewMode = 'quad' | 'single' | 'rear';

export type RecordingSource = 'raw' | 'video';

export interface RecordingItem {
  id: string;
  filename: string;
  timestamp: number;
  source: RecordingSource;
}

// ─── Parse helpers ─────────────────────────────────────────────────────

function parseRecordingPath(path: string, source: RecordingSource = 'video'): RecordingItem {
  const filename = path.includes('/') ? path.split('/').pop()! : path;
  const m = filename.match(/(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);

  let timestamp = 0;
  if (m) {
    timestamp = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
  }

  return { id: path, filename, timestamp, source };
}

function normalizeRecordings(data: unknown): RecordingItem[] {
  if (!Array.isArray(data)) return [];

  return data.map((item): RecordingItem => {
    if (typeof item === 'string') return parseRecordingPath(item);

    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>;
      const source = (rec.source === 'raw' ? 'raw' : 'video') as RecordingSource;

      if (typeof rec.id === 'string' && typeof rec.filename === 'string') {
        return parseRecordingPath(rec.id as string, source);
      }

      if (typeof rec.created_at === 'string') {
        const d = new Date(rec.created_at);
        return {
          id: String(rec.id ?? rec.filename ?? ''),
          filename: String(rec.filename ?? ''),
          timestamp: isNaN(d.getTime()) ? 0 : d.getTime(),
          source,
        };
      }
    }

    return { id: String(item), filename: String(item), timestamp: 0, source: 'video' };
  });
}

// ─── Store ─────────────────────────────────────────────────────────────

interface CamerasState {
  viewMode: ViewMode;
  selectedCamera: CameraId;
  isRecording: boolean;
  recordingBusy: boolean;
  recordings: RecordingItem[];
  recordingsLoading: boolean;

  setViewMode: (mode: ViewMode) => void;
  selectCamera: (id: CameraId) => void;
  toggleRecording: () => Promise<void>;
  setRecording: (active: boolean) => void;
  syncRecordingStatus: () => Promise<void>;
  refreshRecordings: () => Promise<void>;
  deleteRecording: (id: string) => Promise<void>;
  handleWsEvent: (event: WsEvent) => void;
}

export const useCamerasStore = create<CamerasState>((set, get) => ({
  viewMode: 'quad',
  selectedCamera: 'rear',
  isRecording: false,
  recordingBusy: false,
  recordings: [],
  recordingsLoading: false,

  setViewMode: (viewMode) => set({ viewMode }),

  selectCamera: (selectedCamera) => set({ selectedCamera, viewMode: 'single' }),

  toggleRecording: async () => {
    if (get().recordingBusy) return;
    const wasRecording = get().isRecording;
    set({ recordingBusy: true });

    try {
      const ep = wasRecording ? 'record/stop' : 'record/start';
      const res = await fetch(`${API.cameras}/${ep}`, { method: 'POST' });
      if (!res.ok) throw new Error();
      set({ isRecording: !wasRecording });
      if (wasRecording) get().refreshRecordings();
    } catch {
      // WS events will sync state
    } finally {
      set({ recordingBusy: false });
    }
  },

  setRecording: (isRecording) => set({ isRecording }),

  syncRecordingStatus: async () => {
    try {
      const res = await fetch(`${API.cameras}/record/status`);
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data?.active === 'boolean') {
        set({ isRecording: data.active });
      }
    } catch {
      // silent
    }
  },

  refreshRecordings: async () => {
    if (get().recordingsLoading) return;
    set({ recordingsLoading: true });

    try {
      const res = await fetch(`${API.cameras}/recordings`);
      if (!res.ok) throw new Error();
      set({ recordings: normalizeRecordings(await res.json()) });
    } catch {
      // keep existing
    } finally {
      set({ recordingsLoading: false });
    }
  },

  deleteRecording: async (id) => {
    try {
      const res = await fetch(`${API.cameras}/recordings/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      set((s) => ({ recordings: s.recordings.filter((r) => r.id !== id) }));
    } catch {
      // silent
    }
  },

  handleWsEvent: (event) => {
    if (event.topic !== 'cameras') return;
    const type = event.type || event.event;

    if (type === 'recording_started') {
      set({ isRecording: true });
    } else if (type === 'recording_stopped') {
      set({ isRecording: false });
      get().refreshRecordings();
    } else if (type === 'recording_status') {
      const active = (event.data as { active?: boolean })?.active;
      if (typeof active === 'boolean') set({ isRecording: active });
    }
  },
}));
