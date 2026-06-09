import { useState, useMemo } from "react";
import {
  Flame, Bot, Skull, Gamepad2, Users, Zap,
  Globe, Crosshair, Swords, Target, Sparkles, Crown
} from "lucide-react";
import { VELOCITY_SERVERS, getFlag } from "@/data/velocity-servers";

interface VPNServer {
  id: number; name: string; city: string; country: string;
  countryCode: string; region: string; hostname: string;
  load: number; ping: number | null; jitter: number | null;
  protocol: string;
}

// Games commonly played in each region (based on regional popularity)
const REGION_GAMES: Record<string, string[]> = {
  north_america: ["CS2", "CoD", "Apex", "Fortnite", "R6 Siege", "Valorant"],
  europe: ["CS2", "Dota 2", "Fortnite", "PUBG", "R6 Siege", "Rocket League"],
  asia_pacific: ["PUBG", "CoD", "Apex", "Dota 2", "Valorant", "THE FINALS"],
  oceania: ["Fortnite", "Apex", "Rust", "DayZ", "ARK", "PUBG"],
  south_america: ["Free Fire", "Fortnite", "CS2", "CoD", "GTA V", "PUBG"],
  middle_east: ["PUBG", "CoD", "CS2", "Fortnite", "Free Fire"],
  africa: ["Free Fire", "PUBG", "Fortnite", "CoD", "CS2"],
};

// Vibe classification based on load + region
function getVibe(load: number): {
  label: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  desc: string;
} {
  if (load >= 80) return {
    label: "SWEATY LOBBIES", emoji: "🔥", color: "#EF4444", bgColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.3)", desc: "Pro players, high skill, intense matches"
  };
  if (load >= 60) return {
    label: "COMPETITIVE", emoji: "⚡", color: "#F97316", bgColor: "rgba(249,115,22,0.08)",
    borderColor: "rgba(249,115,22,0.3)", desc: "Skilled players, ranked lobbies"
  };
  if (load >= 45) return {
    label: "BALANCED", emoji: "🎯", color: "#FBBF24", bgColor: "rgba(251,191,36,0.08)",
    borderColor: "rgba(251,191,36,0.25)", desc: "Mix of casual and competitive"
  };
  if (load >= 30) return {
    label: "CASUAL ZONE", emoji: "🎮", color: "#22D3EE", bgColor: "rgba(34,211,238,0.08)",
    borderColor: "rgba(34,211,238,0.2)", desc: "Relaxed lobbies, good for practice"
  };
  return {
    label: "BOT LOBBY", emoji: "🤖", color: "#4ADE80", bgColor: "rgba(74,222,128,0.08)",
    borderColor: "rgba(74,222,128,0.2)", desc: "Low skill, easy wins, great for grinding"
  };
}

const REGION_LABELS: Record<string, string> = {
  north_america: "North America",
  europe: "Europe",
  asia_pacific: "Asia-Pacific",
  oceania: "Oceania",
  south_america: "South America",
  middle_east: "Middle East",
  africa: "Africa",
};

const VIBE_FILTERS = [
  { key: "all", label: "All Servers", emoji: "🌍", color: "#E85D4E" },
  { key: "bot", label: "Bot Lobbies", emoji: "🤖", color: "#4ADE80", maxLoad: 29 },
  { key: "casual", label: "Casual", emoji: "🎮", color: "#22D3EE", minLoad: 30, maxLoad: 44 },
  { key: "balanced", label: "Balanced", emoji: "🎯", color: "#FBBF24", minLoad: 45, maxLoad: 59 },
  { key: "comp", label: "Competitive", emoji: "⚡", color: "#F97316", minLoad: 60, maxLoad: 79 },
  { key: "sweaty", label: "Sweaty", emoji: "🔥", color: "#EF4444", minLoad: 80 },
];

interface Props {
  servers: VPNServer[];
  onSelect: (id: number) => void;
}

