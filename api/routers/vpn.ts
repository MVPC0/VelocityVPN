import { z } from "zod";
import { createRouter, publicQuery, authedQuery, authedMutation } from "../middleware";
import { getDb } from "../queries/connection";
import { vpnServers, userConnections, pingResults } from "../../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomInt } from "crypto";

let seedPromise: Promise<void> | null = null;

const DEFAULT_SERVERS = [
  { name: "US-East-1", city: "New York", country: "United States", countryCode: "US", region: "north_america", hostname: "ny-us.velocityvpn.com", ipAddress: "192.168.1.10", port: 51820, protocol: "wireguard" as const, publicKey: "NY_KEY_001", lat: "40.7128", lng: "-74.0060" },
  { name: "US-West-1", city: "Los Angeles", country: "United States", countryCode: "US", region: "north_america", hostname: "la-us.velocityvpn.com", ipAddress: "192.168.1.11", port: 51820, protocol: "wireguard" as const, publicKey: "LA_KEY_002", lat: "34.0522", lng: "-118.2437" },
  { name: "EU-West-1", city: "London", country: "United Kingdom", countryCode: "GB", region: "europe", hostname: "lon-uk.velocityvpn.com", ipAddress: "192.168.2.10", port: 51820, protocol: "wireguard" as const, publicKey: "LON_KEY_003", lat: "51.5074", lng: "-0.1278" },
  { name: "EU-Central-1", city: "Frankfurt", country: "Germany", countryCode: "DE", region: "europe", hostname: "fra-de.velocityvpn.com", ipAddress: "192.168.2.11", port: 51820, protocol: "wireguard" as const, publicKey: "FRA_KEY_004", lat: "50.1109", lng: "8.6821" },
  { name: "AP-Northeast-1", city: "Tokyo", country: "Japan", countryCode: "JP", region: "asia_pacific", hostname: "tok-jp.velocityvpn.com", ipAddress: "192.168.3.10", port: 51820, protocol: "wireguard" as const, publicKey: "TOK_KEY_005", lat: "35.6762", lng: "139.6503" },
  { name: "AP-Southeast-1", city: "Singapore", country: "Singapore", countryCode: "SG", region: "asia_pacific", hostname: "sin-sg.velocityvpn.com", ipAddress: "192.168.3.11", port: 51820, protocol: "wireguard" as const, publicKey: "SIN_KEY_006", lat: "1.3521", lng: "103.8198" },
  { name: "AP-Southeast-2", city: "Sydney", country: "Australia", countryCode: "AU", region: "asia_pacific", hostname: "syd-au.velocityvpn.com", ipAddress: "192.168.3.12", port: 51820, protocol: "wireguard" as const, publicKey: "SYD_KEY_007", lat: "-33.8688", lng: "151.2093" },
  { name: "SA-East-1", city: "Sao Paulo", country: "Brazil", countryCode: "BR", region: "south_america", hostname: "sao-br.velocityvpn.com", ipAddress: "192.168.4.10", port: 51820, protocol: "wireguard" as const, publicKey: "SAO_KEY_008", lat: "-23.5505", lng: "-46.6333" },
  { name: "ME-South-1", city: "Dubai", country: "UAE", countryCode: "AE", region: "middle_east", hostname: "dxb-ae.velocityvpn.com", ipAddress: "192.168.5.10", port: 51820, protocol: "wireguard" as const, publicKey: "DXB_KEY_009", lat: "25.2048", lng: "55.2708" },
  { name: "EU-North-1", city: "Stockholm", country: "Sweden", countryCode: "SE", region: "europe", hostname: "sto-se.velocityvpn.com", ipAddress: "192.168.2.12", port: 51820, protocol: "wireguard" as const, publicKey: "STO_KEY_010", lat: "59.3293", lng: "18.0686" },
];

const PING_BASE: Record<string, number> = {
  "ny-us.velocityvpn.com": 18, "la-us.velocityvpn.com": 35, "lon-uk.velocityvpn.com": 22,
  "fra-de.velocityvpn.com": 20, "tok-jp.velocityvpn.com": 42, "sin-sg.velocityvpn.com": 48,
  "syd-au.velocityvpn.com": 58, "sao-br.velocityvpn.com": 68, "dxb-ae.velocityvpn.com": 52,
  "sto-se.velocityvpn.com": 25,
};

function ensureSeeded(): Promise<void> {
  // Memoize the in-flight seed so concurrent callers share it; reset on failure to retry later
  if (!seedPromise) {
    seedPromise = seedServers().catch((e) => {
      seedPromise = null;
      console.error("Seed error:", e);
    });
  }
  return seedPromise;
}

