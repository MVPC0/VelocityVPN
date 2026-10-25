import { useState, useCallback, useMemo, useRef, type ChangeEvent } from "react";
import {
  Plus, X, Download, ExternalLink, Check, Trash2, Globe,
  Key, Server, Wifi, Info, ChevronRight, Copy, CheckCircle2, Upload, FileText, Pencil, RefreshCw,
} from "lucide-react";
import {
  generateProviderWireGuardConfig,
  providerConfigFilename,
  providerToFields,
  isProviderConfigComplete,
  DEFAULT_ALLOWED_IPS,
  PROVIDER_PRESETS,
  type ProviderType,
  type ProviderConfig,
  type ProviderConfigState,
} from "@/hooks/useProviderConfig";
import {
  EMPTY_WG_FIELDS,
  parseWireGuardConf,
  validateWireGuardFields,
  type WireGuardFields,
} from "@/lib/wg-config";
import { derivePublicKey, generateWireGuardPrivateKey } from "@/lib/wg-keygen";

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

const INPUT_CLS =
  "w-full bg-[#111118] border rounded-lg px-3 py-2.5 text-xs text-white placeholder:text-[#4B5563] focus:outline-none focus:border-[#E85D4E]";

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

export default function ProviderSetup({ state }: { state: ProviderConfigState }) {
  const { providers, activeProvider, addProvider, removeProvider, activateProvider, updateProvider } = state;

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null);
  const [copied, setCopied] = useState(false);

  // Form state
  const [serverName, setServerName] = useState("");
  const [city, setCity] = useState("");
  const [fields, setFields] = useState<WireGuardFields>({ ...EMPTY_WG_FIELDS, allowedIps: DEFAULT_ALLOWED_IPS });
  const [touched, setTouched] = useState(false);
  const [confText, setConfText] = useState("");
  const [importMsg, setImportMsg] = useState<{ ok: boolean; lines: string[] } | null>(null);
  const [derivedPub, setDerivedPub] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const setField = useCallback((k: keyof WireGuardFields, v: string) => {
    setFields((prev) => ({ ...prev, [k]: v }));
    setTouched(true);
  }, []);

  const resetForm = useCallback(() => {
    setSelectedProvider(null);
    setEditingId(null);
    setServerName("");
    setCity("");
    setFields({ ...EMPTY_WG_FIELDS, allowedIps: DEFAULT_ALLOWED_IPS });
    setTouched(false);
    setConfText("");
    setImportMsg(null);
    setDerivedPub("");
    setShowAdd(false);
  }, []);

  const chooseProvider = useCallback((key: ProviderType) => {
    setSelectedProvider(key);
    setFields((prev) => ({ ...prev, dns: prev.dns || PROVIDER_PRESETS[key].dns }));
  }, []);

  const startEdit = useCallback((p: ProviderConfig) => {
    setEditingId(p.id);
    setSelectedProvider((p.provider in PROVIDER_PRESETS ? p.provider : "custom") as ProviderType);
    setServerName(p.name);
    setCity(CITIES.some((c) => c.name === p.city) ? p.city : p.city ? "Other" : "");
    setFields(providerToFields(p));
    setTouched(true);
    setConfText("");
    setImportMsg(null);
    setDerivedPub("");
    setShowAdd(true);
  }, []);

  const applyConf = useCallback((text: string) => {
    const result = parseWireGuardConf(text);
    const hasPeer = !!(result.fields.peerPublicKey || result.fields.endpoint);
    if (!hasPeer && result.errors.length) {
      setImportMsg({ ok: false, lines: result.errors });
      return;
    }
    setFields({ ...result.fields, allowedIps: result.fields.allowedIps || DEFAULT_ALLOWED_IPS });
    setTouched(true);
    setConfText("");
    setImportMsg({
      ok: result.errors.length === 0,
      lines: result.errors.length
        ? ["Imported, but please fix:", ...result.errors, ...result.warnings]
        : ["Imported your provider's [Interface] and [Peer] details.", ...result.warnings],
    });
  }, []);

  const onFile = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 64 * 1024) {
      setImportMsg({ ok: false, lines: ["That file is too large to be a WireGuard .conf"] });
      return;
    }
    applyConf(await file.text());
  }, [applyConf]);

  const errors = useMemo(() => validateWireGuardFields(fields), [fields]);
  const canSave = !!selectedProvider && Object.keys(errors).length === 0;

  const handleSave = useCallback(() => {
    if (!selectedProvider || !canSave) return;
    const preset = PROVIDER_PRESETS[selectedProvider];
    const existing = editingId ? providers.find((p) => p.id === editingId) : undefined;
    const cityData =
      CITIES.find((c) => c.name === city && c.name !== "Other") ||
      (city === "Other" && existing ? { name: existing.city, country: existing.country } : { name: "", country: "" });
    const host = fields.endpoint.trim().replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
    const data = {
      name: serverName.trim() || `${preset.name}${cityData.name ? ` — ${cityData.name}` : ""}`,
      provider: selectedProvider,
      serverName: host,
      city: cityData.name,
      country: cityData.country,
      wgEndpoint: fields.endpoint.trim(),
      serverPublicKey: fields.peerPublicKey.trim(),
      presharedKey: fields.presharedKey.trim(),
      allowedIps: fields.allowedIps.trim() || DEFAULT_ALLOWED_IPS,
      persistentKeepalive: fields.persistentKeepalive.trim(),
      clientPrivateKey: fields.privateKey.trim(),
      clientIp: fields.address.trim(),
      dns: fields.dns.trim(),
      mtu: fields.mtu.trim(),
    };
    if (editingId) updateProvider(editingId, data);
    else addProvider({ ...data, active: false }, { activate: true });
    resetForm();
  }, [selectedProvider, canSave, city, fields, serverName, editingId, providers, updateProvider, addProvider, resetForm]);

  const handleDownload = useCallback((p: ProviderConfig) => {
    if (!isProviderConfigComplete(p)) return;
    downloadText(providerConfigFilename(p), generateProviderWireGuardConfig(p));
  }, []);

  const fieldError = (k: keyof WireGuardFields) =>
    touched && errors[k] ? <p className="text-[10px] text-[#FBBF24] mt-1">{errors[k]}</p> : null;
  const borderFor = (k: keyof WireGuardFields) =>
    touched && errors[k] ? "border-[rgba(251,191,36,0.5)]" : "border-[rgba(255,255,255,0.1)]";

  const activeComplete = isProviderConfigComplete(activeProvider);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-['Archivo'] text-lg tracking-tight">VPN Providers</h2>
          <p className="text-xs text-[#6B7280] mt-0.5">Bring your own WireGuard provider: import its .conf or enter its details</p>
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
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[#4ADE80]">Active Config</h3>
              <p className="text-xs text-[#6B7280] truncate">{activeProvider.name} — {activeProvider.wgEndpoint}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs mb-4">
            <div className="bg-[#111118] rounded-xl p-3 min-w-0">
              <div className="text-[10px] text-[#6B7280] uppercase mb-1">Endpoint</div>
              <div className="font-['JetBrains_Mono'] text-[#4ADE80] truncate">{activeProvider.wgEndpoint}</div>
            </div>
            <div className="bg-[#111118] rounded-xl p-3 min-w-0">
              <div className="text-[10px] text-[#6B7280] uppercase mb-1">Client Address</div>
              <div className="font-['JetBrains_Mono'] text-[#4ADE80] truncate">{activeProvider.clientIp || "—"}</div>
            </div>
          </div>
          {!activeProvider.clientPrivateKey && (
            <div className="bg-[rgba(163,184,212,0.06)] border border-[rgba(163,184,212,0.2)] rounded-xl p-3 mb-4 flex gap-2">
              <Info size={14} className="text-[#A3B8D4] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[#9CA3AF] leading-relaxed">
                Your private key isn't in this browser session (it's never saved permanently). The download will contain a
                placeholder. <button onClick={() => startEdit(activeProvider)} className="text-[#E85D4E] hover:underline bg-transparent border-0 p-0 cursor-pointer text-[11px]">Add it</button> or re-import your .conf.
              </p>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => handleDownload(activeProvider)}
              disabled={!activeComplete}
              className="flex-1 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#4ADE80] rounded-lg text-xs font-medium cursor-pointer hover:border-[#4ADE80] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download size={14} /> Download .conf
            </button>
            <button
              onClick={() => {
                if (!activeComplete) return;
                navigator.clipboard.writeText(generateProviderWireGuardConfig(activeProvider)).then(() => {
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }).catch(() => {});
              }}
              disabled={!activeComplete}
              className="flex-1 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-white rounded-lg text-xs font-medium cursor-pointer hover:border-[#A3B8D4] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
            const complete = isProviderConfigComplete(p);
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
                  <div className="text-[11px] text-[#6B7280] font-['JetBrains_Mono'] truncate">
                    {complete ? p.wgEndpoint : "Needs your provider's public key + endpoint"}
                  </div>
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
                    onClick={() => startEdit(p)}
                    aria-label="Edit"
                    className="p-1.5 text-[#6B7280] hover:text-white cursor-pointer bg-transparent border-0"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => handleDownload(p)}
                    disabled={!complete}
                    aria-label="Download .conf"
                    className="p-1.5 text-[#6B7280] hover:text-[#4ADE80] cursor-pointer bg-transparent border-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    onClick={() => removeProvider(p.id)}
                    aria-label="Delete"
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
          <h3 className="text-sm font-semibold text-white mb-1">Add your provider's WireGuard details</h3>
          <p className="text-xs text-[#6B7280] mb-4 max-w-xs mx-auto">
            VelocityVPN doesn't run VPN servers. Import the .conf from your WireGuard provider (or enter its details) and
            you can download it or scan it as a QR code into the WireGuard app.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="px-5 py-2.5 bg-[#E85D4E] text-white rounded-lg text-xs font-bold cursor-pointer border-0 hover:bg-[#D44A3C]"
          >
            Add Your First Provider
          </button>
        </div>
      )}

      {/* Add / Edit Provider Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[rgba(0,0,0,0.8)] backdrop-blur-sm">
          <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.1)] rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-['Archivo'] text-lg tracking-tight">{editingId ? "Edit Provider" : "Add Provider"}</h3>
                <p className="text-xs text-[#6B7280] mt-0.5">Your provider's WireGuard details</p>
              </div>
              <button onClick={resetForm} className="text-[#6B7280] hover:text-white cursor-pointer bg-transparent border-0">
                <X size={20} />
              </button>
            </div>

            {/* Step 1: Choose Provider */}
            {!selectedProvider ? (
              <div className="space-y-3">
                <p className="text-xs text-[#6B7280] mb-2">Select your VPN provider</p>
                {(Object.entries(PROVIDER_PRESETS) as [ProviderType, (typeof PROVIDER_PRESETS)[ProviderType]][]).map(
                  ([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => chooseProvider(key)}
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
                <div className="bg-[rgba(163,184,212,0.05)] border border-[rgba(163,184,212,0.15)] rounded-xl p-3 flex gap-2">
                  <Info size={14} className="text-[#A3B8D4] shrink-0 mt-0.5" />
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

                {/* Import .conf */}
                <div className="bg-[#111118] border border-[rgba(255,255,255,0.08)] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#6B7280] uppercase tracking-wider flex items-center gap-1">
                      <FileText size={10} /> Paste or import your .conf
                    </span>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="px-2.5 py-1 bg-[#0A0A0F] border border-[rgba(255,255,255,0.15)] text-white rounded-md text-[10px] cursor-pointer hover:border-[#4ADE80] flex items-center gap-1"
                    >
                      <Upload size={10} /> Choose file
                    </button>
                    <input ref={fileRef} type="file" accept=".conf,.txt,text/plain" className="hidden" onChange={onFile} />
                  </div>
                  <textarea
                    value={confText}
                    onChange={(e) => setConfText(e.target.value)}
                    rows={4}
                    spellCheck={false}
                    placeholder={"[Interface]\nPrivateKey = ...\nAddress = 10.64.0.2/32\nDNS = 10.64.0.1\n\n[Peer]\nPublicKey = ...\nAllowedIPs = 0.0.0.0/0, ::/0\nEndpoint = host:51820"}
                    className={`${INPUT_CLS} border-[rgba(255,255,255,0.1)] font-['JetBrains_Mono'] text-[11px] resize-y`}
                  />
                  <button
                    type="button"
                    onClick={() => applyConf(confText)}
                    disabled={!confText.trim()}
                    className="w-full py-2 bg-[#0A0A0F] border border-[rgba(255,255,255,0.15)] text-[#4ADE80] rounded-lg text-[11px] font-medium cursor-pointer hover:border-[#4ADE80] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Fill fields from pasted config
                  </button>
                  {importMsg && (
                    <div className={`text-[10px] leading-relaxed ${importMsg.ok ? "text-[#4ADE80]" : "text-[#FBBF24]"}`}>
                      {importMsg.lines.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  )}
                  <p className="text-[10px] text-[#6B7280]">Parsed in your browser. Nothing is uploaded.</p>
                </div>

                {/* Form Fields */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 block">Name (optional)</label>
                      <input
                        type="text"
                        value={serverName}
                        onChange={(e) => setServerName(e.target.value)}
                        placeholder={`e.g. ${PROVIDER_PRESETS[selectedProvider].name} US-West`}
                        className={`${INPUT_CLS} border-[rgba(255,255,255,0.1)]`}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 block">City (optional)</label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className={`${INPUT_CLS} border-[rgba(255,255,255,0.1)] appearance-none cursor-pointer`}
                      >
                        <option value="">Select a city...</option>
                        {CITIES.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name} {c.country && `(${c.country})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Server size={10} /> Endpoint (host:port) <span className="text-[#E85D4E]">*</span>
                    </label>
                    <input
                      type="text"
                      value={fields.endpoint}
                      onChange={(e) => setField("endpoint", e.target.value)}
                      placeholder="e.g. 193.32.127.66:51820 or us10-wireguard.example.net:51820"
                      className={`${INPUT_CLS} ${borderFor("endpoint")} font-['JetBrains_Mono']`}
                    />
                    {fieldError("endpoint")}
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Key size={10} /> Server Public Key (from your provider) <span className="text-[#E85D4E]">*</span>
                    </label>
                    <input
                      type="text"
                      value={fields.peerPublicKey}
                      onChange={(e) => setField("peerPublicKey", e.target.value)}
                      placeholder="[Peer] PublicKey, 44 characters ending in ="
                      className={`${INPUT_CLS} ${borderFor("peerPublicKey")} font-['JetBrains_Mono']`}
                    />
                    {fieldError("peerPublicKey")}
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 flex items-center justify-between gap-1">
                      <span className="flex items-center gap-1"><Key size={10} /> Your Private Key</span>
                      {selectedProvider === "custom" && (
                        <button
                          type="button"
                          onClick={() => {
                            const k = generateWireGuardPrivateKey();
                            setField("privateKey", k);
                            setDerivedPub(derivePublicKey(k));
                          }}
                          className="normal-case tracking-normal text-[10px] text-[#A3B8D4] hover:text-white bg-transparent border-0 p-0 cursor-pointer flex items-center gap-1"
                        >
                          <RefreshCw size={10} /> Generate client key
                        </button>
                      )}
                    </label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={fields.privateKey}
                      onChange={(e) => { setField("privateKey", e.target.value); setDerivedPub(""); }}
                      placeholder="[Interface] PrivateKey"
                      className={`${INPUT_CLS} ${borderFor("privateKey")} font-['JetBrains_Mono']`}
                    />
                    {fieldError("privateKey")}
                    {derivedPub && (
                      <p className="text-[10px] text-[#A3B8D4] mt-1 break-all">
                        Add this client public key as a peer on your server: <span className="font-['JetBrains_Mono']">{derivedPub}</span>
                      </p>
                    )}
                    <p className="text-[10px] text-[#6B7280] mt-1">
                      Kept only in this browser session, never uploaded. Optional, but without it the .conf gets a placeholder and the QR can't be scanned.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 block">Client Address</label>
                      <input
                        type="text"
                        value={fields.address}
                        onChange={(e) => setField("address", e.target.value)}
                        placeholder="e.g. 10.64.0.2/32"
                        className={`${INPUT_CLS} ${borderFor("address")} font-['JetBrains_Mono']`}
                      />
                      {fieldError("address")}
                    </div>
                    <div>
                      <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 block">DNS</label>
                      <input
                        type="text"
                        value={fields.dns}
                        onChange={(e) => setField("dns", e.target.value)}
                        placeholder="e.g. 10.64.0.1"
                        className={`${INPUT_CLS} ${borderFor("dns")} font-['JetBrains_Mono']`}
                      />
                      {fieldError("dns")}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 block">Allowed IPs</label>
                    <input
                      type="text"
                      value={fields.allowedIps}
                      onChange={(e) => setField("allowedIps", e.target.value)}
                      placeholder={DEFAULT_ALLOWED_IPS}
                      className={`${INPUT_CLS} ${borderFor("allowedIps")} font-['JetBrains_Mono']`}
                    />
                    {fieldError("allowedIps")}
                  </div>

                  <div>
                    <label className="text-[10px] text-[#6B7280] uppercase tracking-wider mb-1 block">Preshared Key (optional)</label>
                    <input
                      type="password"
                      autoComplete="off"
                      value={fields.presharedKey}
                      onChange={(e) => setField("presharedKey", e.target.value)}
                      placeholder="[Peer] PresharedKey, only if your provider gave you one"
                      className={`${INPUT_CLS} ${borderFor("presharedKey")} font-['JetBrains_Mono']`}
                    />
                    {fieldError("presharedKey")}
                  </div>
                  {(errors.mtu || errors.persistentKeepalive) && touched && (
                    <p className="text-[10px] text-[#FBBF24]">
                      {errors.mtu && `MTU: ${errors.mtu}. `}
                      {errors.persistentKeepalive && `PersistentKeepalive: ${errors.persistentKeepalive}.`}
                    </p>
                  )}
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
                    <Check size={14} /> {editingId ? "Save Changes" : "Save & Activate"}
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
