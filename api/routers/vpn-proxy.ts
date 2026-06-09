import { z } from "zod";
import { createRouter, authedMutation, authedQuery } from "../middleware";
import { TRPCError } from "@trpc/server";
import { VELOCITY_SERVERS } from "../../src/data/velocity-servers";

// ─── VPN Proxy Router ─────────────────────────────────────────
// Provides a real HTTP proxy tunnel for authenticated premium users.
// Traffic flows: Browser → WSS/TLS → Backend → Destination → Backend → Browser
// The destination sees the backend's IP, masking the user's real IP.

// In-memory proxy sessions (production: use Redis)
interface ProxySession {
  userId: number;
  serverId: number;
  serverName: string;
  serverCity: string;
  serverCountryCode: string;
  connectedAt: Date;
  bytesTransferred: number;
  requestCount: number;
}

const proxySessions = new Map<string, ProxySession>();

function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

// Headers that we shouldn't forward from the client
const STRIP_HEADERS = [
  "cookie",
  "authorization",
  "host",
  "connection",
  "content-length",
];

// Timeout for proxy requests (ms)
const PROXY_TIMEOUT = 30000;

export const vpnProxyRouter = createRouter({
  // Create a new proxy session (connect to VPN tunnel)
  connect: authedMutation
    .input(z.object({ serverId: z.number().min(1).max(18) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Disconnect any existing session
      for (const [sid, sess] of proxySessions) {
        if (sess.userId === userId) {
          proxySessions.delete(sid);
        }
      }

      const server = VELOCITY_SERVERS.find((s) => s.id === input.serverId);
      if (!server) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "VPN server not found",
        });
      }

      const sessionId = generateSessionId();
      proxySessions.set(sessionId, {
        userId,
        serverId: input.serverId,
        serverName: server.name,
        serverCity: server.city,
        serverCountryCode: server.countryCode,
        connectedAt: new Date(),
        bytesTransferred: 0,
        requestCount: 0,
      });

      return {
        sessionId,
        server: {
          id: server.id,
          name: server.name,
          city: server.city,
          countryCode: server.countryCode,
          hostname: server.hostname,
        },
        connectedAt: new Date().toISOString(),
      };
    }),

  // Disconnect proxy session
  disconnect: authedMutation.mutation(({ ctx }) => {
    const userId = ctx.user.id;
    let disconnected = false;

    for (const [sid, sess] of proxySessions) {
      if (sess.userId === userId) {
        proxySessions.delete(sid);
        disconnected = true;
      }
    }

    return { success: disconnected };
  }),

  // Get current proxy session status
  status: authedQuery.query(({ ctx }) => {
    const userId = ctx.user.id;

    for (const [, sess] of proxySessions) {
      if (sess.userId === userId) {
        const server = VELOCITY_SERVERS.find((s) => s.id === sess.serverId);
        return {
          connected: true,
          sessionId: null, // Don't expose session ID
          server: server
            ? {
                id: server.id,
                name: server.name,
                city: server.city,
                countryCode: server.countryCode,
                hostname: server.hostname,
              }
            : null,
          connectedAt: sess.connectedAt.toISOString(),
          duration: Math.floor(
            (Date.now() - sess.connectedAt.getTime()) / 1000
          ),
          bytesTransferred: sess.bytesTransferred,
          requestCount: sess.requestCount,
        };
      }
    }

    return { connected: false };
  }),

  // Fetch a URL through the VPN proxy tunnel
  fetch: authedMutation
    .input(
      z.object({
        url: z.string().url(),
        method: z
          .enum(["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS", "PATCH"])
          .default("GET"),
        headers: z.record(z.string()).optional().default({}),
        body: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Verify user has an active proxy session
      let session: ProxySession | null = null;
      for (const [, sess] of proxySessions) {
        if (sess.userId === userId) {
          session = sess;
          break;
        }
      }

      if (!session) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "No active VPN tunnel. Connect to a server first.",
        });
      }

      const startTime = Date.now();

      try {
        // Build headers - strip sensitive ones, add proxy identifier
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(input.headers)) {
          if (!STRIP_HEADERS.includes(key.toLowerCase())) {
            headers[key] = value;
          }
        }

        // Add proxy identification headers
        headers["X-Forwarded-By"] = "VelocityVPN-Proxy";
        headers["X-VPN-Server"] = session.serverName;

        // Make the actual HTTP request
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), PROXY_TIMEOUT);

        const response = await fetch(input.url, {
          method: input.method,
          headers,
          body: input.body || undefined,
          signal: controller.signal,
          // @ts-ignore - next.js/node fetch extensions
          redirect: "follow",
        });

        clearTimeout(timeout);

        const responseBody = await response.text();
        const responseTime = Date.now() - startTime;

        // Update session stats
        session.requestCount++;
        session.bytesTransferred +=
          (input.body?.length || 0) + responseBody.length;

        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          responseTime,
        };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            error instanceof Error
              ? `Proxy fetch failed: ${error.message}`
              : "Proxy fetch failed",
        });
      }
    }),

  // Check the exit IP through the VPN tunnel
  checkIp: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    // Verify active session
    let hasSession = false;
    let sessionServer: { city: string; countryCode: string } | null = null;
    for (const [, sess] of proxySessions) {
      if (sess.userId === userId) {
        hasSession = true;
        sessionServer = {
          city: sess.serverCity,
          countryCode: sess.serverCountryCode,
        };
        break;
      }
    }

    if (!hasSession) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No active VPN tunnel. Connect to a server first.",
      });
    }

    try {
      // Fetch IP through our proxy (backend's IP is what the destination sees)
      const res = await fetch("https://ipapi.co/json/", {
        headers: { Accept: "application/json" },
      });
      const data = await res.json();

      return {
        ip: data.ip as string,
        city: data.city as string,
        region: data.region as string,
        country: data.country as string,
        countryCode: data.country_code as string,
        org: data.org as string,
        timezone: data.timezone as string,
        viaVpn: true,
        vpnServer: sessionServer,
      };
    } catch {
      return {
        ip: "unknown",
        city: "unknown",
        region: "unknown",
        country: "unknown",
        countryCode: "",
        org: "unknown",
        timezone: "unknown",
        viaVpn: true,
        vpnServer: sessionServer,
      };
    }
  }),
});
