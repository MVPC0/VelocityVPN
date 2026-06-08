import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { users } from "@db/schema";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "crypto";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const JWT_SECRET = new TextEncoder().encode(
  process.env.EMAIL_AUTH_SECRET || "velocityvpn-email-auth-secret-key-2024"
);

async function createToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId), type: "google" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyGoogleToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: 60 });
    return payload.sub ? parseInt(payload.sub, 10) : null;
  } catch {
    return null;
  }
}

export const googleAuthRouter = createRouter({
  getUrl: publicQuery.query(() => {
    if (!GOOGLE_CLIENT_ID) {
      return { url: null, error: "Google OAuth not configured" };
    }

    const redirectUri = `${process.env.APP_URL || ""}/api/trpc/google.callback`;
    const state = randomBytes(32).toString("hex");

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");

    return { url: url.toString(), state };
  }),

  callback: publicQuery
    .input(
      z.object({
        code: z.string(),
      })
    )
    .query(async ({ input }) => {
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return { error: "Google OAuth not configured" };
      }

      const redirectUri = `${process.env.APP_URL || ""}/api/trpc/google.callback`;

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: input.code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        return { error: "Failed to exchange code" };
      }

      const tokenData = await tokenRes.json();

      // Get user info
      const userRes = await fetch(
        `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`
      );

      if (!userRes.ok) {
        return { error: "Failed to get user info" };
      }

      const googleUser = await userRes.json();

      // Find or create user
      const db = getDb();
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.email, googleUser.email))
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
          unionId: `google_${googleUser.id}`,
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