async function seedServers() {
  const db = getDb();
  {
    const existing = await db.select().from(vpnServers).limit(1);
    if (existing.length > 0) return;
    for (const s of DEFAULT_SERVERS) {
      await db.insert(vpnServers).values(s);
    }
    const all = await db.select().from(vpnServers);
    for (const s of all) {
      const base = PING_BASE[s.hostname] ?? 30;
      await db.insert(pingResults).values({
        serverId: s.id, latency: base + Math.floor(Math.random() * 10),
        jitter: Math.floor(Math.random() * 4) + 1, packetLoss: 0,
      });
    }
  }
}

// HTTP-based timing probe to a server hostname. A fast connection refusal still gives a
// round-trip estimate; a timeout means the host is unreachable and yields null.
async function probe(hostname: string, port: number, timeoutMs: number): Promise<number | null> {
  const start = Date.now();
  try {
    await fetch(`http://${hostname}:${port}`, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      return null;
    }
    // Connection refused/reset: still a valid round-trip timing
  }
  return Date.now() - start;
}

async function measurePing(hostname: string, port: number): Promise<{ latency: number; jitter: number } | null> {
  const latency = await probe(hostname, port, 5000);
  if (latency === null) return null;

  // Take multiple samples for jitter calculation
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const sample = await probe(hostname, port, 3000);
    if (sample !== null) samples.push(sample);
  }
  const jitter = samples.length > 1 ? Math.max(...samples) - Math.min(...samples) : 0;
  return { latency: Math.min(latency, 999), jitter: Math.min(jitter, 99) };
}

