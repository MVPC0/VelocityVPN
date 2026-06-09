import { useState, useCallback } from "react";
import {
  Plus, X, Download, ExternalLink, Check, Trash2, Globe,
  Key, Server, Wifi, AlertTriangle, ChevronRight, Copy, CheckCircle2,
} from "lucide-react";
import {
  useProviderConfig,
  generateProviderWireGuardConfig,
  PROVIDER_PRESETS,
  type ProviderType,
  type ProviderConfig,
} from "@/hooks/useProviderConfig";

const CITIES = [
  { name: "Los Angeles", country: "US" }, { name: "New York", country: "US" },
  { name: "London", country: "UK" }, { name: "Amsterdam", country: "NL" },
  { name: "Tokyo", country: "JP" }, { name: "Singapore", country: "SG" },
  { name: "Sydney", country: "AU" }, { name: "Frankfurt", country: "DE" },
  { name: "Toronto", country: "CA" }, { name: "Paris", country: "FR" },
  { name: "Stockholm", country: "SE" }, { name: "Hong Kong", country: "HK" },
  { name: "Seoul", country: "KR" }, { name: "Sao Paulo", country: "BR" },
  { name: "Warsaw", country: "PL" }, { name: "Mumbai", country: "IN" },
  { name: "Zurich", country: "CH" }, { name: "Oslo", country: "NO" },
  { name: "Madrid", country: "ES" }, { name: "Dubai", country: "AE" },
  { name: "Johannesburg", country: "ZA" }, { name: "Auckland", country: "NZ" },
  { name: "Mexico City", country: "MX" }, { name: "Jakarta", country: "ID" },
  { name: "Other", country: "" },
];