export default function ServerHeatMap({ servers, onSelect }: Props) {
  const [filter, setFilter] = useState("all");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const f = VIBE_FILTERS.find((v) => v.key === filter);
    if (!f || f.key === "all") return servers;
    return servers.filter((s) => {
      if (f.maxLoad !== undefined && s.load > f.maxLoad) return false;
      if (f.minLoad !== undefined && s.load < f.minLoad) return false;
      return true;
    });
  }, [servers, filter]);

  const avgLoad = useMemo(() => {
    return servers.length > 0 ? Math.round(servers.reduce((sum, s) => sum + s.load, 0) / servers.length) : 0;
  }, [servers]);

  // Group by region
  const byRegion = useMemo(() => {
    const groups: Record<string, VPNServer[]> = {};
    for (const s of filtered) {
      if (!groups[s.region]) groups[s.region] = [];
      groups[s.region].push(s);
    }
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-['Archivo'] text-lg tracking-tight flex items-center gap-2">
              <Flame size={20} className="text-[#E85D4E]" />
              Pick Your Lobby
            </h3>
            <p className="text-xs text-[#6B7280] mt-1">
              Average load: <span className="text-white font-bold">{avgLoad}%</span> — {servers.length} servers live
            </p>
          </div>
        </div>

        {/* Vibe Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {VIBE_FILTERS.map((v) => (
            <button
              key={v.key}
              onClick={() => setFilter(v.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border-0 ${
                filter === v.key
                  ? "text-white"
                  : "bg-[#111118] text-[#6B7280] hover:text-white hover:bg-[rgba(255,255,255,0.08)]"
              }`}
              style={filter === v.key ? { backgroundColor: `${v.color}25`, color: v.color, border: `1px solid ${v.color}40` } : {}}
            >
              <span>{v.emoji}</span> {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Server Cards */}
      {Object.entries(byRegion).map(([region, regionServers]) => (
        <div key={region}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Globe size={14} className="text-[#6B7280]" />
            <h4 className="text-sm font-bold text-[#9CA3AF] uppercase tracking-wider">{REGION_LABELS[region] || region}</h4>
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
            <span className="text-xs text-[#6B7280]">{regionServers.length} servers</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {regionServers.map((server) => {
              const vibe = getVibe(server.load);
              const games = REGION_GAMES[server.region] || ["Multiplayer"];
              const isHovered = hoveredId === server.id;

              return (
                <div
                  key={server.id}
                  onClick={() => onSelect(server.id)}
                  onMouseEnter={() => setHoveredId(server.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="rounded-xl p-4 transition-all cursor-pointer border"
                  style={{
                    backgroundColor: vibe.bgColor,
                    borderColor: isHovered ? vibe.color : vibe.borderColor,
                  }}
                >
                  {/* Top row: flag + city + vibe badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getFlag(server.countryCode)}</span>
                      <div>
                        <div className="text-sm font-bold text-white">{server.city}</div>
                        <div className="text-[10px] text-[#6B7280]">{server.name}</div>
                      </div>
                    </div>
                    <div
                      className="px-2 py-0.5 rounded-full text-[9px] font-bold flex items-center gap-1"
                      style={{ backgroundColor: `${vibe.color}20`, color: vibe.color }}
                    >
                      <span>{vibe.emoji}</span> {vibe.label}
                    </div>
                  </div>

                  {/* Vibe description */}
                  <p className="text-[10px] text-[#9CA3AF] mb-3">{vibe.desc}</p>

                  {/* Load bar */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-2 bg-[rgba(0,0,0,0.3)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${server.load}%`, backgroundColor: vibe.color }}
                      />
                    </div>
                    <span className="text-xs font-bold" style={{ color: vibe.color }}>{server.load}%</span>
                  </div>

                  {/* Game tags */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {games.slice(0, 4).map((game) => (
                      <span key={game} className="px-1.5 py-0.5 bg-[rgba(255,255,255,0.06)] rounded text-[9px] text-[#9CA3AF]">
                        {game}
                      </span>
                    ))}
                  </div>

                  {/* Bottom stats */}
                  <div className="flex items-center justify-between text-[10px] text-[#6B7280]">
                    <span className="flex items-center gap-1">
                      <Zap size={9} className="text-[#4ADE80]" />
                      {server.ping !== null ? `${server.ping}ms` : "--"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={9} />
                      ~{Math.floor(server.load * 12)} players
                    </span>
                    <span className="flex items-center gap-1">
                      <Crosshair size={9} />
                      {server.jitter !== null ? `${server.jitter}ms jitter` : "--"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Legend / Guide */}
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
        <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Sparkles size={14} className="text-[#9B6DFF]" /> Lobby Guide
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { emoji: "🤖", label: "Bot Lobby", desc: "Load < 30%. Mostly AI/bots. Perfect for grinding camos, challenges, or warming up.", color: "#4ADE80" },
            { emoji: "🎮", label: "Casual Zone", desc: "Load 30-44%. Relaxed players. Good for trying new weapons or playing with friends.", color: "#22D3EE" },
            { emoji: "🎯", label: "Balanced", desc: "Load 45-59%. Mix of skills. Fair matches with some challenge.", color: "#FBBF24" },
            { emoji: "⚡", label: "Competitive", desc: "Load 60-79%. Skilled players. Ranked lobbies, expect tough fights.", color: "#F97316" },
            { emoji: "🔥", label: "Sweaty", desc: "Load 80%+. Pro-level players. Only join if you want a real challenge.", color: "#EF4444" },
            { emoji: "🌍", label: "Region Matters", desc: "NA/EU = FPS heavy. Asia = BR/MOBA. Pick based on your game.", color: "#9B6DFF" },
          ].map((item) => (
            <div key={item.label} className="bg-[#111118] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{item.emoji}</span>
                <span className="text-xs font-bold" style={{ color: item.color }}>{item.label}</span>
              </div>
              <p className="text-[10px] text-[#6B7280] leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
