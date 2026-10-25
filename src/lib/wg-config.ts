// ─── WireGuard .conf parsing & validation ─────────────────────
// Everything here works on the user's own provider data. VelocityVPN never
// invents or derives server (peer) keys.

import { isValidWireGuardKey } from "./wg-keygen";

export interface WireGuardFields {
  privateKey: string; // [Interface] PrivateKey
  address: string; // [Interface] Address (comma-separated CIDRs)
  dns: string; // [Interface] DNS (comma-separated)
  mtu: string; // [Interface] MTU
  peerPublicKey: string; // [Peer] PublicKey
  presharedKey: string; // [Peer] PresharedKey (optional)
  endpoint: string; // [Peer] Endpoint host:port
  allowedIps: string; // [Peer] AllowedIPs (comma-separated CIDRs)
  persistentKeepalive: string; // [Peer] PersistentKeepalive
}

export const EMPTY_WG_FIELDS: WireGuardFields = {
  privateKey: "",
  address: "",
  dns: "",
  mtu: "",
  peerPublicKey: "",
  presharedKey: "",
  endpoint: "",
  allowedIps: "",
  persistentKeepalive: "",
};

export { isValidWireGuardKey };

const HOSTNAME_RE =
  /^(?=.{1,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)(\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*$/;

function isIPv4(s: string): boolean {
  const parts = s.split(".");
  return (
    parts.length === 4 &&
    parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255 && (p === "0" || !p.startsWith("0")))
  );
}

function isIPv6(s: string): boolean {
  if (!/^[0-9A-Fa-f:.]+$/.test(s) || !s.includes(":")) return false;
  const dbl = s.split("::");
  if (dbl.length > 2) return false;
  const groups = s.split(":").filter((g) => g !== "");
  let count = 0;
  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    if (i === groups.length - 1 && g.includes(".")) {
      if (!isIPv4(g)) return false;
      count += 2;
    } else if (/^[0-9A-Fa-f]{1,4}$/.test(g)) {
      count += 1;
    } else {
      return false;
    }
  }
  return dbl.length === 2 ? count < 8 : count === 8;
}

export function isValidIp(s: string): boolean {
  return isIPv4(s) || isIPv6(s);
}

/** host:port, [ipv6]:port */
export function isValidEndpoint(value: string): boolean {
  const v = value.trim();
  let host: string;
  let port: string;
  const v6 = /^\[([^\]]+)\]:(\d{1,5})$/.exec(v);
  if (v6) {
    if (!isIPv6(v6[1])) return false;
    port = v6[2];
  } else {
    const idx = v.lastIndexOf(":");
    if (idx <= 0) return false;
    host = v.slice(0, idx);
    port = v.slice(idx + 1);
    if (!/^\d{1,5}$/.test(port)) return false;
    if (!(isIPv4(host) || HOSTNAME_RE.test(host))) return false;
  }
  const n = Number(port);
  return n >= 1 && n <= 65535;
}