export const vpnRouter = createRouter({
  // List all active VPN servers
  listServers: publicQuery.query(async () => {
    await ensureSeeded();
    const db = getDb();
    const servers = await db
      .select()
      .from(vpnServers)
      .where(eq(vpnServers.isActive, true))
      .orderBy(vpnServers.region);

    // Get latest ping for each server
    const serversWithPing = await Promise.all(
      servers.map(async (server) => {
        const latestPing = await db
          .select()
          .from(pingResults)
          .where(eq(pingResults.serverId, server.id))
          .orderBy(desc(pingResults.createdAt))
          .limit(1);

        return {
          ...server,
          ping: latestPing[0]?.latency ?? null,
          jitter: latestPing[0]?.jitter ?? null,
        };
      })
    );

    return serversWithPing;
  }),

  // Get a single server with its ping
  getServer: publicQuery
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const server = await db
        .select()
        .from(vpnServers)
        .where(eq(vpnServers.id, input.id))
        .limit(1);

      if (!server[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Server not found" });

      const latestPing = await db
        .select()
        .from(pingResults)
        .where(eq(pingResults.serverId, input.id))
        .orderBy(desc(pingResults.createdAt))
        .limit(1);

      return {
        ...server[0],
        ping: latestPing[0]?.latency ?? null,
        jitter: latestPing[0]?.jitter ?? null,
      };
    }),

  // Measure real ping to a server and store the result
  measurePing: authedMutation
    .input(z.object({ serverId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const server = await db
        .select()
        .from(vpnServers)
        .where(eq(vpnServers.id, input.serverId))
        .limit(1);

      if (!server[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Server not found" });

      const result = await measurePing(server[0].hostname, server[0].port);
      if (!result) {
        return { latency: null, jitter: null, serverId: input.serverId, reachable: false };
      }
      const { latency, jitter } = result;

      // Store the result
      await db.insert(pingResults).values({
        serverId: input.serverId,
        latency,
        jitter,
        packetLoss: 0,
      });

      return { latency, jitter, serverId: input.serverId, reachable: true };
    }),

  // Connect to a VPN server (authenticated)
  connect: authedMutation
    .input(z.object({ serverId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const userId = ctx.user.id;

      // Check if already connected
      const existing = await db
        .select()
        .from(userConnections)
        .where(
          and(
            eq(userConnections.userId, userId),
            eq(userConnections.status, "connected")
          )
        )
        .limit(1);

      if (existing[0]) {
        // Disconnect existing first
        await db
          .update(userConnections)
          .set({
            status: "disconnected",
            disconnectedAt: new Date(),
            duration: Math.floor((Date.now() - existing[0].connectedAt!.getTime()) / 1000),
          })
          .where(eq(userConnections.id, existing[0].id));
      }

      const server = await db
        .select()
        .from(vpnServers)
        .where(eq(vpnServers.id, input.serverId))
        .limit(1);

      if (!server[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Server not found" });

      // Generate a VPN config for the user
      // 10.8.0.0/16 client pool (host octet 2-254; .1 reserved for the server)
      const assignedIp = `10.8.${randomInt(0, 256)}.${randomInt(2, 255)}`;

      // Get client IP from request headers
      const forwardedFor = ctx.req.headers.get("x-forwarded-for");
      const clientIp = forwardedFor?.split(",")[0]?.trim() ?? "unknown";

      // Create connection record
      await db.insert(userConnections).values({
        userId,
        serverId: input.serverId,
        status: "connected",
        clientIp,
        assignedIp,
        protocol: server[0].protocol,
        connectedAt: new Date(),
        bytesSent: 0,
        bytesReceived: 0,
      });

      // Increment server load
      await db
        .update(vpnServers)
        .set({ load: sql`LEAST(100, ${vpnServers.load} + 1)` })
        .where(eq(vpnServers.id, input.serverId));

      return {
        server: server[0],
        assignedIp,
        config: {
          // The client generates its own private key; the server never sees it
          privateKey: null,
          address: `${assignedIp}/32`,
          dns: "1.1.1.1, 8.8.8.8",
          endpoint: `${server[0].hostname}:${server[0].port}`,
          publicKey: server[0].publicKey ?? null,
          allowedIPs: "0.0.0.0/0, ::/0",
        },
      };
    }),

  // Disconnect from VPN (authenticated)
  disconnect: authedMutation.mutation(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const active = await db
      .select()
      .from(userConnections)
      .where(
        and(
          eq(userConnections.userId, userId),
          eq(userConnections.status, "connected")
        )
      )
      .limit(1);

    if (!active[0]) throw new TRPCError({ code: "NOT_FOUND", message: "No active connection" });

    const duration = Math.floor((Date.now() - active[0].connectedAt!.getTime()) / 1000);

    await db
      .update(userConnections)
      .set({
        status: "disconnected",
        disconnectedAt: new Date(),
        duration,
        // Byte counters are not tracked server-side yet; keep the stored values
      })
      .where(eq(userConnections.id, active[0].id));

    // Decrement server load
    await db
      .update(vpnServers)
      .set({ load: sql`GREATEST(0, ${vpnServers.load} - 1)` })
      .where(eq(vpnServers.id, active[0].serverId));

    return {
      success: true,
      duration,
      bytesSent: active[0].bytesSent ?? 0,
      bytesReceived: active[0].bytesReceived ?? 0,
    };
  }),

  // Get current connection status (authenticated)
  getConnectionStatus: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const active = await db
      .select()
      .from(userConnections)
      .where(
        and(
          eq(userConnections.userId, userId),
          eq(userConnections.status, "connected")
        )
      )
      .limit(1);

    if (!active[0]) return null;

    const server = await db
      .select()
      .from(vpnServers)
      .where(eq(vpnServers.id, active[0].serverId))
      .limit(1);

    const duration = Math.floor((Date.now() - active[0].connectedAt!.getTime()) / 1000);

    return {
      ...active[0],
      server: server[0] ?? null,
      duration,
    };
  }),

  // Get connection history (authenticated)
  getConnectionHistory: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const connections = await db
      .select()
      .from(userConnections)
      .where(eq(userConnections.userId, userId))
      .orderBy(desc(userConnections.createdAt))
      .limit(50);

    // Join with server data
    const withServers = await Promise.all(
      connections.map(async (conn) => {
        const server = await db
          .select()
          .from(vpnServers)
          .where(eq(vpnServers.id, conn.serverId))
          .limit(1);
        return { ...conn, server: server[0] ?? null };
      })
    );

    return withServers;
  }),

  // Get connection stats (authenticated)
  getStats: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;

    const allConnections = await db
      .select()
      .from(userConnections)
      .where(eq(userConnections.userId, userId));

    const totalSessions = allConnections.length;
    const totalDuration = allConnections.reduce((sum, c) => sum + (c.duration ?? 0), 0);
    const totalDataSent = allConnections.reduce((sum, c) => sum + (c.bytesSent ?? 0), 0);
    const totalDataReceived = allConnections.reduce((sum, c) => sum + (c.bytesReceived ?? 0), 0);
    const totalData = totalDataSent + totalDataReceived;

    return {
      totalSessions,
      totalDuration,
      totalDataSent,
      totalDataReceived,
      totalData,
    };
  }),
});
