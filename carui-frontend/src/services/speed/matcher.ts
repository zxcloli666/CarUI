import {
	angleDiff,
	destinationPoint,
	bearing as geoBearing,
	haversineM,
	pointToPolylineDistance,
	pointToSegmentDistance,
} from "./geo";
import type { SpatialIndex } from "./rtree";
import {
	DEFAULT_LIMIT,
	type RoadSegment,
	type SpeedChange,
	type SpeedInfo,
} from "./types";

function highwayClass(hwType: string): number {
	switch (hwType) {
		case "motorway":
		case "motorway_link":
			return 6;
		case "trunk":
		case "trunk_link":
			return 5;
		case "primary":
		case "primary_link":
			return 4;
		case "secondary":
		case "secondary_link":
			return 3;
		case "tertiary":
		case "tertiary_link":
			return 2;
		case "residential":
		case "unclassified":
			return 1;
		case "living_street":
			return 0;
		default:
			return 1;
	}
}

function isLinkRoad(hwType: string): boolean {
	return hwType.endsWith("_link");
}

interface MatchContext {
	prev_osm_id: number | null;
	prev_name: string | null;
	prev_speed: number | null;
	prev_class: number | null;
	prev_hw_type: string | null;
}

interface FutureInfo {
	limit: number;
	distance: number;
}

export class MapMatcher {
	private last_osm_id: number | null = null;
	private last_valid_speed: number | null = null;
	private last_name: string | null = null;
	private last_hw_type: string | null = null;

	matchPosition(
		lat: number,
		lon: number,
		bearing: number,
		rtree: SpatialIndex,
	): SpeedInfo {
		const prevClass =
			this.last_hw_type !== null ? highwayClass(this.last_hw_type) : null;
		const ctx: MatchContext = {
			prev_osm_id: this.last_osm_id,
			prev_name: this.last_name,
			prev_speed: this.last_valid_speed,
			prev_class: prevClass,
			prev_hw_type: this.last_hw_type,
		};

		const candidates = rtree.querySegments(lat, lon, 0.0004);
		const bestMatch = findBestSegment(ctx, candidates, lat, lon, bearing);

		if (bestMatch === undefined) {
			return { limit: DEFAULT_LIMIT, gps_source: "", next_change: null };
		}

		const currentSeg = bestMatch[0];
		this.last_osm_id = currentSeg.osm_id;
		this.last_name = currentSeg.name;
		this.last_hw_type = currentSeg.highway_type;

		const currentLimit = resolveSpeed(currentSeg, lat, lon, rtree);
		const future = this.scanFuture(
			currentSeg,
			lat,
			lon,
			bearing,
			currentLimit,
			rtree,
		);

		const prevSpeed =
			this.last_valid_speed !== null ? this.last_valid_speed : currentLimit;
		let finalLimit = currentLimit;

		if (future !== undefined) {
			if (future.distance < 200 && future.limit < finalLimit) {
				finalLimit = future.limit;
			}
		}

		if (currentLimit > prevSpeed) {
			if (future !== undefined) {
				if (future.limit < currentLimit && future.distance < 400) {
					finalLimit = Math.min(prevSpeed, future.limit);
				}
			}
		}

		this.last_valid_speed = finalLimit;

		let nextChange: SpeedChange | null = null;
		if (future !== undefined && future.limit !== finalLimit) {
			nextChange = {
				distance_m: future.distance,
				current_limit: finalLimit,
				new_limit: future.limit,
			};
		}

		return { limit: finalLimit, gps_source: "", next_change: nextChange };
	}

