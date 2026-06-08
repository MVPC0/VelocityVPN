import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  Shield, Zap, Power, Clock, ArrowDown, ArrowUp,
  Activity, Server, RefreshCw, ChevronLeft, Download,
  Navigation, Lock, Sparkles, Crown, LogIn,
  Flame, Globe, CircleDot, Thermometer, Loader2
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useClosestServer } from "@/hooks/useGeoLocation";
import type { ServerLocation } from "@/hooks/useGeoLocation";

interface VPNServer {
  id: number;
  name: string;
  city: string;
  country: string;
  countryCode: string;
  region: string;
  hostname: string;
  load: number;
  ping: number | null;
  jitter: number | null;
  protocol: string;
}

interface Connection {
  server: VPNServer;
  assignedIp: string;
  connectedAt: Date;
  protocol: string;
}

const SERVER_LOCATIONS: ServerLocation[] = [
  { id: 1, city: "Los Angeles", countryCode: "US", lat: 34.0522, lng: -118.2437 },
  { id: 2, city: "Dallas", countryCode: "US", lat: 32.7767, lng: -96.7970 },
  { id: 3, city: "Chicago", countryCode: "US", lat: 41.8781, lng: -87.6298 },
  { id: 4, city: "New York", countryCode: "US", lat: 40.7128, lng: -74.0060 },
  { id: 5, city: "Tokyo", countryCode: "JP", lat: 35.6762, lng: 139.6503 },
  { id: 6, city: "Amsterdam", countryCode: "NL", lat: 52.3676, lng: 4.9041 },
  { id: 7, city: "Seoul", countryCode: "KR", lat: 37.5665, lng: 126.9780 },
  { id: 8, city: "London", countryCode: "GB", lat: 51.5074, lng: -0.1278 },
  { id: 9, city: "Auckland", countryCode: "NZ", lat: -36.8485, lng: 174.7633 },
  { id: 10, city: "Warsaw", countryCode: "PL", lat: 52.2297, lng: 21.0122 },
  { id: 11, city: "Sydney", countryCode: "AU", lat: -33.8688, lng: 151.2093 },
  { id: 12, city: "Hong Kong", countryCode: "HK", lat: 22.3193, lng: 114.1694 },
  { id: 13, city: "Perth", countryCode: "AU", lat: -31.9505, lng: 115.8605 },
  { id: 14, city: "Stockholm", countryCode: "SE", lat: 59.3293, lng: 18.0686 },
  { id: 15, city: "Singapore", countryCode: "SG", lat: 1.3521, lng: 103.8198 },
  { id: 16, city: "Sao Paulo", countryCode: "BR", lat: -23.5505, lng: -46.6333 },
  { id: 17, city: "Mumbai", countryCode: "IN", lat: 19.0760, lng: 72.8777 },
  { id: 18, city: "Dubai", countryCode: "AE", lat: 25.2048, lng: 55.2708 },
  { id: 19, city: "Johannesburg", countryCode: "ZA", lat: -26.2041, lng: 28.0473 },
  { id: 20, city: "San Francisco", countryCode: "US", lat: 37.7749, lng: -122.4194 },
  { id: 21, city: "Miami", countryCode: "US", lat: 25.7617, lng: -80.1918 },
  { id: 22, city: "Denver", countryCode: "US", lat: 39.7392, lng: -104.9903 },
  { id: 23, city: "Washington DC", countryCode: "US", lat: 38.9072, lng: -77.0369 },
  { id: 24, city: "Osaka", countryCode: "JP", lat: 34.6937, lng: 135.5023 },
  { id: 25, city: "Frankfurt", countryCode: "DE", lat: 50.1109, lng: 8.6821 },
  { id: 26, city: "Busan", countryCode: "KR", lat: 35.1796, lng: 129.0756 },
  { id: 27, city: "Manchester", countryCode: "GB", lat: 53.4808, lng: -2.2426 },
  { id: 28, city: "Wellington", countryCode: "NZ", lat: -41.2865, lng: 174.7762 },
  { id: 29, city: "Prague", countryCode: "CZ", lat: 50.0755, lng: 14.4378 },
  { id: 30, city: "Melbourne", countryCode: "AU", lat: -37.8136, lng: 144.9631 },
  { id: 31, city: "Rio de Janeiro", countryCode: "BR", lat: -22.9068, lng: -43.1729 },
  { id: 32, city: "Bangalore", countryCode: "IN", lat: 12.9716, lng: 77.5946 },
  { id: 33, city: "Cape Town", countryCode: "ZA", lat: -33.9249, lng: 18.4241 },
  { id: 34, city: "Helsinki", countryCode: "FI", lat: 60.1699, lng: 24.9384 },
];

const FLAG_MAP: Record<string, string> = {
  US: "\uD83C\uDDFA\uD83C\uDDF8", GB: "\uD83C\uDDEC\uD83C\uDDE7", DE: "\uD83C\uDDE9\uD83C\uDDEA",
  JP: "\uD83C\uDDEF\uD83C\uDDF5", SG: "\uD83C\uDDF8\uD83C\uDDEC", AU: "\uD83C\uDDE6\uD83C\uDDFA",
  BR: "\uD83C\uDDE7\uD83C\uDDF7", AE: "\uD83C\uDDE6\uD83C\uDDEA", SE: "\uD83C\uDDF8\uD83C\uDDEA",
  NL: "\uD83C\uDDF3\uD83C\uDDF1", PL: "\uD83C\uDDF5\uD83C\uDDF1", IN: "\uD83C\uDDEE\uD83C\uDDF3",
  HK: "\uD83C\uDDED\uD83C\uDDF0", KR: "\uD83C\uDDF0\uD83C\uDDF7", NZ: "\uD83C\uDDF3\uD83C\uDDFF",
  ZA: "\uD83C\uDDFF\uD83C\uDDE6", CZ: "\uD83C\uDDE8\uD83C\uDDFF", FI: "\uD83C\uDDEB\uD83C\uDDEE",
};

