import { MapMatcher } from "./matcher";
import { SpatialIndex } from "./rtree";
import { TileStore } from "./tileStore";
import type { SpeedInfo } from "./types";

export class SpeedEngine {
	private tileStore: TileStore;
	private index: SpatialIndex;
	private matcher: MapMatcher;
	private indexedTileKeys: string;

	constructor(overpassUrl: string) {
		this.tileStore = new TileStore(overpassUrl);
		this.index = new SpatialIndex();
		this.matcher = new MapMatcher();
		this.indexedTileKeys = "";
	}

	get store(): TileStore {
		return this.tileStore;
	}

	async loadData(lat: number, lon: number): Promise<void> {
		await this.tileStore.ensureTile(lat, lon);
		this.rebuildIfNeeded();
	}

	match(lat: number, lon: number, bearing: number): SpeedInfo {
		return this.matcher.matchPosition(lat, lon, bearing, this.index);
	}

	private rebuildIfNeeded() {
		const tiles = this.tileStore.getAll();
		const keys = tiles
			.map((t) => t.key)
			.sort()
			.join("|");

		if (keys === this.indexedTileKeys) return;

		this.index = new SpatialIndex();
		for (const tile of tiles) {
			for (const seg of tile.segments) {
				this.index.insertSegment(seg);
			}
		}
		for (const tile of tiles) {
			for (const cam of tile.cameras) {
				this.index.insertCamera(cam);
			}
		}

		this.indexedTileKeys = keys;
	}
}

export function createSpeedEngine(overpassUrl: string): SpeedEngine {
	return new SpeedEngine(overpassUrl);
}
