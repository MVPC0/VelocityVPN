// Same-origin proxy for Steam's public current-player count.
// Steam's ISteamUserStats/GetNumberOfCurrentPlayers sends no CORS headers, so the
// browser cannot read it directly. This returns { counts: { [appId]: number | null } };
// null means Steam did not return a count (never an estimate).
// GET /.netlify/functions/steam-players?appids=730,570,3010850

const STEAM_URL = 'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=';
const MAX_IDS = 40;

async function currentPlayers(appId) {
  try {
    const res = await fetch(STEAM_URL + appId, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const data = await res.json();
    const r = data && data.response;
    return r && r.result === 1 && Number.isFinite(r.player_count) ? r.player_count : null;
  } catch {
    return null;
  }
}

export default async (req) => {
  const raw = new URL(req.url).searchParams.get('appids') || '';
  const ids = [...new Set(raw.split(',').filter((s) => /^\d{1,10}$/.test(s)).map(Number))].slice(0, MAX_IDS);
  if (ids.length === 0) {
    return Response.json({ error: 'appids required' }, { status: 400 });
  }
  const values = await Promise.all(ids.map(currentPlayers));
  const counts = Object.fromEntries(ids.map((id, i) => [id, values[i]]));
  return Response.json(
    { counts, fetchedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, max-age=60', 'Netlify-CDN-Cache-Control': 'public, s-maxage=120' } },
  );
};