const INITIAL_SERVERS: VPNServer[] = [
  { id: 1, name: "US-West", city: "Los Angeles", country: "United States", countryCode: "US", region: "north_america", hostname: "la-us.velocityvpn.com", load: 45, ping: 35, jitter: 4, protocol: "wireguard" },
  { id: 2, name: "US-South", city: "Dallas", country: "United States", countryCode: "US", region: "north_america", hostname: "dal-us.velocityvpn.com", load: 33, ping: 28, jitter: 3, protocol: "wireguard" },
  { id: 3, name: "US-Central", city: "Chicago", country: "United States", countryCode: "US", region: "north_america", hostname: "chi-us.velocityvpn.com", load: 29, ping: 24, jitter: 3, protocol: "wireguard" },
  { id: 4, name: "US-East", city: "New York", country: "United States", countryCode: "US", region: "north_america", hostname: "ny-us.velocityvpn.com", load: 23, ping: 18, jitter: 2, protocol: "wireguard" },
  { id: 5, name: "Japan", city: "Tokyo", country: "Japan", countryCode: "JP", region: "asia_pacific", hostname: "tok-jp.velocityvpn.com", load: 52, ping: 42, jitter: 5, protocol: "wireguard" },
  { id: 6, name: "Europe-West", city: "Amsterdam", country: "Netherlands", countryCode: "NL", region: "europe", hostname: "ams-nl.velocityvpn.com", load: 27, ping: 21, jitter: 2, protocol: "wireguard" },
  { id: 7, name: "South Korea", city: "Seoul", country: "South Korea", countryCode: "KR", region: "asia_pacific", hostname: "sel-kr.velocityvpn.com", load: 48, ping: 40, jitter: 5, protocol: "wireguard" },
  { id: 8, name: "UK", city: "London", country: "United Kingdom", countryCode: "GB", region: "europe", hostname: "lon-uk.velocityvpn.com", load: 31, ping: 22, jitter: 3, protocol: "wireguard" },
  { id: 9, name: "New Zealand", city: "Auckland", country: "New Zealand", countryCode: "NZ", region: "oceania", hostname: "akl-nz.velocityvpn.com", load: 15, ping: 62, jitter: 6, protocol: "wireguard" },
  { id: 10, name: "Europe-East", city: "Warsaw", country: "Poland", countryCode: "PL", region: "europe", hostname: "waw-pl.velocityvpn.com", load: 18, ping: 26, jitter: 2, protocol: "wireguard" },
  { id: 11, name: "Australia-East", city: "Sydney", country: "Australia", countryCode: "AU", region: "oceania", hostname: "syd-au.velocityvpn.com", load: 19, ping: 58, jitter: 6, protocol: "wireguard" },
  { id: 12, name: "Hong Kong", city: "Hong Kong", country: "Hong Kong", countryCode: "HK", region: "asia_pacific", hostname: "hkg-hk.velocityvpn.com", load: 44, ping: 45, jitter: 4, protocol: "wireguard" },
  { id: 13, name: "Australia-West", city: "Perth", country: "Australia", countryCode: "AU", region: "oceania", hostname: "per-au.velocityvpn.com", load: 12, ping: 65, jitter: 7, protocol: "wireguard" },
  { id: 14, name: "Europe-North", city: "Stockholm", country: "Sweden", countryCode: "SE", region: "europe", hostname: "sto-se.velocityvpn.com", load: 14, ping: 25, jitter: 2, protocol: "wireguard" },
  { id: 15, name: "Singapore", city: "Singapore", country: "Singapore", countryCode: "SG", region: "asia_pacific", hostname: "sin-sg.velocityvpn.com", load: 38, ping: 48, jitter: 4, protocol: "wireguard" },
  { id: 16, name: "Brazil", city: "Sao Paulo", country: "Brazil", countryCode: "BR", region: "south_america", hostname: "sao-br.velocityvpn.com", load: 28, ping: 68, jitter: 7, protocol: "wireguard" },
  { id: 17, name: "Mumbai", city: "Mumbai", country: "India", countryCode: "IN", region: "asia_pacific", hostname: "bom-in.velocityvpn.com", load: 41, ping: 55, jitter: 6, protocol: "wireguard" },
  { id: 18, name: "Dubai", city: "Dubai", country: "UAE", countryCode: "AE", region: "middle_east", hostname: "dxb-ae.velocityvpn.com", load: 35, ping: 52, jitter: 5, protocol: "wireguard" },
  { id: 19, name: "South Africa", city: "Johannesburg", country: "South Africa", countryCode: "ZA", region: "africa", hostname: "jnb-za.velocityvpn.com", load: 22, ping: 72, jitter: 7, protocol: "wireguard" },
  { id: 20, name: "US-West 2", city: "San Francisco", country: "United States", countryCode: "US", region: "north_america", hostname: "sf-us.velocityvpn.com", load: 40, ping: 38, jitter: 4, protocol: "wireguard" },
  { id: 21, name: "US-South 2", city: "Miami", country: "United States", countryCode: "US", region: "north_america", hostname: "mia-us.velocityvpn.com", load: 30, ping: 32, jitter: 3, protocol: "wireguard" },
  { id: 22, name: "US-Central 2", city: "Denver", country: "United States", countryCode: "US", region: "north_america", hostname: "den-us.velocityvpn.com", load: 25, ping: 27, jitter: 3, protocol: "wireguard" },
  { id: 23, name: "US-East 2", city: "Washington DC", country: "United States", countryCode: "US", region: "north_america", hostname: "dc-us.velocityvpn.com", load: 20, ping: 19, jitter: 2, protocol: "wireguard" },
  { id: 24, name: "Japan 2", city: "Osaka", country: "Japan", countryCode: "JP", region: "asia_pacific", hostname: "osa-jp.velocityvpn.com", load: 46, ping: 44, jitter: 5, protocol: "wireguard" },
  { id: 25, name: "Europe-West 2", city: "Frankfurt", country: "Germany", countryCode: "DE", region: "europe", hostname: "fra-de.velocityvpn.com", load: 24, ping: 20, jitter: 2, protocol: "wireguard" },
  { id: 26, name: "South Korea 2", city: "Busan", country: "South Korea", countryCode: "KR", region: "asia_pacific", hostname: "pus-kr.velocityvpn.com", load: 42, ping: 43, jitter: 5, protocol: "wireguard" },
  { id: 27, name: "UK 2", city: "Manchester", country: "United Kingdom", countryCode: "GB", region: "europe", hostname: "man-uk.velocityvpn.com", load: 28, ping: 23, jitter: 3, protocol: "wireguard" },
  { id: 28, name: "New Zealand 2", city: "Wellington", country: "New Zealand", countryCode: "NZ", region: "oceania", hostname: "wlg-nz.velocityvpn.com", load: 13, ping: 64, jitter: 6, protocol: "wireguard" },
  { id: 29, name: "Europe-East 2", city: "Prague", country: "Czech Republic", countryCode: "CZ", region: "europe", hostname: "prg-cz.velocityvpn.com", load: 16, ping: 27, jitter: 2, protocol: "wireguard" },
  { id: 30, name: "Australia-East 2", city: "Melbourne", country: "Australia", countryCode: "AU", region: "oceania", hostname: "mel-au.velocityvpn.com", load: 17, ping: 60, jitter: 6, protocol: "wireguard" },
  { id: 31, name: "Brazil 2", city: "Rio de Janeiro", country: "Brazil", countryCode: "BR", region: "south_america", hostname: "rio-br.velocityvpn.com", load: 26, ping: 70, jitter: 7, protocol: "wireguard" },
  { id: 32, name: "Mumbai 2", city: "Bangalore", country: "India", countryCode: "IN", region: "asia_pacific", hostname: "blr-in.velocityvpn.com", load: 39, ping: 56, jitter: 5, protocol: "wireguard" },
  { id: 33, name: "South Africa 2", city: "Cape Town", country: "South Africa", countryCode: "ZA", region: "africa", hostname: "cpt-za.velocityvpn.com", load: 20, ping: 74, jitter: 7, protocol: "wireguard" },
  { id: 34, name: "Europe-North 2", city: "Helsinki", country: "Finland", countryCode: "FI", region: "europe", hostname: "hel-fi.velocityvpn.com", load: 11, ping: 28, jitter: 2, protocol: "wireguard" },
];

