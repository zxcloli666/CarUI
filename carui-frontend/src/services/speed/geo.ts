const EARTH_RADIUS_M = 6371000.0;
const EARTH_RADIUS_KM = 6371.0;

export function haversineM(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const dlat = ((lat2 - lat1) * Math.PI) / 180;
	const dlon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dlat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dlon / 2) ** 2;
	return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function haversineKm(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	return haversineM(lat1, lon1, lat2, lon2) / 1000;
}

export function bearing(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const lat1r = (lat1 * Math.PI) / 180;
	const lat2r = (lat2 * Math.PI) / 180;
	const dlon = ((lon2 - lon1) * Math.PI) / 180;
	const x = Math.sin(dlon) * Math.cos(lat2r);
	const y =
		Math.cos(lat1r) * Math.sin(lat2r) -
		Math.sin(lat1r) * Math.cos(lat2r) * Math.cos(dlon);
	return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

export function destinationPoint(
	lat: number,
	lon: number,
	bearingDeg: number,
	distKm: number,
): [number, number] {
	const d = distKm / EARTH_RADIUS_KM;
	const brng = (bearingDeg * Math.PI) / 180;
	const lat1 = (lat * Math.PI) / 180;
	const lon1 = (lon * Math.PI) / 180;
	const lat2 = Math.asin(
		Math.sin(lat1) * Math.cos(d) +
			Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
	);
	const lon2 =
		lon1 +
		Math.atan2(
			Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
			Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
		);
	return [(lat2 * 180) / Math.PI, (lon2 * 180) / Math.PI];
}

export function angleDiff(a: number, b: number): number {
	const d = Math.abs(a - b);
	return d > 180 ? 360 - d : d;
}

export function pointToSegmentDistance(
	lat: number,
	lon: number,
	segLat1: number,
	segLon1: number,
	segLat2: number,
	segLon2: number,
): number {
	const ax = lat - segLat1;
	const ay = lon - segLon1;
	const cx = segLat2 - segLat1;
	const cy = segLon2 - segLon1;
	const dot = ax * cx + ay * cy;
	const lenSq = cx * cx + cy * cy;
	const t = lenSq !== 0 ? Math.min(1, Math.max(0, dot / lenSq)) : 0;
	const projLat = segLat1 + t * cx;
	const projLon = segLon1 + t * cy;
	return haversineM(lat, lon, projLat, projLon);
}

export function pointToPolylineDistance(
	lat: number,
	lon: number,
	polyline: Array<[number, number]>,
): number {
	let min = Number.MAX_VALUE;
	for (let i = 0; i < polyline.length - 1; i++) {
		const d = pointToSegmentDistance(
			lat,
			lon,
			polyline[i][0],
			polyline[i][1],
			polyline[i + 1][0],
			polyline[i + 1][1],
		);
		if (d < min) min = d;
	}
	return min;
}

export function polylineAzimuth(polyline: Array<[number, number]>): number {
	if (polyline.length < 2) return 0;
	const first = polyline[0];
	const last = polyline[polyline.length - 1];
	return bearing(first[0], first[1], last[0], last[1]);
}

export function latLonToTile(
	lat: number,
	lon: number,
	level: number,
): [number, number] {
	const size = 180 / (1 << level);
	const x = Math.floor((lon + 180) / size);
	const y = Math.floor((lat + 90) / size);
	return [x, y];
}

export function tileSizeDeg(level: number): number {
	return 180 / (1 << level);
}
