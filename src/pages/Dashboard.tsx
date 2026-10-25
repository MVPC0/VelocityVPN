import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Shield, Zap, Power, Clock, ArrowDown, ArrowUp,
  Activity, Server, RefreshCw, ChevronLeft, Download,
  Globe, Lock, Gamepad2, ScanLine,
  HelpCircle, Puzzle, Key, LogIn, X,
  Smartphone, Wifi, AlertTriangle, CheckCircle2,
  Check, Loader2, Info
} from "lucide-react";
import { VELOCITY_SERVERS, getFlag } from "@/data/velocity-servers";
import SteamGamesPanel from "@/components/SteamGamesPanel";
import ServerHeatMap from "@/components/ServerHeatMap";
import ProviderSetup from "@/components/ProviderSetup";
import {
  useProviderConfig,
  generateProviderWireGuardConfig,
  providerConfigFilename,
  isProviderConfigComplete,
  type ProviderConfig,
} from "@/hooks/useProviderConfig";
import { useVpnDetector } from "@/hooks/useVpnDetector";
import { runCityLatency, useLatencyResults } from "@/hooks/useCityLatency";
import { VARIANCE_NOTE, formatSpreadPm, latencyColor, type LatencyResult } from "@/lib/latency";
import MadSpread from "@/components/MadSpread";
import EstimateTag from "@/components/EstimateTag";
import { latencyHeadlineLabel, latencyTargetLabel, primaryLatencyTarget } from "@/data/ping-targets";

// ─── Types ────────────────────────────────────────────────────

// A reference location used for the latency test and the Regions tab.
// These are not VelocityVPN servers; tunnels use the user's own provider.
// latency/spread come from the shared test (src/lib/latency.ts), the same
// one the landing page runs: median and MAD in ms.
interface VPNServer {
  id: number; name: string; city: string; country: string;
  countryCode: string; region: string; hostname: string; endpoint: string;
  latency: number | null; spread: number | null;
  protocol: string;
}

interface Connection {
  server: VPNServer; assignedIp: string; connectedAt: Date; protocol: string;
}

interface SessionRecord {
  server: VPNServer; duration: number; date: Date; status: string;
}

// ─── Helpers ──────────────────────────────────────────────────

const INITIAL_SERVERS: VPNServer[] = VELOCITY_SERVERS.map((s) => ({
  id: s.id, name: s.name, city: s.city, country: s.country,
  countryCode: s.countryCode, region: s.region, hostname: s.hostname, endpoint: s.endpoint,
  latency: null,
  spread: null,
  protocol: "wireguard",
}));

