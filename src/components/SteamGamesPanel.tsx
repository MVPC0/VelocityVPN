import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchSteamCounts, steamCount } from "@/lib/steam";
import { Gamepad2, Users, TrendingUp, RefreshCw, Loader2 } from "lucide-react";

// ─── Steam Games Panel ────────────────────────────────────────
// Live counts come only from Steam's public API (via a same-origin function).
// If Steam doesn't answer, a game shows "—" — never a guessed number.
// Fortnite is not on Steam and has no public count, so it always shows "—".

const STEAM_GAMES: { appId: number; name: string; genre: string }[] = [
  { appId: 730, name: "CS2", genre: "FPS" },
  { appId: 570, name: "Dota 2", genre: "MOBA" },
  { appId: 578080, name: "PUBG", genre: "Battle Royale" },
  { appId: 1172470, name: "Apex Legends", genre: "Battle Royale" },
  { appId: 553850, name: "Helldivers 2", genre: "Shooter" },
  { appId: 2767030, name: "Marvel Rivals", genre: "Hero Shooter" },
  { appId: 1623730, name: "Palworld", genre: "Survival" },
  { appId: 252490, name: "Rust", genre: "Survival" },
  { appId: 3241660, name: "R.E.P.O.", genre: "Co-op Horror" },
  { appId: 440, name: "Team Fortress 2", genre: "FPS" },
  { appId: 1085660, name: "Destiny 2", genre: "FPS" },
  { appId: 359550, name: "Rainbow Six Siege", genre: "FPS" },
  { appId: 252950, name: "Rocket League", genre: "Sports" },
  { appId: 892970, name: "Valheim", genre: "Survival" },
  { appId: 221100, name: "DayZ", genre: "Survival" },
  { appId: 381210, name: "Dead by Daylight", genre: "Horror" },
  { appId: 1245620, name: "ELDEN RING", genre: "RPG" },
  { appId: 2073850, name: "THE FINALS", genre: "FPS" },
  { appId: 582010, name: "Monster Hunter: World", genre: "RPG" },
  { appId: 271590, name: "GTA V", genre: "Action" },
  { appId: 1938090, name: "Call of Duty", genre: "FPS" },
  { appId: 346110, name: "ARK", genre: "Survival" },
  { appId: 236390, name: "War Thunder", genre: "Simulation" },
  { appId: 238960, name: "Path of Exile", genre: "ARPG" },
  { appId: 3010850, name: "Gears of War: E-Day", genre: "Shooter" },
];

// Games without a count ("—") sort last; ties keep list order.
function byCountDesc(a: GameData, b: GameData) {
  return (b.count ?? -1) - (a.count ?? -1);
}

interface GameData {
  name: string;
  count: number | null;
  genre: string;
  source: "steam" | "epic";
}

const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function buildGames(counts: Record<string, number | null> | null): GameData[] {
  const list: GameData[] = STEAM_GAMES.map((g) => {
    return { name: g.name, count: steamCount(counts, g.appId), genre: g.genre, source: "steam" as const };
  });
  list.push({ name: "Fortnite", count: null, genre: "Battle Royale", source: "epic" });
  return list.sort(byCountDesc);
}

const genreColors: Record<string, string> = {
  FPS: "#E85D4E", MOBA: "#9B6DFF", "Battle Royale": "#4ADE80",
  Survival: "#FBBF24", Action: "#22D3EE", Sports: "#A3B8D4",
  Horror: "#8B5CF6", RPG: "#F97316", Simulation: "#06B6D4",
  Shooter: "#EF4444", "Hero Shooter": "#EC4899", "Co-op Horror": "#7C3AED",
  ARPG: "#D946EF", Fighting: "#F59E0B", Strategy: "#10B981",
};

