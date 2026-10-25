import { randomBytes } from "crypto";

let cached: Uint8Array | null = null;

/**
 * Secret used to sign email/Google auth JWTs.
 * - Production: EMAIL_AUTH_SECRET (>= 32 chars) is required; throws otherwise.
 * - Development: falls back to a random per-process secret (tokens reset on restart).
 * Evaluated lazily so the frontend-only (Netlify) build never needs it.
 */
export function getAuthSecret(): Uint8Array {
  if (cached) return cached;
  const secret = process.env.EMAIL_AUTH_SECRET;
  if (secret && secret.length >= 32) {
    cached = new TextEncoder().encode(secret);
    return cached;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("EMAIL_AUTH_SECRET must be set (at least 32 characters)");
  }
  console.warn("[auth] EMAIL_AUTH_SECRET not set; using an ephemeral dev secret");
  cached = randomBytes(32);
  return cached;
}