	private scanFuture(
		currentSeg: RoadSegment,
		lat: number,
		lon: number,
		bearing: number,
		baseLimit: number,
		rtree: SpatialIndex,
	): FutureInfo | undefined {
		const maxDist = 2000.0;
		const roadBrg = roadBearingNear(currentSeg.polyline, lat, lon);
		const forward = angleDiff(bearing, roadBrg) < 90.0;

		let totalDist = remainingDistance(currentSeg.polyline, lat, lon, forward);

		const visited = new Set<number>([currentSeg.osm_id]);

		let prevSeg = currentSeg;
		let prevForward = forward;

		const baseClass = highwayClass(currentSeg.highway_type);

		let changedDist = 0.0;
		let firstChange: [number, number] | null = null;

		let junctionFailed = false;
		for (let i = 0; i < 30; i++) {
			if (totalDist > maxDist) break;

			const exit = exitPointAndBearing(prevSeg.polyline, prevForward);
			if (exit === undefined) {
				junctionFailed = true;
				break;
			}
			const [exitLat, exitLon, exitBearing] = exit;

			const candidates = rtree.querySegments(exitLat, exitLon, 0.00035);
			const next = findJunctionContinuation(
				candidates,
				exitLat,
				exitLon,
				exitBearing,
				prevSeg,
				visited,
				baseClass,
			);

			if (next !== undefined) {
				const nextSeg = next[0];
				const nextSegForward = next[1];

				const segSpeed = segmentRoadSpeed(nextSeg);
				const segClass = highwayClass(nextSeg.highway_type);
				const segLen = polylineLength(nextSeg.polyline);
				const classDrop = baseClass - segClass;

				if (baseClass >= 4 && segClass <= 1) {
					junctionFailed = true;
					break;
				}

				if (classDrop >= 3 && !isLinkRoad(nextSeg.highway_type)) {
					junctionFailed = true;
					break;
				}

				if (segSpeed !== baseLimit) {
					changedDist += segLen;
					if (firstChange === null) {
						firstChange = [Math.trunc(totalDist), segSpeed];
					}

					const threshold =
						classDrop >= 3 ? 600.0 : classDrop >= 2 ? 400.0 : 150.0;
					if (changedDist >= threshold) {
						const [d, l] = firstChange;
						return { limit: l, distance: d };
					}
				} else {
					changedDist = 0.0;
					firstChange = null;
				}

				totalDist += segLen;
				visited.add(nextSeg.osm_id);
				prevSeg = nextSeg;
				prevForward = nextSegForward;
			} else {
				junctionFailed = true;
				break;
			}
		}

		if (junctionFailed || totalDist < maxDist) {
			const fb =
				exitPointAndBearing(prevSeg.polyline, prevForward) ??
				([lat, lon, bearing] as [number, number, number]);
			const [fbLat, fbLon, fbBearing] = fb;

			const remaining = Math.min(maxDist - totalDist, 1200.0);
			if (remaining > 100.0) {
				const projResult = this.projectionFallback(
					fbLat,
					fbLon,
					fbBearing,
					prevSeg,
					baseLimit,
					baseClass,
					remaining,
					totalDist,
					rtree,
				);

				if (projResult !== undefined) {
					return projResult;
				}

				if (firstChange !== null) {
					if (changedDist >= 100.0) {
						const [d, l] = firstChange;
						return { limit: l, distance: d };
					}
				}
			}
		}

		return undefined;
	}

	private projectionFallback(
		startLat: number,
		startLon: number,
		bearing: number,
		lastSeg: RoadSegment,
		baseLimit: number,
		baseClass: number,
		maxRemaining: number,
		distanceOffset: number,
		rtree: SpatialIndex,
	): FutureInfo | undefined {
		const step = 100.0;
		const steps = Math.floor(maxRemaining / step);

		let lat = startLat;
		let lon = startLon;
		let brg = bearing;
		let routeOsmId: number | null = lastSeg.osm_id;
		let routeName: string | null = lastSeg.name;

		let changedDist = 0.0;
		let firstChange: [number, number] | null = null;

		for (let i = 1; i <= steps; i++) {
			const [nlat, nlon] = destinationPoint(lat, lon, brg, step / 1000.0);
			lat = nlat;
			lon = nlon;
			const dist = distanceOffset + step * i;

			const ctx: MatchContext = {
				prev_osm_id: routeOsmId,
				prev_name: routeName,
				prev_speed: baseLimit,
				prev_class: baseClass,
				prev_hw_type: lastSeg.highway_type,
			};

			const candidates = rtree.querySegments(lat, lon, 0.0004);
			const best = findBestSegment(ctx, candidates, lat, lon, brg);

			if (best !== undefined) {
				const seg = best[0];
				const speed = segmentRoadSpeed(seg);
				const segClass = highwayClass(seg.highway_type);
				const classDrop = baseClass - segClass;

				if (baseClass >= 4 && segClass <= 1) {
					continue;
				}
				if (classDrop >= 3 && !isLinkRoad(seg.highway_type)) {
					continue;
				}

				const isPlausible =
					routeOsmId === seg.osm_id ||
					(routeName !== null && routeName === seg.name) ||
					classDrop <= 1;
				if (isPlausible) {
					const rbrg = roadBearingNear(seg.polyline, lat, lon);
					if (angleDiff(brg, rbrg) < 90.0) {
						brg = rbrg;
					} else {
						brg = (rbrg + 180.0) % 360.0;
					}
				}

				routeOsmId = seg.osm_id;
				routeName = seg.name;

				if (speed !== baseLimit) {
					changedDist += step;
					if (firstChange === null) {
						firstChange = [Math.trunc(dist), speed];
					}

					const threshold =
						classDrop >= 3 ? 600.0 : classDrop >= 2 ? 400.0 : 150.0;
					if (changedDist >= threshold) {
						const [d, l] = firstChange;
						return { limit: l, distance: d };
					}
				} else {
					changedDist = 0.0;
					firstChange = null;
				}
			} else {
				routeOsmId = null;
				routeName = null;
				changedDist = 0.0;
				firstChange = null;
			}
		}

		return undefined;
	}
}

