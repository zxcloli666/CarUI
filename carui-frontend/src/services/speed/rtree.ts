import RBush from "rbush";
import type { Camera, RoadSegment } from "./types";

export interface SegmentIndexItem extends RoadSegment {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

export interface CameraIndexItem extends Camera {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

function segmentBBox(seg: RoadSegment): [number, number, number, number] {
	let minLat = Number.MAX_VALUE;
	let maxLat = -Number.MAX_VALUE;
	let minLon = Number.MAX_VALUE;
	let maxLon = -Number.MAX_VALUE;
	for (const [lat, lon] of seg.polyline) {
		if (lat < minLat) minLat = lat;
		if (lat > maxLat) maxLat = lat;
		if (lon < minLon) minLon = lon;
		if (lon > maxLon) maxLon = lon;
	}
	return [minLon, minLat, maxLon, maxLat];
}

export class SpatialIndex {
	private segments: RBush<SegmentIndexItem>;
	private cameras: RBush<CameraIndexItem>;

	constructor() {
		this.segments = new RBush<SegmentIndexItem>();
		this.cameras = new RBush<CameraIndexItem>();
	}

	clear() {
		this.segments.clear();
		this.cameras.clear();
	}

	insertSegment(segment: RoadSegment) {
		if (segment.polyline.length < 2) return;
		const [minLon, minLat, maxLon, maxLat] = segmentBBox(segment);
		this.segments.insert({
			...segment,
			minX: minLon,
			minY: minLat,
			maxX: maxLon,
			maxY: maxLat,
		});
	}

	insertSegments(segments: RoadSegment[]) {
		const items: SegmentIndexItem[] = [];
		for (const seg of segments) {
			if (seg.polyline.length < 2) continue;
			const [minLon, minLat, maxLon, maxLat] = segmentBBox(seg);
			items.push({
				...seg,
				minX: minLon,
				minY: minLat,
				maxX: maxLon,
				maxY: maxLat,
			});
		}
		this.segments.load(items);
	}

	insertCamera(camera: Camera) {
		this.cameras.insert({
			...camera,
			minX: camera.lon,
			minY: camera.lat,
			maxX: camera.lon,
			maxY: camera.lat,
		});
	}

	insertCameras(cameras: Camera[]) {
		const items: CameraIndexItem[] = cameras.map((c) => ({
			...c,
			minX: c.lon,
			minY: c.lat,
			maxX: c.lon,
			maxY: c.lat,
		}));
		this.cameras.load(items);
	}

	querySegments(lat: number, lon: number, radius: number): RoadSegment[] {
		const items = this.segments.search({
			minX: lon - radius,
			minY: lat - radius,
			maxX: lon + radius,
			maxY: lat + radius,
		});
		return items.map(
			({ minX, minY, maxX, maxY, ...seg }) => seg as RoadSegment,
		);
	}

	queryCameras(lat: number, lon: number, radius: number): Camera[] {
		const items = this.cameras.search({
			minX: lon - radius,
			minY: lat - radius,
			maxX: lon + radius,
			maxY: lat + radius,
		});
		return items.map(({ minX, minY, maxX, maxY, ...cam }) => cam as Camera);
	}

	get segmentsCount(): number {
		return this.segments.all().length;
	}

	get camerasCount(): number {
		return this.cameras.all().length;
	}
}
