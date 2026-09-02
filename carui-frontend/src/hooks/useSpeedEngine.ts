import { useEffect, useRef } from "react";
import { useCarStore } from "../app/store";
import { OVERPASS_URL } from "../services/config";
import { SpeedEngine } from "../services/speed/speedEngine";
import type { SpeedLimit } from "../types";

const MATCH_THROTTLE_MS = 400;

let lastMatchAt = 0;

export function useSpeedEngine() {
	const setSpeedLimit = useCarStore((s) => s.setSpeedLimit);
	const position = useCarStore((s) => s.position);

	const engineRef = useRef<SpeedEngine | null>(null);
	if (engineRef.current === null) {
		engineRef.current = new SpeedEngine(OVERPASS_URL);
	}

	useEffect(() => {
		const engine = engineRef.current;
		if (!engine || !position) return;

		let cancelled = false;

		(async () => {
			try {
				await engine.loadData(position.lat, position.lon);
			} catch (err) {
				if (__DEV__) console.warn("[SpeedEngine] load failed", err);
			}
			if (cancelled) return;

			const now = Date.now();
			if (now - lastMatchAt < MATCH_THROTTLE_MS) return;
			lastMatchAt = now;

			const info = engine.match(position.lat, position.lon, position.bearing);
			const limit: SpeedLimit = {
				limit: info.limit,
				gps_source: info.gps_source,
				next_change: info.next_change ?? undefined,
			};
			setSpeedLimit(limit);
		})();

		return () => {
			cancelled = true;
		};
	}, [position, setSpeedLimit]);
}