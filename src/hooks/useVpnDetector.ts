// ─── VPN Connection Detector ──────────────────────────────────
// Detects if a VPN is active by comparing your current public IP
// against your "home" IP (set by user when VPN is OFF).
// The browser CANNOT read WireGuard directly — this is the best we can do.

import { useState, useEffect, useCallback, useRef } from "react";

export interface VpnStatus {
  isVpnActive: boolean;        // IP changed from baseline
  hasBaseline: boolean;        // Do we have a home IP set?
  isChecking: boolean;         // Currently fetching IP
  currentIp: string | null;    // Current detected public IP
  currentCity: string | null;
  currentCountry: string | null;
  homeIp: string | null;       // Baseline IP (no VPN) — MUST be set manually
  lastCheck: number;           // timestamp
}

const STORAGE_KEY = "velocityvpn_homeip";
const POLL_INTERVAL = 5000; // Check every 5 seconds

function loadHomeIp(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch { /* ignore */ }
  return null;
}

export function useVpnDetector() {
  const [status, setStatus] = useState<VpnStatus>({
    isVpnActive: false,
    hasBaseline: false,
    isChecking: true,
    currentIp: null,
    currentCity: null,
    currentCountry: null,
    homeIp: null,
    lastCheck: 0,
  });

  const isMounted = useRef(true);

  const checkIp = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isChecking: true }));
    try {
      const res = await fetch("https://ipapi.co/json/", {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();

      if (!isMounted.current) return;

      const currentIp = data.ip;
      const currentCity = data.city;
      const currentCountry = data.country_name;
      const homeIp = loadHomeIp();

      // Only declare VPN active if we have a baseline AND current IP differs
      const hasBaseline = !!homeIp;
      const isVpnActive = hasBaseline && currentIp !== homeIp;

      setStatus({
        isVpnActive,
        hasBaseline,
        isChecking: false,
        currentIp,
        currentCity,
        currentCountry,
        homeIp,
        lastCheck: Date.now(),
      });
    } catch {
      if (isMounted.current) {
        setStatus((prev) => ({ ...prev, isChecking: false, lastCheck: Date.now() }));
      }
    }
  }, []);

  // Initial check + polling
  useEffect(() => {
    isMounted.current = true;
    checkIp();
    const interval = setInterval(checkIp, POLL_INTERVAL);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [checkIp]);

  // Set home IP = current IP. Call this when you know VPN is OFF.
  const setHomeIp = useCallback(async () => {
    try {
      const res = await fetch("https://ipapi.co/json/", {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      localStorage.setItem(STORAGE_KEY, data.ip);
      if (isMounted.current) {
        setStatus((prev) => ({
          ...prev,
          homeIp: data.ip,
          hasBaseline: true,
          isVpnActive: false, // Just set baseline, so we're not on VPN
          currentIp: data.ip,
          currentCity: data.city,
          currentCountry: data.country_name,
          lastCheck: Date.now(),
        }));
      }
      // Immediately re-check so if VPN is already on, we detect it
      setTimeout(() => checkIp(), 500);
    } catch { /* ignore */ }
  }, [checkIp]);

  // Clear home IP
  const clearHomeIp = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setStatus((prev) => ({
      ...prev,
      homeIp: null,
      hasBaseline: false,
      isVpnActive: false,
    }));
    // Immediate re-check
    setTimeout(() => checkIp(), 500);
  }, [checkIp]);

  return { ...status, checkIp, setHomeIp, clearHomeIp };
}