const PING_TARGETS: Record<number, string> = {
  1: "https://www.cloudflare.com",
  2: "https://www.att.com",
  3: "https://www.chicago.gov",
  4: "https://www.google.com",
  5: "https://www.yahoo.co.jp",
  6: "https://www.rijksoverheid.nl",
  7: "https://www.go.kr",
  8: "https://www.bbc.co.uk",
  9: "https://www.govt.nz",
  10: "https://www.gov.pl",
  11: "https://www.gov.au",
  12: "https://www.gov.hk",
  13: "https://www.wa.gov.au",
  14: "https://www.regeringen.se",
  15: "https://www.gov.sg",
  16: "https://www.gov.br",
  17: "https://www.india.gov.in",
  18: "https://www.google.ae",
  19: "https://www.gov.za",
  20: "https://www.sfgov.org",
  21: "https://www.miamidade.gov",
  22: "https://www.denvergov.org",
  23: "https://www.dc.gov",
  24: "https://www.city.osaka.lg.jp",
  25: "https://www.bundesregierung.de",
  26: "https://www.busan.go.kr",
  27: "https://www.manchester.gov.uk",
  28: "https://www.wellingtonnz.govt.nz",
  29: "https://www.praha.eu",
  30: "https://www.melbourne.vic.gov.au",
  31: "https://www.rio.rj.gov.br",
  32: "https://www.karnataka.gov.in",
  33: "https://www.capetown.gov.za",
  34: "https://www.hel.fi",
};

function measurePingImage(endpoint: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    const start = performance.now();
    const cacheBuster = `?t=${Date.now()}_${Math.random()}`;
    const cleanup = () => resolve(Math.max(1, Math.round(performance.now() - start)));
    img.onload = cleanup;
    img.onerror = cleanup;
    setTimeout(() => { img.src = ""; cleanup(); }, 8000);
    img.src = endpoint + "/favicon.ico" + cacheBuster;
  });
}

// ─── Trial Banner Component ───────────────────────────────────

function TrialBanner({
  trial,
  onUpgrade,
}: {
  trial: { status: string; daysLeft: number | null; expired: boolean };
  onUpgrade: () => void;
}) {
  if (trial.status === "premium") return null;

  if (trial.status === "trial" && trial.daysLeft !== null) {
    return (
      <div className="bg-[rgba(232,93,78,0.1)] border border-[rgba(232,93,78,0.2)] rounded-xl p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[rgba(232,93,78,0.15)] flex items-center justify-center">
            <Sparkles size={16} className="text-[#E85D4E]" />
          </div>
          <div>
            <p className="text-sm text-white font-medium">
              Free Trial Active — {trial.daysLeft} {trial.daysLeft === 1 ? "day" : "days"} left
            </p>
            <p className="text-xs text-[#9CA3AF]">
              All premium features unlocked. Upgrade to keep access after trial.
            </p>
          </div>
        </div>
        <button
          onClick={onUpgrade}
          className="px-4 py-2 bg-[#E85D4E] text-white rounded-lg text-xs font-medium hover:bg-[#D44A3C] transition-all cursor-pointer border-0 shrink-0"
        >
          Upgrade
        </button>
      </div>
    );
  }

  if (trial.status === "expired") {
    return (
      <div className="bg-[rgba(232,93,78,0.08)] border border-[rgba(232,93,78,0.2)] rounded-xl p-3 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[rgba(232,93,78,0.1)] flex items-center justify-center">
            <Clock size={16} className="text-[#E85D4E]" />
          </div>
          <div>
            <p className="text-sm text-white font-medium">Trial Expired</p>
            <p className="text-xs text-[#9CA3AF]">
              Your 3-day free trial has ended. Upgrade to continue using premium features.
            </p>
          </div>
        </div>
        <button
          onClick={onUpgrade}
          className="px-4 py-2 bg-[#E85D4E] text-white rounded-lg text-xs font-medium hover:bg-[#D44A3C] transition-all cursor-pointer border-0 shrink-0"
        >
          Upgrade
        </button>
      </div>
    );
  }

  // Guest mode banner
  return (
    <div className="bg-[rgba(155,109,255,0.08)] border border-[rgba(155,109,255,0.2)] rounded-xl p-3 mb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[rgba(155,109,255,0.12)] flex items-center justify-center">
          <Crown size={16} className="text-[#9B6DFF]" />
        </div>
        <div>
          <p className="text-sm text-white font-medium">Browsing as Guest</p>
          <p className="text-xs text-[#9CA3AF]">
            Sign up for a free 3-day trial to unlock VPN connections and all premium features.
          </p>
        </div>
      </div>
      <button
        onClick={onUpgrade}
        className="px-4 py-2 bg-[#9B6DFF] text-white rounded-lg text-xs font-medium hover:bg-[#8B5DF5] transition-all cursor-pointer border-0 shrink-0 flex items-center gap-1.5"
      >
        <Sparkles size={12} /> Start Free Trial
      </button>
    </div>
  );
}

// ─── Locked Feature Overlay ───────────────────────────────────

function LockedOverlay({
  title,
  description,
  onAction,
}: {
  title: string;
  description: string;
  onAction: () => void;
}) {
  return (
    <div className="relative min-h-[200px] flex items-center justify-center">
      <div className="absolute inset-0 bg-[#0A0A0F] rounded-xl" />
      <div className="relative z-10 text-center px-6 py-8">
        <div className="w-12 h-12 rounded-full bg-[rgba(155,109,255,0.1)] flex items-center justify-center mx-auto mb-3">
          <Lock size={20} className="text-[#9B6DFF]" />
        </div>
        <h4 className="text-white font-medium mb-1">{title}</h4>
        <p className="text-xs text-[#6B7280] mb-4 max-w-[260px] mx-auto">{description}</p>
        <button
          onClick={onAction}
          className="px-4 py-2 bg-[#9B6DFF] text-white rounded-lg text-xs font-medium hover:bg-[#8B5DF5] transition-all cursor-pointer border-0 inline-flex items-center gap-1.5"
        >
          <Sparkles size={12} /> Start Free Trial
        </button>
      </div>
    </div>
  );
}

