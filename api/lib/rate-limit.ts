import type { Context, Next } from "hono";

type Bucket = { count: number; resetAt: number };

/**
 * Small in-memory fixed-window rate limiter keyed by client IP.
 * Suitable for a single Node process; use a shared store if you scale out.
 */
export function rateLimit({ windowMs, limit }: { windowMs: number; limit: number }) {
  const buckets = new Map<string, Bucket>();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, b] of buckets) if (b.resetAt <= now) buckets.delete(key);
  }, windowMs);
  sweep.unref?.();

  return async (c: Context, next: Next) => {
    const key =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count++;
    c.header("RateLimit-Limit", String(limit));
    c.header("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    if (bucket.count > limit) {
      c.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return c.json({ error: "Too many requests" }, 429);
    }
    await next();
  };
}
