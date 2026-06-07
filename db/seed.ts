import { getDb } from "../api/queries/connection";
import { vpnServers, pingResults } from "./schema";
import { sql } from "drizzle-orm";

const servers = [
  {
    name: "US-East-1",
    city: "New York",
    country: "United States",
    countryCode: "US",
    region: "north_america",
    hostname: "ny-us.velocityvpn.com",
    ipAddress: "192.168.1.10",
    port: 51820,
    protocol: "wireguard" as const,
    publicKey: "NY_PUBLIC_KEY_VELOCITY_VPN_001",
    lat: "40.7128",
    lng: "-74.0060",
  },
  {
    name: "US-West-1",
    city: "Los Angeles",
    country: "United States",
    countryCode: "US",
    region: "north_america",
    hostname: "la-us.velocityvpn.com",
    ipAddress: "192.168.1.11",
    port: 51820,
    protocol: "wireguard" as const,
    publicKey: "LA_PUBLIC_KEY_VELOCITY_VPN_002",
    lat: "34.0522",
    lng: "-118.2437",
  },
  {
    name: "EU-West-1",
    city: "London",
    country: "United Kingdom",
    countryCode: "GB",
    region: "europe",
    hostname: "lon-uk.velocityvpn.com",
    ipAddress: "192.168.2.10",
    port: 51820,
    protocol: "wireguard" as const,
    publicKey: "LON_PUBLIC_KEY_VELOCITY_VPN_003",
    lat: "51.5074",
    lng: "-0.1278",
  },
  {
    name: "EU-Central-1",
    city: "Frankfurt",
    country: "Germany",
    countryCode: "DE",
    region: "europe",
    hostname: "fra-de.velocityvpn.com",
    ipAddress: "192.168.2.11",
    port: 51820,
    protocol: "wireguard" as const,
    publicKey: "FRA_PUBLIC_KEY_VELOCITY_VPN_004",
    lat: "50.1109",
    lng: "8.6821",
  },
  {
    name: "AP-Northeast-1",
    city: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    region: "asia_pacific",
    hostname: "tok-jp.velocityvpn.com",
    ipAddress: "192.168.3.10",
    port: 51820,
    protocol: "wireguard" as const,
    publicKey: "TOK_PUBLIC_KEY_VELOCITY_VPN_005",
    lat: "35.6762",
    lng: "139.6503",
  },
  {
    name: "AP-Southeast-1",
    city: "Singapore",
    country: "Singapore",
    countryCode: "SG",
    region: "asia_pacific",
    hostname: "sin-sg.velocityvpn.com",
    ipAddress: "192.168.3.11",
    port: 51820,
    protocol: "wireguard" as const,
    publicKey: "SIN_PUBLIC_KEY_VELOCITY_VPN_006",
    lat: "1.3521",
    lng: "103.8198",
  },
  {
    name: "AP-Southeast-2",
    city: "Sydney",
    country: "Australia",
    countryCode: "AU",
    region: "asia_pacific",
    hostname: "syd-au.velocityvpn.com",
    ipAddress: "192.168.3.12",
    port: 51820,
    protocol: "wireguard" as const,
    publicKey: "SYD_PUBLIC_KEY_VELOCITY_VPN_007",
    lat: "-33.8688",
    lng: "151.2093",
  },
  {
    name: "SA-East-1",
    city: "Sao Paulo",
    country: "Brazil",
    countryCode: "BR",
    region: "south_america",
    hostname: "sao-br.velocityvpn.com",
    ipAddress: "192.168.4.10",
    port: 51820,
    protocol: "wireguard" as const,
    publicKey: "SAO_PUBLIC_KEY_VELOCITY_VPN_008",
    lat: "-23.5505",
    lng: "-46.6333",
  },
  {
    name: "ME-South-1",
    city: "Dubai",
    country: "UAE",
    countryCode: "AE",
    region: "middle_east",
    hostname: "dxb-ae.velocityvpn.com",
    ipAddress: "192.168.5.10",
    port: 51820,
    protocol: "wireguard" as const,
    publicKey: "DXB_PUBLIC_KEY_VELOCITY_VPN_009",
    lat: "25.2048",
    lng: "55.2708",
  },
  {
    name: "EU-North-1",
    city: "Stockholm",
    country: "Sweden",
    countryCode: "SE",
    region: "europe",
    hostname: "sto-se.velocityvpn.com",
    ipAddress: "192.168.2.12",
    port: 51820,
    protocol: "wireguard" as const,
    publicKey: "STO_PUBLIC_KEY_VELOCITY_VPN_010",
    lat: "59.3293",
    lng: "18.0686",
  },
];

async function seed() {
  const db = getDb();

  console.log("Seeding VPN servers...");

  for (const server of servers) {
    // Check if server already exists
    const existing = await db
      .select()
      .from(vpnServers)
      .where(sql`${vpnServers.hostname} = ${server.hostname}`)
      .limit(1);

    if (existing.length > 0) {
      console.log(`  Server ${server.name} (${server.city}) already exists, skipping`);
      continue;
    }

    const [result] = await db.insert(vpnServers).values(server).$returningId();
    console.log(`  Created server ${server.name} (${server.city}) - ID: ${result.id}`);

    // Seed initial ping result (simulated realistic values)
    const latencyMap: Record<string, number> = {
      "ny-us.velocityvpn.com": 18,
      "la-us.velocityvpn.com": 35,
      "lon-uk.velocityvpn.com": 22,
      "fra-de.velocityvpn.com": 20,
      "tok-jp.velocityvpn.com": 42,
      "sin-sg.velocityvpn.com": 48,
      "syd-au.velocityvpn.com": 58,
      "sao-br.velocityvpn.com": 68,
      "dxb-ae.velocityvpn.com": 52,
      "sto-se.velocityvpn.com": 25,
    };

    const baseLatency = latencyMap[server.hostname] ?? 30;
    await db.insert(pingResults).values({
      serverId: result.id,
      latency: baseLatency + Math.floor(Math.random() * 10),
      jitter: Math.floor(Math.random() * 4) + 1,
      packetLoss: 0,
    });
  }

  console.log("Seed complete!");
}

seed().catch(console.error);
