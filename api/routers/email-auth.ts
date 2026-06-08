import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { emailUsers } from "@db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, pbkdf2Sync } from "crypto";

const JWT_SECRET = new TextEncoder().encode(
  process.env.EMAIL_AUTH_SECRET || "velocityvpn-email-auth-secret-key-2024"
);

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  const check = pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
  return hash === check;
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId), type: "email" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
}

export async function verifyEmailToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: 60 });
    return payload.sub ? parseInt(payload.sub, 10) : null;
  } catch {
    return null;
  }
}

// Helper: get trial status for a user
function getTrialStatus(user: typeof emailUsers.$inferSelect) {
  const now = new Date();
  const started = user.trialStartedAt;
  const days = user.trialDays;
  const isSubscribed = user.isSubscribed;

  if (isSubscribed) {
    return { status: "premium" as const, daysLeft: null, expired: false };
  }

  if (!started) {
    return { status: "no_trial" as const, daysLeft: days, expired: false };
  }

  const elapsedMs = now.getTime() - new Date(started).getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  const daysLeft = Math.max(0, Math.ceil(days - elapsedDays));

  if (daysLeft <= 0) {
    return { status: "expired" as const, daysLeft: 0, expired: true };
  }

  return { status: "trial" as const, daysLeft, expired: false };
}

export const emailAuthRouter = createRouter({
  signup: publicQuery
    .input(
      z.object({
        email: z.string().email("Invalid email address"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        name: z.string().min(1, "Name is required"),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const existing = await db
        .select()
        .from(emailUsers)
        .where(eq(emailUsers.email, input.email))
        .limit(1);

      if (existing.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with this email already exists",
        });
      }

      const code = generateCode();
      const passwordHash = hashPassword(input.password);

      const result = await db.insert(emailUsers).values({
        email: input.email,
        passwordHash,
        name: input.name,
        verificationCode: code,
        verified: false,
      });

      const userId = Number(result[0].insertId);

      return {
        success: true,
        userId,
        message: "Account created. Check your email for the verification code.",
        code,
      };
    }),

  verify: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().length(6),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const user = await db
        .select()
        .from(emailUsers)
        .where(eq(emailUsers.email, input.email))
        .limit(1);

      if (user.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (user[0].verified) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already verified" });
      }

      if (user[0].verificationCode !== input.code) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid verification code" });
      }

      // Start trial on verification
      await db
        .update(emailUsers)
        .set({
          verified: true,
          verificationCode: null,
          trialStartedAt: new Date(),
        })
        .where(eq(emailUsers.id, user[0].id));

      const token = await createToken(user[0].id);

      return {
        success: true,
        token,
        message: "Email verified successfully. Your 3-day free trial has started!",
      };
    }),

  login: publicQuery
    .input(
      z.object({
        email: z.string().email(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();

      const user = await db
        .select()
        .from(emailUsers)
        .where(eq(emailUsers.email, input.email))
        .limit(1);

      if (user.length === 0) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      if (!user[0].verified) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Please verify your email before logging in",
        });
      }

      if (!verifyPassword(input.password, user[0].passwordHash)) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid email or password",
        });
      }

      await db
        .update(emailUsers)
        .set({ lastSignInAt: new Date() })
        .where(eq(emailUsers.id, user[0].id));

      const token = await createToken(user[0].id);
      const trial = getTrialStatus(user[0]);

      return {
        success: true,
        token,
        trial,
        user: {
          id: user[0].id,
          email: user[0].email,
          name: user[0].name,
        },
      };
    }),

  me: publicQuery.query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.get("x-email-auth-token");
    if (!authHeader) return null;

    const userId = await verifyEmailToken(authHeader);
    if (!userId) return null;

    const db = getDb();
    const user = await db
      .select()
      .from(emailUsers)
      .where(eq(emailUsers.id, userId))
      .limit(1);

    if (user.length === 0 || !user[0].verified) return null;

    const trial = getTrialStatus(user[0]);

    return {
      id: user[0].id,
      email: user[0].email,
      name: user[0].name,
      role: user[0].role,
      createdAt: user[0].createdAt,
      trial,
    };
  }),

  startTrial: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = getDb();

      const user = await db
        .select()
        .from(emailUsers)
        .where(eq(emailUsers.email, input.email))
        .limit(1);

      if (user.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      await db
        .update(emailUsers)
        .set({ trialStartedAt: new Date() })
        .where(eq(emailUsers.id, user[0].id));

      return { success: true, message: "3-day free trial started!" };
    }),

  trialStatus: publicQuery
    .input(z.object({ email: z.string().email() }))
    .query(async ({ input }) => {
      const db = getDb();

      const user = await db
        .select()
        .from(emailUsers)
        .where(eq(emailUsers.email, input.email))
        .limit(1);

      if (user.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      return getTrialStatus(user[0]);
    }),

  resendCode: publicQuery
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const code = generateCode();

      const result = await db
        .update(emailUsers)
        .set({ verificationCode: code })
        .where(eq(emailUsers.email, input.email));

      if (result[0].affectedRows === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      return { success: true, message: "New code sent", code };
    }),
});
