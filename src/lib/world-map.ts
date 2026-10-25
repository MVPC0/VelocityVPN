import { LAND_COLS, LAND_ROWS, LAND_ROWS_HEX } from '@/data/world-land-dots';
import { VELOCITY_SERVERS } from '@/data/velocity-servers';

// Equirectangular bounds. Must match scripts/gen-land-dots.mjs.
export const MAP_LON_MIN = -170;
export const MAP_LON_MAX = 180;
export const MAP_LAT_MAX = 76;
export const MAP_LAT_MIN = -56;
/** Natural width / height of the projected map. */
export const MAP_ASPECT = (MAP_LON_MAX - MAP_LON_MIN) / (MAP_LAT_MAX - MAP_LAT_MIN);

/** Project lat/lng to fractions (0..1) of the map box. */
export function project(lat: number, lng: number): { x: number; y: number } {
  const x = (lng - MAP_LON_MIN) / (MAP_LON_MAX - MAP_LON_MIN);
  const y = (MAP_LAT_MAX - lat) / (MAP_LAT_MAX - MAP_LAT_MIN);
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

export { LAND_COLS, LAND_ROWS };

let landCache: Array<[number, number]> | null = null;

/** Land cells as [col, row] pairs, decoded once from the hex bitmask rows. */
export function getLandCells(): Array<[number, number]> {
  if (landCache) return landCache;
  const cells: Array<[number, number]> = [];
  LAND_ROWS_HEX.forEach((hex, row) => {
    for (let i = 0; i < hex.length; i++) {
      const nibble = parseInt(hex[i], 16);
      for (let b = 0; b < 4; b++) {
        const col = i * 4 + b;
        if (col < LAND_COLS && nibble & (8 >> b)) cells.push([col, row]);
      }
    }
  });
  landCache = cells;
  return cells;
}

// ─── Shared city list ────────────────────────────────────────
// One list for the map, the ping test and the dashboard.
export interface MapCity {
  id: number;
  city: string;
  countryCode: string;
  flag: string;
  lat: number;
  lng: number;
  /** Public site near the city, used only for coarse browser timing. */
  endpoint: string;
  region: string;
}

export const MAP_CITIES: MapCity[] = VELOCITY_SERVERS.map((s) => ({
  id: s.id,
  city: s.city,
  countryCode: s.countryCode,
  flag: s.flag,
  lat: s.lat,
  lng: s.lng,
  endpoint: s.endpoint,
  region: s.region,
}));

const REGION_CONTINENT: Record<string, string> = {
  north_america: 'North America',
  south_america: 'South America',
  europe: 'Europe',
  asia_pacific: 'Asia',
  middle_east: 'Asia',
  africa: 'Africa',
  oceania: 'Oceania',
};

export const MAP_CITY_COUNT = MAP_CITIES.length;
export const MAP_CONTINENT_COUNT = new Set(
  MAP_CITIES.map((c) => REGION_CONTINENT[c.region] ?? c.region),
).size;