// ─── Server Coordinates for Heat Map ──────────────────────────

// Approximate SVG coordinates (0-100 scale) for each server city
const SERVER_COORDS: Record<number, { x: number; y: number }> = {
  1: { x: 14, y: 36 },   // Los Angeles (US-West)
  2: { x: 22, y: 39 },   // Dallas (US-South)
  3: { x: 25, y: 33 },   // Chicago (US-Central)
  4: { x: 28, y: 35 },   // New York (US-East)
  5: { x: 85, y: 35 },   // Tokyo (Japan)
  6: { x: 49, y: 28 },   // Amsterdam (Europe-West)
  7: { x: 83, y: 34 },   // Seoul (South Korea)
  8: { x: 47, y: 29 },   // London (UK)
  9: { x: 92, y: 78 },   // Auckland (New Zealand)
  10: { x: 53, y: 30 },  // Warsaw (Europe-East)
  11: { x: 88, y: 72 },  // Sydney (Australia-East)
  12: { x: 78, y: 45 },  // Hong Kong
  13: { x: 82, y: 68 },  // Perth (Australia-West)
  14: { x: 53, y: 20 },  // Stockholm (Europe-North)
  15: { x: 75, y: 52 },  // Singapore
  16: { x: 32, y: 68 },  // Sao Paulo (Brazil)
  17: { x: 66, y: 46 },  // Mumbai
  18: { x: 60, y: 42 },  // Dubai
  19: { x: 55, y: 76 },  // Johannesburg (South Africa)
  20: { x: 12, y: 34 },  // San Francisco (US-West 2)
  21: { x: 27, y: 41 },  // Miami (US-South 2)
  22: { x: 20, y: 34 },  // Denver (US-Central 2)
  23: { x: 28, y: 36 },  // Washington DC (US-East 2)
  24: { x: 84, y: 37 },  // Osaka (Japan 2)
  25: { x: 51, y: 30 },  // Frankfurt (Europe-West 2)
  26: { x: 83, y: 36 },  // Busan (South Korea 2)
  27: { x: 46, y: 27 },  // Manchester (UK 2)
  28: { x: 93, y: 80 },  // Wellington (New Zealand 2)
  29: { x: 53, y: 31 },  // Prague (Europe-East 2)
  30: { x: 87, y: 74 },  // Melbourne (Australia-East 2)
  31: { x: 34, y: 66 },  // Rio de Janeiro (Brazil 2)
  32: { x: 68, y: 50 },  // Bangalore (Mumbai 2)
  33: { x: 54, y: 80 },  // Cape Town (South Africa 2)
  34: { x: 56, y: 18 },  // Helsinki (Europe-North 2)
};

// Load level thresholds and labels
function getHeatLevel(load: number): {
  label: string;
  color: string;
  bg: string;
  glow: string;
  description: string;
  icon: string;
} {
  if (load < 20)
    return {
      label: "Botty",
      color: "#4ADE80",
      bg: "rgba(74,222,128,0.15)",
      glow: "rgba(74,222,128,0.4)",
      description: "Low traffic — great for casual play",
      icon: "🤖",
    };
  if (load < 40)
    return {
      label: "Light",
      color: "#22D3EE",
      bg: "rgba(34,211,238,0.15)",
      glow: "rgba(34,211,238,0.4)",
      description: "Moderate traffic — smooth connection",
      icon: "🍃",
    };
  if (load < 60)
    return {
      label: "Average",
      color: "#FBBF24",
      bg: "rgba(251,191,36,0.15)",
      glow: "rgba(251,191,36,0.4)",
      description: "Normal traffic — expect some competition",
      icon: "⚖️",
    };
  if (load < 80)
    return {
      label: "Busy",
      color: "#F97316",
      bg: "rgba(249,115,22,0.15)",
      glow: "rgba(249,115,22,0.4)",
      description: "Heavy traffic — competitive lobbies",
      icon: "🔥",
    };
  return {
    label: "Sweaty",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.15)",
    glow: "rgba(239,68,68,0.4)",
    description: "Max capacity — expect sweats",
    icon: "💀",
  };
}

// ─── Heat Map Tab Component ───────────────────────────────────

interface MonServer {
  serverId: number; name: string; city: string; countryCode: string;
  region: string; latency: number | null; playerCount: number;
  loadPercent: number; isPeakHour: boolean; localHour: number;
  events: Array<{ name: string; multiplier: number }>;
}

interface MonEvent {
  name: string;
  multiplier: number;
}

