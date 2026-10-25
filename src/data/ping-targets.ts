// ─── Latency test targets ─────────────────────────────────────
// Each reference city is timed against a cloud region in (or, where
// there is none, nearest to) that city. Every URL below was checked to
// resolve to a unicast IP in the named region (not an anycast CDN edge).
//
// Primary: AWS for all 18 cities, so every city is measured the same
// way against the same kind of endpoint:
//   DynamoDB's regional health endpoint (`/ping`, ~40 bytes, CORS `*`,
//   the target cloudping.info uses). Readable responses, so HTTP errors
//   are detected, and the server does almost no work per request.
//
// Fallback (used only if the primary fails or returns garbage, and
// labelled "via fallback" in the UI): a 2-byte public blob in an Azure
// regional storage account. These accounts belong to azurespeed.com, not
// to us, and send no CORS header, so they are fetched in `no-cors` mode
// (opaque: status unreadable). Both providers use the identical code path
// and timing source (wall-clock fetch -> response headers, warm connection).
// Bias, Azure blob minus AWS, 14 alternating runs x 8 nearby region pairs
// (headless Chromium, 2026-10-24): pooled median +3 ms; per-pair medians
// Chicago/Ohio -0.4, N.Virginia +1.5, N.California +1.5, Sao Paulo +1.5,
// Tokyo +5, Singapore +5, London +22, Frankfurt +26. So a fallback reading
// can be ~0-25 ms high; it is labelled "via fallback" rather than corrected.
//
// Keyed by VelocityServer / MapCity id.

export type LatencyProvider = 'AWS' | 'Azure';

export interface LatencyTarget {
  provider: LatencyProvider;
  /** Provider region code, e.g. `us-east-2`. */
  region: string;
  /** Where that region physically is, e.g. `Ohio`. */
  regionLocation: string;
  /** True when the region is in/at the city itself. */
  inCity: boolean;
  url: string;
  /** Approximate datacenter coordinates, used for the speed-of-light floor. */
  lat: number;
  lng: number;
  /** `cors` when the endpoint sends Access-Control-Allow-Origin. */
  mode: 'cors' | 'no-cors';
}

/** Typical extra ms an Azure blob fallback reads vs AWS in the same metro (measured). */
export const AZURE_BLOB_BIAS_MS = 3; // pooled median, see header (range -0.4..+26 by region)

// Approximate region coordinates (metro of the region's datacenters).
// me-central-1's exact site isn't published; placed between Abu Dhabi and
// Dubai so the physics floor errs low.
const COORDS: Record<string, [number, number]> = {
  'us-west-1': [37.35, -121.96], 'us-east-2': [39.96, -83.0], 'us-east-1': [39.04, -77.49],
  'ap-northeast-1': [35.68, 139.69], 'eu-central-1': [50.11, 8.68], 'ap-northeast-2': [37.57, 126.98],
  'eu-west-2': [51.51, -0.13], 'ap-southeast-6': [-36.85, 174.76], 'ap-southeast-2': [-33.87, 151.21],
  'ap-east-1': [22.32, 114.17], 'ap-southeast-4': [-37.81, 144.96], 'eu-north-1': [59.33, 18.07],
  'ap-southeast-1': [1.35, 103.82], 'sa-east-1': [-23.55, -46.63], 'me-central-1': [24.8, 55.0],
  'af-south-1': [-33.92, 18.42],
  westus: [37.78, -122.42], southcentralus: [29.42, -98.49], northcentralus: [41.88, -87.63],
  eastus: [36.67, -78.39], japaneast: [35.68, 139.69], westeurope: [52.37, 4.9], koreacentral: [37.57, 126.98],
  uksouth: [51.51, -0.13], newzealandnorth: [-36.85, 174.76], polandcentral: [52.23, 21.01],
  australiaeast: [-33.87, 151.21], eastasia: [22.32, 114.17], australiasoutheast: [-37.81, 144.96],
  swedencentral: [60.67, 17.14], southeastasia: [1.35, 103.82], brazilsouth: [-23.55, -46.63],
  uaenorth: [25.2, 55.27], southafricanorth: [-26.2, 28.05],
};

const coords = (region: string) => {
  const c = COORDS[region];
  if (!c) throw new Error(`No coordinates for region ${region}`);
  return { lat: c[0], lng: c[1] };
};

