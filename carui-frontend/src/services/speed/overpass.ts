import type { Camera, RoadSegment } from "./types";

interface RawRoad {
	osm_id: number;
	tags: Record<string, string>;
	highway_type: string;
	name: string | null;
	polyline: Array<[number, number]>;
}

interface OverpassElement {
	type?: string;
	id?: number;
	lat?: number;
	lon?: number;
	tags?: Record<string, string>;
	geometry?: Array<{ lat?: number; lon?: number }>;
}

interface OverpassResponse {
	elements?: OverpassElement[];
}

const HIGHWAY_REGEX =
	"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|residential|living_street)$";

export class OverpassClient {
	private url: string;
	private radius: number;

	constructor(url: string, radius = 4000) {
		this.url = url;
		this.radius = radius;
	}

	async fetchData(
		lat: number,
		lon: number,
	): Promise<{ segments: RoadSegment[]; cameras: Camera[] }> {
		const query = `[out:json][timeout:20];
(
  way["highway"~"${HIGHWAY_REGEX}"](around:${this.radius}, ${lat}, ${lon});
  node["highway"="speed_camera"](around:${this.radius}, ${lat}, ${lon});
);
out geom tags;`;

		const params = new URLSearchParams({ data: query });
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 25000);
		let resp: OverpassResponse;
		try {
			const res = await fetch(`${this.url}?${params}`, {
				signal: controller.signal,
			});
			if (!res.ok) {
				throw new Error(`Overpass HTTP ${res.status}`);
			}
			resp = (await res.json()) as OverpassResponse;
		} catch (err) {
			throw new Error(
				`Overpass request failed: ${err instanceof Error ? err.message : String(err)}`,
			);
		} finally {
			clearTimeout(timeout);
		}

		const elements: OverpassElement[] =
			resp && Array.isArray(resp.elements) ? resp.elements : [];

		const rawRoads: RawRoad[] = [];
		const cameras: Camera[] = [];

		for (const el of elements) {
			const elType = el?.type;
			if (elType === "way") {
				const id = el.id;
				const geometry = el.geometry;
				if (typeof id !== "number" || !Array.isArray(geometry)) continue;

				const tags: Record<string, string> = {};
				if (el.tags && typeof el.tags === "object") {
					for (const [k, v] of Object.entries(el.tags)) {
						tags[k] = v;
					}
				}

				const polyline: Array<[number, number]> = [];
				for (const p of geometry) {
					if (typeof p?.lat === "number" && typeof p?.lon === "number") {
						polyline.push([p.lat, p.lon]);
					}
				}
				if (polyline.length < 2) continue;

				const highwayType = tags.highway || "unknown";
				rawRoads.push({
					osm_id: id,
					tags,
					highway_type: highwayType,
					name: tags.name ?? null,
					polyline,
				});
			} else if (elType === "node") {
				const id = el.id;
				const lat = el.lat;
				const lon = el.lon;
				if (
					typeof id !== "number" ||
					typeof lat !== "number" ||
					typeof lon !== "number"
				)
					continue;
				let maxspeed: number | null = null;
				if (el.tags?.maxspeed) {
					const parsed = parseInt(el.tags.maxspeed, 10);
					if (!Number.isNaN(parsed)) maxspeed = parsed;
				}
				cameras.push({ osm_id: id, lat, lon, maxspeed });
			}
		}

		const urbanRoadCount = rawRoads.filter(
			(r) =>
				r.highway_type === "residential" || r.highway_type === "living_street",
		).length;
		const hasUrbanContext = urbanRoadCount >= 3;

		const segments: RoadSegment[] = rawRoads.map((raw) => ({
			id: 0,
			osm_id: raw.osm_id,
			maxspeed: this.resolveMaxspeed(
				raw.tags,
				raw.highway_type,
				hasUrbanContext,
			),
			highway_type: raw.highway_type,
			name: raw.name,
			polyline: raw.polyline,
		}));

		return { segments, cameras };
	}

	private resolveMaxspeed(
		tags: Record<string, string>,
		highway: string,
		urbanContext: boolean,
	): number {
		if (tags.junction === "roundabout") {
			if (highway !== "motorway" && highway !== "trunk") return 60;
		}

		if (tags.maxspeed) {
			const speed = parseInt(tags.maxspeed, 10);
			if (!Number.isNaN(speed)) return speed;
			if (tags.maxspeed === "RU:urban") return 60;
			if (tags.maxspeed === "RU:rural") return 90;
			if (tags.maxspeed === "RU:motorway") return 110;
		}

		for (const key of ["zone:maxspeed", "source:maxspeed"]) {
			const val = tags[key];
			if (val === "RU:urban") return 60;
			if (val === "RU:rural") return 90;
		}

		if (highway === "living_street") return 20;

		const urban = this.isUrban(tags) || urbanContext;
		switch (highway) {
			case "motorway":
			case "motorway_link":
				return 110;
			case "trunk":
			case "trunk_link":
				if (urban && this.isUrban(tags)) return 60;
				return 90;
			case "primary":
			case "primary_link":
			case "secondary":
			case "secondary_link":
			case "tertiary":
			case "tertiary_link":
				return urban ? 60 : 90;
			case "residential":
				return 60;
			case "unclassified":
				return urban ? 60 : 90;
			default:
				return 60;
		}
	}

	private isUrban(tags: Record<string, string>): boolean {
		if (tags.lit === "yes") return true;
		if (
			tags.sidewalk === "both" ||
			tags.sidewalk === "left" ||
			tags.sidewalk === "right" ||
			tags.sidewalk === "yes"
		)
			return true;
		if (tags["lanes:psv"] !== undefined) return true;
		if (
			tags.cycleway !== undefined ||
			tags["cycleway:right"] !== undefined ||
			tags["cycleway:left"] !== undefined
		)
			return true;
		if (tags["railway:embedded"] === "yes") return true;
		if (tags.embedded_rails === "yes" || tags.embedded_rails === "tram")
			return true;
		return false;
	}
}