export default function ProviderSetup() {
  const {
    providers,
    activeProvider,
    addProvider,
    removeProvider,
    activateProvider,
  } = useProviderConfig();

  const [showAdd, setShowAdd] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [serverName, setServerName] = useState("");
  const [city, setCity] = useState("");
  const [wgEndpoint, setWgEndpoint] = useState("");
  const [serverPublicKey, setServerPublicKey] = useState("");
  const [clientPrivateKey, setClientPrivateKey] = useState("");
  const [clientIp, setClientIp] = useState("10.0.0.2/32");

  const resetForm = useCallback(() => {
    setSelectedProvider(null);
    setServerName("");
    setCity("");
    setWgEndpoint("");
    setServerPublicKey("");
    setClientPrivateKey("");
    setClientIp("10.0.0.2/32");
    setShowAdd(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedProvider || !wgEndpoint || !serverPublicKey || !clientPrivateKey) return;
    const preset = PROVIDER_PRESETS[selectedProvider];
    const cityData = CITIES.find((c) => c.name === city) || { name: city || "Unknown", country: "" };
    const config = addProvider({
      name: serverName || `${preset.name} — ${cityData.name}`,
      provider: selectedProvider,
      serverName: serverName || `${cityData.name}-${Math.floor(Math.random() * 900 + 100)}`,
      city: cityData.name,
      country: cityData.country,
      wgEndpoint,
      serverPublicKey,
      clientPrivateKey,
      clientIp,
      dns: preset.dns,
      mtu: preset.mtu,
      active: false,
    });
    // Auto-activate the first provider
    if (providers.length === 0) {
      setTimeout(() => activateProvider(config.id), 50);
    }
    resetForm();
  }, [selectedProvider, wgEndpoint, serverPublicKey, clientPrivateKey, serverName, city, clientIp, addProvider, providers.length, activateProvider, resetForm]);

  const handleDownload = useCallback((p: ProviderConfig) => {
    const config = generateProviderWireGuardConfig(p);
    const blob = new Blob([config], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p.provider}-${p.city.toLowerCase().replace(/\s/g, "-")}.conf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const canSave = selectedProvider && wgEndpoint && serverPublicKey && clientPrivateKey;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Archivo'] text-lg tracking-tight">VPN Providers</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">Connect your WireGuard provider to generate working configs</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="px-4 py-2 bg-[#E85D4E] text-white rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-[#D44A3C] flex items-center gap-2"
        >
          <Plus size={14} /> Add Provider
        </button>
      </div>

      {/* Active Provider Status */}
      {activeProvider && (
        <div className="bg-[rgba(74,222,128,0.05)] border border-[rgba(74,222,128,0.2)] rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-[rgba(74,222,128,0.1)] flex items-center justify-center">
              <CheckCircle2 size={20} className="text-[#4ADE80]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#4ADE80]">Active Config</h3>
              <p className="text-xs text-[#6B7280]">{activeProvider.name} — {activeProvider.wgEndpoint}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs mb-4">
            <div className="bg-[#111118] rounded-xl p-3">
              <div className="text-[10px] text-[#6B7280] uppercase mb-1">Endpoint</div>
              <div className="font-['JetBrains_Mono'] text-[#4ADE80]">{activeProvider.wgEndpoint}</div>
            </div>
            <div className="bg-[#111118] rounded-xl p-3">
              <div className="text-[10px] text-[#6B7280] uppercase mb-1">Client IP</div>
              <div className="font-['JetBrains_Mono'] text-[#4ADE80]">{activeProvider.clientIp}</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => handleDownload(activeProvider)}
              className="flex-1 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#4ADE80] rounded-lg text-xs font-medium cursor-pointer hover:border-[#4ADE80] flex items-center justify-center gap-2"
            >
              <Download size={14} /> Download .conf
            </button>
            <button
              onClick={() => {
                const cfg = generateProviderWireGuardConfig(activeProvider);
                navigator.clipboard.writeText(cfg);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex-1 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-white rounded-lg text-xs font-medium cursor-pointer hover:border-[#A3B8D4] flex items-center justify-center gap-2"
            >
              {copied ? <Check size={14} className="text-[#4ADE80]" /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy Config"}
            </button>
            <button
              onClick={() => activateProvider(null)}
              className="px-4 py-2.5 bg-[#111118] border border-[rgba(239,68,68,0.3)] text-[#EF4444] rounded-lg text-xs font-medium cursor-pointer hover:border-[#EF4444]"
            >
              Deactivate
            </button>
          </div>
        </div>
      )}

      {/* Saved Providers List */}
      {providers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider">Saved Configs ({providers.length})</h3>
          {providers.map((p) => {
            const preset = PROVIDER_PRESETS[p.provider as ProviderType];
            const isActive = activeProvider?.id === p.id;
            return (
              <div
                key={p.id}
                className={`bg-[#0A0A0F] border rounded-xl p-4 flex items-center gap-3 ${
                  isActive ? "border-[rgba(74,222,128,0.3)]" : "border-[rgba(255,255,255,0.08)]"
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: `${preset?.color || "#6B7280"}15` }}
                >
                  <Server size={16} style={{ color: preset?.color || "#6B7280" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-[#6B7280] font-['JetBrains_Mono'] truncate">{p.wgEndpoint}</div>
                </div>
                <div className="flex items-center gap-2">
                  {!isActive && (
                    <button
                      onClick={() => activateProvider(p.id)}
                      className="px-3 py-1.5 bg-[#111118] border border-[rgba(255,255,255,0.1)] text-white rounded-lg text-[10px] font-medium cursor-pointer hover:border-[#4ADE80]"
                    >
                      Activate
                    </button>
                  )}
                  {isActive && (
                    <span className="px-3 py-1.5 bg-[rgba(74,222,128,0.1)] text-[#4ADE80] rounded-lg text-[10px] font-bold">
                      Active
                    </span>
                  )}
                  <button
                    onClick={() => handleDownload(p)}
                    className="p-1.5 text-[#6B7280] hover:text-[#4ADE80] cursor-pointer bg-transparent border-0"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => removeProvider(p.id)}
                    className="p-1.5 text-[#6B7280] hover:text-[#EF4444] cursor-pointer bg-transparent border-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {providers.length === 0 && !showAdd && (
        <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-[#111118] flex items-center justify-center mx-auto mb-4">
            <Wifi size={24} className="text-[#6B7280]" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">No Providers Configured</h3>
          <p className="text-xs text-[#6B7280] mb-4 max-w-xs mx-auto">
            Add your WireGuard provider details to generate real, working config files that you can import into the WireGuard app.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 bg-[#E85D4E] text-white rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-[#D44A3C]"
          >
            Add Your First Provider
          </button>
        </div>
      )}

      {/* Add Provider Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm">
          <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-['Archivo'] text-lg tracking-tight">Add Provider</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">Enter your WireGuard server details</p>
              </div>
              <button onClick={resetForm} className="text-[#6B7280] hover:text-white cursor-pointer bg-transparent border-0">
                <X size={20} />
              </button>
            </div>

            {/* Step 1: Choose Provider */}
            {!selectedProvider ? (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] mb-2">Select your VPN provider</p>
                {(Object.entries(PROVIDER_PRESETS) as [ProviderType, typeof PROVIDER_PRESETS.mullvad][]).map(
                  ([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedProvider(key)}
                      className="w-full flex items-center gap-3 p-4 bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-xl cursor-pointer hover:border-[rgba(255,255,255,0.2)] transition-colors text-left"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${preset.color}15` }}
                      >
                        <Globe size={18} style={{ color: preset.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{preset.name}</div>
                        <div className="text-[11px] text-[#6B7280]">
                          {key === "hideme" && "Free 10GB • No logs • Best for gaming"}
                          {key === "mullvad" && "No email required • ~€5/month"}
                          {key === "protonvpn" && "Free tier available"}
                          {key === "windscribe" && "Free 10GB/month"}
                          {key === "ivpn" && "Privacy-focused • No logs"}
                          {key === "privado" && "Free 10GB/month • WireGuard"}
                          {key === "custom" && "Your own WireGuard server"}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-[#6B7280]" />
                    </button>
                  )
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Provider Header */}
                <div
                  className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: `${PROVIDER_PRESETS[selectedProvider].color}10` }}
                >
                  <Globe size={18} style={{ color: PROVIDER_PRESETS[selectedProvider].color }} />
                  <div>
                    <div className="text-sm font-semibold">{PROVIDER_PRESETS[selectedProvider].name}</div>
                    <button
                      onClick={() => setSelectedProvider(null)}
                      className="text-[10px] text-[#6B7280] hover:text-white cursor-pointer bg-transparent border-0 p-0"
                    >
                      Change provider
                    </button>
                  </div>
                </div>

                {/* Instructions */}
                <div className="bg-[rgba(251,191,36,0.05)] border border-[rgba(251,191,36,0.15)] rounded-xl p-3 flex gap-2">
                  <AlertTriangle size={14} className="text-[#FBBF24] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                    {PROVIDER_PRESETS[selectedProvider].instructions}
                    {PROVIDER_PRESETS[selectedProvider].helpUrl && (
                      <>
                        {" "}
                        <a
                          href={PROVIDER_PRESETS[selectedProvider].helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#E85D4E] hover:underline inline-flex items-center gap-1"
                        >
                          Get your config <ExternalLink size={10} />
                        </a>
                      </>
                    )}
                  </p>
                </div>

                {/* Form Fields */}
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 block">Server Name (optional)</label>
                    <input
                      type="text"
                      value={serverName}
                      onChange={(e) => setServerName(e.target.value)}
                      placeholder={`e.g. ${PROVIDER_PRESETS[selectedProvider].name}-US-West`}
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#E85D4E]"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 block">City / Location</label>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#E85D4E] appearance-none cursor-pointer"
                    >
                      <option value="">Select a city...</option>
                      {CITIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name} {c.country && `(${c.country})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Server size={10} /> Server Endpoint <span className="text-[#E85D4E]">*</span>
                    </label>
                    <input
                      type="text"
                      value={wgEndpoint}
                      onChange={(e) => setWgEndpoint(e.target.value)}
                      placeholder="e.g. 193.32.127.66:51820 or us10-wireguard.mullvad.net:51820"
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#E85D4E] font-['JetBrains_Mono']"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Key size={10} /> Server Public Key <span className="text-[#E85D4E]">*</span>
                    </label>
                    <input
                      type="text"
                      value={serverPublicKey}
                      onChange={(e) => setServerPublicKey(e.target.value)}
                      placeholder="e.g. QKh3MKXqL0gL0R7E9..."
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#E85D4E] font-['JetBrains_Mono']"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Key size={10} /> Your Private Key <span className="text-[#E85D4E]">*</span>
                    </label>
                    <input
                      type="text"
                      value={clientPrivateKey}
                      onChange={(e) => setClientPrivateKey(e.target.value)}
                      placeholder="e.g. cG9vbHN0b3J5..."
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#E85D4E] font-['JetBrains_Mono']"
                    />
                    <p className="text-[10px] text-[#6B7280] mt-1">This stays on your device only — never sent to any server.</p>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 block">Client IP (optional)</label>
                    <input
                      type="text"
                      value={clientIp}
                      onChange={(e) => setClientIp(e.target.value)}
                      placeholder="10.0.0.2/32"
                      className="w-full bg-[#111118] border border-[rgba(255,255,255,0.1)] rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#E85D4E] font-['JetBrains_Mono']"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={resetForm} className="flex-1 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-white rounded-lg text-xs font-medium cursor-pointer hover:border-[#E85D4E]">
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!canSave}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold cursor-pointer border-0 flex items-center justify-center gap-2 ${
                      canSave
                        ? "bg-[#4ADE80] text-[#050507] hover:bg-[#3ECF71]"
                        : "bg-[#1a1a24] text-[#6B7280] cursor-not-allowed"
                    }`}
                  >
                    <Check size={14} /> Save Config
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