const aws = (region: string, regionLocation: string, inCity: boolean): LatencyTarget => ({
  provider: 'AWS',
  region,
  regionLocation,
  inCity,
  ...coords(region),
  url: `https://dynamodb.${region}.amazonaws.com/ping`,
  mode: 'cors',
});

const azure = (region: string, regionLocation: string, inCity: boolean): LatencyTarget => ({
  provider: 'Azure',
  region,
  regionLocation,
  inCity,
  ...coords(region),
  url: `https://s8${region}.blob.core.windows.net/public/latency-test.json`,
  mode: 'no-cors',
});

/** [primary, fallback] per city. */
export const LATENCY_TARGETS: Record<number, [LatencyTarget, LatencyTarget]> = {
  1: [aws('us-west-1', 'N. California', false), azure('westus', 'California', false)], // Los Angeles
  2: [aws('us-east-2', 'Ohio', false), azure('southcentralus', 'San Antonio, TX', false)], // Dallas
  3: [aws('us-east-2', 'Ohio', false), azure('northcentralus', 'Chicago', true)], // Chicago
  4: [aws('us-east-1', 'N. Virginia', false), azure('eastus', 'Virginia', false)], // New York
  5: [aws('ap-northeast-1', 'Tokyo', true), azure('japaneast', 'Tokyo', true)], // Tokyo
  6: [aws('eu-central-1', 'Frankfurt', false), azure('westeurope', 'Amsterdam', true)], // Amsterdam
  7: [aws('ap-northeast-2', 'Seoul', true), azure('koreacentral', 'Seoul', true)], // Seoul
  8: [aws('eu-west-2', 'London', true), azure('uksouth', 'London', true)], // London
  9: [aws('ap-southeast-6', 'Auckland', true), azure('newzealandnorth', 'Auckland', true)], // Auckland
  10: [aws('eu-central-1', 'Frankfurt', false), azure('polandcentral', 'Warsaw', true)], // Warsaw
  11: [aws('ap-southeast-2', 'Sydney', true), azure('australiaeast', 'Sydney', true)], // Sydney
  12: [aws('ap-east-1', 'Hong Kong', true), azure('eastasia', 'Hong Kong', true)], // Hong Kong
  13: [aws('ap-southeast-4', 'Melbourne', false), azure('australiasoutheast', 'Melbourne', false)], // Perth
  14: [aws('eu-north-1', 'Stockholm', true), azure('swedencentral', 'Gävle', false)], // Stockholm
  15: [aws('ap-southeast-1', 'Singapore', true), azure('southeastasia', 'Singapore', true)], // Singapore
  16: [aws('sa-east-1', 'São Paulo', true), azure('brazilsouth', 'São Paulo', true)], // Sao Paulo
  17: [aws('me-central-1', 'UAE', false), azure('uaenorth', 'Dubai', true)], // Dubai
  18: [aws('af-south-1', 'Cape Town', false), azure('southafricanorth', 'Johannesburg', true)], // Johannesburg
};

/** Primary first, then fallbacks. Empty if the city has no targets. */
export function cityLatencyTargets(cityId: number): LatencyTarget[] {
  return LATENCY_TARGETS[cityId] ?? [];
}

export function primaryLatencyTarget(cityId: number): LatencyTarget | undefined {
  return LATENCY_TARGETS[cityId]?.[0];
}

/** Short honest label, e.g. `AWS us-east-2 (Ohio)`. */
export function latencyTargetLabel(t: LatencyTarget): string {
  return `${t.provider} ${t.region} (${t.regionLocation})`;
}

/**
 * Label for the result itself, e.g. `Latency to AWS London`,
 * `Latency to nearest AWS region (Ohio)`, `Latency to Azure Chicago (fallback)`.
 */
export function latencyHeadlineLabel(t: LatencyTarget, viaFallback = false): string {
  if (viaFallback) return `Latency to ${t.provider} ${t.regionLocation} (fallback)`;
  if (t.inCity) return `Latency to ${t.provider} ${t.regionLocation}`;
  return `Latency to nearest ${t.provider} region (${t.regionLocation})`;
}

/** BYO-WireGuard reminder shown next to every result. */
export const REFERENCE_DC_NOTE = "Reference cloud datacenter — not your VPN provider's server.";
