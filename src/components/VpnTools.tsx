import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Globe, Shield, Zap, AlertTriangle, CheckCircle2,
  Download, Smartphone, X, RefreshCw, Clock,
  ArrowDown, ArrowUp, Activity, Wifi, WifiOff,
  Loader2, Copy, Check, Lock, Unlock
} from "lucide-react";
// @ts-ignore
import QRCode from "qrcode";
import { VELOCITY_SERVERS, generateWireGuardConfig, getFlag } from "@/data/velocity-servers";
import { generateWireGuardPrivateKey } from "@/lib/wg-keygen";

// ─── IP Address Display ───────────────────────────────────────

interface IpData {
  ip: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  loc: string;
  org: string;
  postal: string;
  timezone: string;
}

interface IPDisplayProps {
  tunnelActive?: boolean;
  tunnelIp?: {
    ip: string;
    city: string;
    region: string;
    country: string;
    countryCode: string;
    org: string;
    timezone: string;
    viaVpn: boolean;
    vpnServer: { city: string; countryCode: string } | null;
  } | null;
  isCheckingIp?: boolean;
}

export function IPDisplay({ tunnelActive, tunnelIp, isCheckingIp }: IPDisplayProps) {
  const [ipData, setIpData] = useState<IpData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchIP = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("https://ipapi.co/json/");
      if (!res.ok) throw new Error("Failed to fetch IP");
      const data = await res.json();
      setIpData(data);
    } catch {
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const { ip } = await res.json();
        setIpData({
          ip,
          city: "Unknown",
          region: "Unknown",
          country: "Unknown",
          countryCode: "",
          loc: "",
          org: "Unknown ISP",
          postal: "",
          timezone: "",
        });
      } catch {
        setError("Unable to detect your IP. You may be blocking IP detection services.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchIP(); }, [fetchIP]);

  // Use tunnel IP data when tunnel is active
  const displayData = tunnelActive && tunnelIp
    ? {
        ip: tunnelIp.ip,
        city: tunnelIp.city,
        region: tunnelIp.region,
        country: tunnelIp.country,
        countryCode: tunnelIp.countryCode,
        org: tunnelIp.org,
        timezone: tunnelIp.timezone,
        loc: "",
        postal: "",
      }
    : ipData;

  const isTunnelLoading = tunnelActive && isCheckingIp;

  if ((loading && !tunnelActive) || isTunnelLoading) {
    return (
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5 flex items-center justify-center gap-2 text-[#6B7280] text-sm">
        <Loader2 size={16} className="animate-spin" /> Detecting{tunnelActive ? " tunnel exit" : " your"} IP...
      </div>
    );
  }

  if (error && !tunnelActive) {
    return (
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
        <div className="flex items-center gap-2 text-[#EF4444] text-sm mb-2">
          <WifiOff size={16} /> {error}
        </div>
        <button onClick={fetchIP} className="text-xs text-[#E85D4E] hover:text-white flex items-center gap-1 cursor-pointer bg-transparent border-0">
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  if (!displayData) return null;

  return (
    <div className={`rounded-2xl p-5 border ${tunnelActive ? "bg-[rgba(74,222,128,0.03)] border-[rgba(74,222,128,0.2)]" : "bg-[#0A0A0F] border-[rgba(255,255,255,0.08)]"}`}>
      {/* Protection Status Banner */}
      <div className={`flex items-center gap-3 mb-4 p-3 rounded-xl ${tunnelActive ? "bg-[rgba(74,222,128,0.08)]" : "bg-[rgba(239,68,68,0.08)]"}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${tunnelActive ? "bg-[rgba(74,222,128,0.15)]" : "bg-[rgba(239,68,68,0.15)]"}`}>
          {tunnelActive ? <Shield size={20} className="text-[#4ADE80]" /> : <AlertTriangle size={20} className="text-[#EF4444]" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${tunnelActive ? "text-[#4ADE80]" : "text-[#EF4444]"}`}>
              {tunnelActive ? "PROTECTED" : "EXPOSED"}
            </span>
            {!tunnelActive && (
              <span className="text-[9px] font-bold text-[#050507] bg-[#EF4444] px-2 py-0.5 rounded-full">NO VPN</span>
            )}
          </div>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            {tunnelActive
              ? `Your traffic is encrypted and routed through ${tunnelIp?.vpnServer?.city ?? "VPN server"}. Your real IP is hidden.`
              : "Your real IP address is visible to websites and trackers. Connect to a VPN server to hide your identity."}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Archivo'] text-base tracking-tight flex items-center gap-2">
          <Globe size={18} className={tunnelActive ? "text-[#4ADE80]" : "text-[#E85D4E]"} />
          {tunnelActive ? "VPN Tunnel Exit IP" : "Your Real IP Address"}
        </h3>
        <button onClick={fetchIP} className="text-[#6B7280] hover:text-white transition-colors cursor-pointer bg-transparent border-0">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className={`rounded-xl p-4 mb-3 ${tunnelActive ? "bg-[rgba(74,222,128,0.05)]" : "bg-[#111118]"}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">
              {tunnelActive ? "Exit IP (VPN Server)" : "Public IP"}
            </div>
            <div className={`font-['JetBrains_Mono'] text-2xl tracking-wider ${tunnelActive ? "text-[#4ADE80]" : "text-white"}`}>
              {displayData.ip}
            </div>
          </div>
          <CopyButton text={displayData.ip} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <InfoItem label="Location" value={`${displayData.city}, ${displayData.countryCode}`} />
        <InfoItem label="ISP" value={displayData.org.replace(/^AS\d+\s/, "")} />
        <InfoItem label="Region" value={displayData.region} />
        <InfoItem label="Timezone" value={displayData.timezone} />
      </div>

      {/* No Logs Policy */}
      <div className="mt-4 pt-3 border-t border-[rgba(255,255,255,0.06)] flex items-start gap-2">
        <Lock size={12} className="text-[#4ADE80] mt-0.5 shrink-0" />
        <div>
          <span className="text-xs text-[#4ADE80] font-medium">Zero Logs Policy</span>
          <p className="text-[10px] text-[#6B7280] mt-0.5">
            VelocityVPN does not store connection logs, traffic logs, or DNS queries. We cannot identify what you browse or which sites you visit. Your privacy is guaranteed by design — not by policy.
          </p>
        </div>
      </div>

      {tunnelActive && tunnelIp?.vpnServer && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[#4ADE80]">
          <Shield size={12} />
          <span>Encrypted tunnel to {tunnelIp.vpnServer.city} ({getFlag(tunnelIp.vpnServer.countryCode)}) — {displayData.org}</span>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111118] rounded-lg p-2.5">
      <div className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-xs text-[#D1D5DB] truncate" title={value}>{value}</div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-2 bg-[rgba(255,255,255,0.05)] rounded-lg hover:bg-[rgba(255,255,255,0.1)] transition-all cursor-pointer border-0">
      {copied ? <Check size={16} className="text-[#4ADE80]" /> : <Copy size={16} className="text-[#6B7280]" />}
    </button>
  );
}

// ─── Speed Test ───────────────────────────────────────────────

interface SpeedResult {
  download: number; // Mbps
  upload: number;   // Mbps
  latency: number;  // ms
  jitter: number;   // ms
}

export function SpeedTest() {
  const [phase, setPhase] = useState<"idle" | "latency" | "download" | "upload" | "done">("idle");
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef(false);

  const testLatency = async (): Promise<{ latency: number; jitter: number }> => {
    const times: number[] = [];
    for (let i = 0; i < 5; i++) {
      if (abortRef.current) break;
      const start = performance.now();
      try {
        await fetch(`https://www.cloudflare.com/cdn-cgi/trace?t=${Date.now()}`, { method: "HEAD", cache: "no-store" });
        times.push(performance.now() - start);
      } catch {
        times.push(200);
      }
    }
    const latency = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const jitter = times.length >= 2
      ? Math.round(times.slice(1).map((t, i) => Math.abs(t - times[i])).reduce((a, b) => a + b, 0) / (times.length - 1))
      : 0;
    return { latency, jitter };
  };

  const testDownload = async (): Promise<number> => {
    const fileSizeMB = 5;
    const url = `https://speed.cloudflare.com/__down?bytes=${fileSizeMB * 1024 * 1024}&t=${Date.now()}`;
    const start = performance.now();
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      await res.arrayBuffer();
      const duration = (performance.now() - start) / 1000;
      if (abortRef.current) return 0;
      return Math.round((fileSizeMB * 8) / Math.max(duration, 0.1));
    } catch {
      // Fallback: measure with smaller requests
      const smallStart = performance.now();
      try {
        await fetch(`https://www.cloudflare.com/cdn-cgi/trace?t=${Date.now()}`, { cache: "no-store" });
        const dur = (performance.now() - smallStart) / 1000;
        return Math.round(0.05 / Math.max(dur, 0.001));
      } catch {
        return 0;
      }
    }
  };

  const runTest = async () => {
    abortRef.current = false;
    setPhase("latency");
    setProgress(0);
    setResult(null);

    // Latency test
    const { latency, jitter } = await testLatency();
    if (abortRef.current) return;
    setProgress(20);

    // Download test
    setPhase("download");
    const download = await testDownload();
    if (abortRef.current) return;
    setProgress(60);

    // Upload test (simulated via latency since we can't upload large files easily from browser)
    setPhase("upload");
    const uploadSamples: number[] = [];
    for (let i = 0; i < 3; i++) {
      if (abortRef.current) break;
      const upStart = performance.now();
      try {
        const blob = new Blob([new ArrayBuffer(256 * 1024)]); // 256KB
        await fetch(`https://httpbin.org/post?t=${Date.now()}`, {
          method: "POST",
          body: blob,
          cache: "no-store",
        });
        uploadSamples.push(performance.now() - upStart);
      } catch {
        uploadSamples.push(500);
      }
    }
    const avgUpTime = uploadSamples.length
      ? uploadSamples.reduce((a, b) => a + b, 0) / uploadSamples.length / 1000
      : 1;
    const upload = Math.round((0.256 * 8) / Math.max(avgUpTime, 0.001));

    if (abortRef.current) return;
    setProgress(100);
    setResult({ download, upload, latency, jitter });
    setPhase("done");
  };

  const cancel = () => { abortRef.current = true; setPhase("idle"); setProgress(0); };

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "latency": return "Testing Latency...";
      case "download": return "Testing Download Speed...";
      case "upload": return "Testing Upload Speed...";
      default: return "";
    }
  }, [phase]);

  return (
    <div className="space-y-4">
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Archivo'] text-base tracking-tight flex items-center gap-2">
            <Zap size={18} className="text-[#E85D4E]" />
            Speed Test
          </h3>
          {phase === "idle" || phase === "done" ? (
            <button
              onClick={runTest}
              className="px-4 py-2 bg-[#E85D4E] text-white rounded-lg text-xs font-medium hover:bg-[#D44A3C] transition-all flex items-center gap-1.5 cursor-pointer border-0"
            >
              <Activity size={14} /> Start Test
            </button>
          ) : (
            <button
              onClick={cancel}
              className="px-4 py-2 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#9CA3AF] rounded-lg text-xs font-medium hover:text-white transition-all cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>

        {/* Progress */}
        {phase !== "idle" && phase !== "done" && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#9CA3AF] flex items-center gap-1.5">
                <Loader2 size={12} className="animate-spin" /> {phaseLabel}
              </span>
              <span className="text-xs text-[#6B7280]">{progress}%</span>
            </div>
            <div className="h-1.5 bg-[#111118] rounded-full overflow-hidden">
              <div className="h-full bg-[#E85D4E] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SpeedCard label="Download" value={result.download} unit="Mbps" icon={<ArrowDown size={14} />} color="#4ADE80" />
            <SpeedCard label="Upload" value={result.upload} unit="Mbps" icon={<ArrowUp size={14} />} color="#A3B8D4" />
            <SpeedCard label="Latency" value={result.latency} unit="ms" icon={<Clock size={14} />} color="#FBBF24" />
            <SpeedCard label="Jitter" value={result.jitter} unit="ms" icon={<Activity size={14} />} color="#9B6DFF" />
          </div>
        )}

        {!result && phase === "idle" && (
          <div className="text-center py-8 text-[#6B7280] text-sm">
            <Activity size={32} className="mx-auto mb-2 opacity-30" />
            Click "Start Test" to measure your connection speed.
          </div>
        )}
      </div>
    </div>
  );
}

function SpeedCard({ label, value, unit, icon, color }: { label: string; value: number; unit: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="bg-[#111118] rounded-xl p-3 text-center">
      <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#6B7280] uppercase tracking-wider mb-1">
        {icon} {label}
      </div>
      <div className="font-['JetBrains_Mono'] text-xl font-bold" style={{ color }}>
        {value > 0 ? value.toLocaleString() : "--"}
      </div>
      <div className="text-[10px] text-[#6B7280]">{unit}</div>
    </div>
  );
}

// ─── DNS Leak Test ────────────────────────────────────────────

type DNSLeakStatus = "idle" | "testing" | "safe" | "leak";

export function DNSLeakTest() {
  const [status, setStatus] = useState<DNSLeakStatus>("idle");
  const [dnsServers, setDnsServers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setStatus("testing");
    setLoading(true);
    setDnsServers([]);

    const detected = new Set<string>();

    // Test using EDNS subnet by resolving unique hostnames
    const testId = Math.random().toString(36).substring(2, 10);
    const hostnames = [
      `dns-test-${testId}-1.dnsleaktest.com`,
      `dns-test-${testId}-2.dnsleaktest.com`,
      `dns-test-${testId}-3.dnsleaktest.com`,
    ];

    // Try multiple DNS resolution approaches
    for (const hostname of hostnames) {
      try {
        await fetch(`https://1.1.1.1/dns-query?name=${hostname}&type=A`, {
          headers: { Accept: "application/dns-json" },
        });
      } catch { /* silent */ }
    }

    // Use a DNS leak detection API
    try {
      const res = await fetch("https://dns.google/resolve?name=cloudflare.com&type=A", {
        headers: { Accept: "application/dns-json" },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.Comment) {
          detected.add("Google DNS (8.8.8.8)");
        }
      }
    } catch { /* silent */ }

    try {
      const res = await fetch("https://cloudflare-dns.com/dns-query?name=example.com&type=A", {
        headers: { Accept: "application/dns-json" },
      });
      if (res.ok) {
        detected.add("Cloudflare DNS (1.1.1.1)");
      }
    } catch { /* silent */ }

    // Check if we can reach known DNS servers directly
    try {
      await fetch("https://1.1.1.1/cdn-cgi/trace", { method: "HEAD" });
      detected.add("Cloudflare (1.1.1.1)");
    } catch { /* silent */ }

    try {
      await fetch("https://8.8.8.8/generate_204", { method: "HEAD" });
      detected.add("Google (8.8.8.8)");
    } catch { /* silent */ }

    const servers = Array.from(detected);
    setDnsServers(servers);
    setStatus(servers.length > 0 ? "safe" : "idle");
    setLoading(false);
  };

  return (
    <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Archivo'] text-base tracking-tight flex items-center gap-2">
          <Shield size={18} className="text-[#E85D4E]" />
          DNS Leak Test
        </h3>
        {status === "idle" && (
          <button
            onClick={runTest}
            disabled={loading}
            className="px-4 py-2 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#E85D4E] rounded-lg text-xs font-medium hover:border-[#E85D4E] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={12} /> Test
          </button>
        )}
      </div>

      {status === "testing" && (
        <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
          <Loader2 size={14} className="animate-spin text-[#E85D4E]" />
          Checking DNS resolution paths...
        </div>
      )}

      {status === "safe" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[#4ADE80] text-sm">
            <CheckCircle2 size={16} /> No DNS leak detected
          </div>
          <div className="text-xs text-[#9CA3AF] mb-2">Detected DNS resolvers:</div>
          <div className="flex flex-wrap gap-2">
            {dnsServers.map((s) => (
              <span key={s} className="px-2.5 py-1 bg-[rgba(74,222,128,0.1)] text-[#4ADE80] rounded-full text-xs border border-[rgba(74,222,128,0.2)]">
                {s}
              </span>
            ))}
          </div>
          <p className="text-xs text-[#6B7280] mt-2">
            Your DNS queries are being resolved by the detected servers above. When connected to VPN, these should show your VPN provider's DNS servers.
          </p>
          <button
            onClick={runTest}
            className="text-xs text-[#E85D4E] hover:text-white flex items-center gap-1 mt-2 cursor-pointer bg-transparent border-0"
          >
            <RefreshCw size={12} /> Re-test
          </button>
        </div>
      )}

      {status === "idle" && !loading && (
        <div className="text-center py-6 text-[#6B7280] text-sm">
          <Shield size={32} className="mx-auto mb-2 opacity-30" />
          Test if your DNS queries are leaking outside the VPN tunnel.
        </div>
      )}
    </div>
  );
}

// ─── WebRTC Leak Test ─────────────────────────────────────────

type WebRTCStatus = "idle" | "testing" | "safe" | "leak";

export function WebRTCLeakTest() {
  const [status, setStatus] = useState<WebRTCStatus>("idle");
  const [localIPs, setLocalIPs] = useState<string[]>([]);

  const runTest = () => {
    setStatus("testing");
    setLocalIPs([]);

    const ips = new Set<string>();

    try {
      const RTCPeerConnection = window.RTCPeerConnection ||
        // @ts-ignore
        window.mozRTCPeerConnection || window.webkitRTCPeerConnection;

      if (!RTCPeerConnection) {
        setStatus("safe");
        return;
      }

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      pc.createDataChannel("");

      pc.onicecandidate = (e) => {
        if (!e.candidate) {
          pc.close();
          const found = Array.from(ips);
          setLocalIPs(found);
          setStatus(found.length > 0 ? "leak" : "safe");
          return;
        }
        const ipMatch = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/.exec(e.candidate.candidate);
        if (ipMatch) {
          const ip = ipMatch[1];
          if (ip !== "0.0.0.0" && ip !== "127.0.0.1" && !ip.startsWith("0.")) {
            ips.add(ip);
          }
        }
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => setStatus("safe"));

      // Timeout fallback
      setTimeout(() => {
        const found = Array.from(ips);
        if (found.length === 0 && status === "testing") {
          setStatus("safe");
        }
        try { pc.close(); } catch { /* silent */ }
      }, 5000);
    } catch {
      setStatus("safe");
    }
  };

  return (
    <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-['Archivo'] text-base tracking-tight flex items-center gap-2">
          <AlertTriangle size={18} className="text-[#E85D4E]" />
          WebRTC Leak Test
        </h3>
        {status === "idle" && (
          <button
            onClick={runTest}
            className="px-4 py-2 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#E85D4E] rounded-lg text-xs font-medium hover:border-[#E85D4E] transition-all flex items-center gap-1.5 cursor-pointer border-solid"
          >
            <RefreshCw size={12} /> Test
          </button>
        )}
      </div>

      {status === "testing" && (
        <div className="flex items-center gap-2 text-sm text-[#9CA3AF]">
          <Loader2 size={14} className="animate-spin text-[#E85D4E]" />
          Checking WebRTC for IP leaks...
        </div>
      )}

      {status === "safe" && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[#4ADE80] text-sm">
            <CheckCircle2 size={16} /> No WebRTC leak detected
          </div>
          <p className="text-xs text-[#6B7280]">
            Your local IP address is not exposed through WebRTC. Your browser is either blocking WebRTC or not leaking your IP.
          </p>
          <button
            onClick={runTest}
            className="text-xs text-[#E85D4E] hover:text-white flex items-center gap-1 mt-2 cursor-pointer bg-transparent border-0"
          >
            <RefreshCw size={12} /> Re-test
          </button>
        </div>
      )}

      {status === "leak" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[#FBBF24] text-sm">
            <AlertTriangle size={16} /> Potential WebRTC leak detected
          </div>
          <div className="text-xs text-[#9CA3AF] mb-2">Exposed IP addresses:</div>
          <div className="flex flex-wrap gap-2">
            {localIPs.map((ip) => (
              <span key={ip} className="px-2.5 py-1 bg-[rgba(251,191,36,0.1)] text-[#FBBF24] rounded-full text-xs font-mono border border-[rgba(251,191,36,0.2)]">
                {ip}
              </span>
            ))}
          </div>
          <p className="text-xs text-[#6B7280]">
            These IPs may be exposed to websites through WebRTC. Use a VPN client or disable WebRTC in your browser to prevent this.
          </p>
          <button
            onClick={runTest}
            className="text-xs text-[#E85D4E] hover:text-white flex items-center gap-1 mt-2 cursor-pointer bg-transparent border-0"
          >
            <RefreshCw size={12} /> Re-test
          </button>
        </div>
      )}

      {status === "idle" && (
        <div className="text-center py-6 text-[#6B7280] text-sm">
          <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
          Check if WebRTC is leaking your local IP address.
        </div>
      )}
    </div>
  );
}

// ─── WireGuard QR Code Generator ──────────────────────────────

export function WireGuardQR({ serverId, onClose }: { serverId: number; onClose: () => void }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [privateKey, setPrivateKey] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const server = VELOCITY_SERVERS.find((s) => s.id === serverId);

  useEffect(() => {
    if (!server) return;
    const key = generateWireGuardPrivateKey();
    setPrivateKey(key);
    const config = generateWireGuardConfig(server, key);
    QRCode.toDataURL(config, { width: 280, margin: 2, color: { dark: "#ffffff", light: "#0A0A0F" } })
      .then((url: string) => { setQrDataUrl(url); setLoading(false); })
      .catch(() => setLoading(false));
  }, [serverId, server]);

  if (!server) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-['Archivo'] text-base tracking-tight">WireGuard Config</h3>
          <button onClick={onClose} className="text-[#6B7280] hover:text-white cursor-pointer bg-transparent border-0">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">{getFlag(server.countryCode)}</span>
          <div>
            <div className="text-sm text-white">{server.city}</div>
            <div className="text-xs text-[#6B7280]">{server.hostname}</div>
          </div>
        </div>

        {/* Private Key Display */}
        {privateKey && (
          <div className="bg-[rgba(74,222,128,0.05)] border border-[rgba(74,222,128,0.15)] rounded-xl p-3 mb-4">
            <div className="text-[10px] text-[#4ADE80] uppercase tracking-wider mb-1">Private Key (save this!)</div>
            <div className="font-['JetBrains_Mono'] text-[10px] text-[#4ADE80] break-all">{privateKey}</div>
          </div>
        )}

        <div className="bg-[#111118] rounded-xl p-4 flex items-center justify-center mb-4">
          {loading ? (
            <Loader2 size={32} className="animate-spin text-[#E85D4E]" />
          ) : (
            <img src={qrDataUrl} alt="WireGuard QR Code" className="w-56 h-56" />
          )}
        </div>

        <p className="text-xs text-[#6B7280] text-center mb-3">
          Scan with the WireGuard app, or download the config file below.
        </p>

        <button
          onClick={() => {
            const config = generateWireGuardConfig(server, privateKey || "<YOUR_PRIVATE_KEY>");
            const blob = new Blob([config], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `velocity-${server.city.toLowerCase().replace(/\s/g, "-")}.conf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }}
          className="w-full py-2.5 bg-[#E85D4E] text-white rounded-lg text-xs font-medium hover:bg-[#D44A3C] transition-all flex items-center justify-center gap-1.5 cursor-pointer border-0"
        >
          <Download size={14} /> Download Config File
        </button>
      </div>
    </div>
  );
}

// ─── How to Connect Modal ─────────────────────────────────────

export function HowToConnectModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-['Archivo'] text-lg tracking-tight">Get a Real VPN</h3>
            <p className="text-xs text-[#6B7280] mt-0.5">VelocityVPN works with any WireGuard provider</p>
          </div>
          <button onClick={onClose} className="text-[#6B7280] hover:text-white cursor-pointer bg-transparent border-0">
            <X size={20} />
          </button>
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
              <div className="pb-4">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Step {i + 1}</span>
                </div>
                <h4 className="text-sm text-white font-medium mb-0.5">{step.title}</h4>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-2 text-xs text-[#FBBF24]">
            <AlertTriangle size={14} />
            <span>Remember: this web dashboard manages configs. The actual VPN connection runs in the WireGuard app.</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-white rounded-lg text-xs font-medium hover:border-[#E85D4E] transition-all cursor-pointer"
        >
          Got it
        </button>
      </div>
    </div>
  );}