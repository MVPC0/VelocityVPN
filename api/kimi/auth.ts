import type { Context } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import { timingSafeEqual } from "crypto";
import * as jose from "jose";
import * as cookie from "cookie";
import { env } from "../lib/env";
import { getSessionCookieOptions } from "../lib/cookies";
import { Paths, Session } from "@contracts/constants";
import { Errors } from "@contracts/errors";
import { signSessionToken, verifySessionToken } from "./session";
import { users as kimiUsers } from "./platform";
import { findUserByUnionId, upsertUser } from "../queries/users";
import type { TokenResponse } from "./types";

async function exchangeAuthCode(
  code: string,
  redirectUri: string,
): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: env.appId,
    redirect_uri: redirectUri,
    client_secret: env.appSecret,
  });

  const resp = await fetch(`${env.kimiAuthUrl}/api/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Token exchange failed (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<TokenResponse>;
}

const jwks = jose.createRemoteJWKSet(
  new URL(`${env.kimiAuthUrl}/api/.well-known/jwks.json`),
);

async function verifyAccessToken(
  accessToken: string,
): Promise<{ userId: string; clientId: string }> {
  const { payload } = await jose.jwtVerify(accessToken, jwks);
  const userId = payload.user_id as string;
  const clientId = payload.client_id as string;
  if (!userId) {
    throw new Error("user_id missing from access token");
  }
  return { userId, clientId };
}

export async function authenticateRequest(headers: Headers) {
  const cookies = cookie.parse(headers.get("cookie") || "");
  const token = cookies[Session.cookieName];
  if (!token) {
    console.warn("[auth] No session cookie found in request.");
    throw Errors.forbidden("Invalid authentication token.");
  }
  const claim = await verifySessionToken(token);
  if (!claim) {
    throw Errors.forbidden("Invalid authentication token.");
  }
  const user = await findUserByUnionId(claim.unionId);
  if (!user) {
    throw Errors.forbidden("User not found. Please re-login.");
  }
  return user;
}

export const OAUTH_NONCE_COOKIE = "oauth_nonce";

/** Redirect URIs we are willing to send to the token endpoint. */
function allowedRedirectUris(requestUrl: string): Set<string> {
  const allowed = new Set<string>();
  const origins = [new URL(requestUrl).origin];
  if (process.env.APP_URL) origins.push(new URL(process.env.APP_URL).origin);
  for (const origin of origins) allowed.add(`${origin}${Paths.oauthCallback}`);
  for (const extra of (process.env.OAUTH_REDIRECT_ALLOWLIST || "").split(",")) {
    if (extra.trim()) allowed.add(extra.trim());
  }
  return allowed;
}

/**
 * State is either base64(JSON {redirectUri, nonce}) or legacy base64(redirectUri).
 * The nonce, when present, must match the HttpOnly cookie set by the login initiator.
 */
function parseState(state: string): { redirectUri: string; nonce?: string } {
  const decoded = atob(state);
  try {
    const parsed = JSON.parse(decoded) as { redirectUri?: unknown; nonce?: unknown };
    if (typeof parsed.redirectUri === "string") {
      return {
        redirectUri: parsed.redirectUri,
        nonce: typeof parsed.nonce === "string" ? parsed.nonce : undefined,
      };
    }
  } catch {
    // legacy format
  }
  return { redirectUri: decoded };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createOAuthCallbackHandler() {
  return async (c: Context) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    const errorDescription = c.req.query("error_description");

    if (error) {
      if (error === "access_denied") {
        return c.redirect("/", 302);
      }
      return c.json(
        { error, error_description: errorDescription },
        400,
      );
    }

    if (!code || !state) {
      return c.json({ error: "code and state are required" }, 400);
    }

    try {
      let parsedState: { redirectUri: string; nonce?: string };
      try {
        parsedState = parseState(state);
      } catch {
        return c.json({ error: "Invalid state" }, 400);
      }
      const { redirectUri, nonce } = parsedState;
      if (!allowedRedirectUris(c.req.url).has(redirectUri)) {
        return c.json({ error: "Invalid redirect URI" }, 400);
      }
      const cookieNonce = getCookie(c, OAUTH_NONCE_COOKIE);
      if ((nonce || cookieNonce) && !(nonce && cookieNonce && safeEqual(nonce, cookieNonce))) {
        return c.json({ error: "Invalid OAuth state" }, 400);
      }
      if (cookieNonce) deleteCookie(c, OAUTH_NONCE_COOKIE, { path: "/" });
      const tokenResp = await exchangeAuthCode(code, redirectUri);
      const { userId } = await verifyAccessToken(tokenResp.access_token);
      const userProfile = await kimiUsers.getProfile(tokenResp.access_token);
      if (!userProfile) {
        throw new Error("Failed to fetch user profile from Kimi Open");
      }

      await upsertUser({
        unionId: userId,
        name: userProfile.name,
        avatar: userProfile.avatar_url,
        lastSignInAt: new Date(),
      });

      const token = await signSessionToken({
        unionId: userId,
        clientId: env.appId,
      });

      const cookieOpts = getSessionCookieOptions(c.req.raw.headers);
      setCookie(c, Session.cookieName, token, {
        ...cookieOpts,
        maxAge: Session.maxAgeMs / 1000,
      });

      return c.redirect("/", 302);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      return c.json({ error: "OAuth callback failed" }, 500);
    }
  };
}

export { exchangeAuthCode, verifyAccessToken };
