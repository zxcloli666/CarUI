export interface GeocodingResult {
  city: string;
  displayName: string;
}

const OPEN_METEO_API = 'https://geocoding-api.open-meteo.com/v1/reverse';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/reverse';
const BIGDATA_API = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

const CACHE_DIST_KM = 3;
const CACHE_TTL_MS = 20 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 3500;
const MIN_REQUEST_INTERVAL_MS = 20 * 1000;
const GEO_LANG_PRIMARY = 'ru';
const GEO_LANG_FALLBACK = 'en';

type GeoCache = {
  coords: { lat: number; lon: number };
  data: GeocodingResult | null;
  updatedAt: number;
  lastAttemptAt: number;
  lastAttemptCoords: { lat: number; lon: number };
  promise: Promise<GeocodingResult | null> | null;
};

const cache: GeoCache = {
  coords: { lat: 0, lon: 0 },
  data: null,
  updatedAt: 0,
  lastAttemptAt: 0,
  lastAttemptCoords: { lat: 0, lon: 0 },
  promise: null,
};

export class GeoService {
  static getCached(): GeocodingResult | null {
    return cache.data;
  }

  static getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 9999;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  static async reverseGeocode(lat: number, lon: number): Promise<GeocodingResult | null> {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return cache.data;
    }

    const now = Date.now();
    const distFromCache = GeoService.getDistanceKm(lat, lon, cache.coords.lat, cache.coords.lon);
    const isFresh =
      cache.data &&
      distFromCache < CACHE_DIST_KM &&
      now - cache.updatedAt < CACHE_TTL_MS;

    if (isFresh) return cache.data;
    if (cache.promise) return cache.promise;

    const distFromAttempt = GeoService.getDistanceKm(
      lat,
      lon,
      cache.lastAttemptCoords.lat,
      cache.lastAttemptCoords.lon
    );
    if (now - cache.lastAttemptAt < MIN_REQUEST_INTERVAL_MS || distFromAttempt < CACHE_DIST_KM) {
      return cache.data;
    }

    cache.lastAttemptAt = now;
    cache.lastAttemptCoords = { lat, lon };

    cache.promise = (async () => {
      try {
        // reverseGeocodeBigdata
        const result = (await reverseGeocodeOpenMeteo(lat, lon, GEO_LANG_PRIMARY)) ||
            (await reverseGeocodeOpenMeteo(lat, lon, GEO_LANG_FALLBACK)) ||
            (await reverseGeocodeBigdata(lat, lon)) ||
            (await reverseGeocodeNominatim(lat, lon)) || null;

        if (result) {
          cache.coords = { lat, lon };
          cache.data = result;
          cache.updatedAt = Date.now();
          return result;
        }

        return cache.data;
      } catch (e) {
        return cache.data;
      } finally {
        cache.promise = null;
      }
    })();

    return cache.promise;
  }
}

function normalizeGeoText(value?: string | null): string {
  return (value || '').trim();
}

function buildDisplayName(city?: string, district?: string, region?: string, country?: string): string {
  const safeCity = normalizeGeoText(city);
  const safeDistrict = normalizeGeoText(district);
  const safeRegion = normalizeGeoText(region);
  const safeCountry = normalizeGeoText(country);

  if (safeCity && safeDistrict && safeCity.toLowerCase() !== safeDistrict.toLowerCase()) {
    return `${safeCity}, ${safeDistrict}`;
  }

  if (safeCity) return safeCity;

  if (safeDistrict && safeRegion && safeDistrict.toLowerCase() !== safeRegion.toLowerCase()) {
    return `${safeDistrict}, ${safeRegion}`;
  }

  return safeDistrict || safeRegion || safeCountry || 'Unknown location';
}

async function fetchJson(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<any | null> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const init = controller ? { ...options, signal: controller.signal } : options;
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function reverseGeocodeOpenMeteo(
  lat: number,
  lon: number,
  language: string
): Promise<GeocodingResult | null> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    language,
    format: 'json',
  });
  const data = await fetchJson(`${OPEN_METEO_API}?${params}`);
  const result = data?.results?.[0];
  if (!result) return null;

  const city = normalizeGeoText(result.name || result.admin1);
  const district = normalizeGeoText(result.admin2 || result.admin3 || result.admin4);
  const region = normalizeGeoText(result.admin1);
  const country = normalizeGeoText(result.country);
  const display = buildDisplayName(city, district, region, country);

  return { city: city || region || country || '', displayName: display };
}

async function reverseGeocodeNominatim(lat: number, lon: number): Promise<GeocodingResult | null> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lon.toString(),
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': GEO_LANG_PRIMARY,
  });
  const data = await fetchJson(`${NOMINATIM_API}?${params}`, {
    headers: { 'User-Agent': 'CarUI/1.0' },
  });
  const address = data?.address;
  if (!address) return null;

  const city = normalizeGeoText(
    address.city || address.town || address.village || address.hamlet || address.locality || address.municipality
  );
  const district = normalizeGeoText(
    address.city_district || address.state_district || address.county || address.region || address.district
  );
  const region = normalizeGeoText(address.state || address.province || address.region);
  const country = normalizeGeoText(address.country);
  const display = buildDisplayName(city, district, region, country);

  return { city: city || region || country || '', displayName: display };
}

async function reverseGeocodeBigdata(lat: number, lon: number): Promise<GeocodingResult | null> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    localityLanguage: GEO_LANG_PRIMARY,
  });
  const address = await fetchJson(`${BIGDATA_API}?${params}`, {
    headers: { 'User-Agent': 'CarUI/1.0' },
  });

  const city = normalizeGeoText(
      address.city || address.locality
  );
  const district = normalizeGeoText(
      address.locality || address.principalSubdivision || address.countryName
  );
  const region = normalizeGeoText(address.principalSubdivision);
  const country = normalizeGeoText(address.countryName);
  const display = buildDisplayName(city, district, region, country);

  return { city: city || region || country || '', displayName: display };
}