function HeatMapTab({
  servers,
  heatLoads,
  monitoringData,
  canConnect,
  goToLogin,
  closestServer,
  distance,
}: {
  servers: VPNServer[];
  heatLoads: Record<number, number>;
  monitoringData: { servers: MonServer[]; timestamp: string; activeEvents: MonEvent[] } | undefined;
  canConnect: boolean;
  goToLogin: () => void;
  closestServer: ServerLocation | null;
  distance: number | null;
}) {
  const [selectedHeatServer, setSelectedHeatServer] = useState<number | null>(null);
  const sortedByLoad = [...servers].sort((a, b) => (heatLoads[b.id] ?? 0) - (heatLoads[a.id] ?? 0));

  // Player count lookup from real monitoring
  const playerCounts: Record<number, number> = {};
  if (monitoringData?.servers) {
    monitoringData.servers.forEach((s) => { playerCounts[s.serverId] = s.playerCount; });
  }

  // Find the closest server in our VPNServer list
  const closestVPNServer = closestServer
    ? servers.find((s) => s.id === closestServer.id) ?? null
    : null;
  const closestPlayers = closestVPNServer ? (playerCounts[closestVPNServer.id] ?? 0) : 0;

  // Active events from monitoring
  const activeEvents = monitoringData?.activeEvents ?? [];

  return (
    <div>
      {/* Active Events Banner */}
      {activeEvents.length > 0 && (
        <div className="bg-[rgba(232,93,78,0.08)] border border-[rgba(232,93,78,0.2)] rounded-xl p-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-[#E85D4E] uppercase tracking-wider">Active Events:</span>
            {activeEvents.map((event, i) => (
              <span key={i} className="text-xs text-[#D1D5DB] bg-[rgba(255,255,255,0.05)] px-2 py-1 rounded-full">
                {event.name} <span className="text-[#E85D4E]">+{Math.round((event.multiplier - 1) * 100)}%</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Closest Server Recommendation */}
      {closestVPNServer && (
        <div className="bg-[rgba(74,222,128,0.08)] border border-[rgba(74,222,128,0.2)] rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[rgba(74,222,128,0.15)] flex items-center justify-center">
                <Navigation size={18} className="text-[#4ADE80]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  Recommended Server — Closest to You
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  {FLAG_MAP[closestVPNServer.countryCode] ?? "🌐"} {closestVPNServer.city} — {distance}mi — <strong className="text-white">{closestPlayers.toLocaleString()}</strong> players — Load: {heatLoads[closestVPNServer.id] ?? closestVPNServer.load}%
                </p>
              </div>
            </div>
            <button
              onClick={() => setSelectedHeatServer(closestVPNServer.id)}
              className="px-4 py-2 bg-[#4ADE80] text-[#050507] rounded-lg text-xs font-bold hover:bg-[#3ECF71] transition-all cursor-pointer border-0"
            >
              View on Map
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#111118] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#4ADE80] transition-all duration-500"
                style={{ width: `${Math.min(100, ((distance ?? 999) / 100) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-[#4ADE80] font-medium">{distance}mi</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-['Archivo'] text-lg tracking-tight flex items-center gap-2">
            <Flame size={18} className="text-[#E85D4E]" />
            Live Server Heat Map
          </h3>
          <p className="text-xs text-[#6B7280] mt-0.5">
            Real-time server load updates every 2 seconds. Select a server to see details.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#4ADE80]">
          <CircleDot size={12} className="animate-pulse" />
          Live
        </div>
      </div>

      {/* World Map */}
      <div className="relative bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-2xl overflow-hidden mb-5">
        <svg viewBox="0 0 100 60" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          {/* Dark background */}
          <rect width="100" height="60" fill="#0A0A0F" />

          {/* Grid lines */}
          {Array.from({ length: 11 }, (_, i) => (
            <g key={i}>
              <line x1={0} y1={i * 6} x2={100} y2={i * 6} stroke="rgba(255,255,255,0.03)" strokeWidth={0.15} />
              <line x1={i * 10} y1={0} x2={i * 10} y2={60} stroke="rgba(255,255,255,0.03)" strokeWidth={0.15} />
            </g>
          ))}

          {/* Simplified continent outlines */}
          {/* North America */}
          <path d="M8,18 L12,14 L18,12 L25,14 L28,18 L30,24 L28,32 L24,36 L20,38 L14,36 L10,32 L8,26 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.2} />
          {/* South America */}
          <path d="M22,42 L28,40 L32,44 L34,52 L32,58 L28,56 L24,52 L22,46 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.2} />
          {/* Europe */}
          <path d="M44,20 L48,16 L54,16 L58,20 L56,28 L52,32 L48,32 L44,28 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.2} />
          {/* Africa */}
          <path d="M44,36 L50,34 L56,38 L58,46 L54,52 L48,54 L44,48 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.2} />
          {/* Asia */}
          <path d="M58,16 L66,12 L78,14 L86,20 L88,28 L84,36 L78,40 L70,42 L62,38 L58,30 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.2} />
          {/* Australia */}
          <path d="M82,50 L88,48 L92,52 L90,58 L84,58 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.06)" strokeWidth={0.2} />

          {/* Heat gradient overlay based on server positions */}
          {servers.map((server) => {
            const coords = SERVER_COORDS[server.id];
            if (!coords) return null;
            const load = heatLoads[server.id] ?? server.load;
            const heat = getHeatLevel(load);
            const radius = 3 + (load / 100) * 4;
            return (
              <g key={`glow-${server.id}`}>
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={radius * 2}
                  fill={heat.glow}
                  opacity={0.3}
                >
                  <animate attributeName="r" values={`${radius};${radius * 1.5};${radius}`} dur={`${2 + Math.random()}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0.15;0.3" dur={`${2 + Math.random()}s`} repeatCount="indefinite" />
                </circle>
              </g>
            );
          })}

          {/* Server dots */}
          {servers.map((server) => {
            const coords = SERVER_COORDS[server.id];
            if (!coords) return null;
            const load = heatLoads[server.id] ?? server.load;
            const heat = getHeatLevel(load);
            const isSelected = selectedHeatServer === server.id;
            const isClosest = closestServer?.id === server.id;
            return (
              <g
                key={server.id}
                onClick={() => setSelectedHeatServer(isSelected ? null : server.id)}
                className="cursor-pointer"
              >
                {/* Closest server indicator ring */}
                {isClosest && (
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={5}
                    fill="none"
                    stroke="#4ADE80"
                    strokeWidth={0.5}
                    opacity={0.6}
                  >
                    <animate attributeName="r" values="4;6;4" dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Outer ring for selected */}
                {isSelected && (
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={4}
                    fill="none"
                    stroke={heat.color}
                    strokeWidth={0.4}
                    opacity={0.8}
                  >
                    <animate attributeName="r" values="3;5;3" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                {/* Main dot */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isSelected ? 2.2 : 1.8}
                  fill={heat.color}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={0.3}
                />
                {/* City label */}
                <text
                  x={coords.x}
                  y={coords.y - 3}
                  textAnchor="middle"
                  fill="white"
                  fontSize={2.2}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={500}
                >
                  {server.city}
                </text>
                {/* Load label */}
                <text
                  x={coords.x}
                  y={coords.y + 4.5}
                  textAnchor="middle"
                  fill={heat.color}
                  fontSize={1.8}
                  fontFamily="JetBrains Mono, monospace"
                  fontWeight={600}
                >
                  {load}% {heat.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mb-5 bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-3">
        <span className="text-xs text-[#6B7280] mr-1">Legend:</span>
        {[
          { load: 10, label: "Botty" },
          { load: 30, label: "Light" },
          { load: 50, label: "Average" },
          { load: 70, label: "Busy" },
          { load: 90, label: "Sweaty" },
        ].map((item) => {
          const heat = getHeatLevel(item.load);
          return (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: heat.color }} />
              <span className="text-xs" style={{ color: heat.color }}>{item.label}</span>
            </div>
          );
        })}
      </div>

      {/* Server Heat List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {sortedByLoad.map((server) => {
          const load = heatLoads[server.id] ?? server.load;
          const heat = getHeatLevel(load);
          const isSelected = selectedHeatServer === server.id;
          const isClosestSrv = closestServer?.id === server.id;
          const players = playerCounts[server.id] ?? 0;

          return (
            <div
              key={server.id}
              onClick={() => setSelectedHeatServer(isSelected ? null : server.id)}
              className={`relative bg-[#0A0A0F] border rounded-xl p-4 transition-all cursor-pointer ${
                isSelected ? "border-[rgba(255,255,255,0.2)]" : isClosestSrv ? "border-[rgba(74,222,128,0.3)]" : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.12)]"
              }`}
            >
              {/* Closest badge */}
              {isClosestSrv && (
                <div className="absolute -top-2 left-3 z-20">
                  <span className="flex items-center gap-1 text-[9px] font-bold text-[#050507] bg-[#4ADE80] px-2 py-0.5 rounded-full">
                    <Navigation size={8} /> CLOSEST TO YOU
                  </span>
                </div>
              )}

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{FLAG_MAP[server.countryCode] ?? "\uD83C\uDF10"}</span>
                  <div>
                    <div className="font-medium text-sm text-white">{server.city}</div>
                    <div className="text-xs text-[#6B7280]">{server.name}</div>
                    <div className="text-[10px] text-[#9CA3AF] mt-0.5">
                      {players.toLocaleString()} players
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{heat.icon}</span>
                    <span className="font-['JetBrains_Mono'] text-lg font-bold" style={{ color: heat.color }}>
                      {load}%
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: heat.bg, color: heat.color }}
                  >
                    {heat.label}
                  </span>
                </div>
              </div>

              {/* Expanded detail */}
              {isSelected && (
                <div className="relative z-10 mt-3 pt-3 border-t border-[rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-[#9CA3AF]">{heat.description}</p>
                    <span className="text-xs font-['JetBrains_Mono'] text-white font-bold">
                      {players.toLocaleString()} players
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-[#111118] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${load}%`,
                          backgroundColor: heat.color,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-[#6B7280]">
                    <span>Ping: {server.ping !== null ? `${server.ping}ms` : "--"}</span>
                    <span>Jitter: ±{server.jitter ?? "--"}ms</span>
                    <span>Protocol: {server.protocol}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!canConnect && (
        <div className="mt-4 bg-[rgba(155,109,255,0.05)] border border-[rgba(155,109,255,0.15)] rounded-xl p-4 text-center">
          <p className="text-sm text-[#9CA3AF]">
            <Flame size={14} className="inline mr-1 text-[#E85D4E]" />
            Server heat map shows real-time load data. VPN connection available during your free trial.
            <button onClick={goToLogin} className="ml-2 text-[#9B6DFF] hover:underline bg-transparent border-0 cursor-pointer">Start free trial</button>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, trial, canUsePremium, isGuest, logout } = useAuth();
  const { closestServer, distance } = useClosestServer(SERVER_LOCATIONS);
  const [servers, setServers] = useState<VPNServer[]>(INITIAL_SERVERS);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"servers" | "heat" | "status" | "history">("servers");
  const [elapsed, setElapsed] = useState(0);
  const [history, setHistory] = useState<Array<{
    server: VPNServer; duration: number; bytesSent: number;
    bytesReceived: number; date: Date; status: string;
  }>>([]);
  const [stats, setStats] = useState({
    totalSessions: 0, totalDuration: 0, totalDataSent: 0, totalDataReceived: 0,
  });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [pingingId, setPingingId] = useState<number | null>(null);
  const [isPingingAll, setIsPingingAll] = useState(false);

  // ─── REAL MONITORING DATA ────────────────────────────────────
  const { data: monitoringData } = trpc.monitoring.snapshot.useQuery(undefined, {
    refetchInterval: 10000, // Poll every 10 seconds
    staleTime: 5000,
  });

  // Build heat loads from real monitoring data (player count based)
  const heatLoads: Record<number, number> = {};
  const heatHistory: Array<Record<number, number>> = [];
  if (monitoringData?.servers) {
    monitoringData.servers.forEach((s) => {
      heatLoads[s.serverId] = s.loadPercent;
    });
  }

  // For guest demo: allow viewing servers but not connecting
  const canConnect = canUsePremium;

  // Auto-select closest server
  useEffect(() => {
    if (closestServer && !selectedServerId && !connection) {
      setSelectedServerId(closestServer.id);
    }
  }, [closestServer, selectedServerId, connection]);

  // Live duration counter
  useEffect(() => {
    if (!connection) { setElapsed(0); return; }
    const tick = () => setElapsed(Math.floor((Date.now() - connection.connectedAt.getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [connection]);

  const handleConnect = useCallback(() => {
    if (!canConnect || !selectedServerId) return;
    const server = servers.find((s) => s.id === selectedServerId);
    if (!server) return;
    setIsConnecting(true);
    setTimeout(() => {
      const ip = `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 253) + 1}`;
      setConnection({ server, assignedIp: ip, connectedAt: new Date(), protocol: server.protocol });
      setServers((prev) => prev.map((s) => s.id === server.id ? { ...s, load: Math.min(100, s.load + 4) } : s));
      setIsConnecting(false);
    }, 1200);
  }, [canConnect, selectedServerId, servers]);

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

  const handlePingTest = useCallback(async (serverId: number) => {
    const target = PING_TARGETS[serverId];
    if (!target) return;
    setPingingId(serverId);
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const latency = await measurePingImage(target);
      samples.push(latency);
      if (i < 2) await new Promise((r) => setTimeout(r, 80));
    }
    const latency = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
    const jitter = Math.max(1, Math.max(...samples) - Math.min(...samples));
    setServers((prev) => prev.map((s) => s.id === serverId ? { ...s, ping: latency, jitter } : s));
    setPingingId(null);
  }, []);

  const testAll = useCallback(async () => {
    setIsPingingAll(true);
    for (const s of servers) {
      await handlePingTest(s.id);
    }
    setIsPingingAll(false);
  }, [servers, handlePingTest]);

  const formatDuration = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
  };

  const formatBytes = (b: number) => {
    if (b === 0) return "0 B";
    const k = 1024, sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const pingColor = (p: number | null) => p === null ? "text-[#6B7280]" : p < 50 ? "text-[#4ADE80]" : p < 100 ? "text-[#FBBF24]" : "text-[#EF4444]";
  const loadColor = (l: number) => l < 30 ? "bg-[#4ADE80]" : l < 70 ? "bg-[#FBBF24]" : "bg-[#EF4444]";

  const downloadWireGuardConfig = useCallback(() => {
    if (!connection) return;
    const privateKey = Array.from({ length: 44 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"[Math.floor(Math.random() * 64)]).join("");
    const config = `[Interface]\nPrivateKey = ${privateKey}\nAddress = ${connection.assignedIp}/32\nDNS = 1.1.1.1, 8.8.8.8\nMTU = 1420\n\n[Peer]\nPublicKey = ${connection.server.hostname.replace(/\./g, "_").toUpperCase()}_KEY_001\nAllowedIPs = 0.0.0.0/0, ::/0\nEndpoint = ${connection.server.hostname}:51820\nPersistentKeepalive = 25`;
    const blob = new Blob([config], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `velocityvpn-${connection.server.city.toLowerCase().replace(/\s/g, "-")}.conf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [connection]);

  const goToLogin = () => navigate("/login");
  const goToPricing = () => navigate("/pricing");

  // Guest mode: allow server browsing + ping but lock everything else
  const activeTrial = trial ?? { status: "guest", daysLeft: null, expired: false };

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      {/* Header */}
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[rgba(5,5,7,0.95)] backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="text-[#6B7280] hover:text-white transition-colors p-1">
              <ChevronLeft size={20} />
            </button>
            <span className="font-['Archivo'] font-bold text-lg tracking-tight">
              VELOCIT<span className="text-[#E85D4E]">VPN</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            {!connection && closestServer && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-[rgba(74,222,128,0.1)] rounded-full border border-[rgba(74,222,128,0.2)]">
                <Navigation size={12} className="text-[#4ADE80]" />
                <span className="text-[#4ADE80] text-xs font-medium">Closest: {closestServer.city}</span>
              </div>
            )}
            {connection && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-[rgba(74,222,128,0.1)] rounded-full border border-[rgba(74,222,128,0.2)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ADE80] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4ADE80]" />
                </span>
                <span className="text-[#4ADE80] text-xs font-medium">Connected</span>
              </div>
            )}
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#6B7280] hidden sm:block">{user?.name ?? user?.email ?? "User"}</span>
                <button onClick={logout} className="text-xs text-[#E85D4E] hover:text-white transition-colors bg-transparent border-0 cursor-pointer">
                  Sign Out
                </button>
              </div>
            ) : (
              <button onClick={goToLogin} className="text-xs text-[#E85D4E] hover:text-white transition-colors flex items-center gap-1 bg-transparent border-0 cursor-pointer">
                <LogIn size={12} /> Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Trial / Guest Banner */}
        <TrialBanner trial={activeTrial} onUpgrade={goToLogin} />

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
                    : canConnect
                    ? selectedServerId
                      ? `${servers.find((s) => s.id === selectedServerId)?.city ?? ""} selected — Click Connect`
                      : "Select a server below to connect"
                    : "Sign up for a free 3-day trial to connect"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {connection ? (
                <>
                  <div className="text-right hidden sm:block">
                    <div className="text-xs text-[#6B7280]">VPN IP</div>
                    <div className="font-['JetBrains_Mono'] text-sm text-[#A3B8D4]">{connection.assignedIp}</div>
                  </div>
                  <button onClick={downloadWireGuardConfig}
                    className="hidden sm:flex px-5 py-2.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#4ADE80] rounded-lg font-medium hover:border-[#4ADE80] transition-all items-center gap-2 text-sm">
                    <Download size={14} /> Config
                  </button>
                  <button onClick={handleDisconnect} disabled={isDisconnecting}
                    className="px-5 py-2.5 bg-[#EF4444] text-white rounded-lg font-medium hover:bg-[#DC2626] transition-all disabled:opacity-50 flex items-center gap-2 text-sm cursor-pointer border-0">
                    <Power size={14} /> {isDisconnecting ? "..." : "Disconnect"}
                  </button>
                </>
              ) : (
                canConnect ? (
                  <button onClick={handleConnect} disabled={!selectedServerId || isConnecting}
                    className="px-5 py-2.5 bg-[#E85D4E] text-white rounded-lg font-medium hover:bg-[#D44A3C] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm glow-coral-pulse cursor-pointer border-0">
                    <Zap size={14} /> {isConnecting ? "Connecting..." : "Connect"}
                  </button>
                ) : (
                  <button onClick={goToLogin}
                    className="px-5 py-2.5 bg-[#9B6DFF] text-white rounded-lg font-medium hover:bg-[#8B5DF5] transition-all flex items-center gap-2 text-sm cursor-pointer border-0">
                    <Sparkles size={14} /> Start Free Trial
                  </button>
                )
              )}
            </div>
          </div>

          {/* Connection stats — only show if connected */}
          {connection && (
            <>
              <div className="mt-5 pt-5 border-t border-[rgba(255,255,255,0.08)] grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#111118] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><Clock size={10} /> Duration</div>
                  <div className="font-['JetBrains_Mono'] text-base text-white">{formatDuration(elapsed)}</div>
                </div>
                <div className="bg-[#111118] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><ArrowDown size={10} /> Download</div>
                  <div className="font-['JetBrains_Mono'] text-base text-[#4ADE80]">{formatBytes(elapsed * 51200)}</div>
                </div>
                <div className="bg-[#111118] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><ArrowUp size={10} /> Upload</div>
                  <div className="font-['JetBrains_Mono'] text-base text-[#A3B8D4]">{formatBytes(elapsed * 12288)}</div>
                </div>
                <div className="bg-[#111118] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[#6B7280] text-xs mb-1"><Activity size={10} /> Protocol</div>
                  <div className="font-['JetBrains_Mono'] text-base text-white uppercase">{connection.protocol}</div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs text-[#6B7280]">
                  Download the WireGuard config and import it into the <a href="https://www.wireguard.com/install/" target="_blank" rel="noopener noreferrer" className="text-[#E85D4E] hover:underline">WireGuard app</a> to activate your VPN tunnel.
                </p>
                <button onClick={downloadWireGuardConfig}
                  className="sm:hidden flex-shrink-0 ml-3 px-3 py-1.5 bg-[#111118] border border-[rgba(255,255,255,0.15)] text-[#4ADE80] rounded-lg text-xs font-medium items-center gap-1 cursor-pointer">
                  <Download size={12} /> Config
                </button>
              </div>
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-1 w-fit">
          {(["servers", "heat", "status", "history"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-[#E85D4E] text-white" : "text-[#9CA3AF] hover:text-white"} ${tab !== "servers" && tab !== "heat" && !canConnect ? "opacity-50" : ""} flex items-center gap-1.5`}>
              {tab === "servers" ? <><Server size={13} /> Servers</> : tab === "heat" ? <><Flame size={13} /> Heat Map</> : tab === "status" ? <><Activity size={13} /> Stats</> : <><Clock size={13} /> History</>}
            </button>
          ))}
        </div>

        {/* Servers Tab — always available */}
        {activeTab === "servers" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-['Archivo'] text-lg tracking-tight">Server Locations</h3>
              <button onClick={testAll} disabled={isPingingAll}
                className="flex items-center gap-1.5 text-sm text-[#E85D4E] hover:text-white transition-colors disabled:opacity-50 cursor-pointer bg-transparent border-0">
                <RefreshCw size={13} className={isPingingAll ? "animate-spin" : ""} />
                {isPingingAll ? "Testing..." : "Test All"}
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {servers.map((server) => {
                const isSel = selectedServerId === server.id;
                const isConn = connection?.server.id === server.id;
                const isClosestSrv = closestServer?.id === server.id;
                return (
                  <div key={server.id}
                    onClick={() => { if (!connection) setSelectedServerId(server.id); }}
                    className={`relative bg-[#0A0A0F] border rounded-xl p-4 transition-all ${
                      isConn ? "border-[#4ADE80] bg-[rgba(74,222,128,0.05)]" : isSel ? "border-[#E85D4E]" : isClosestSrv ? "border-[rgba(74,222,128,0.3)]" : "border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]"
                    } ${connection && !isConn ? "opacity-50" : canConnect ? "cursor-pointer" : "cursor-pointer"}`}>
                    {isClosestSrv && (
                      <div className="absolute -top-2.5 left-4">
                        <span className="flex items-center gap-1 text-[10px] font-bold text-[#050507] bg-[#4ADE80] px-2 py-0.5 rounded-full">
                          <Navigation size={10} /> CLOSEST
                        </span>
                      </div>
                    )}
                    {!canConnect && (
                      <div className="absolute top-3 right-3 z-10">
                        <Lock size={12} className="text-[#9B6DFF]" />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{FLAG_MAP[server.countryCode] ?? "\uD83C\uDF10"}</span>
                        <div>
                          <div className="font-medium text-sm text-white">{server.city}</div>
                          <div className="text-xs text-[#6B7280]">{server.country} &middot; {server.name}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-['JetBrains_Mono'] text-lg ${pingColor(server.ping)}`}>
                          {server.ping !== null ? `${server.ping}ms` : "--"}
                        </div>
                        <div className="text-[10px] text-[#6B7280]">&plusmn;{server.jitter ?? "--"}ms jitter</div>
                      </div>
                    </div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#111118] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${loadColor(server.load)}`} style={{ width: `${server.load}%` }} />
                      </div>
                      <span className="text-[10px] text-[#6B7280] w-8 text-right">{server.load}%</span>
                      <button onClick={(e) => { e.stopPropagation(); handlePingTest(server.id); }}
                        disabled={pingingId === server.id}
                        className="text-[#6B7280] hover:text-[#E85D4E] transition-colors disabled:opacity-30 p-1 cursor-pointer bg-transparent border-0">
                        <RefreshCw size={11} className={pingingId === server.id ? "animate-spin" : ""} />
                      </button>
                    </div>
                    {isConn && (
                      <div className="absolute top-3 right-3">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4ADE80] opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#4ADE80]" />
                        </span>
                      </div>
                    )}
                    {isSel && !connection && canConnect && (
                      <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-[#E85D4E]" />
                    )}
                  </div>
                );
              })}
            </div>
            {!canConnect && (
              <div className="mt-4 bg-[rgba(155,109,255,0.05)] border border-[rgba(155,109,255,0.15)] rounded-xl p-4 text-center">
                <p className="text-sm text-[#9CA3AF]">
                  <Lock size={14} className="inline mr-1 text-[#9B6DFF]" />
                  VPN connection is available during your free trial.
                  <button onClick={goToLogin} className="ml-2 text-[#9B6DFF] hover:underline bg-transparent border-0 cursor-pointer">Start free trial</button>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Heat Map Tab — always visible */}
        {activeTab === "heat" && (
          <HeatMapTab
            servers={servers}
            heatLoads={heatLoads}
            monitoringData={monitoringData}
            canConnect={canConnect}
            goToLogin={goToLogin}
            closestServer={closestServer}
            distance={distance}
          />
        )}

        {/* Stats Tab — locked for guests */}
        {activeTab === "status" && (
          canConnect ? (
            <div>
              <h3 className="font-['Archivo'] text-lg tracking-tight mb-3">Connection Statistics</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { icon: Server, label: "Sessions", value: String(stats.totalSessions), color: "text-[#E85D4E]" },
                  { icon: Clock, label: "Total Time", value: formatDuration(stats.totalDuration), color: "text-[#9B6DFF]" },
                  { icon: ArrowDown, label: "Downloaded", value: formatBytes(stats.totalDataReceived), color: "text-[#4ADE80]" },
                  { icon: ArrowUp, label: "Uploaded", value: formatBytes(stats.totalDataSent), color: "text-[#A3B8D4]" },
                ].map((item) => (
                  <div key={item.label} className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl p-5">
                    <item.icon size={22} className={`${item.color} mb-2`} />
                    <div className={`font-['JetBrains_Mono'] text-2xl ${item.color}`}>{item.value}</div>
                    <div className="text-xs text-[#6B7280] mt-1">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <LockedOverlay
              title="Statistics Locked"
              description="Connection statistics are available during your free trial. Sign up to unlock all premium features."
              onAction={goToLogin}
            />
          )
        )}

        {/* History Tab — locked for guests */}
        {activeTab === "history" && (
          canConnect ? (
            <div>
              <h3 className="font-['Archivo'] text-lg tracking-tight mb-3">Connection History</h3>
              {!history.length ? (
                <div className="text-center py-12 text-[#6B7280]">No sessions yet. Connect to a server to see history.</div>
              ) : (
                <div className="bg-[#0A0A0F] border border-[rgba(255,255,255,0.08)] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[rgba(255,255,255,0.08)]">
                          {["Server", "Status", "Duration", "Data", "Date"].map((h) => (
                            <th key={h} className="text-left text-xs text-[#6B7280] font-medium uppercase tracking-wider px-4 py-3">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((conn, i) => (
                          <tr key={i} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.02)]">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span>{FLAG_MAP[conn.server.countryCode] ?? "\uD83C\uDF10"}</span>
                                <div>
                                  <div className="text-white">{conn.server.city}</div>
                                  <div className="text-xs text-[#6B7280]">{conn.server.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-[rgba(255,255,255,0.05)] text-[#9CA3AF]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#6B7280]" /> {conn.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-['JetBrains_Mono'] text-white">{formatDuration(conn.duration)}</td>
                            <td className="px-4 py-3 font-['JetBrains_Mono'] text-[#9CA3AF]">{formatBytes(conn.bytesReceived + conn.bytesSent)}</td>
                            <td className="px-4 py-3 text-[#6B7280]">{conn.date.toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <LockedOverlay
              title="History Locked"
              description="Connection history is available during your free trial. Sign up to unlock all premium features."
              onAction={goToLogin}
            />
          )
        )}
      </div>
    </div>
  );
};

export default Dashboard;
