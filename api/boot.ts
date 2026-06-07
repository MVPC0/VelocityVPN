import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { HttpBindings } from "@hono/node-server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./router";
import { createContext } from "./context";
import { env } from "./lib/env";
import { createOAuthCallbackHandler } from "./kimi/auth";
import { Paths } from "@contracts/constants";
import fs from "fs";
import path from "path";

const app = new Hono<{ Bindings: HttpBindings }>();

app.use(bodyLimit({ maxSize: 50 * 1024 * 1024 }));
app.get(Paths.oauthCallback, createOAuthCallbackHandler());
app.use("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext,
  });
});
app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

// SPA fallback: serve index.html for all non-API routes
const distPath = path.resolve(import.meta.dirname, "../dist/public");

app.get("*", (c) => {
  const url = new URL(c.req.url);
  // Don't interfere with API routes
  if (url.pathname.startsWith("/api/")) {
    return c.notFound();
  }
  // Try to serve static file first
  const filePath = path.join(distPath, url.pathname);
  if (url.pathname !== "/" && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return new Response(fs.readFileSync(filePath), {
      headers: { "content-type": getContentType(filePath) },
    });
  }
  // Fall back to index.html for client-side routing
  const indexPath = path.resolve(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    return new Response(fs.readFileSync(indexPath, "utf-8"), {
      headers: { "content-type": "text/html" },
    });
  }
  return c.json({ error: "Not Found" }, 404);
});

function getContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
  };
  return types[ext] || "application/octet-stream";
}

export default app;

if (env.isProduction) {
  const { serve } = await import("@hono/node-server");
  const port = parseInt(process.env.PORT || "3000");
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}