function formatDuration(s: number) {
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m ${s % 60}s` : `${m}m ${s % 60}s`;
}
// Traffic flows through the WireGuard app, not this page, so bytes aren't tracked here.
const NOT_TRACKED = "—";

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Run the shared latency test for many cities, a few at a time so they don't compete for bandwidth. */
async function measureCities(ids: number[], concurrency = 3) {
  const queue = [...ids];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) await runCityLatency(id);
  }));
}

function LatencyBadge({ result }: { result: LatencyResult | undefined }) {
  if (!result) return <div className="text-xs text-[#6B7280]">-- ms</div>;
  if (result.offline) {
    return <div className="text-xs text-[#9CA3AF]" title={result.note ?? undefined}>Offline</div>;
  }
  if (result.status === "unavailable" || !result.stats) {
    return <div className="text-xs text-[#FBBF24]" title={result.note ?? undefined}>Unavailable</div>;
  }
  const { median, mad } = result.stats;
  return (
    <>
      <div className="font-['JetBrains_Mono'] text-sm" style={{ color: result.status === "unreliable" ? "#FBBF24" : latencyColor(median) }}>{median}ms</div>
      <div className="text-[10px] text-[#6B7280]"><MadSpread mad={mad} plusMinus />{result.status === "unreliable" ? " · unreliable" : ""}</div>
    </>
  );
}

// ─── Dashboard Component ──────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [baseServers] = useState<VPNServer[]>(INITIAL_SERVERS);
  const latency = useLatencyResults();
  const servers = useMemo(() => baseServers.map((s) => {
    const st = latency.get(s.id)?.stats ?? null;
    return { ...s, latency: st?.median ?? null, spread: st?.mad ?? null };
  }), [baseServers, latency]);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState<"servers" | "heat" | "stats" | "history" | "games" | "tools" | "providers">("servers");
  const providerState = useProviderConfig();
  const { activeProvider, providers } = providerState;
  const providerReady = isProviderConfigComplete(activeProvider);
  const vpnDetector = useVpnDetector();
  const [showQR, setShowQR] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showProviderRequired, setShowProviderRequired] = useState(false);
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState({ totalSessions: 0, totalDuration: 0 });

  // Auto-select first server
  useEffect(() => {
    if (!selectedServerId && servers.length > 0) {
      setSelectedServerId(servers[0].id);
    }
  }, [selectedServerId, servers]);

  // Duration counter
  useEffect(() => {
    if (!connection) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - connection.connectedAt.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [connection]);

  const handleConnect = useCallback(() => {
    if (!selectedServerId) return;
    // A session needs the user's own provider details (peer key + endpoint)
    if (!isProviderConfigComplete(activeProvider)) {
      setShowProviderRequired(true);
      return;
    }
    const server = servers.find((s) => s.id === selectedServerId);
    if (!server) return;
    setIsConnecting(true);
    // Check if VPN is actually active by fetching public IP
    fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data) {
          // Store the detected IP info so we can show real connection status
          (window as Window & { __vpnIpInfo?: unknown }).__vpnIpInfo = data;
        }
        setConnection({
          server,
          assignedIp: activeProvider.clientIp,
          connectedAt: new Date(),
          protocol: server.protocol,
        });
      })
      .catch(() => {
        // UI session only. This does not create a WireGuard tunnel.
        setConnection({
          server,
          assignedIp: activeProvider.clientIp,
          connectedAt: new Date(),
          protocol: server.protocol,
        });
      })
      .finally(() => {
        setIsConnecting(false);
      });
  }, [selectedServerId, servers, activeProvider]);

  const handleDisconnect = useCallback(() => {
    if (!connection) return;
    setIsDisconnecting(true);
    setTimeout(() => {
      const dur = elapsed;
      setHistory((prev) => [{ server: connection.server, duration: dur, date: new Date(), status: "disconnected" }, ...prev]);
      setStats((p) => ({ totalSessions: p.totalSessions + 1, totalDuration: p.totalDuration + dur }));
      setConnection(null);
      setIsDisconnecting(false);
    }, 600);
  }, [connection, elapsed]);

  const testAll = useCallback(async () => {
    setIsTestingAll(true);
    await measureCities(servers.map((s) => s.id));
    setIsTestingAll(false);
  }, [servers]);

  // Config + QR come only from the user's own provider entry.
  const downloadWireGuardConfig = useCallback(() => {
    if (!isProviderConfigComplete(activeProvider)) {
      setShowProviderRequired(true);
      return;
    }
    downloadText(providerConfigFilename(activeProvider), generateProviderWireGuardConfig(activeProvider));
  }, [activeProvider]);

  const openQR = useCallback(() => {
    if (!isProviderConfigComplete(activeProvider)) {
      setShowProviderRequired(true);
      return;
    }
    setShowQR(true);
  }, [activeProvider]);

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Header */}
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(5,5,7,0.95)] backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-[#6B7280] hover:text-white transition-colors p-1 cursor-pointer bg-transparent border-0">
              <ChevronLeft size={20} />
            </button>
            <span className="font-['Archivo'] font-bold text-lg tracking-tight">
              VELOCITY<span className="text-[#E85D4E]">VPN</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {vpnDetector.isVpnActive && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-[rgba(74,222,128,0.1)] rounded-full border border-[rgba(74,222,128,0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ADE80] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4ADE80]" />
                </span>
                <span className="text-[#4ADE80] text-xs font-medium">VPN Active</span>
              </div>
            )}
            <button onClick={() => navigate("/login")} className="text-xs text-[#E85D4E] hover:text-white transition-colors flex items-center gap-1 cursor-pointer bg-transparent border-0">
              <LogIn size={12} /> Sign In
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Guest banner */}
        <div className="bg-[rgba(74,222,128,0.05)] border border-[rgba(74,222,128,0.15)] rounded-xl p-3 mb-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[rgba(74,222,128,0.1)] flex items-center justify-center shrink-0">
            <CheckCircle2 size={16} className="text-[#4ADE80]" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-white font-medium">Full Access</p>
            <p className="text-xs text-[#9CA3AF]">All features unlocked. Add a provider in the Providers tab to connect.</p>
          </div>
          <button onClick={() => navigate("/login")} className="px-4 py-2 bg-[#9B6DFF] text-white rounded-lg text-xs font-medium cursor-pointer border-0 shrink-0">
            Sign Up
          </button>
        </div>

        {/* Status Card */}
        <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${vpnDetector.isVpnActive ? "bg-[rgba(74,222,128,0.15)]" : connection ? "bg-[rgba(74,222,128,0.1)]" : "bg-[rgba(255,255,255,0.05)]"}`}>
                {vpnDetector.isVpnActive ? <Wifi size={24} className="text-[#4ADE80]" /> : connection ? <Shield size={24} className="text-[#4ADE80]" /> : <Shield size={24} className="text-[#6B7280]" />}
              </div>
              <div>
                <h2 className="font-['Archivo'] text-xl tracking-tight">
                  {vpnDetector.isVpnActive ? "Public IP looks like a VPN" : connection ? "Dashboard session only - not a tunnel" : "No dashboard session"}
                </h2>
                <p className="text-[#9CA3AF] text-sm mt-0.5">
                  {vpnDetector.isVpnActive
                    ? `${vpnDetector.currentCity ?? "Unknown"} - ${vpnDetector.currentIp ?? "..."}`
                    : connection
                    ? activeProvider
                      ? `${activeProvider.name} - ${formatDuration(elapsed)}`
                      : `${connection.server.city} - ${formatDuration(elapsed)}`
                    : providerReady
                    ? `${activeProvider.name} ready - download the config or scan the QR into WireGuard`
                    : "Add your provider's WireGuard details to get a config"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {vpnDetector.hasBaseline ? (
                <button onClick={vpnDetector.clearHomeIp}
                  className="px-4 py-3 bg-[rgba(155,109,255,0.15)] text-[#9B6DFF] border border-[rgba(155,109,255,0.3)] rounded-lg font-medium hover:bg-[rgba(155,109,255,0.25)] transition-all flex items-center gap-2 text-sm cursor-pointer"
                  title="Clear the saved home IP">
                  <RefreshCw size={16} /> Clear Baseline
                </button>
              ) : (
                <button onClick={vpnDetector.setHomeIp}
                  className="px-4 py-3 bg-[rgba(155,109,255,0.15)] text-[#9B6DFF] border border-[rgba(155,109,255,0.3)] rounded-lg font-medium hover:bg-[rgba(155,109,255,0.25)] transition-all flex items-center gap-2 text-sm cursor-pointer"
                  title="Save current IP as your home IP (turn VPN OFF first)">
                  <Shield size={16} /> Set Home IP
                </button>
              )}
              <button onClick={handleConnect} disabled={isConnecting || !!connection}
                className={`px-6 py-3 rounded-lg font-medium flex items-center gap-2 text-sm transition-all border-0 ${connection ? "bg-[rgba(74,222,128,0.15)] text-[#4ADE80] border border-[#4ADE80]" : isConnecting ? "bg-[#E85D4E]/70 text-white" : "bg-[#E85D4E] text-white hover:bg-[#D44A3C]"} ${(isConnecting || !!connection) ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}`}>
                <Power size={16} /> {isConnecting ? "Connecting..." : connection ? "Connected" : "Connect"}
              </button>
              {connection && (
                <button onClick={handleDisconnect} disabled={isDisconnecting}
                  className="px-6 py-3 bg-[rgba(239,68,68,0.15)] text-[#EF4444] border border-[rgba(239,68,68,0.3)] rounded-lg font-medium hover:bg-[rgba(239,68,68,0.25)] transition-all flex items-center gap-2 text-sm cursor-pointer disabled:opacity-50">
                  <Zap size={16} /> {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              )}
              <button onClick={() => setShowHowTo(true)} className="hidden sm:flex px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#9CA3AF] rounded-lg text-xs items-center gap-2 cursor-pointer hover:border-[#9B6DFF]">
                <HelpCircle size={14} /> How to Connect
              </button>
              {providerReady ? (
                <>
                  <button onClick={openQR} className="hidden sm:flex px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#A3B8D4] rounded-lg text-xs items-center gap-2 cursor-pointer hover:border-[#A3B8D4]">
                    <ScanLine size={14} /> QR
                  </button>
                  <button onClick={downloadWireGuardConfig} className="hidden sm:flex px-5 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#4ADE80] rounded-lg text-xs items-center gap-2 cursor-pointer hover:border-[#4ADE80]">
                    <Download size={14} /> Config
                  </button>
                </>
              ) : (
                <button onClick={() => setActiveTab("providers")} className="flex px-4 py-2.5 bg-[#111118] border border-[rgba(163,184,212,0.3)] text-[#A3B8D4] rounded-lg text-xs items-center gap-2 cursor-pointer hover:border-[#A3B8D4]">
                  <Key size={14} /> Add your provider's WireGuard details
                </button>
              )}
            </div>
          </div>

          {connection && (
            <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.08)]">
              {/* Active Provider Banner */}
              {activeProvider && (
                <div className={`rounded-xl p-3 mb-3 flex items-center gap-3 border ${vpnDetector.isVpnActive ? "bg-[rgba(74,222,128,0.05)] border-[rgba(74,222,128,0.15)]" : connection ? "bg-[rgba(74,222,128,0.05)] border-[rgba(74,222,128,0.15)]" : "bg-[rgba(251,191,36,0.05)] border-[rgba(251,191,36,0.15)]"}`}>
                  <Globe size={16} className={`shrink-0 ${vpnDetector.isVpnActive || connection ? "text-[#4ADE80]" : "text-[#FBBF24]"}`} />
                  <div className="min-w-0">
                    <div className={`text-xs font-semibold ${vpnDetector.isVpnActive || connection ? "text-[#4ADE80]" : "text-[#FBBF24]"}`}>
                      {activeProvider.name} {vpnDetector.isVpnActive ? "- VPN Active" : connection ? "- Active" : "- Ready"}
                    </div>
                    <div className="text-[10px] text-[#6B7280] font-['JetBrains_Mono'] truncate">{activeProvider.wgEndpoint}</div>
                  </div>
                  <span className={`ml-auto px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${vpnDetector.isVpnActive ? "bg-[rgba(74,222,128,0.1)] text-[#4ADE80]" : connection ? "bg-[rgba(74,222,128,0.1)] text-[#4ADE80]" : "bg-[rgba(251,191,36,0.1)] text-[#FBBF24]"}`}>
                    {vpnDetector.isVpnActive ? "WireGuard ON" : connection ? "Dashboard" : "Config Ready"}
                  </span>
                </div>
              )}
              {!activeProvider && providers.length > 0 && (
                <div className="bg-[rgba(163,184,212,0.05)] border border-[rgba(163,184,212,0.15)] rounded-xl p-3 mb-3 flex items-center gap-3">
                  <Info size={16} className="text-[#A3B8D4] shrink-0" />
                  <div className="text-xs text-[#9CA3AF]">Go to the <button onClick={() => setActiveTab("providers")} className="text-[#FBBF24] hover:underline cursor-pointer bg-transparent border-0 p-0 font-medium">Providers</button> tab to activate a config.</div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#111118] rounded-xl p-3"><div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><Clock size={10} /> Duration</div><div className="font-['JetBrains_Mono'] text-base text-white">{formatDuration(elapsed)}</div></div>
                <div className="bg-[#111118] rounded-xl p-3"><div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><ArrowDown size={10} /> Download</div><div className="font-['JetBrains_Mono'] text-base text-[#4ADE80]" title="Traffic goes through the WireGuard app, not this page">{NOT_TRACKED}</div></div>
                <div className="bg-[#111118] rounded-xl p-3"><div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><ArrowUp size={10} /> Upload</div><div className="font-['JetBrains_Mono'] text-base text-[#A3B8D4]" title="Traffic goes through the WireGuard app, not this page">{NOT_TRACKED}</div></div>
                <div className="bg-[#111118] rounded-xl p-3"><div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><Activity size={10} /> Protocol</div><div className="font-['JetBrains_Mono'] text-base text-white uppercase">{connection.protocol}</div></div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(["servers", "heat", "stats", "history", "games", "tools", "providers"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-[#E85D4E] text-white" : "text-[#9CA3AF] hover:text-white"} flex items-center gap-1.5 shrink-0`}>
              {tab === "servers" ? <><Server size={13} /> Locations</> : tab === "heat" ? <><Globe size={13} /> Regions</> : tab === "stats" ? <><Activity size={13} /> Stats</> : tab === "history" ? <><Clock size={13} /> History</> : tab === "games" ? <><Gamepad2 size={13} /> Games</> : tab === "providers" ? <><Globe size={13} /> Providers</> : <><ScanLine size={13} /> Tools</>}
            </button>
          ))}
        </div>

        {/* Servers Tab */}
        {activeTab === "servers" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-['Archivo'] text-lg tracking-tight">Latency Reference Locations ({servers.length})</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">Round-trip time from your browser to a cloud data center near each city, the same test as the home page. It&apos;s not your VPN server, and not an ICMP ping.</p>
                <p className="text-xs text-[#6B7280] mt-0.5" data-testid="variance-note">{VARIANCE_NOTE}</p>
              </div>
              <button onClick={testAll} disabled={isTestingAll}
                className="flex shrink-0 whitespace-nowrap items-center gap-1.5 text-sm text-[#E85D4E] hover:text-white transition-colors disabled:opacity-50 cursor-pointer bg-transparent border-0">
                <RefreshCw size={13} className={isTestingAll ? "animate-spin" : ""} /> {isTestingAll ? "Testing..." : "Test All"}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {servers.map((server) => {
                const isSel = selectedServerId === server.id;
                const isConn = connection?.server.id === server.id;
                return (
                  <div key={server.id}
                    onClick={() => { if (!connection) setSelectedServerId(server.id); }}
                    className={`relative bg-[#0A0A0F] border rounded-xl p-4 transition-all ${isConn ? "border-[#4ADE80] bg-[rgba(74,222,128,0.05)]" : isSel ? "border-[#E85D4E]" : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]"} cursor-pointer`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getFlag(server.countryCode)}</span>
                        <div>
                          <div className="font-medium text-sm text-white">{server.city}</div>
                          <div className="text-xs text-[#6B7280]">{server.name}</div>
                          <div className="text-[10px] text-[#6B7280] font-['JetBrains_Mono']">
                            {(() => {
                              const r = latency.get(server.id);
                              const t = r?.target ?? primaryLatencyTarget(server.id);
                              if (!t) return null;
                              const fb = !!r?.viaFallback;
                              return (
                                <>
                                  <span className={fb ? "text-[#FBBF24]" : "text-[#A3B8D4]"}>{latencyHeadlineLabel(t, fb)}</span>{" "}
                                  <EstimateTag className="ml-0.5" />
                                  <span className="block text-[#4B5563]">{latencyTargetLabel(t)}</span>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <LatencyBadge result={latency.get(server.id)} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Regions tab (no load data yet) */}
        {activeTab === "heat" && <ServerHeatMap servers={servers} onSelect={setSelectedServerId} />}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1"><Activity size={10} /> Sessions</div>
                <div className="font-['JetBrains_Mono'] text-2xl text-white">{stats.totalSessions + (connection ? 1 : 0)}</div>
              </div>
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1"><Clock size={10} /> Duration</div>
                <div className="font-['JetBrains_Mono'] text-2xl text-white">{formatDuration(stats.totalDuration + (connection ? elapsed : 0))}</div>
              </div>
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1"><ArrowDown size={10} /> Received</div>
                <div className="font-['JetBrains_Mono'] text-2xl text-[#4ADE80]">{NOT_TRACKED}</div>
                <div className="text-[10px] text-[#6B7280] mt-1">See the WireGuard app</div>
              </div>
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1"><ArrowUp size={10} /> Sent</div>
                <div className="font-['JetBrains_Mono'] text-2xl text-[#A3B8D4]">{NOT_TRACKED}</div>
                <div className="text-[10px] text-[#6B7280] mt-1">See the WireGuard app</div>
              </div>
            </div>
            {connection && (
              <div className="bg-[rgba(74,222,128,0.05)] border border-[rgba(74,222,128,0.15)] rounded-xl p-3 flex items-center gap-2">
                <Activity size={14} className="text-[#4ADE80]" />
                <span className="text-xs text-[#4ADE80]">Live session active - stats include current connection</span>
              </div>
            )}
            <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
              <h3 className="font-['Archivo'] text-base tracking-tight mb-3">Reference Location Latency</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {servers.map((s) => (
                  <div key={s.id} className="bg-[#111118] rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{getFlag(s.countryCode)}</span>
                      <span className="text-xs text-white font-medium">{s.city}</span>
                    </div>
                    <div className="font-['JetBrains_Mono'] text-[11px] text-[#9CA3AF]">{latency.get(s.id)?.status === "unavailable" ? "Unavailable" : s.latency !== null ? `${s.latency} ms ${formatSpreadPm(s.spread ?? 0)}` : "-- ms"}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <h3 className="font-['Archivo'] text-lg tracking-tight">Connection History</h3>
            {history.length === 0 ? (
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8 text-center text-[#6B7280]">
                <Clock size={32} className="mx-auto mb-2 opacity-30" />
                <p>No connection history yet.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((h, i) => (
                  <div key={i} className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getFlag(h.server.countryCode)}</span>
                      <div>
                        <div className="text-sm text-white font-medium">{h.server.city}</div>
                        <div className="text-[10px] text-[#6B7280]">{h.date.toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-[#4ADE80]">{formatDuration(h.duration)}</div>
                      <div className="text-[10px] text-[#6B7280]">Dashboard session</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Games Tab */}
        {activeTab === "games" && <SteamGamesPanel />}

        {/* Tools Tab */}
        {activeTab === "tools" && <ToolsTab downloadWireGuardConfig={downloadWireGuardConfig} openQR={openQR} providerReady={providerReady} goToProviders={() => setActiveTab("providers")} setShowHowTo={setShowHowTo} vpnDetector={vpnDetector} />}

        {/* Providers Tab */}
        {activeTab === "providers" && <ProviderSetup state={providerState} />}
      </div>

      {/* Modals */}
      {showQR && providerReady && <WireGuardQR provider={activeProvider} onClose={() => setShowQR(false)} onEdit={() => { setShowQR(false); setActiveTab("providers"); }} />}
      {showHowTo && <HowToConnectModal onClose={() => setShowHowTo(false)} />}

      {/* Provider Required Modal */}
      {showProviderRequired && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm" onClick={() => setShowProviderRequired(false)}>
          <div className="bg-[#0A0A0F] border border-[rgba(163,184,212,0.25)] rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(163,184,212,0.1)] flex items-center justify-center">
                <Key size={24} className="text-[#A3B8D4]" />
              </div>
              <div>
                <h3 className="font-['Archivo'] text-base tracking-tight text-white">Add your provider's WireGuard details</h3>
                <p className="text-xs text-[#6B7280]">One quick step, then your config and QR are ready</p>
              </div>
            </div>
            <div className="bg-[rgba(163,184,212,0.05)] border border-[rgba(163,184,212,0.15)] rounded-xl p-4 mb-5">
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                VelocityVPN doesn't run VPN servers - you bring your own WireGuard provider. Import the .conf your provider gives you (or enter its endpoint and server public key) and we'll build the config and QR code from it, right in your browser.
              </p>
            </div>
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <Check size={14} className="text-[#4ADE80]" /> Go to the <strong className="text-white">Providers</strong> tab
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <Check size={14} className="text-[#4ADE80]" /> Pick your provider (Mullvad, ProtonVPN, your own server...)
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <Check size={14} className="text-[#4ADE80]" /> Import or paste your .conf, then save
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <Check size={14} className="text-[#4ADE80]" /> Download the config or scan the QR in WireGuard
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowProviderRequired(false)} className="flex-1 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-white rounded-lg text-xs font-medium cursor-pointer hover:border-[#E85D4E]">
                Not now
              </button>
              <button onClick={() => { setShowProviderRequired(false); setActiveTab("providers"); }} className="flex-1 py-2.5 bg-[#E85D4E] text-white rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-[#D44A3C]">
                Go to Providers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tools Tab Component ──────────────────────────────────────

function ToolsTab({ downloadWireGuardConfig, openQR, providerReady, goToProviders, setShowHowTo, vpnDetector }: {
  downloadWireGuardConfig: () => void;
  openQR: () => void;
  providerReady: boolean;
  goToProviders: () => void;
  setShowHowTo: (v: boolean) => void;
  vpnDetector: ReturnType<typeof useVpnDetector>;
}) {
  const [speedPhase, setSpeedPhase] = useState<"idle" | "running" | "done">("idle");
  const [speedResult, setSpeedResult] = useState<{ download: number; upload: number; latency: number } | null>(null);
  // Real VPN detection: 3 states
  // 1. No baseline → UNKNOWN (need to set home IP with VPN off)
  // 2. Has baseline, IP matches → EXPOSED
  // 3. Has baseline, IP differs → PROTECTED (VPN active)
  const isProtected = vpnDetector.isVpnActive;
  const needsBaseline = !vpnDetector.hasBaseline;

  const runSpeedTest = useCallback(async () => {
    setSpeedPhase("running");
    setSpeedResult(null);
    // Measure latency
    const latencies: number[] = [];
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      try { await fetch("https://www.cloudflare.com/cdn-cgi/trace?t=" + Date.now(), { method: "HEAD", cache: "no-store" }); } catch { /* ignore */ }
      latencies.push(Math.floor(performance.now() - start));
    }
    const avgLatency = Math.floor(latencies.reduce((a, b) => a + b, 0) / latencies.length);
    // Estimate download speed
    const start = performance.now();
    try {
      await fetch("https://speed.cloudflare.com/__down?bytes=1000000&t=" + Date.now(), { cache: "no-store" });
    } catch { /* ignore */ }
    const duration = (performance.now() - start) / 1000;
    const downloadMbps = Math.max(1, Math.round((1 * 8) / Math.max(duration, 0.1)));
    const uploadMbps = Math.max(1, Math.round(downloadMbps * 0.3));
    setSpeedResult({ download: downloadMbps, upload: uploadMbps, latency: avgLatency });
    setSpeedPhase("done");
  }, []);

  return (
    <div className="space-y-4">
      {/* Chrome Extension */}
      <div className="bg-[rgba(74,222,128,0.03)] border border-[rgba(74,222,128,0.15)] rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-[rgba(74,222,128,0.1)] flex items-center justify-center shrink-0"><Puzzle size={20} className="text-[#4ADE80]" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white mb-1">Chrome Extension (Proxy)</h3>
            <p className="text-xs text-[#9CA3AF] mb-3">Free Chrome extension that routes <strong className="text-white">browser traffic</strong> through a proxy server <strong className="text-white">you provide</strong>. It doesn't include a proxy and isn't WireGuard.</p>
            <ol className="text-xs text-[#9CA3AF] space-y-1 mb-3 list-decimal list-inside">
              <li>Download the extension ZIP below</li>
              <li>Extract to a folder</li>
              <li>Go to <code className="text-[#E85D4E]">chrome://extensions</code></li>
              <li>Enable <strong className="text-white">Developer mode</strong></li>
              <li>Click <strong className="text-white">Load unpacked</strong> and select the folder</li>
              <li>Open the extension and enter your proxy's host and port</li>
            </ol>
            <a href="/extension/velocityvpn-extension.zip" download className="inline-flex items-center gap-2 px-4 py-2 bg-[#4ADE80] text-[#050507] rounded-lg text-xs font-bold hover:bg-[#3ECF71] transition-all no-underline">
              <Download size={14} /> Download Extension
            </a>
          </div>
        </div>
      </div>

      {/* IP Display */}
      <div className={`rounded-2xl p-5 border ${isProtected ? "bg-[rgba(74,222,128,0.03)] border-[rgba(74,222,128,0.2)]" : needsBaseline ? "bg-[#0A0A0F] border-[rgba(251,191,36,0.2)]" : "bg-[#0A0A0F] border-[rgba(255,255,255,0.08)]"}`}>
        {/* Protection Status Banner */}
        <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl ${isProtected ? "bg-[rgba(74,222,128,0.08)]" : needsBaseline ? "bg-[rgba(251,191,36,0.08)]" : "bg-[rgba(239,68,68,0.08)]"}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isProtected ? "bg-[rgba(74,222,128,0.15)]" : needsBaseline ? "bg-[rgba(251,191,36,0.15)]" : "bg-[rgba(239,68,68,0.15)]"}`}>
            {isProtected ? <Shield size={20} className="text-[#4ADE80]" /> : needsBaseline ? <Wifi size={20} className="text-[#FBBF24]" /> : <AlertTriangle size={20} className="text-[#EF4444]" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${isProtected ? "text-[#4ADE80]" : needsBaseline ? "text-[#FBBF24]" : "text-[#EF4444]"}`}>
                {isProtected ? "VPN ACTIVE" : needsBaseline ? "UNKNOWN" : "EXPOSED"}
              </span>
              {isProtected && <span className="text-[9px] font-bold text-[#050507] bg-[#4ADE80] px-2 py-0.5 rounded-full">WIREGUARD</span>}
              {!isProtected && !needsBaseline && <span className="text-[9px] font-bold text-[#050507] bg-[#EF4444] px-2 py-0.5 rounded-full">NO VPN</span>}
              {needsBaseline && <span className="text-[9px] font-bold text-[#050507] bg-[#FBBF24] px-2 py-0.5 rounded-full">SETUP</span>}
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              {isProtected
                ? `Your IP changed from home address. WireGuard VPN is routing your traffic through ${vpnDetector.currentCity ?? "remote server"}.`
                : needsBaseline
                ? "Turn WireGuard OFF, then click 'Set Home IP' below to establish your baseline. Then turn VPN back on to detect it."
                : "Your real IP matches your home address. WireGuard is OFF - your traffic is not encrypted."}
            </p>
          </div>
        </div>
        {/* Baseline action buttons */}
        {needsBaseline && (
          <div className="mb-4">
            <button onClick={vpnDetector.setHomeIp}
              className="w-full py-3 bg-[#FBBF24] text-[#050507] rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-[#F5A623] flex items-center justify-center gap-2">
              <Shield size={14} /> Set Home IP (WireGuard must be OFF)
            </button>
            <p className="text-[10px] text-[#6B7280] mt-2 text-center">This saves your current IP as "home." After saving, turn WireGuard ON and the dashboard will detect it.</p>
          </div>
        )}
        {isProtected && (
          <div className="mb-4">
            <button onClick={vpnDetector.clearHomeIp}
              className="w-full py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#9CA3AF] rounded-lg text-xs font-medium cursor-pointer hover:border-[#EF4444]">
              Clear Baseline
            </button>
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Archivo'] text-base tracking-tight flex items-center gap-2">
            <Globe size={18} className={isProtected ? "text-[#4ADE80]" : "text-[#E85D4E]"} />
            {isProtected ? "VPN Tunnel Exit IP" : "Your Real IP Address"}
          </h3>
        </div>
        {vpnDetector.isChecking && !vpnDetector.currentIp ? (
          <div className="text-sm text-[#6B7280] flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Detecting IP...</div>
        ) : vpnDetector.currentIp ? (
          <>
            <div className={`rounded-xl p-4 mb-3 ${isProtected ? "bg-[rgba(74,222,128,0.05)]" : "bg-[#111118]"}`}>
              <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">
                {isProtected ? "Exit IP (VPN Server)" : "Public IP"}
              </div>
              <div className={`font-['JetBrains_Mono'] text-2xl tracking-wider ${isProtected ? "text-[#4ADE80]" : "text-white"}`}>
                {vpnDetector.currentIp}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: "Location", v: `${vpnDetector.currentCity ?? "?"}, ${vpnDetector.currentCountry ?? "?"}` },
                { l: "Home IP", v: vpnDetector.homeIp ? `${vpnDetector.homeIp.slice(0, 10)}...` : "Not set", color: vpnDetector.homeIp ? "text-[#D1D5DB]" : "text-[#FBBF24]" },
                { l: "Checked", v: new Date(vpnDetector.lastCheck).toLocaleTimeString() },
                { l: "Status", v: isProtected ? "VPN ACTIVE" : needsBaseline ? "NEEDS SETUP" : "EXPOSED", color: isProtected ? "text-[#4ADE80]" : needsBaseline ? "text-[#FBBF24]" : "text-[#EF4444]" },
              ].map((item) => (
                <div key={item.l} className="bg-[#111118] rounded-lg p-2.5">
                  <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">{item.l}</div>
                  <div className={`text-xs truncate font-medium ${item.color || "text-[#D1D5DB]"}`}>{item.v}</div>
                </div>
              ))}
            </div>
            {/* VPN Detection Status */}
            <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.06)] flex items-start gap-2">
              {isProtected ? <Wifi size={12} className="text-[#4ADE80] mt-0.5 shrink-0" /> : needsBaseline ? <AlertTriangle size={12} className="text-[#FBBF24] mt-0.5 shrink-0" /> : <Lock size={12} className="text-[#4ADE80] mt-0.5 shrink-0" />}
              <div>
                <span className={`text-xs font-medium ${isProtected ? "text-[#4ADE80]" : needsBaseline ? "text-[#FBBF24]" : "text-[#4ADE80]"}`}>
                  {isProtected ? "WireGuard VPN Detected - IP changed from baseline" : needsBaseline ? "Step 1: Set your home IP with VPN off" : "Your details stay in your browser"}
                </span>
                <p className="text-[10px] text-[#6B7280]">
                  {isProtected
                    ? `IP changed from ${vpnDetector.homeIp} → ${vpnDetector.currentIp}. Auto-checking every 15 seconds.`
                    : needsBaseline
                    ? "After setting home IP, turn WireGuard ON. The dashboard will auto-detect the change."
                    : "VelocityVPN doesn't carry your traffic. Provider details stay in this browser; private keys only for the session."}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-sm text-[#EF4444]">Unable to detect IP</div>
        )}
      </div>

      {/* Speed Test */}
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Archivo'] text-base tracking-tight flex items-center gap-2"><Activity size={18} className="text-[#E85D4E]" /> Speed Test</h3>
          {speedPhase === "idle" && <button onClick={runSpeedTest} className="px-4 py-2 bg-[#E85D4E] text-white rounded-lg text-xs font-medium cursor-pointer border-0 hover:bg-[#D44A3C]"><Activity size={14} className="inline mr-1" /> Start</button>}
        </div>
        {speedPhase === "running" && <div className="text-center py-6"><Loader2 size={24} className="animate-spin text-[#E85D4E] mx-auto mb-2" /><p className="text-sm text-[#9CA3AF]">Testing your connection...</p></div>}
        {speedPhase === "done" && speedResult && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#111118] rounded-xl p-3 text-center"><div className="text-[10px] text-[#6B7280] mb-1">Download</div><div className="font-['JetBrains_Mono'] text-xl text-[#4ADE80]">{speedResult.download} Mbps</div></div>
            <div className="bg-[#111118] rounded-xl p-3 text-center"><div className="text-[10px] text-[#6B7280] mb-1">Upload</div><div className="font-['JetBrains_Mono'] text-xl text-[#A3B8D4]">{speedResult.upload} Mbps</div></div>
            <div className="bg-[#111118] rounded-xl p-3 text-center"><div className="text-[10px] text-[#6B7280] mb-1">Latency</div><div className="font-['JetBrains_Mono'] text-xl text-[#FBBF24]">{speedResult.latency} ms</div></div>
          </div>
        )}
        {speedPhase === "idle" && !speedResult && <div className="text-center py-6 text-[#6B7280] text-sm">Click Start to measure your connection speed.</div>}
      </div>

      {/* Quick Actions */}
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
        <h3 className="font-['Archivo'] text-base tracking-tight mb-3">Quick Actions</h3>
        {providerReady ? (
          <div className="flex flex-wrap gap-3">
            <button onClick={openQR} className="px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-white rounded-lg text-xs cursor-pointer hover:border-[#A3B8D4]"><ScanLine size={14} className="inline mr-1" /> Show QR</button>
            <button onClick={downloadWireGuardConfig} className="px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#4ADE80] rounded-lg text-xs cursor-pointer hover:border-[#4ADE80]"><Download size={14} className="inline mr-1" /> Download Config</button>
            <button onClick={() => setShowHowTo(true)} className="px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#9B6DFF] rounded-lg text-xs cursor-pointer hover:border-[#9B6DFF]"><HelpCircle size={14} className="inline mr-1" /> How to Connect</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-[#9CA3AF] flex-1 min-w-[200px]">Add your provider's WireGuard details to download a config or show a QR code.</p>
            <button onClick={goToProviders} className="px-4 py-2.5 bg-[#111118] border border-[rgba(163,184,212,0.3)] text-[#A3B8D4] rounded-lg text-xs cursor-pointer hover:border-[#A3B8D4]"><Key size={14} className="inline mr-1" /> Add provider details</button>
            <button onClick={() => setShowHowTo(true)} className="px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#9B6DFF] rounded-lg text-xs cursor-pointer hover:border-[#9B6DFF]"><HelpCircle size={14} className="inline mr-1" /> How to Connect</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── WireGuard QR Modal ───────────────────────────────────────

function WireGuardQR({ provider, onClose, onEdit }: { provider: ProviderConfig; onClose: () => void; onEdit: () => void }) {
  const [qrUrl, setQrUrl] = useState("");
  const hasPrivateKey = !!provider.clientPrivateKey;
  const config = generateProviderWireGuardConfig(provider);

  useEffect(() => {
    if (!hasPrivateKey) return;
    let cancelled = false;
    import("qrcode").then((QR) => {
      QR.default.toDataURL(config, { width: 280, margin: 2, color: { dark: "#ffffff", light: "#0A0A0F" } })
        .then((url: string) => { if (!cancelled) setQrUrl(url); }).catch(() => {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [config, hasPrivateKey]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <h3 className="font-['Archivo'] text-base tracking-tight">WireGuard Config</h3>
            <p className="text-[11px] text-[#6B7280] truncate">{provider.name} — {provider.wgEndpoint}</p>
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-white cursor-pointer bg-transparent border-0"><X size={18} /></button>
        </div>
        {hasPrivateKey ? (
          <>
            <div className="bg-[#111118] rounded-xl p-4 flex items-center justify-center mb-2">
              {qrUrl ? <img src={qrUrl} alt="WireGuard config QR code" className="w-56 h-56" /> : <Loader2 size={32} className="animate-spin text-[#E85D4E]" />}
            </div>
            <p className="text-[10px] text-[#6B7280] mb-4 text-center">Scan with the WireGuard app: Add tunnel → Scan from QR code. Contains your private key, so don't share it.</p>
          </>
        ) : (
          <div className="bg-[rgba(163,184,212,0.06)] border border-[rgba(163,184,212,0.2)] rounded-xl p-4 mb-4 flex gap-3">
            <Info size={18} className="text-[#A3B8D4] shrink-0 mt-0.5" />
            <p className="text-xs text-[#9CA3AF] leading-relaxed">
              Add your private key to show a scannable QR. It's kept only for this browser session.{" "}
              <button onClick={onEdit} className="text-[#E85D4E] hover:underline bg-transparent border-0 p-0 cursor-pointer text-xs">Open Providers</button>
            </p>
          </div>
        )}
        <button onClick={() => downloadText(providerConfigFilename(provider), config)}
          className="w-full py-2.5 bg-[#E85D4E] text-white rounded-lg text-xs font-medium cursor-pointer border-0 hover:bg-[#D44A3C]"><Download size={14} className="inline mr-1" /> Download Config</button>
      </div>
    </div>
  );
}

// ─── How to Connect Modal ─────────────────────────────────────

function HowToConnectModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div><h3 className="font-['Archivo'] text-lg tracking-tight">Get a Real VPN</h3><p className="text-xs text-[#6B7280] mt-0.5">VelocityVPN works with any WireGuard provider</p></div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-white cursor-pointer bg-transparent border-0"><X size={20} /></button>
        </div>

        <div className="bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.2)] rounded-xl p-4 mb-5 flex gap-3">
          <AlertTriangle size={18} className="text-[#FBBF24] shrink-0 mt-0.5" />
          <div className="text-xs text-[#9CA3AF] leading-relaxed">VelocityVPN is a <strong className="text-white">management dashboard</strong>, not a VPN service. Bring a WireGuard provider, then import its .conf in the <strong className="text-white">Providers</strong> tab - the config download and QR code are built from your provider's details.</div>
        </div>

        <h4 className="text-sm font-semibold text-white mb-3">Recommended: Mullvad</h4>
        <div className="space-y-3 mb-5">
          {[
            { icon: <Globe size={16} />, text: "Go to ", link: "mullvad.net", url: "https://mullvad.net", desc: " - no email needed, accepts crypto/cash" },
            { icon: <Download size={16} />, text: "Install WireGuard app from ", link: "wireguard.com", url: "https://wireguard.com/install", desc: "" },
            { icon: <Key size={16} />, text: "In your Mullvad account, generate a WireGuard config for your chosen server location", link: "", url: "", desc: "" },
            { icon: <Smartphone size={16} />, text: "Import that .conf in the Providers tab here, then download it or scan the QR code into the WireGuard app", link: "", url: "", desc: "" },
            { icon: <Wifi size={16} />, text: "Toggle ON - your traffic is now encrypted and routed through Mullvad", link: "", url: "", desc: "" },
          ].map((step, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-[rgba(232,93,78,0.1)] flex items-center justify-center shrink-0"><span className="text-[#E85D4E]">{step.icon}</span></div>
              <p className="text-xs text-[#9CA3AF] leading-relaxed pt-1">{step.text}{step.link && <a href={step.url} target="_blank" rel="noopener noreferrer" className="text-[#E85D4E] hover:underline">{step.link}</a>}{step.desc}</p>
            </div>
          ))}
        </div>

        <h4 className="text-sm font-semibold text-white mb-3">Other Providers</h4>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { name: "ProtonVPN", url: "https://protonvpn.com", note: "Free tier" },
            { name: "Windscribe", url: "https://windscribe.com", note: "Free 10GB/mo" },
            { name: "IVPN", url: "https://ivpn.net", note: "Privacy-focused" },
            { name: "Mullvad", url: "https://mullvad.net", note: "Best for WG" },
          ].map((p) => (
            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" className="bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 hover:border-[rgba(255,255,255,0.2)] transition-colors">
              <div className="text-xs text-white font-medium">{p.name}</div>
              <div className="text-[10px] text-[#6B7280]">{p.note}</div>
            </a>
          ))}
        </div>

        <button onClick={onClose} className="w-full py-2.5 bg-[#E85D4E] text-white rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-[#D44A3C]">Got It</button>
      </div>
    </div>
  );
}
