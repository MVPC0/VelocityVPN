// ─── Game-ping targets ────────────────────────────────────────
// Each reference city is timed against a cloud datacenter physically
// in (or, where there is none, nearest to) that city — the same
// regions multiplayer games host servers in. Every URL below was
// checked to resolve to a unicast IP in the named region (not an
// anycast CDN edge) and to answer a tiny request quickly.
//
// - AWS: DynamoDB's regional health endpoint (`/ping`, ~30 bytes,
//   CORS `*`), the same target cloudping.info uses.
// - Azure: a 2-byte public blob in a regional storage account, the
//   same target azurespeed.com uses. No CORS header, so it is fetched
//   in `no-cors` mode (opaque response, timing still valid).
//
// Keyed by VelocityServer / MapCity id.

export type PingProvider = 'AWS' | 'Azure';

export interface PingTarget {
  provider: PingProvider;
  /** Provider region code, e.g. `us-east-2`. */
  region: string;
  /** Where that region physically is, e.g. `Ohio`. */
  regionLocation: string;
  /** True when the region is in/at the city itself. */
  inCity: boolean;
  url: string;
  /** `cors` when the endpoint sends Access-Control-Allow-Origin. */
  mode: 'cors' | 'no-cors';
}

const aws = (region: string, regionLocation: string, inCity: boolean): PingTarget => ({
  provider: 'AWS',
  region,
  regionLocation,
  inCity,
  url: `https://dynamodb.${region}.amazonaws.com/ping`,
  mode: 'cors',
});

const azure = (region: string, regionLocation: string, inCity: boolean): PingTarget => ({
  provider: 'Azure',
  region,
  regionLocation,
  inCity,
  url: `https://s8${region}.blob.core.windows.net/public/latency-test.json`,
  mode: 'no-cors',
});

export const PING_TARGETS: Record<number, PingTarget> = {
  1: aws('us-west-1', 'N. California', false), // Los Angeles
  2: azure('southcentralus', 'San Antonio, TX', false), // Dallas
  3: azure('northcentralus', 'Chicago', true), // Chicago
  4: aws('us-east-1', 'N. Virginia', false), // New York
  5: aws('ap-northeast-1', 'Tokyo', true), // Tokyo
  6: azure('westeurope', 'Amsterdam', true), // Amsterdam
  7: aws('ap-northeast-2', 'Seoul', true), // Seoul
  8: aws('eu-west-2', 'London', true), // London
  9: aws('ap-southeast-6', 'Auckland', true), // Auckland
  10: azure('polandcentral', 'Warsaw', true), // Warsaw
  11: aws('ap-southeast-2', 'Sydney', true), // Sydney
  12: aws('ap-east-1', 'Hong Kong', true), // Hong Kong
  13: aws('ap-southeast-4', 'Melbourne', false), // Perth (no Perth region)
  14: aws('eu-north-1', 'Stockholm', true), // Stockholm
  15: aws('ap-southeast-1', 'Singapore', true), // Singapore
  16: aws('sa-east-1', 'São Paulo', true), // Sao Paulo
  17: azure('uaenorth', 'Dubai', true), // Dubai
  18: azure('southafricanorth', 'Johannesburg', true), // Johannesburg
};

export function getPingTarget(cityId: number): PingTarget | undefined {
  return PING_TARGETS[cityId];
}

/** Short honest label, e.g. `AWS us-east-2 (Ohio)`. */
export function pingTargetLabel(t: PingTarget): string {
  return `${t.provider} ${t.region} (${t.regionLocation})`;
}
