/**
 * Sends verification emails through Resend (https://resend.com) when
 * RESEND_API_KEY and EMAIL_FROM are set. In development without a provider the
 * code is logged to the server console. In production without a provider this
 * throws so signup fails loudly instead of silently.
 */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export function canDeliverVerification(): boolean {
  return isEmailConfigured() || process.env.NODE_ENV !== "production";
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`[mailer:dev] Verification code for ${to}: ${code}`);
      return;
    }
    throw new Error("Email delivery is not configured (set RESEND_API_KEY and EMAIL_FROM)");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject: "Your VelocityVPN verification code",
      text: `Your VelocityVPN verification code is ${code}. It expires in 15 minutes.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Email provider returned ${res.status}`);
  }
}
