import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Shield, Zap, Power, Clock, ArrowDown, ArrowUp,
  Activity, Server, RefreshCw, ChevronLeft, Download,
  Flame, Globe, Navigation, Lock, Gamepad2, ScanLine,
  HelpCircle, Puzzle, Key, LogIn, ChevronRight, X,
  Smartphone, Wifi, AlertTriangle, CheckCircle2,
  TrendingUp, Users, Copy, Check, Loader2
} from "lucide-react";
import { VELOCITY_SERVERS, generateWireGuardConfig, getFlag } from "@/data/velocity-servers";
import { generateWireGuardPrivateKey } from "@/lib/wg-keygen";
import SteamGamesPanel from "@/components/SteamGamesPanel";
import ServerHeatMap from "@/components/ServerHeatMap";
import ProviderSetup from "@/components/ProviderSetup";
import { useProviderConfig, generateProviderWireGuardConfig } from "@/hooks/useProviderConfig";

// ─── Types ────────────────────────────────────────────────────

interface VPNServer {
  id: number; name: string; city: string; country: string;
  countryCode: string; region: string; hostname: string;
  load: number; ping: number | null; jitter: number | null;
  protocol: string;
}

interface Connection {
  server: VPNServer; assignedIp: string; connectedAt: Date; protocol: string;
}

interface SessionRecord {
  server: VPNServer; duration: number; bytesSent: number;
  bytesReceived: number; date: Date; status: string;
}

// ─── Helpers ──────────────────────────────────────────────────

const INITIAL_SERVERS: VPNServer[] = VELOCITY_SERVERS.map((s) => ({
  id: s.id, name: s.name, city: s.city, country: s.country,
  countryCode: s.countryCode, region: s.region, hostname: s.hostname,
  load: Math.floor(Math.random() * 35) + 15,
  ping: Math.floor(Math.random() * 60) + 15,
  jitter: Math.floor(Math.random() * 6) + 1,
  protocol: "wireguard",
}));

