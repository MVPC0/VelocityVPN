import { useState, useMemo } from "react";
import {
  Users, Zap, Globe, Crosshair
} from "lucide-react";
import { getFlag } from "@/data/velocity-servers";
import { formatSpreadPm } from "@/lib/latency";

interface VPNServer {
  id: number; name: string; city: string; country: string;
  countryCode: string; region: string; hostname: string;
  latency: number | null; spread: number | null;
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

const REGION_LABELS: Record<string, string> = {
  north_america: "North America",
  europe: "Europe",
  asia_pacific: "Asia-Pacific",
  oceania: "Oceania",
  south_america: "South America",
  middle_east: "Middle East",
  africa: "Africa",
};

interface Props {
  servers: VPNServer[];
  onSelect: (id: number) => void;
}

export default function ServerHeatMap({ servers, onSelect }: Props) {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  // No real load data exists yet, so cards show no load and nothing is
  // ranked, filtered or color-coded by load.
  // Group by region
  const byRegion = useMemo(() => {
    const groups: Record<string, VPNServer[]> = {};
    for (const s of servers) {
      if (!groups[s.region]) groups[s.region] = [];
      groups[s.region].push(s);
    }
    return groups;
  }, [servers]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
        <h3 className="font-['Archivo'] text-lg tracking-tight flex items-center gap-2">
          <Globe size={20} className="text-[#E85D4E]" />
          Regions
        </h3>
        <p className="text-xs text-[#6B7280] mt-1">
          {servers.length} reference locations (not VPN servers), grouped by region. No load data yet, so locations aren't rated or ranked.
        </p>
      </div>

      {/* Server Cards */}
      {Object.entries(byRegion).map(([region, regionServers]) => (
        <div key={region}>
          <div className="flex items-center gap-2 mb-3 px-1">
            <Globe size={14} className="text-[#6B7280]" />
            <h4 className="text-sm font-bold text-[#9CA3AF] uppercase tracking-wider">{REGION_LABELS[region] || region}</h4>
            <div className="flex-1 h-px bg-[rgba(255,255,255,0.06)]" />
            <span className="text-xs text-[#6B7280]">{regionServers.length} {regionServers.length === 1 ? "city" : "cities"}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {regionServers.map((server) => {
              const games = REGION_GAMES[server.region] || ["Multiplayer"];
              const isHovered = hoveredId === server.id;

              return (
                <div
                  key={server.id}
                  data-testid="region-card"
                  onClick={() => onSelect(server.id)}
                  onMouseEnter={() => setHoveredId(server.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="rounded-xl p-4 transition-all cursor-pointer border bg-[#0A0A0F]"
                  style={{ borderColor: isHovered ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.08)" }}
                >
                  {/* Top row: flag + city */}
                  <div className="flex items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{getFlag(server.countryCode)}</span>
                      <div>
                        <div className="text-sm font-bold text-white">{server.city}</div>
                        <div className="text-[10px] text-[#6B7280]">{server.name}</div>
                      </div>
                    </div>
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
                      {server.latency !== null ? `${server.latency}ms` : "--"}
                    </span>
                    <span className="flex items-center gap-1" title="No player count">
                      <Users size={9} />
                      —
                    </span>
                    <span className="flex items-center gap-1">
                      <Crosshair size={9} />
                      {server.spread !== null ? formatSpreadPm(server.spread) : "--"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

    </div>
  );
}
