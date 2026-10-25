// Live Steam player counts via the same-origin Netlify Function (Steam sends no CORS
// headers, so the browser can't call it directly). Failures return null: callers show
// "—", never an estimate.
export const STEAM_COUNTS_ENDPOINT = "/.netlify/functions/steam-players";
export const STEAM_TIMEOUT_MS = 8000;

export interface SteamCounts { counts: Record<string, unknown>; fetchedAt: Date }

export async function fetchSteamCounts(appIds: number[]): Promise<SteamCounts | null> {
  try {
    const res = await fetch(`${STEAM_COUNTS_ENDPOINT}?appids=${appIds.join(",")}`, { signal: AbortSignal.timeout(STEAM_TIMEOUT_MS) });
    if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) return null;
    const data = await res.json();
    if (!data || typeof data.counts !== "object" || data.counts === null) return null;
    // The response may be CDN/browser cached for a couple of minutes, so keep when it was fetched.
    const t = new Date(data.fetchedAt);
    return { counts: data.counts, fetchedAt: Number.isNaN(t.getTime()) ? new Date() : t };
  } catch {
    return null;
  }
}

/** The count to display for a game, or null ("—") when Steam gave no usable number. */
export function steamCount(counts: Record<string, unknown> | null | undefined, appId: number): number | null {
  const c = counts?.[String(appId)];
  return typeof c === "number" && Number.isFinite(c) && c >= 0 ? c : null;
}