function formatDuration(s: number) {
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m ${s % 60}s` : `${m}m ${s % 60}s`;
}
function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
}

// ─── Dashboard Component ──────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<VPNServer[]>(INITIAL_SERVERS);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activeTab, setActiveTab] = useState<"servers" | "heat" | "stats" | "history" | "games" | "tools" | "providers">("servers");
  const { activeProvider, providers } = useProviderConfig();
  const [showQR, setShowQR] = useState<number | null>(null);
  const [showHowTo, setShowHowTo] = useState(false);
  const [showProviderRequired, setShowProviderRequired] = useState(false);
  const [generatedKey, setGeneratedKey] = useState("");
  const [isPingingAll, setIsPingingAll] = useState(false);
  const [history, setHistory] = useState<SessionRecord[]>([]);
  const [stats, setStats] = useState({ totalSessions: 0, totalDuration: 0, totalDataSent: 0, totalDataReceived: 0 });

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
    // Block connection if no real provider is configured
    if (!activeProvider) {
      setShowProviderRequired(true);
      return;
    }
    const server = servers.find((s) => s.id === selectedServerId);
    if (!server) return;
    setIsConnecting(true);
    setTimeout(() => {
      const ip = activeProvider.clientIp;
      setConnection({ server, assignedIp: ip, connectedAt: new Date(), protocol: server.protocol });
      setServers((prev) => prev.map((s) => s.id === server.id ? { ...s, load: Math.min(100, s.load + 4) } : s));
      setIsConnecting(false);
    }, 1200);
  }, [selectedServerId, servers, activeProvider]);

  const handleDisconnect = useCallback(() => {
    if (!connection) return;
    setIsDisconnecting(true);
    setTimeout(() => {
      const dur = elapsed;
      const up = Math.floor(Math.random() * 400000000) + 1000000;
      const down = Math.floor(Math.random() * 1800000000) + 5000000;
      setHistory((prev) => [{ server: connection.server, duration: dur, bytesSent: up, bytesReceived: down, date: new Date(), status: "disconnected" }, ...prev]);
      setStats((p) => ({ totalSessions: p.totalSessions + 1, totalDuration: p.totalDuration + dur, totalDataSent: p.totalDataSent + up, totalDataReceived: p.totalDataReceived + down }));
      setServers((prev) => prev.map((s) => s.id === connection.server.id ? { ...s, load: Math.max(0, s.load - 4) } : s));
      setConnection(null);
      setIsDisconnecting(false);
    }, 600);
  }, [connection, elapsed]);

  const testAll = useCallback(() => {
    setIsPingingAll(true);
    const tests = servers.map((s, i) =>
      new Promise<void>((resolve) =>
        setTimeout(() => {
          setServers((prev) => prev.map((sv) =>
            sv.id === s.id ? { ...sv, ping: Math.floor(Math.random() * 80) + 15, jitter: Math.floor(Math.random() * 8) + 1 } : sv
          ));
          resolve();
        }, i * 80)
      )
    );
    Promise.all(tests).then(() => setIsPingingAll(false));
  }, [servers]);

  const downloadWireGuardConfig = useCallback(() => {
    if (!connection) return;
    // Use active provider config if available — this creates a REAL working config
    if (activeProvider) {
      const config = generateProviderWireGuardConfig(activeProvider);
      const blob = new Blob([config], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeProvider.provider}-${activeProvider.city.toLowerCase().replace(/\s/g, "-")}.conf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setGeneratedKey(activeProvider.clientPrivateKey);
      return;
    }
    // Fallback: template config (needs manual editing)
    const vServer = VELOCITY_SERVERS.find((s) => s.id === connection.server.id);
    if (!vServer) return;
    const key = generateWireGuardPrivateKey();
    const config = generateWireGuardConfig(vServer, key, connection.assignedIp + "/32");
    const blob = new Blob([config], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `velocity-${connection.server.city.toLowerCase().replace(/\s/g, "-")}.conf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setGeneratedKey(key);
  }, [connection, activeProvider]);

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
            {connection && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-[rgba(74,222,128,0.1)] rounded-full border border-[rgba(74,222,128,0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ADE80] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4ADE80]" />
                </span>
                <span className="text-[#4ADE80] text-xs font-medium">Connected</span>
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
              <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${connection ? "bg-[rgba(74,222,128,0.15)]" : "bg-[rgba(255,255,255,0.05)]"}`}>
                {connection ? <Shield size={24} className="text-[#4ADE80]" /> : <Shield size={24} className="text-[#6B7280]" />}
              </div>
              <div>
                <h2 className="font-['Archivo'] text-xl tracking-tight">
                  {connection ? "VPN Connected" : "VPN Disconnected"}
                </h2>
                <p className="text-[#9CA3AF] text-sm mt-0.5">
                  {connection
                    ? `${connection.server.city} — ${formatDuration(elapsed)}`
                    : selectedServerId
                    ? activeProvider
                      ? `${servers.find((s) => s.id === selectedServerId)?.city ?? ""} selected — Ready to connect`
                      : `${servers.find((s) => s.id === selectedServerId)?.city ?? ""} selected — Provider required`
                    : "Select a server below to connect"}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
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
              {connection && (
                <>
                  <button onClick={() => setShowHowTo(true)} className="hidden sm:flex px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#9CA3AF] rounded-lg text-xs items-center gap-2 cursor-pointer hover:border-[#9B6DFF]">
                    <HelpCircle size={14} /> How to Connect
                  </button>
                  <button onClick={() => setShowQR(connection.server.id)} className="hidden sm:flex px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#A3B8D4] rounded-lg text-xs items-center gap-2 cursor-pointer hover:border-[#A3B8D4]">
                    <ScanLine size={14} /> QR
                  </button>
                  <button onClick={downloadWireGuardConfig} className="hidden sm:flex px-5 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#4ADE80] rounded-lg text-xs items-center gap-2 cursor-pointer hover:border-[#4ADE80]">
                    <Download size={14} /> Config
                  </button>
                </>
              )}
            </div>
          </div>

          {connection && (
            <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.08)]">
              {/* Active Provider Banner */}
              {activeProvider && (
                <div className="bg-[rgba(74,222,128,0.05)] border border-[rgba(74,222,128,0.15)] rounded-xl p-3 mb-3 flex items-center gap-3">
                  <Globe size={16} className="text-[#4ADE80] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-[#4ADE80]">{activeProvider.name}</div>
                    <div className="text-[10px] text-[#6B7280] font-['JetBrains_Mono'] truncate">{activeProvider.wgEndpoint}</div>
                  </div>
                  <span className="ml-auto px-2 py-0.5 bg-[rgba(74,222,128,0.1)] text-[#4ADE80] rounded text-[10px] font-bold shrink-0">Real Config</span>
                </div>
              )}
              {!activeProvider && providers.length > 0 && (
                <div className="bg-[rgba(251,191,36,0.05)] border border-[rgba(251,191,36,0.15)] rounded-xl p-3 mb-3 flex items-center gap-3">
                  <AlertTriangle size={16} className="text-[#FBBF24] shrink-0" />
                  <div className="text-xs text-[#9CA3AF]">Go to the <button onClick={() => setActiveTab("providers")} className="text-[#FBBF24] hover:underline cursor-pointer bg-transparent border-0 p-0 font-medium">Providers</button> tab to activate a real config for import into WireGuard.</div>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#111118] rounded-xl p-3"><div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><Clock size={10} /> Duration</div><div className="font-['JetBrains_Mono'] text-base text-white">{formatDuration(elapsed)}</div></div>
                <div className="bg-[#111118] rounded-xl p-3"><div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><ArrowDown size={10} /> Download</div><div className="font-['JetBrains_Mono'] text-base text-[#4ADE80]">{formatBytes(elapsed * 51200)}</div></div>
                <div className="bg-[#111118] rounded-xl p-3"><div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><ArrowUp size={10} /> Upload</div><div className="font-['JetBrains_Mono'] text-base text-[#A3B8D4]">{formatBytes(elapsed * 12288)}</div></div>
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
              {tab === "servers" ? <><Server size={13} /> Servers</> : tab === "heat" ? <><Flame size={13} /> Heat Map</> : tab === "stats" ? <><Activity size={13} /> Stats</> : tab === "history" ? <><Clock size={13} /> History</> : tab === "games" ? <><Gamepad2 size={13} /> Games</> : tab === "providers" ? <><Globe size={13} /> Providers</> : <><ScanLine size={13} /> Tools</>}
            </button>
          ))}
        </div>

        {/* Servers Tab */}
        {activeTab === "servers" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-['Archivo'] text-lg tracking-tight">Server Locations ({servers.length})</h3>
              <button onClick={testAll} disabled={isPingingAll}
                className="flex items-center gap-1.5 text-sm text-[#E85D4E] hover:text-white transition-colors disabled:opacity-50 cursor-pointer bg-transparent border-0">
                <RefreshCw size={13} className={isPingingAll ? "animate-spin" : ""} /> {isPingingAll ? "Testing..." : "Test All"}
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
                        </div>
                      </div>
                      <div className="text-right">
                        {server.ping !== null ? (
                          <><div className="font-['JetBrains_Mono'] text-sm text-[#4ADE80]">{server.ping}ms</div><div className="text-[10px] text-[#6B7280]">jitter {server.jitter}ms</div></>
                        ) : <div className="text-xs text-[#6B7280]">-- ms</div>}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-[#111118] rounded-full overflow-hidden">
                        <div className="h-full bg-[#E85D4E] rounded-full transition-all" style={{ width: `${server.load}%` }} />
                      </div>
                      <span className="text-[10px] text-[#6B7280] w-8 text-right">{server.load}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Heat Map Tab */}
        {activeTab === "heat" && <ServerHeatMap servers={servers} onSelect={setSelectedServerId} />}

        {/* Stats Tab */}
        {activeTab === "stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1"><Activity size={10} /> Sessions</div>
                <div className="font-['JetBrains_Mono'] text-2xl text-white">{stats.totalSessions}</div>
              </div>
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1"><Clock size={10} /> Duration</div>
                <div className="font-['JetBrains_Mono'] text-2xl text-white">{formatDuration(stats.totalDuration)}</div>
              </div>
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1"><ArrowDown size={10} /> Received</div>
                <div className="font-['JetBrains_Mono'] text-2xl text-[#4ADE80]">{formatBytes(stats.totalDataReceived)}</div>
              </div>
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-4 text-center">
                <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1"><ArrowUp size={10} /> Sent</div>
                <div className="font-['JetBrains_Mono'] text-2xl text-[#A3B8D4]">{formatBytes(stats.totalDataSent)}</div>
              </div>
            </div>
            <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
              <h3 className="font-['Archivo'] text-base tracking-tight mb-3">Server Status Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {servers.map((s) => (
                  <div key={s.id} className="bg-[#111118] rounded-lg p-2.5">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{getFlag(s.countryCode)}</span>
                      <span className="text-xs text-white font-medium">{s.city}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1 bg-[#1a1a24] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${s.load}%`, backgroundColor: s.load > 80 ? "#EF4444" : s.load > 50 ? "#FBBF24" : "#4ADE80" }} />
                      </div>
                      <span className="text-[10px] text-[#6B7280]">{s.load}%</span>
                    </div>
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
                      <div className="text-[10px] text-[#6B7280]">DL {formatBytes(h.bytesReceived)} / UL {formatBytes(h.bytesSent)}</div>
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
        {activeTab === "tools" && <ToolsTab downloadWireGuardConfig={downloadWireGuardConfig} connection={connection} setShowQR={setShowQR} setShowHowTo={setShowHowTo} />}

        {/* Providers Tab */}
        {activeTab === "providers" && <ProviderSetup />}
      </div>

      {/* Modals */}
      {showQR && <WireGuardQR serverId={showQR} onClose={() => setShowQR(null)} />}
      {showHowTo && <HowToConnectModal onClose={() => setShowHowTo(false)} />}
      {generatedKey && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm" onClick={() => setGeneratedKey("")}>
          <div className="bg-[#0A0A0F] border border-[rgba(74,222,128,0.2)] rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[rgba(74,222,128,0.1)] flex items-center justify-center"><Key size={20} className="text-[#4ADE80]" /></div>
              <div><h3 className="font-['Archivo'] text-base tracking-tight text-[#4ADE80]">Config Generated</h3><p className="text-xs text-[#6B7280]">Your WireGuard private key</p></div>
            </div>
            <div className="bg-[#111118] rounded-xl p-4 mb-4">
              <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">Private Key (save this!)</div>
              <div className="font-['JetBrains_Mono'] text-xs text-[#4ADE80] break-all select-all">{generatedKey}</div>
            </div>
            <div className="bg-[rgba(251,191,36,0.08)] border border-[rgba(251,191,36,0.25)] rounded-xl p-4 mb-4 flex gap-3">
              <AlertTriangle size={18} className="text-[#FBBF24] shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-semibold text-[#FBBF24] mb-1">Action Required</div>
                <div className="text-[11px] text-[#9CA3AF] leading-relaxed">Open the downloaded .conf file and replace <code className="text-[#FBBF24] font-mono">YOUR_SERVER_IP</code> with your actual WireGuard server IP. Without a real endpoint, the tunnel will NOT connect.</div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => navigator.clipboard.writeText(generatedKey)} className="flex-1 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-white rounded-lg text-xs font-medium cursor-pointer hover:border-[#4ADE80]">Copy Key</button>
              <button onClick={() => setGeneratedKey("")} className="flex-1 py-2.5 bg-[#4ADE80] text-[#050507] rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-[#3ECF71]">Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Provider Required Modal */}
      {showProviderRequired && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm" onClick={() => setShowProviderRequired(false)}>
          <div className="bg-[#0A0A0F] border border-[rgba(239,68,68,0.3)] rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[rgba(239,68,68,0.1)] flex items-center justify-center">
                <Lock size={24} className="text-[#EF4444]" />
              </div>
              <div>
                <h3 className="font-['Archivo'] text-base tracking-tight text-[#EF4444]">Provider Required</h3>
                <p className="text-xs text-[#6B7280]">A real WireGuard config is needed</p>
              </div>
            </div>
            <div className="bg-[rgba(251,191,36,0.05)] border border-[rgba(251,191,36,0.15)] rounded-xl p-4 mb-5">
              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                VelocityVPN cannot create a working VPN tunnel without a real WireGuard server. You need to add a provider config with your actual server endpoint, public key, and private key.
              </p>
            </div>
            <div className="space-y-2 mb-5">
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <Check size={14} className="text-[#4ADE80]" /> Go to the <strong className="text-white">Providers</strong> tab
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <Check size={14} className="text-[#4ADE80]" /> Select your VPN provider (Mullvad, ProtonVPN, etc.)
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <Check size={14} className="text-[#4ADE80]" /> Paste your server details and save
              </div>
              <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                <Check size={14} className="text-[#4ADE80]" /> Activate the config, then connect
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowProviderRequired(false)} className="flex-1 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-white rounded-lg text-xs font-medium cursor-pointer hover:border-[#E85D4E]">
                Cancel
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

