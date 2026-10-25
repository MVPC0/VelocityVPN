import { z } from "zod";
import * as cookie from "cookie";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, timingSafeEqual } from "crypto";
import { getAuthSecret } from "../lib/auth-secret";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const STATE_COOKIE = "google_oauth_state";
const FETCH_TIMEOUT_MS = 10_000;

function redirectUri(): string {
  return `${process.env.APP_URL || ""}/api/trpc/googleAuth.callback`;
}

const googleTokenSchema = z.object({ access_token: z.string().min(1) });
const googleUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  verified_email: z.literal(true),
  name: z.string().optional(),
  picture: z.string().url().optional(),
});

async function createToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId), type: "google" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getAuthSecret());
}

export async function verifyGoogleToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), { clockTolerance: 60 });
    if (payload.type !== "google" || !payload.sub) return null;
    const id = parseInt(payload.sub, 10);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export const googleAuthRouter = createRouter({
  getUrl: publicQuery.query(({ ctx }) => {
    if (!GOOGLE_CLIENT_ID) {
      return { url: null, error: "Google OAuth not configured" };
    }

    const state = randomBytes(32).toString("hex");
    ctx.resHeaders.append(
      "Set-Cookie",
      cookie.serialize(STATE_COOKIE, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/api/trpc",
        maxAge: 10 * 60,
      }),
    );

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");

    return { url: url.toString() };
  }),

  callback: publicQuery
    .input(
      z.object({
        code: z.string().min(1).max(2048),
        state: z.string().min(1).max(256),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return { error: "Google OAuth not configured" };
      }

      const expectedState = cookie.parse(ctx.req.headers.get("cookie") || "")[STATE_COOKIE];
      const a = Buffer.from(input.state);
      const b = Buffer.from(expectedState || "");
      if (!expectedState || a.length !== b.length || !timingSafeEqual(a, b)) {
        return { error: "Invalid OAuth state" };
      }
      ctx.resHeaders.append(
        "Set-Cookie",
        cookie.serialize(STATE_COOKIE, "", { path: "/api/trpc", maxAge: 0 }),
      );

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: input.code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri(),
          grant_type: "authorization_code",
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!tokenRes.ok) {
        return { error: "Failed to exchange code" };
      }

      const tokenData = googleTokenSchema.safeParse(await tokenRes.json());
      if (!tokenData.success) {
        return { error: "Failed to exchange code" };
      }

      // Get user info
      const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.data.access_token}` },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });

      if (!userRes.ok) {
        return { error: "Failed to get user info" };
      }

      const parsedUser = googleUserSchema.safeParse(await userRes.json());
      if (!parsedUser.success) {
        return { error: "Google account email is not verified" };
      }
      const googleUser = parsedUser.data;
      const unionId = `google_${googleUser.id}`;

      // Find or create user by Google account id (never link by email alone)
      const db = getDb();
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.unionId, unionId))
        .limit(1);

      let userId: number;

      if (existing.length > 0) {
        userId = existing[0].id;
        await db
          .update(users)
          .set({ lastSignInAt: new Date() })
          .where(eq(users.id, userId));
      } else {
        const result = await db.insert(users).values({
          unionId,
          name: googleUser.name || googleUser.email.split("@")[0],
          email: googleUser.email,
          avatar: googleUser.picture,
          role: "user",
        });
        userId = Number(result[0].insertId);
      }

      const token = await createToken(userId);

      return {
        success: true,
        token,
        user: {
          id: userId,
          email: googleUser.email,
          name: googleUser.name,
        },
      };
    }),
});
