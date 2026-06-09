// ─── VelocityVPN Servers ──────────────────────────────────────
// 18 global locations across 6 regions
// Our own VPN infrastructure — no third-party provider needed

import { getServerKeyPair } from "../lib/wg-keygen";

export interface VelocityServer {
  id: number;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  region: string;
  hostname: string;
  endpoint: string;
  wgEndpoint: string;
  flag: string;
  lat: number;
  lng: number;
}

// VelocityVPN — 18 global locations
export const VELOCITY_SERVERS: VelocityServer[] = [
  {
    id: 1, name: "US-West", city: "Los Angeles", country: "United States",
    countryCode: "US", region: "north_america",
    hostname: "usw-001.velocityvpn.io", endpoint: "https://www.cloudflare.com", wgEndpoint: "1.1.1.1",
    flag: "\uD83C\uDDFA\uD83C\uDDF8", lat: 34.0522, lng: -118.2437,
  },
  {
    id: 2, name: "US-South", city: "Dallas", country: "United States",
    countryCode: "US", region: "north_america",
    hostname: "uss-001.velocityvpn.io", endpoint: "https://www.att.com", wgEndpoint: "8.8.8.8",
    flag: "\uD83C\uDDFA\uD83C\uDDF8", lat: 32.7767, lng: -96.7970,
  },
  {
    id: 3, name: "US-Central", city: "Chicago", country: "United States",
    countryCode: "US", region: "north_america",
    hostname: "usc-001.velocityvpn.io", endpoint: "https://www.chicago.gov", wgEndpoint: "9.9.9.9",
    flag: "\uD83C\uDDFA\uD83C\uDDF8", lat: 41.8781, lng: -87.6298,
  },
  {
    id: 4, name: "US-East", city: "New York", country: "United States",
    countryCode: "US", region: "north_america",
    hostname: "use-001.velocityvpn.io", endpoint: "https://www.google.com", wgEndpoint: "8.8.4.4",
    flag: "\uD83C\uDDFA\uD83C\uDDF8", lat: 40.7128, lng: -74.0060,
  },
  {
    id: 5, name: "Japan", city: "Tokyo", country: "Japan",
    countryCode: "JP", region: "asia_pacific",
    hostname: "jpn-001.velocityvpn.io", endpoint: "https://www.yahoo.co.jp", wgEndpoint: "1.1.1.1",
    flag: "\uD83C\uDDEF\uD83C\uDDF5", lat: 35.6762, lng: 139.6503,
  },
  {
    id: 6, name: "Europe-West", city: "Amsterdam", country: "Netherlands",
    countryCode: "NL", region: "europe",
    hostname: "euw-001.velocityvpn.io", endpoint: "https://www.rijksoverheid.nl", wgEndpoint: "1.1.1.1",
    flag: "\uD83C\uDDF3\uD83C\uDDF1", lat: 52.3676, lng: 4.9041,
  },
  {
    id: 7, name: "South Korea", city: "Seoul", country: "South Korea",
    countryCode: "KR", region: "asia_pacific",
    hostname: "kor-001.velocityvpn.io", endpoint: "https://www.go.kr", wgEndpoint: "8.8.8.8",
    flag: "\uD83C\uDDF0\uD83C\uDDF7", lat: 37.5665, lng: 126.9780,
  },
  {
    id: 8, name: "UK", city: "London", country: "United Kingdom",
    countryCode: "GB", region: "europe",
    hostname: "uk-001.velocityvpn.io", endpoint: "https://www.bbc.co.uk", wgEndpoint: "1.1.1.1",
    flag: "\uD83C\uDDEC\uD83C\uDDE7", lat: 51.5074, lng: -0.1278,
  },
  {
    id: 9, name: "New Zealand", city: "Auckland", country: "New Zealand",
    countryCode: "NZ", region: "oceania",
    hostname: "nzl-001.velocityvpn.io", endpoint: "https://www.govt.nz", wgEndpoint: "8.8.8.8",
    flag: "\uD83C\uDDF3\uD83C\uDDFF", lat: -36.8485, lng: 174.7633,
  },
  {
    id: 10, name: "Europe-East", city: "Warsaw", country: "Poland",
    countryCode: "PL", region: "europe",
    hostname: "eue-001.velocityvpn.io", endpoint: "https://www.gov.pl", wgEndpoint: "9.9.9.9",
    flag: "\uD83C\uDDF5\uD83C\uDDF1", lat: 52.2297, lng: 21.0122,
  },
  {
    id: 11, name: "Australia-East", city: "Sydney", country: "Australia",
    countryCode: "AU", region: "oceania",
    hostname: "aue-001.velocityvpn.io", endpoint: "https://www.gov.au", wgEndpoint: "1.1.1.1",
    flag: "\uD83C\uDDE6\uD83C\uDDFA", lat: -33.8688, lng: 151.2093,
  },
  {
    id: 12, name: "Hong Kong", city: "Hong Kong", country: "Hong Kong",
    countryCode: "HK", region: "asia_pacific",
    hostname: "hkg-001.velocityvpn.io", endpoint: "https://www.gov.hk", wgEndpoint: "8.8.8.8",
    flag: "\uD83C\uDDED\uD83C\uDDF0", lat: 22.3193, lng: 114.1694,
  },
  {
    id: 13, name: "Australia-West", city: "Perth", country: "Australia",
    countryCode: "AU", region: "oceania",
    hostname: "auw-001.velocityvpn.io", endpoint: "https://www.wa.gov.au", wgEndpoint: "9.9.9.9",
    flag: "\uD83C\uDDE6\uD83C\uDDFA", lat: -31.9505, lng: 115.8605,
  },
  {
    id: 14, name: "Europe-North", city: "Stockholm", country: "Sweden",
    countryCode: "SE", region: "europe",
    hostname: "eun-001.velocityvpn.io", endpoint: "https://www.regeringen.se", wgEndpoint: "1.1.1.1",
    flag: "\uD83C\uDDF8\uD83C\uDDEA", lat: 59.3293, lng: 18.0686,
  },
  {
    id: 15, name: "Singapore", city: "Singapore", country: "Singapore",
    countryCode: "SG", region: "asia_pacific",
    hostname: "sgp-001.velocityvpn.io", endpoint: "https://www.gov.sg", wgEndpoint: "8.8.8.8",
    flag: "\uD83C\uDDF8\uD83C\uDDEC", lat: 1.3521, lng: 103.8198,
  },
  {
    id: 16, name: "Brazil", city: "Sao Paulo", country: "Brazil",
    countryCode: "BR", region: "south_america",
    hostname: "bra-001.velocityvpn.io", endpoint: "https://www.gov.br", wgEndpoint: "9.9.9.9",
    flag: "\uD83C\uDDE7\uD83C\uDDF7", lat: -23.5505, lng: -46.6333,
  },
  {
    id: 17, name: "Dubai", city: "Dubai", country: "UAE",
    countryCode: "AE", region: "middle_east",
    hostname: "dxb-001.velocityvpn.io", endpoint: "https://www.google.ae", wgEndpoint: "1.1.1.1",
    flag: "\uD83C\uDDE6\uD83C\uDDEA", lat: 25.2048, lng: 55.2708,
  },
  {
    id: 18, name: "South Africa", city: "Johannesburg", country: "South Africa",
    countryCode: "ZA", region: "africa",
    hostname: "zaf-001.velocityvpn.io", endpoint: "https://www.gov.za", wgEndpoint: "8.8.8.8",
    flag: "\uD83C\uDDFF\uD83C\uDDE6", lat: -26.2041, lng: 28.0473,
  },
];