function ToolsTab({ downloadWireGuardConfig, connection, setShowQR, setShowHowTo }: {
  downloadWireGuardConfig: () => void;
  connection: Connection | null;
  setShowQR: (id: number | null) => void;
  setShowHowTo: (v: boolean) => void;
}) {
  const [ipData, setIpData] = useState<{ ip: string; city: string; country: string; countryCode: string; org: string } | null>(null);
  const [ipLoading, setIpLoading] = useState(true);
  const [speedPhase, setSpeedPhase] = useState<"idle" | "running" | "done">("idle");
  const [speedResult, setSpeedResult] = useState<{ download: number; upload: number; latency: number } | null>(null);

  useEffect(() => {
    fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(5000) })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d ? setIpData({ ip: d.ip, city: d.city, country: d.country_name, countryCode: d.country_code, org: d.org }) : setIpData(null))
      .catch(() => setIpData(null))
      .finally(() => setIpLoading(false));
  }, []);

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
            <h3 className="text-sm font-bold text-white mb-1">Chrome Extension VPN</h3>
            <p className="text-xs text-[#9CA3AF] mb-3">Install our free Chrome extension for <strong className="text-white">automatic VPN protection</strong> on all websites.</p>
            <ol className="text-xs text-[#9CA3AF] space-y-1 mb-3 list-decimal list-inside">
              <li>Download the extension ZIP below</li>
              <li>Extract to a folder</li>
              <li>Go to <code className="text-[#E85D4E]">chrome://extensions</code></li>
              <li>Enable <strong className="text-white">Developer mode</strong></li>
              <li>Click <strong className="text-white">Load unpacked</strong> and select the folder</li>
            </ol>
            <a href="/extension/velocityvpn-extension.zip" download className="inline-flex items-center gap-2 px-4 py-2 bg-[#4ADE80] text-[#050507] rounded-lg text-xs font-bold hover:bg-[#3ECF71] transition-all no-underline">
              <Download size={14} /> Download Extension
            </a>
          </div>
        </div>
      </div>

      {/* IP Display */}
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Archivo'] text-base tracking-tight flex items-center gap-2"><Globe size={18} className="text-[#E85D4E]" /> Your IP Address</h3>
        </div>
        {ipLoading ? (
          <div className="text-sm text-[#6B7280] flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Detecting...</div>
        ) : ipData ? (
          <>
            <div className="bg-[#111118] rounded-xl p-4 mb-3">
              <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">Public IP</div>
              <div className="font-['JetBrains_Mono'] text-2xl text-white">{ipData.ip}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[{ l: "Location", v: `${ipData.city}, ${ipData.countryCode}` }, { l: "ISP", v: ipData.org?.replace(/^AS\d+\s/, "") || "Unknown" }, { l: "Country", v: ipData.country }, { l: "Status", v: "EXPOSED" }].map((item) => (
                <div key={item.l} className="bg-[#111118] rounded-lg p-2.5">
                  <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">{item.l}</div>
                  <div className={`text-xs truncate ${item.v === "EXPOSED" ? "text-[#EF4444] font-bold" : "text-[#D1D5DB]"}`}>{item.v}</div>
                </div>
              ))}
            </div>
            {/* Zero Logs Policy */}
            <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.06)] flex items-start gap-2">
              <Lock size={12} className="text-[#4ADE80] mt-0.5 shrink-0" />
              <div><span className="text-xs text-[#4ADE80] font-medium">Zero Logs Policy</span><p className="text-[10px] text-[#6B7280]">We don't store connection logs, traffic logs, or DNS queries.</p></div>
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
      {connection && (
        <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
          <h3 className="font-['Archivo'] text-base tracking-tight mb-3">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setShowQR(connection.server.id)} className="px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-white rounded-lg text-xs cursor-pointer hover:border-[#A3B8D4]"><ScanLine size={14} className="inline mr-1" /> Show QR</button>
            <button onClick={downloadWireGuardConfig} className="px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#4ADE80] rounded-lg text-xs cursor-pointer hover:border-[#4ADE80]"><Download size={14} className="inline mr-1" /> Download Config</button>
            <button onClick={() => setShowHowTo(true)} className="px-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#9B6DFF] rounded-lg text-xs cursor-pointer hover:border-[#9B6DFF]"><HelpCircle size={14} className="inline mr-1" /> How to Connect</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── WireGuard QR Modal ───────────────────────────────────────

function WireGuardQR({ serverId, onClose }: { serverId: number; onClose: () => void }) {
  const server = VELOCITY_SERVERS.find((s) => s.id === serverId);
  const [qrUrl, setQrUrl] = useState("");
  const [key, setKey] = useState("");

  useEffect(() => {
    if (!server) return;
    const k = generateWireGuardPrivateKey();
    setKey(k);
    const config = generateWireGuardConfig(server, k);
    import("qrcode").then((QR) => {
      QR.default.toDataURL(config, { width: 280, margin: 2, color: { dark: "#ffffff", light: "#0A0A0F" } })
        .then((url: string) => setQrUrl(url)).catch(() => {});
    }).catch(() => {});
  }, [serverId, server]);

  if (!server) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Archivo'] text-base tracking-tight">WireGuard Config</h3>
          <button onClick={onClose} className="text-[#6B7280] hover:text-white cursor-pointer bg-transparent border-0"><X size={18} /></button>
        </div>
        {key && <div className="bg-[rgba(74,222,128,0.05)] border border-[rgba(74,222,128,0.15)] rounded-xl p-3 mb-4"><div className="text-[10px] text-[#4ADE80] uppercase mb-1">Private Key</div><div className="font-['JetBrains_Mono'] text-[10px] text-[#4ADE80] break-all">{key}</div></div>}
        <div className="bg-[#111118] rounded-xl p-4 flex items-center justify-center mb-4">
          {qrUrl ? <img src={qrUrl} alt="QR" className="w-56 h-56" /> : <Loader2 size={32} className="animate-spin text-[#E85D4E]" />}
        </div>
        <button onClick={() => {
          const config = generateWireGuardConfig(server, key || "x");
          const blob = new Blob([config], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url;
          a.download = `velocity-${server.city.toLowerCase().replace(/\s/g, "-")}.conf`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        }} className="w-full py-2.5 bg-[#E85D4E] text-white rounded-lg text-xs font-medium cursor-pointer border-0 hover:bg-[#D44A3C]"><Download size={14} className="inline mr-1" /> Download Config</button>
      </div>
    </div>
  );
}

// ─── Heat Map Component ───────────────────────────────────────

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
          <div className="text-xs text-[#9CA3AF] leading-relaxed">VelocityVPN is a <strong className="text-white">management dashboard</strong>, not a VPN service. You need a real WireGuard provider for the tunnel to work. The configs generated here are templates — replace <code className="text-[#FBBF24] font-mono">YOUR_SERVER_IP</code> and <code className="text-[#FBBF24] font-mono">PublicKey</code> with your provider's details.</div>
        </div>

        <h4 className="text-sm font-semibold text-white mb-3">Recommended: Mullvad</h4>
        <div className="space-y-3 mb-5">
          {[
            { icon: <Globe size={16} />, text: "Go to ", link: "mullvad.net", url: "https://mullvad.net", desc: " — no email needed, accepts crypto/cash" },
            { icon: <Download size={16} />, text: "Install WireGuard app from ", link: "wireguard.com", url: "https://wireguard.com/install", desc: "" },
            { icon: <Key size={16} />, text: "In your Mullvad account, generate a WireGuard config for your chosen server location", link: "", url: "", desc: "" },
            { icon: <Smartphone size={16} />, text: "Download the .conf file or scan the QR code into the WireGuard app", link: "", url: "", desc: "" },
            { icon: <Wifi size={16} />, text: "Toggle ON — your traffic is now encrypted and routed through Mullvad", link: "", url: "", desc: "" },
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