function findJunctionContinuation(
	candidates: RoadSegment[],
	exitLat: number,
	exitLon: number,
	exitBearing: number,
	prevSeg: RoadSegment,
	visited: Set<number>,
	baseClass: number,
): [RoadSegment, boolean] | undefined {
	const prevClass = highwayClass(prevSeg.highway_type);
	const prevName = prevSeg.name;
	const prevIsMain = !isLinkRoad(prevSeg.highway_type);

	let best: [RoadSegment, boolean, number] | undefined;
	for (const seg of candidates) {
		if (visited.has(seg.osm_id)) continue;
		if (seg.polyline.length < 2) continue;

		const first = seg.polyline[0];
		const last = seg.polyline[seg.polyline.length - 1];
		const dStart = haversineM(exitLat, exitLon, first[0], first[1]);
		const dEnd = haversineM(exitLat, exitLon, last[0], last[1]);

		if (dStart > 40.0 && dEnd > 40.0) continue;

		const forward = dStart < dEnd;

		let entryBearing: number;
		if (forward) {
			entryBearing = geoBearing(
				seg.polyline[0][0],
				seg.polyline[0][1],
				seg.polyline[1][0],
				seg.polyline[1][1],
			);
		} else {
			const l = seg.polyline.length;
			const raw = geoBearing(
				seg.polyline[l - 2][0],
				seg.polyline[l - 2][1],
				seg.polyline[l - 1][0],
				seg.polyline[l - 1][1],
			);
			entryBearing = (raw + 180.0) % 360.0;
		}

		const angle = angleDiff(exitBearing, entryBearing);
		if (angle > 90.0) continue;

		let score = 100.0 - angle;
		const segClass = highwayClass(seg.highway_type);
		const classDiff = Math.abs(prevClass - segClass);
		const segIsLink = isLinkRoad(seg.highway_type);

		if (classDiff === 0) {
			score += 60.0;
			if (prevIsMain && !segIsLink) {
				score += 20.0;
			}
		} else if (classDiff === 1) {
			score += 25.0;
		} else if (classDiff >= 2) {
			score -= (classDiff - 1.0) * 15.0;
		}

		if (prevIsMain && segIsLink && prevClass > segClass) {
			score -= 30.0;
		}

		if (baseClass >= 5 && segClass <= 2) {
			score -= 40.0;
		}

		if (prevName !== null && seg.name !== null) {
			if (prevName === seg.name) {
				score += 50.0;
			}
		}

		if (prevSeg.osm_id === seg.osm_id) {
			score += 80.0;
		}

		score += segClass * 5.0;

		if (best === undefined || score > best[2]) {
			best = [seg, forward, score];
		}
	}

	if (best === undefined) return undefined;
	return [best[0], best[1]];
}

function findBestSegment(
	ctx: MatchContext,
	candidates: RoadSegment[],
	lat: number,
	lon: number,
	bearing: number,
): [RoadSegment, number] | undefined {
	let best: [RoadSegment, number] | undefined;
	for (const seg of candidates) {
		if (seg.polyline.length < 2) continue;

		const dist = pointToPolylineDistance(lat, lon, seg.polyline);
		if (dist > 40.0) continue;

		const az = roadBearingNear(seg.polyline, lat, lon);
		const diff = angleDiff(bearing, az);
		const revDiff = angleDiff(bearing, (az + 180.0) % 360.0);
		const bestAngle = Math.min(diff, revDiff);
		if (bestAngle > 45.0) continue;

		let score = -dist * 5.0;
		score -= bestAngle;

		const segClass = highwayClass(seg.highway_type);
		const segIsLink = isLinkRoad(seg.highway_type);

		if (ctx.prev_osm_id !== null) {
			if (ctx.prev_osm_id === seg.osm_id) {
				score += 70.0;
			}
		}

		if (ctx.prev_name !== null && seg.name !== null) {
			if (ctx.prev_name === seg.name) {
				score += 30.0;
			}
		}

		score += segClass * 8.0;

		if (ctx.prev_class !== null) {
			const classDiff = Math.abs(ctx.prev_class - segClass);
			if (classDiff === 0) {
				score += 20.0;
			} else if (classDiff >= 2) {
				score -= classDiff * 8.0;
			}

			if (ctx.prev_hw_type !== null) {
				const prevIsMain = !isLinkRoad(ctx.prev_hw_type);
				if (prevIsMain && segIsLink && ctx.prev_class > segClass) {
					score -= 20.0;
				}
			}
		}

		if (ctx.prev_speed !== null) {
			const segSpeed = seg.maxspeed <= 0 ? DEFAULT_LIMIT : seg.maxspeed;
			const speedDiff = Math.abs(ctx.prev_speed - segSpeed);
			score += Math.max(0.0, 20.0 - speedDiff / 3.0);
		}

		if (best === undefined || score > best[1]) {
			best = [seg, score];
		}
	}

	return best;
}

