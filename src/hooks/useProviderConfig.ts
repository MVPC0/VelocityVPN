// ─── Provider Config Management ───────────────────────────────
// VelocityVPN is not a VPN network: every tunnel detail (peer public key,
// endpoint, AllowedIPs, DNS, address, optional preshared key) comes from the
// user's own WireGuard provider. Non-secret fields persist to localStorage;
// the client private key and preshared key live only in sessionStorage
// (cleared when the browser session ends). Server keys are never invented
// or derived here.

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  buildWireGuardConf,
  isValidEndpoint,
  isValidWireGuardKey,
  type WireGuardFields,
} from "@/lib/wg-config";

export interface ProviderConfig {
  id: string;
  name: string;
  provider: string; // key of PROVIDER_PRESETS
  serverName: string;
  city: string;
  country: string;
  wgEndpoint: string; // [Peer] Endpoint host:port
  serverPublicKey: string; // [Peer] PublicKey (from the provider)
  presharedKey: string; // [Peer] PresharedKey (optional, sessionStorage only)
  allowedIps: string; // [Peer] AllowedIPs
  persistentKeepalive: string; // [Peer] PersistentKeepalive (optional)
  clientPrivateKey: string; // [Interface] PrivateKey (sessionStorage only)
  clientIp: string; // [Interface] Address
  dns: string; // [Interface] DNS
  mtu: string; // [Interface] MTU (optional)
  active: boolean;
  createdAt: number;
}

export type NewProviderConfig = Omit<ProviderConfig, "id" | "createdAt">;

export const DEFAULT_ALLOWED_IPS = "0.0.0.0/0, ::/0";

const STORAGE_KEY = "velocityvpn_providers";
const KEY_STORAGE_KEY = "velocityvpn_provider_keys";

interface SessionSecrets {
  privateKey?: string;
  presharedKey?: string;
}

function loadSecrets(): Record<string, SessionSecrets> {
  try {
    const raw = sessionStorage.getItem(KEY_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string | SessionSecrets>) : {};
    const out: Record<string, SessionSecrets> = {};
    for (const [id, v] of Object.entries(parsed)) {
      // Older builds stored just the private key string
      out[id] = typeof v === "string" ? { privateKey: v } : v;
    }
    return out;
  } catch {
    return {};
  }
}

function loadProviders(): ProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<ProviderConfig>[]) : [];
    const secrets = loadSecrets();
    return stored
      .filter((p): p is Partial<ProviderConfig> & { id: string } => typeof p?.id === "string")
      .map((p) => ({
        name: "",
        provider: "custom",
        serverName: "",
        city: "",
        country: "",
        wgEndpoint: "",
        serverPublicKey: "",
        clientIp: "",
        dns: "",
        active: false,
        createdAt: Date.now(),
        ...p,
        allowedIps: p.allowedIps || DEFAULT_ALLOWED_IPS,
        persistentKeepalive: p.persistentKeepalive ?? "",
        mtu: p.mtu === undefined || p.mtu === null ? "" : String(p.mtu),
        // Legacy entries may still carry the key in localStorage; saveProviders strips it
        clientPrivateKey: secrets[p.id]?.privateKey || p.clientPrivateKey || "",
        presharedKey: secrets[p.id]?.presharedKey || p.presharedKey || "",
      }));
  } catch {
    return [];
  }
}

