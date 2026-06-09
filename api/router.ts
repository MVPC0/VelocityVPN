import { authRouter } from "./auth-router";
import { emailAuthRouter } from "./routers/email-auth";
import { googleAuthRouter } from "./routers/google-auth";
import { vpnRouter } from "./routers/vpn";
import { vpnProxyRouter } from "./routers/vpn-proxy";
import { monitoringRouter } from "./routers/monitoring";
import { gameEventsRouter } from "./routers/game-events";
import { steamApiRouter } from "./routers/steam-api";
import { fortniteApiRouter } from "./routers/fortnite-api";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  emailAuth: emailAuthRouter,
  googleAuth: googleAuthRouter,
  vpn: vpnRouter,
  vpnProxy: vpnProxyRouter,
  monitoring: monitoringRouter,
  gameEvents: gameEventsRouter,
  steam: steamApiRouter,
  fortnite: fortniteApiRouter,
});

export type AppRouter = typeof appRouter;
