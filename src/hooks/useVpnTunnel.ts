import { useState, useCallback } from "react";

interface TunnelServer {
  id: number;
  name: string;
  city: string;
  countryCode: string;
  hostname: string;
}

// ─── VPN Proxy Tunnel Hook (STANDALONE MODE) ─────────────────
// Returns default state without backend — all visual features work,
// but tunnel connection requires backend deployment.

export function useVpnTunnel() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const connect = useCallback(async (_serverId: number) => {
    setIsConnecting(true);
    // Simulate connection delay
    await new Promise((r) => setTimeout(r, 800));
    setIsConnecting(false);
  }, []);

  const disconnect = useCallback(async () => {
    setIsDisconnecting(true);
    await new Promise((r) => setTimeout(r, 400));
    setIsDisconnecting(false);
  }, []);

  return {
    connected: false,
    server: null as TunnelServer | null,
    duration: 0,
    bytesTransferred: 0,
    requestCount: 0,
    isConnecting,
    isDisconnecting,
    isFetching: false,
    tunnelIp: null,
    isCheckingIp: false,
    connect,
    disconnect,
    proxyFetch: async (_params: { url: string; method?: string; headers?: Record<string, string>; body?: string }) => {
      throw new Error("VPN proxy requires backend server");
    },
  };
}
