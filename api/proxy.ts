import { Hono } from "hono";

// ─── HTTP Forward Proxy ───────────────────────────────────────
// Handles both regular HTTP proxy requests and HTTPS CONNECT tunnels
// This is what the browser extension connects to for VPN routing

const proxyApp = new Hono();

// Forward proxy: GET/POST/... requests with target URL
proxyApp.all("/proxy", async (c) => {
  const targetUrl = c.req.query("url");
  if (!targetUrl) {
    return c.json({ error: "Missing url parameter" }, 400);
  }

  try {
    // Strip proxy-specific headers
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      if (!["host", "connection", "content-length", "proxy-connection"].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    const response = await fetch(targetUrl, {
      method: c.req.method,
      headers,
      body: ["GET", "HEAD"].includes(c.req.method) ? undefined : await c.req.blob(),
      redirect: "follow",
    });

    // Forward response headers (filter out problematic ones)
    const respHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (!["content-encoding", "content-length", "transfer-encoding"].includes(key.toLowerCase())) {
        respHeaders[key] = value;
      }
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  } catch (error) {
    console.error("Proxy fetch error:", error);
    return c.json({ error: "Proxy fetch failed" }, 502);
  }
});

// Health check for proxy
proxyApp.get("/proxy/health", (c) => {
  return c.json({ status: "ok", type: "velocityvpn-proxy" });
});

export default proxyApp;