export default function SteamGamesPanel() {
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [asOf, setAsOf] = useState<Date | null>(null);

  const loadAll = useCallback(async () => {
    setRefreshing(true);
    const live = await fetchSteamCounts(STEAM_GAMES.map((g) => g.appId));
    setGames(buildGames(live?.counts ?? null));
    setAsOf(live ? live.fetchedAt : null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Stats use real Steam counts only.
  const steamCounted = useMemo(() => games.filter((g) => g.source === "steam" && g.count !== null), [games]);
  const totalPlayers = steamCounted.length ? steamCounted.reduce((s, g) => s + (g.count ?? 0), 0) : null;
  const topGame = steamCounted[0]?.name ?? "—";
  const steamLive = steamCounted.length > 0;

  const fmt = (n: number | null) => {
    if (n === null) return "—";
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
    return n.toString();
  };

  if (loading) {
    return (
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8 flex items-center justify-center gap-2 text-[#6B7280]">
        <Loader2 size={16} className="animate-spin" /> Loading Steam counts…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">
            <Gamepad2 size={10} /> Tracked Games
          </div>
          <div className="font-['JetBrains_Mono'] text-2xl text-white">{games.length}</div>
        </div>
        <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">
            <Users size={10} /> Steam Players
          </div>
          <div className={`font-['JetBrains_Mono'] text-2xl ${totalPlayers === null ? "text-[#6B7280]" : "text-[#4ADE80]"}`}>{fmt(totalPlayers)}</div>
        </div>
        <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">
            <TrendingUp size={10} /> Top Game
          </div>
          <div className="font-['JetBrains_Mono'] text-lg text-[#E85D4E] truncate px-1">{topGame}</div>
        </div>
      </div>

      {/* Game List */}
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Archivo'] text-base tracking-tight flex items-center gap-2">
            <Gamepad2 size={18} className="text-[#E85D4E]" />
            Player counts
          </h3>
          <div className="flex items-center gap-3">
            {steamLive && asOf ? (
              <span className="flex items-center gap-1 text-[9px] text-[#6B7280]" data-testid="steam-status">
                <span className="w-2 h-2 rounded-full bg-[#4ADE80]" /> Steam · as of {fmtTime(asOf)}
              </span>
            ) : (
              <span className="text-[9px] text-[#6B7280]" data-testid="steam-status">Steam counts unavailable</span>
            )}
          </div>
        </div>

        <>
            <div className="grid grid-cols-12 gap-2 mb-2 px-3 text-[10px] text-[#6B7280] uppercase tracking-wider">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Game</div>
              <div className="col-span-2">Genre</div>
              <div className="col-span-3 text-right">Players</div>
              <div className="col-span-2 text-right">Share</div>
            </div>

            <div className="space-y-1">
              {games.map((game, i) => {
                const maxCount = games[0]?.count || 1;
                const barWidth = ((game.count ?? 0) / maxCount) * 100;
                const color = genreColors[game.genre] || "#6B7280";
                return (
                  <div key={game.name} className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg hover:bg-[rgba(255,255,255,0.03)] transition-colors">
                    <div className="col-span-1 text-xs text-[#6B7280]">{i + 1}</div>
                    <div className="col-span-4 flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${game.count !== null ? "bg-[#4ADE80]" : ""}`}
                        data-dot={game.count !== null ? "live" : "none"}
                      />
                      <span className="text-sm text-white font-medium truncate" title={game.name}>{game.name}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}15`, color }}>{game.genre}</span>
                    </div>
                    <div
                      className={`col-span-3 text-right font-['JetBrains_Mono'] text-sm ${game.count === null ? "text-[#6B7280]" : "text-white"}`}
                      title={game.count !== null ? undefined : game.source === "epic" ? "No public Fortnite player count" : "Steam didn't return a count"}
                    >
                      {fmt(game.count)}
                    </div>
                    <div className="col-span-2">
                      <div className="h-1.5 bg-[#111118] rounded-full overflow-hidden">
                        {game.count !== null && (
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(3, barWidth)}%`, backgroundColor: color }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        </>

        <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <p className="text-[10px] text-[#6B7280]">Counts from Steam's public API. Fortnite has no public count.</p>
          <button onClick={loadAll} disabled={refreshing} className="text-[10px] text-[#E85D4E] hover:text-white flex items-center gap-1 cursor-pointer bg-transparent border-0">
            <RefreshCw size={10} className={refreshing ? "animate-spin" : undefined} /> Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