export function isValidCidr(value: string): boolean {
  const [ip, prefix, ...rest] = value.trim().split("/");
  if (rest.length || !ip) return false;
  const v4 = isIPv4(ip);
  if (!v4 && !isIPv6(ip)) return false;
  if (prefix === undefined) return true; // bare address = host route
  if (!/^\d{1,3}$/.test(prefix)) return false;
  return Number(prefix) <= (v4 ? 32 : 128);
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isValidCidrList(value: string): boolean {
  const items = splitList(value);
  return items.length > 0 && items.every(isValidCidr);
}

/** DNS may contain IPs or search domains */
export function isValidDnsList(value: string): boolean {
  const items = splitList(value);
  return items.length > 0 && items.every((d) => isValidIp(d) || HOSTNAME_RE.test(d));
}

export type FieldErrors = Partial<Record<keyof WireGuardFields, string>>;

/**
 * Validate fields. Peer public key + endpoint are required; everything else
 * is optional but must be well-formed when present.
 */
export function validateWireGuardFields(f: WireGuardFields): FieldErrors {
  const e: FieldErrors = {};
  if (!f.peerPublicKey.trim()) e.peerPublicKey = "Required: your provider's server public key";
  else if (!isValidWireGuardKey(f.peerPublicKey)) e.peerPublicKey = "Must be a base64 32-byte WireGuard key (44 chars)";
  if (!f.endpoint.trim()) e.endpoint = "Required: host:port from your provider";
  else if (!isValidEndpoint(f.endpoint)) e.endpoint = "Use host:port, e.g. 203.0.113.5:51820 or [2001:db8::1]:51820";
  if (f.privateKey.trim() && !isValidWireGuardKey(f.privateKey)) e.privateKey = "Must be a base64 32-byte WireGuard key";
  if (f.presharedKey.trim() && !isValidWireGuardKey(f.presharedKey)) e.presharedKey = "Must be a base64 32-byte key";
  if (f.address.trim() && !isValidCidrList(f.address)) e.address = "Comma-separated CIDRs, e.g. 10.64.0.2/32, fc00::2/128";
  if (f.allowedIps.trim() && !isValidCidrList(f.allowedIps)) e.allowedIps = "Comma-separated CIDRs, e.g. 0.0.0.0/0, ::/0";
  if (f.dns.trim() && !isValidDnsList(f.dns)) e.dns = "Comma-separated IP addresses";
  if (f.mtu.trim() && !(/^\d+$/.test(f.mtu.trim()) && Number(f.mtu) >= 576 && Number(f.mtu) <= 9000)) e.mtu = "576–9000";
  if (f.persistentKeepalive.trim() && !(/^\d+$/.test(f.persistentKeepalive.trim()) && Number(f.persistentKeepalive) <= 65535))
    e.persistentKeepalive = "0–65535 seconds";
  return e;
}

export interface ParseResult {
  fields: WireGuardFields;
  errors: string[];
  warnings: string[];
}

/** Parse an existing provider .conf ([Interface] + first [Peer]). */
export function parseWireGuardConf(text: string): ParseResult {
  const fields: WireGuardFields = { ...EMPTY_WG_FIELDS };
  const errors: string[] = [];
  const warnings: string[] = [];
  let section: "interface" | "peer" | null = null;
  let peerCount = 0;
  let sawInterface = false;

  const append = (cur: string, v: string) => (cur ? `${cur}, ${v}` : v);

  for (const rawLine of text.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const line = rawLine.replace(/[#;].*$/, "").trim();
    if (!line) continue;
    const header = /^\[(\w+)\]$/.exec(line);
    if (header) {
      const name = header[1].toLowerCase();
      if (name === "interface") {
        section = "interface";
        sawInterface = true;
      } else if (name === "peer") {
        peerCount++;
        section = peerCount === 1 ? "peer" : null;
      } else {
        section = null;
        warnings.push(`Ignored unknown section [${header[1]}]`);
      }
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0 || !section) continue;
    const key = line.slice(0, eq).trim().toLowerCase();
    const value = line.slice(eq + 1).trim();

    if (section === "interface") {
      if (key === "privatekey") fields.privateKey = value;
      else if (key === "address") fields.address = append(fields.address, value);
      else if (key === "dns") fields.dns = append(fields.dns, value);
      else if (key === "mtu") fields.mtu = value;
      else if (["listenport", "fwmark", "table", "preup", "postup", "predown", "postdown", "saveconfig"].includes(key))
        warnings.push(`Ignored [Interface] ${line.slice(0, eq).trim()}`);
    } else {
      if (key === "publickey") fields.peerPublicKey = value;
      else if (key === "presharedkey") fields.presharedKey = value;
      else if (key === "endpoint") fields.endpoint = value;
      else if (key === "allowedips") fields.allowedIps = append(fields.allowedIps, value);
      else if (key === "persistentkeepalive") fields.persistentKeepalive = value;
    }
  }

  if (!sawInterface) errors.push("No [Interface] section found");
  if (peerCount === 0) errors.push("No [Peer] section found");
  if (peerCount > 1) warnings.push("Multiple [Peer] sections: only the first one was imported");

  for (const msg of Object.values(validateWireGuardFields(fields))) {
    if (msg) errors.push(msg);
  }
  return { fields, errors, warnings };
}

/** Build a .conf from validated fields. */
export function buildWireGuardConf(f: WireGuardFields, header?: string[]): string {
  const lines: string[] = [];
  for (const h of header ?? []) lines.push(`# ${h.replace(/[\r\n]/g, " ")}`);
  lines.push("[Interface]");
  lines.push(`PrivateKey = ${f.privateKey.trim() || "<PASTE_YOUR_PRIVATE_KEY>"}`);
  if (f.address.trim()) lines.push(`Address = ${f.address.trim()}`);
  if (f.dns.trim()) lines.push(`DNS = ${f.dns.trim()}`);
  if (f.mtu.trim()) lines.push(`MTU = ${f.mtu.trim()}`);
  lines.push("");
  lines.push("[Peer]");
  lines.push(`PublicKey = ${f.peerPublicKey.trim()}`);
  if (f.presharedKey.trim()) lines.push(`PresharedKey = ${f.presharedKey.trim()}`);
  lines.push(`AllowedIPs = ${f.allowedIps.trim() || "0.0.0.0/0, ::/0"}`);
  lines.push(`Endpoint = ${f.endpoint.trim()}`);
  if (f.persistentKeepalive.trim()) lines.push(`PersistentKeepalive = ${f.persistentKeepalive.trim()}`);
  return lines.join("\n") + "\n";
}