function resolveSpeed(
	segment: RoadSegment,
	lat: number,
	lon: number,
	rtree: SpatialIndex,
): number {
	const road = segment.maxspeed <= 0 ? DEFAULT_LIMIT : segment.maxspeed;

	const radiusDeg = 30.0 / 111139.0;
	const cameras = rtree.queryCameras(lat, lon, radiusDeg);

	let minCam: number | null = null;
	for (const c of cameras) {
		if (c.maxspeed === null) continue;
		const d = haversineM(lat, lon, c.lat, c.lon);
		if (d <= 30.0) {
			if (minCam === null || c.maxspeed < minCam) {
				minCam = c.maxspeed;
			}
		}
	}

	return minCam !== null ? Math.min(road, minCam) : road;
}

function segmentRoadSpeed(seg: RoadSegment): number {
	return seg.maxspeed <= 0 ? DEFAULT_LIMIT : seg.maxspeed;
}

function roadBearingNear(
	poly: Array<[number, number]>,
	lat: number,
	lon: number,
): number {
	if (poly.length < 2) return 0.0;
	let minDist = Number.MAX_VALUE;
	let bestIdx = 0;
	for (let i = 0; i < poly.length - 1; i++) {
		const d = pointToSegmentDistance(
			lat,
			lon,
			poly[i][0],
			poly[i][1],
			poly[i + 1][0],
			poly[i + 1][1],
		);
		if (d < minDist) {
			minDist = d;
			bestIdx = i;
		}
	}
	return geoBearing(
		poly[bestIdx][0],
		poly[bestIdx][1],
		poly[bestIdx + 1][0],
		poly[bestIdx + 1][1],
	);
}

function polylineLength(poly: Array<[number, number]>): number {
	let total = 0.0;
	for (let i = 0; i < poly.length - 1; i++) {
		total += haversineM(poly[i][0], poly[i][1], poly[i + 1][0], poly[i + 1][1]);
	}
	return total;
}

function remainingDistance(
	poly: Array<[number, number]>,
	lat: number,
	lon: number,
	forward: boolean,
): number {
	let minD = Number.MAX_VALUE;
	let idx = 0;
	for (let i = 0; i < poly.length; i++) {
		const d = haversineM(lat, lon, poly[i][0], poly[i][1]);
		if (d < minD) {
			minD = d;
			idx = i;
		}
	}

	const total = polylineLength(poly);
	let distFromStart = 0.0;
	for (let i = 0; i < idx; i++) {
		if (i + 1 < poly.length) {
			distFromStart += haversineM(
				poly[i][0],
				poly[i][1],
				poly[i + 1][0],
				poly[i + 1][1],
			);
		}
	}

	if (forward) {
		return Math.max(0.0, total - distFromStart);
	}
	return distFromStart;
}

function exitPointAndBearing(
	poly: Array<[number, number]>,
	forward: boolean,
): [number, number, number] | undefined {
	if (poly.length < 2) return undefined;
	const l = poly.length;

	if (forward) {
		const lat = poly[l - 1][0];
		const lon = poly[l - 1][1];
		const brg = geoBearing(poly[l - 2][0], poly[l - 2][1], lat, lon);
		return [lat, lon, brg];
	} else {
		const lat = poly[0][0];
		const lon = poly[0][1];
		const brg =
			(geoBearing(poly[0][0], poly[0][1], poly[1][0], poly[1][1]) + 180.0) %
			360.0;
		return [lat, lon, brg];
	}
}