function saveProviders(providers: ProviderConfig[]) {
  const secrets: Record<string, SessionSecrets> = {};
  const persisted = providers.map((p) => {
    if (p.clientPrivateKey || p.presharedKey) {
      secrets[p.id] = { privateKey: p.clientPrivateKey || undefined, presharedKey: p.presharedKey || undefined };
    }
    return { ...p, clientPrivateKey: "", presharedKey: "" };
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // storage full / unavailable
  }
  try {
    sessionStorage.setItem(KEY_STORAGE_KEY, JSON.stringify(secrets));
  } catch {
    // sessionStorage unavailable: keys stay in memory only
  }
}

/** True when the provider has a valid peer public key and endpoint. */
export function isProviderConfigComplete(p: ProviderConfig | null | undefined): p is ProviderConfig {
  return !!p && isValidWireGuardKey(p.serverPublicKey) && isValidEndpoint(p.wgEndpoint);
}

export function useProviderConfig() {
  const [providers, setProviders] = useState<ProviderConfig[]>(loadProviders);

  useEffect(() => {
    saveProviders(providers);
  }, [providers]);

  const activeProvider = useMemo(() => providers.find((p) => p.active) ?? null, [providers]);

  const addProvider = useCallback((config: NewProviderConfig, opts?: { activate?: boolean }) => {
    const newProvider: ProviderConfig = {
      ...config,
      id: `provider_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: Date.now(),
    };
    setProviders((prev) => {
      const activate = opts?.activate || prev.length === 0;
      const base = activate ? prev.map((p) => ({ ...p, active: false })) : prev;
      return [...base, { ...newProvider, active: activate }];
    });
    return newProvider;
  }, []);

  const removeProvider = useCallback((id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const activateProvider = useCallback((id: string | null) => {
    setProviders((prev) => prev.map((p) => ({ ...p, active: id !== null && p.id === id })));
  }, []);

  const updateProvider = useCallback((id: string, updates: Partial<ProviderConfig>) => {
    setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  return {
    providers,
    activeProvider,
    addProvider,
    removeProvider,
    activateProvider,
    updateProvider,
  };
}

export type ProviderConfigState = ReturnType<typeof useProviderConfig>;

// ─── Generate WireGuard config from the user's provider details ──

export function providerToFields(p: ProviderConfig): WireGuardFields {
  return {
    privateKey: p.clientPrivateKey,
    address: p.clientIp,
    dns: p.dns,
    mtu: p.mtu,
    peerPublicKey: p.serverPublicKey,
    presharedKey: p.presharedKey,
    endpoint: p.wgEndpoint,
    allowedIps: p.allowedIps || DEFAULT_ALLOWED_IPS,
    persistentKeepalive: p.persistentKeepalive,
  };
}

export function generateProviderWireGuardConfig(p: ProviderConfig): string {
  const location = [p.city, p.country].filter(Boolean).join(", ");
  return buildWireGuardConf(providerToFields(p), [
    location ? `${p.name} — ${location}` : p.name,
    `Provider: ${PROVIDER_PRESETS[p.provider as ProviderType]?.name ?? p.provider}`,
    "Built by VelocityVPN from your provider's details",
  ]);
}

export function providerConfigFilename(p: ProviderConfig): string {
  const slug = `${p.provider}-${p.city || p.serverName || "config"}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  // WireGuard tunnel names are limited to 15 chars on some platforms
  return `${slug.slice(0, 15).replace(/-$/, "") || "wg0"}.conf`;
}

// ─── Provider presets ─────────────────────────────────────────

// dns is only a suggestion for hand entry; an imported .conf wins.
export const PROVIDER_PRESETS = {
  mullvad: {
    name: "Mullvad",
    color: "#E85D4E",
    dns: "10.64.0.1",
    helpUrl: "https://mullvad.net/en/account/wireguard-config",
    instructions: "In your Mullvad account → WireGuard configuration, generate a key, pick a server, and download the .conf. Import or paste it below.",
  },
  protonvpn: {
    name: "ProtonVPN",
    color: "#6D4AFF",
    dns: "10.8.8.1",
    helpUrl: "https://account.protonvpn.com/downloads#wireguard",
    instructions: "In ProtonVPN Downloads → WireGuard configuration, create a config for a server and download the .conf. Import or paste it below.",
  },
  windscribe: {
    name: "Windscribe",
    color: "#4ADE80",
    dns: "10.255.255.3",
    helpUrl: "https://windscribe.com/getconfig/wireguard",
    instructions: "In Windscribe → Config Generators → WireGuard, pick a location and download the .conf. Import or paste it below.",
  },
  ivpn: {
    name: "IVPN",
    color: "#FBBF24",
    dns: "10.0.254.1",
    helpUrl: "https://www.ivpn.net/account/wireguard/",
    instructions: "In your IVPN account → WireGuard, add a key and use the config file generator to download a .conf for a server. Import or paste it below.",
  },
  privado: {
    name: "PrivadoVPN",
    color: "#FF6B35",
    dns: "198.18.0.1",
    helpUrl: "https://privadovpn.com/setup/wireguard",
    instructions: "In your PrivadoVPN account → Setup → WireGuard, pick a server location and download the .conf. Import or paste it below.",
  },
  hideme: {
    name: "Hide.me",
    color: "#00D26A",
    dns: "10.13.1.100",
    helpUrl: "https://member.hide.me/en/wireguard",
    instructions: "In the Hide.me Member Area → WireGuard, pick a server and download the .conf. Import or paste it below.",
  },
  custom: {
    name: "Custom / Self-Hosted",
    color: "#22D3EE",
    dns: "1.1.1.1",
    helpUrl: "",
    instructions: "Import or paste your server's client .conf, or enter the details by hand: the server's endpoint (host:port) and public key (`wg show <if> public-key`), plus your client private key and address.",
  },
} as const;

export type ProviderType = keyof typeof PROVIDER_PRESETS;
