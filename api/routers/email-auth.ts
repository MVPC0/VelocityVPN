import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { emailUsers } from "@db/schema";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes, randomInt, pbkdf2, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { getAuthSecret } from "../lib/auth-secret";
import { canDeliverVerification, sendVerificationEmail } from "../lib/mailer";

const pbkdf2Async = promisify(pbkdf2);
const PBKDF2_ITERATIONS = 210_000;
const LEGACY_ITERATIONS = 10_000;
const MAX_VERIFY_ATTEMPTS = 5;
const CODE_TTL_MS = 15 * 60 * 1000;

const emailSchema = z.string().trim().toLowerCase().email("Invalid email address").max(320);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await pbkdf2Async(password, salt, PBKDF2_ITERATIONS, 64, "sha512");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash.toString("hex")}`;
}

/** Supports the current `pbkdf2$iter$salt$hash` format and the legacy `salt:hash` (10k) format. */
async function verifyPassword(password: string, stored: string): Promise<{ ok: boolean; legacy: boolean }> {
  let salt: string | undefined;
  let hashHex: string | undefined;
  let iterations: number;
  let legacy = false;
  if (stored.startsWith("pbkdf2$")) {
    const [, iter, s, h] = stored.split("$");
    iterations = Number(iter);
    salt = s;
    hashHex = h;
  } else {
    [salt, hashHex] = stored.split(":");
    iterations = LEGACY_ITERATIONS;
    legacy = true;
  }
  if (!salt || !hashHex || !Number.isFinite(iterations) || iterations <= 0) {
    return { ok: false, legacy };
  }
  const expected = Buffer.from(hashHex, "hex");
  const check = await pbkdf2Async(password, salt, iterations, 64, "sha512");
  const ok = expected.length === check.length && timingSafeEqual(expected, check);
  return { ok, legacy };
}

function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

function codesMatch(a: string | null, b: string): boolean {
  if (!a) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

async function createToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId), type: "email" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getAuthSecret());
}

export async function verifyEmailToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), { clockTolerance: 60 });
    if (payload.type !== "email" || !payload.sub) return null;
    const id = parseInt(payload.sub, 10);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

async function requireEmailUserId(headers: Headers): Promise<number> {
  const token = headers.get("x-email-auth-token");
  const userId = token ? await verifyEmailToken(token) : null;
  if (!userId) throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
  return userId;
}

function assertCanSendEmail() {
  if (!canDeliverVerification()) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Email verification is temporarily unavailable. Please try again later.",
    });
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
        email: emailSchema,
        password: z.string().min(8, "Password must be at least 8 characters").max(200),
        name: z.string().trim().min(1, "Name is required").max(255),
      })
    )
    .mutation(async ({ input }) => {
      assertCanSendEmail();
      const db = getDb();

      const existing = await db
        .select({ id: emailUsers.id })
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
      const passwordHash = await hashPassword(input.password);

      let userId: number;
      try {
        const result = await db.insert(emailUsers).values({
          email: input.email,
          passwordHash,
          name: input.name,
          verificationCode: code,
          verifyAttempts: 0,
          codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
          verified: false,
        });
        userId = Number(result[0].insertId);
      } catch (err) {
        // Unique constraint on email closes the check-then-insert race
        if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
          throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists" });
        }
        throw err;
      }

      await sendVerificationEmail(input.email, code);

      return {
        success: true,
        userId,
        message: "Account created. Check your email for the verification code.",
      };
    }),

  verify: publicQuery
    .input(
      z.object({
        email: emailSchema,
        code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
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
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid verification code" });
      }

      if (user[0].verified) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already verified" });
      }

      const expired = !user[0].codeExpiresAt || user[0].codeExpiresAt.getTime() < Date.now();
      if (user[0].verifyAttempts >= MAX_VERIFY_ATTEMPTS || expired) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "This code has expired or too many attempts were made. Request a new code.",
        });
      }

      if (!codesMatch(user[0].verificationCode, input.code)) {
        await db
          .update(emailUsers)
          .set({ verifyAttempts: sql`${emailUsers.verifyAttempts} + 1` })
          .where(eq(emailUsers.id, user[0].id));
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid verification code" });
      }

      // Start trial on verification
      await db
        .update(emailUsers)
        .set({
          verified: true,
          verificationCode: null,
          verifyAttempts: 0,
          codeExpiresAt: null,
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
        email: emailSchema,
        password: z.string().max(200),
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

      const { ok, legacy } = await verifyPassword(input.password, user[0].passwordHash);
      if (!ok) {
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

      await db
        .update(emailUsers)
        .set({
          lastSignInAt: new Date(),
          // Transparently upgrade legacy 10k-iteration hashes
          ...(legacy ? { passwordHash: await hashPassword(input.password) } : {}),
        })
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

  startTrial: publicQuery.mutation(async ({ ctx }) => {
    const userId = await requireEmailUserId(ctx.req.headers);
    const db = getDb();

    const user = await db
      .select()
      .from(emailUsers)
      .where(eq(emailUsers.id, userId))
      .limit(1);

    if (user.length === 0 || !user[0].verified) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
    }

    if (user[0].trialStartedAt) {
      throw new TRPCError({ code: "CONFLICT", message: "Your free trial has already been used" });
    }

    await db
      .update(emailUsers)
      .set({ trialStartedAt: new Date() })
      .where(eq(emailUsers.id, userId));

    return { success: true, message: "3-day free trial started!" };
  }),

  trialStatus: publicQuery.query(async ({ ctx }) => {
    const userId = await requireEmailUserId(ctx.req.headers);
    const db = getDb();

    const user = await db
      .select()
      .from(emailUsers)
      .where(eq(emailUsers.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
    }

    return getTrialStatus(user[0]);
  }),

  resendCode: publicQuery
    .input(z.object({ email: emailSchema }))
    .mutation(async ({ input }) => {
      assertCanSendEmail();
      const db = getDb();
      const code = generateCode();

      const user = await db
        .select({ id: emailUsers.id, verified: emailUsers.verified })
        .from(emailUsers)
        .where(eq(emailUsers.email, input.email))
        .limit(1);

      // Same response whether or not the account exists (no enumeration)
      if (user.length > 0 && !user[0].verified) {
        await db
          .update(emailUsers)
          .set({
            verificationCode: code,
            verifyAttempts: 0,
            codeExpiresAt: new Date(Date.now() + CODE_TTL_MS),
          })
          .where(eq(emailUsers.id, user[0].id));
        await sendVerificationEmail(input.email, code);
      }

      return { success: true, message: "If that account needs verification, a new code was sent." };
    }),
});
