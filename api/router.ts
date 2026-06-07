import { authRouter } from "./auth-router";
import { vpnRouter } from "./routers/vpn";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  vpn: vpnRouter,
});

export type AppRouter = typeof appRouter;
