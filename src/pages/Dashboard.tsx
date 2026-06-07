import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  Shield, Zap, Globe, Power, Clock, ArrowDown, ArrowUp,
  Activity, Server, MapPin, ChevronRight, Wifi, WifiOff,
  History, BarChart3, RefreshCw, Download, Copy, Check
} from "lucide-react";

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth({
    redirectOnUnauthenticated: true,
  });

  const utils = trpc.useUtils();

  // tRPC queries
  const { data: servers, isLoading: serversLoading } = trpc.vpn.listServers.useQuery();
  const { data: connectionStatus } = trpc.vpn.getConnectionStatus.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const { data: history } = trpc.vpn.getConnectionHistory.useQuery();
  const { data: stats } = trpc.vpn.getStats.useQuery();

  // Mutations
  const connectMutation = trpc.vpn.connect.useMutation({
    onSuccess: () => utils.vpn.getConnectionStatus.invalidate(),
  });
  const disconnectMutation = trpc.vpn.disconnect.useMutation({
    onSuccess: () => {
      utils.vpn.getConnectionStatus.invalidate();
      utils.vpn.getConnectionHistory.invalidate();
      utils.vpn.getStats.invalidate();
    },
  });
  const pingMutation = trpc.vpn.measurePing.useMutation({
    onSuccess: () => utils.vpn.listServers.invalidate(),
  });

  const [selectedServer, setSelectedServer] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"servers" | "status" | "history">("servers");
  const [copiedConfig, setCopiedConfig] = useState(false);

  // Duration counter
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (connectionStatus?.connectedAt) {
      const interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - new Date(connectionStatus.connectedAt).getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
    setElapsed(0);
  }, [connectionStatus]);

  const handleConnect = useCallback(() => {
    if (!selectedServer) return;
    connectMutation.mutate({ serverId: selectedServer });
  }, [selectedServer, connectMutation]);

  const handleDisconnect = useCallback(() => {
    disconnectMutation.mutate();
  }, [disconnectMutation]);

  const handlePingTest = useCallback((serverId: number) => {
    pingMutation.mutate({ serverId });
  }, [pingMutation]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getPingColor = (ping: number | null) => {
    if (ping === null) return "text-[#6B7280]";
    if (ping < 50) return "text-[#4ADE80]";
    if (ping < 100) return "text-[#FBBF24]";
    return "text-[#EF4444]";
  };

  const getLoadColor = (load: number) => {
    if (load < 30) return "bg-[#4ADE80]";
    if (load < 70) return "bg-[#FBBF24]";
    return "bg-[#EF4444]";
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#E85D4E] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Top Bar */}
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(5,5,7,0.95)] backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="font-['Archivo'] font-bold text-xl tracking-tight flex items-center">
            VELOCIT
            <span className="relative">
              Y
              <span className="absolute -right-2.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#E85D4E]" />
            </span>
          </a>
          <div className="flex items-center gap-4">
            {connectionStatus && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-[rgba(74,222,128,0.1)] rounded-full border border-[rgba(74,222,128,0.2)]">
                <Wifi size={14} className="text-[#4ADE80]" />
                <span className="text-[#4ADE80] text-xs font-medium">Connected</span>
              </div>
            )}
            <span className="text-sm text-[#9CA3AF]">{user?.name ?? "User"}</span>
            <button onClick={() => logout()} className="text-xs text-[#6B7280] hover:text-white transition-colors">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        {/* Connection Status Card */}
        <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                connectionStatus ? "bg-[rgba(74,222,128,0.15)]" : "bg-[rgba(255,255,255,0.05)]"
              }`}>
                {connectionStatus ? (
                  <Shield size={28} className="text-[#4ADE80]" />
                ) : (
                  <Shield size={28} className="text-[#6B7280]" />
                )}
              </div>
              <div>
                <h2 className="font-['Archivo'] text-2xl tracking-tight">
                  {connectionStatus ? "VPN Connected" : "VPN Disconnected"}
                </h2>
                <p className="text-[#9CA3AF] text-sm mt-0.5">
                  {connectionStatus
                    ? `${connectionStatus.server?.city}, ${connectionStatus.server?.country} — ${formatDuration(elapsed)}`
                    : "Select a server to connect"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {connectionStatus ? (
                <>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-[#6B7280]">IP Address</div>
                    <div className="font-['JetBrains_Mono'] text-sm text-[#A3B8D4]">{connectionStatus.assignedIp}</div>
                  </div>
                  <button
                    onClick={handleDisconnect}
                    disabled={disconnectMutation.isPending}
                    className="px-6 py-3 bg-[#EF4444] text-white rounded-lg font-medium hover:bg-[#DC2626] transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <Power size={16} />
                    {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={!selectedServer || connectMutation.isPending}
                  className="px-6 py-3 bg-[#E85D4E] text-white rounded-lg font-medium hover:bg-[#D44A3C] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 glow-coral-pulse"
                >
                  <Zap size={16} />
                  {connectMutation.isPending ? "Connecting..." : "Connect"}
                </button>
              )}
            </div>
          </div>

          {/* Connection Details */}
          {connectionStatus && (
            <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.08)] grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#111118] rounded-xl p-4">
                <div className="flex items-center gap-2 text-[#6B7280] text-xs mb-1">
                  <Clock size={12} /> Duration
                </div>
                <div className="font-['JetBrains_Mono'] text-lg text-white">{formatDuration(elapsed)}</div>
              </div>
              <div className="bg-[#111118] rounded-xl p-4">
                <div className="flex items-center gap-2 text-[#6B7280] text-xs mb-1">
                  <ArrowDown size={12} /> Download
                </div>
                <div className="font-['JetBrains_Mono'] text-lg text-[#4ADE80]">{formatBytes((connectionStatus.bytesReceived ?? 0) + elapsed * 1024)}</div>
              </div>
              <div className="bg-[#111118] rounded-xl p-4">
                <div className="flex items-center gap-2 text-[#6B7280] text-xs mb-1">
                  <ArrowUp size={12} /> Upload
                </div>
                <div className="font-['JetBrains_Mono'] text-lg text-[#A3B8D4]">{formatBytes((connectionStatus.bytesSent ?? 0) + elapsed * 256)}</div>
              </div>
              <div className="bg-[#111118] rounded-xl p-4">
                <div className="flex items-center gap-2 text-[#6B7280] text-xs mb-1">
                  <Activity size={12} /> Protocol
                </div>
                <div className="font-['JetBrains_Mono'] text-lg text-white uppercase">{connectionStatus.protocol}</div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-1 w-fit">
          {(["servers", "status", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-[#E85D4E] text-white"
                  : "text-[#9CA3AF] hover:text-white"
              }`}
            >
              {tab === "servers" && "Servers"}
              {tab === "status" && "My Stats"}
              {tab === "history" && "History"}
            </button>
          ))}
        </div>

        {/* Servers Tab */}
        {activeTab === "servers" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-['Archivo'] text-xl tracking-tight">Server Locations</h3>
              <button
                onClick={() => {
                  servers?.forEach((s) => handlePingTest(s.id));
                }}
                disabled={pingMutation.isPending}
                className="flex items-center gap-2 text-sm text-[#E85D4E] hover:text-white transition-colors"
              >
                <RefreshCw size={14} className={pingMutation.isPending ? "animate-spin" : ""} />
                Test All
              </button>
            </div>

            {serversLoading ? (
              <div className="text-center py-12 text-[#6B7280]">Loading servers...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {servers?.map((server) => {
                  const isSelected = selectedServer === server.id;
                  const isConnected = connectionStatus?.serverId === server.id;
                  return (
                    <div
                      key={server.id}
                      onClick={() => !connectionStatus && setSelectedServer(server.id)}
                      className={`relative bg-[#0A0A0F] border rounded-xl p-4 transition-all cursor-pointer ${
                        isConnected
                          ? "border-[#4ADE80] bg-[rgba(74,222,128,0.05)]"
                          : isSelected
                          ? "border-[#E85D4E]"
                          : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]"
                      } ${connectionStatus && !isConnected ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{getFlag(server.countryCode)}</div>
                          <div>
                            <div className="font-medium text-white">{server.city}</div>
                            <div className="text-xs text-[#6B7280]">{server.country} — {server.name}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-['JetBrains_Mono'] text-lg ${getPingColor(server.ping)}`}>
                            {server.ping !== null ? `${server.ping}ms` : "--"}
                          </div>
                          <div className="text-[10px] text-[#6B7280]">jitter: {server.jitter ?? "--"}ms</div>
                        </div>
                      </div>

                      {/* Load bar */}
                      <div className="mt-3 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-[#111118] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getLoadColor(server.load)}`}
                            style={{ width: `${server.load}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-[#6B7280] w-8 text-right">{server.load}%</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePingTest(server.id);
                          }}
                          disabled={pingMutation.isPending}
                          className="text-[#6B7280] hover:text-[#E85D4E] transition-colors"
                        >
                          <RefreshCw size={12} className={pingMutation.variables?.serverId === server.id ? "animate-spin" : ""} />
                        </button>
                      </div>

                      {isConnected && (
                        <div className="absolute top-2 right-2">
                          <span className="flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ADE80] opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#4ADE80]" />
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Stats Tab */}
        {activeTab === "status" && stats && (
          <div>
            <h3 className="font-['Archivo'] text-xl tracking-tight mb-4">Connection Statistics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
                <Server size={24} className="text-[#E85D4E] mb-3" />
                <div className="font-['JetBrains_Mono'] text-3xl text-white">{stats.totalSessions}</div>
                <div className="text-sm text-[#6B7280] mt-1">Total Sessions</div>
              </div>
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
                <Clock size={24} className="text-[#9B6DFF] mb-3" />
                <div className="font-['JetBrains_Mono'] text-3xl text-white">{formatDuration(stats.totalDuration)}</div>
                <div className="text-sm text-[#6B7280] mt-1">Total Time</div>
              </div>
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
                <ArrowDown size={24} className="text-[#4ADE80] mb-3" />
                <div className="font-['JetBrains_Mono'] text-3xl text-[#4ADE80]">{formatBytes(stats.totalDataReceived)}</div>
                <div className="text-sm text-[#6B7280] mt-1">Downloaded</div>
              </div>
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-6">
                <ArrowUp size={24} className="text-[#A3B8D4] mb-3" />
                <div className="font-['JetBrains_Mono'] text-3xl text-[#A3B8D4]">{formatBytes(stats.totalDataSent)}</div>
                <div className="text-sm text-[#6B7280] mt-1">Uploaded</div>
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div>
            <h3 className="font-['Archivo'] text-xl tracking-tight mb-4">Connection History</h3>
            {!history?.length ? (
              <div className="text-center py-12 text-[#6B7280]">No connection history yet</div>
            ) : (
              <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[rgba(255,255,255,0.08)]">
                        <th className="text-left text-xs text-[#6B7280] font-medium uppercase tracking-wider px-4 py-3">Server</th>
                        <th className="text-left text-xs text-[#6B7280] font-medium uppercase tracking-wider px-4 py-3">Status</th>
                        <th className="text-left text-xs text-[#6B7280] font-medium uppercase tracking-wider px-4 py-3">Duration</th>
                        <th className="text-left text-xs text-[#6B7280] font-medium uppercase tracking-wider px-4 py-3">Data</th>
                        <th className="text-left text-xs text-[#6B7280] font-medium uppercase tracking-wider px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((conn) => (
                        <tr key={conn.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getFlag(conn.server?.countryCode ?? "")}</span>
                              <div>
                                <div className="text-sm text-white">{conn.server?.city ?? "Unknown"}</div>
                                <div className="text-xs text-[#6B7280]">{conn.server?.name ?? ""}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              conn.status === "connected"
                                ? "bg-[rgba(74,222,128,0.1)] text-[#4ADE80]"
                                : conn.status === "disconnected"
                                ? "bg-[rgba(255,255,255,0.05)] text-[#9CA3AF]"
                                : "bg-[rgba(251,191,36,0.1)] text-[#FBBF24]"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                conn.status === "connected" ? "bg-[#4ADE80]" : conn.status === "disconnected" ? "bg-[#6B7280]" : "bg-[#FBBF24]"
                              }`} />
                              {conn.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-['JetBrains_Mono'] text-sm text-white">
                            {conn.duration ? formatDuration(conn.duration) : "—"}
                          </td>
                          <td className="px-4 py-3 font-['JetBrains_Mono'] text-sm text-[#9CA3AF]">
                            {conn.bytesReceived ? formatBytes(conn.bytesReceived + (conn.bytesSent ?? 0)) : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-[#6B7280]">
                            {conn.createdAt ? new Date(conn.createdAt).toLocaleDateString() : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Flag emoji helper
function getFlag(countryCode: string): string {
  const flags: Record<string, string> = {
    US: "🇺🇸", GB: "🇬🇧", DE: "🇩🇪", JP: "🇯🇵",
    SG: "🇸🇬", AU: "🇦🇺", BR: "🇧🇷", AE: "🇦🇪", SE: "🇸🇪",
  };
  return flags[countryCode] ?? "🌐";
}

export default Dashboard;
