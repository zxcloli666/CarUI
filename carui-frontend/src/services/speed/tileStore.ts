import AsyncStorage from "@react-native-async-storage/async-storage";
import { latLonToTile } from "./geo";
import { OverpassClient } from "./overpass";
import type { Camera, RoadSegment } from "./types";

const ZOOM = 12;
const TTL_DAYS = 7;
const STORAGE_PREFIX = "carui_osm_tile:";

interface CachedTile {
	key: string;
	expiresAt: number;
	segments: RoadSegment[];
	cameras: Camera[];
}

export function tileKeyFor(lat: number, lon: number): string {
	const [x, y] = latLonToTile(lat, lon, ZOOM);
	return `osm_${ZOOM}_${x}_${y}`;
}

export class TileStore {
	private client: OverpassClient;
	private memory: Map<string, CachedTile> = new Map();
	private inflight: Map<string, Promise<void>> = new Map();

	constructor(overpassUrl: string) {
		this.client = new OverpassClient(overpassUrl);
	}

	async ensureTile(lat: number, lon: number): Promise<void> {
		const key = tileKeyFor(lat, lon);

		const mem = this.memory.get(key);
		if (mem && mem.expiresAt > Date.now()) return;

		const cached = await this.loadFromStorage(key);
		if (cached && cached.expiresAt > Date.now()) {
			this.memory.set(key, { ...cached, key });
			return;
		}

		const existing = this.inflight.get(key);
		if (existing) return existing;

		const task = this.fetchAndStore(key, lat, lon);
		this.inflight.set(key, task);
		try {
			await task;
		} finally {
			this.inflight.delete(key);
		}
	}

	private async fetchAndStore(
		key: string,
		lat: number,
		lon: number,
	): Promise<void> {
		const now = Date.now();
		const expiresAt = now + TTL_DAYS * 24 * 60 * 60 * 1000;
		let data: { segments: RoadSegment[]; cameras: Camera[] };
		try {
			data = await this.client.fetchData(lat, lon);
		} catch (err) {
			data = { segments: [], cameras: [] };
			if (__DEV__) console.warn("[Speed] Overpass fetch failed:", err);
		}

		const entry: CachedTile = { key, expiresAt, ...data };
		this.memory.set(key, entry);
		this.saveToStorage(key, entry);
	}

	getAll(): CachedTile[] {
		return Array.from(this.memory.values());
	}

	private async loadFromStorage(key: string): Promise<CachedTile | null> {
		try {
			const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
			if (!raw) return null;
			const parsed = JSON.parse(raw) as CachedTile;
			return parsed && typeof parsed.expiresAt === "number" ? parsed : null;
		} catch (_err) {
			return null;
		}
	}

	private async saveToStorage(key: string, entry: CachedTile) {
		try {
			await AsyncStorage.setItem(
				`${STORAGE_PREFIX}${key}`,
				JSON.stringify(entry),
			);
		} catch (err) {
			if (__DEV__) console.warn("[Speed] Tile storage write failed:", err);
		}
	}
}

export function createTileStore(overpassUrl: string): TileStore {
	return new TileStore(overpassUrl);
}
