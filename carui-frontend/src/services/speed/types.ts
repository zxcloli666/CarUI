export interface RoadSegment {
	id: number;
	osm_id: number;
	maxspeed: number;
	highway_type: string;
	name: string | null;
	polyline: Array<[number, number]>;
}

export interface Camera {
	osm_id: number;
	lat: number;
	lon: number;
	maxspeed: number | null;
}

export interface SpeedChange {
	distance_m: number;
	current_limit: number;
	new_limit: number;
}

export interface SpeedInfo {
	limit: number;
	gps_source: string;
	next_change: SpeedChange | null;
}

export interface TileData {
	segments: RoadSegment[];
	cameras: Camera[];
}

export const DEFAULT_LIMIT = 60;
