import { authRouter } from "./auth-router";
import { emailAuthRouter } from "./routers/email-auth";
import { googleAuthRouter } from "./routers/google-auth";
import { vpnRouter } from "./routers/vpn";
import { monitoringRouter } from "./routers/monitoring";
import { gameEventsRouter } from "./routers/game-events";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  emailAuth: emailAuthRouter,
  googleAuth: googleAuthRouter,
  vpn: vpnRouter,
  monitoring: monitoringRouter,
  gameEvents: gameEventsRouter,
});

export type AppRouter = typeof appRouter;