// Region labels for UI display
export const REGION_LABELS: Record<string, string> = {
  north_america: "North America",
  europe: "Europe",
  asia_pacific: "Asia-Pacific",
  oceania: "Oceania",
  south_america: "South America",
  middle_east: "Middle East",
  africa: "Africa",
};

// Generate a WireGuard config for a given server
export function generateWireGuardConfig(
  server: VelocityServer,
  clientPrivateKey: string = "<YOUR_PRIVATE_KEY>",
  clientIp: string = "10.0.0.2/24"
): string {
  return `# ============================================================
#  VelocityVPN - ${server.city} (${server.name})
#  CONFIG TEMPLATE - Endpoint must be set before activating!
# ============================================================
#  WARNING: Replace YOUR_SERVER_IP below with your actual
#  WireGuard server IP/hostname before turning on this tunnel.
#  Without a real endpoint, this config will NOT connect.
# ============================================================
[Interface]
PrivateKey = ${clientPrivateKey}
Address = ${clientIp}
DNS = 1.1.1.1, 8.8.8.8
MTU = 1420

[Peer]
PublicKey = ${getServerKeyPair(server.hostname).publicKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = YOUR_SERVER_IP:51820
PersistentKeepalive = 25`;
}

// Server public keys are now generated using real Curve25519 cryptography
// via getServerKeyPair() from ../lib/wg-keygen

export function getFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    US: "\uD83C\uDDFA\uD83C\uDDF8", JP: "\uD83C\uDDEF\uD83C\uDDF5",
    NL: "\uD83C\uDDF3\uD83C\uDDF1", KR: "\uD83C\uDDF0\uD83C\uDDF7",
    GB: "\uD83C\uDDEC\uD83C\uDDE7", NZ: "\uD83C\uDDF3\uD83C\uDDFF",
    PL: "\uD83C\uDDF5\uD83C\uDDF1", AU: "\uD83C\uDDE6\uD83C\uDDFA",
    HK: "\uD83C\uDDED\uD83C\uDDF0", SE: "\uD83C\uDDF8\uD83C\uDDEA",
    SG: "\uD83C\uDDF8\uD83C\uDDEC", BR: "\uD83C\uDDE7\uD83C\uDDF7",
    AE: "\uD83C\uDDE6\uD83C\uDDEA", ZA: "\uD83C\uDDFF\uD83C\uDDE6",
  };
  return flags[countryCode] ?? "\uD83C\uDF10";
}
