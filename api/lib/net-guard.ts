import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";

/**
 * Resolve a URL's host and reject anything that is not a public unicast address
 * (loopback, private, link-local/metadata, etc.). Returns the parsed URL.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = ipaddr.isValid(host)
    ? [host]
    : (await lookup(host, { all: true })).map((a) => a.address);
  if (addresses.length === 0) throw new Error("Host did not resolve");
  for (const address of addresses) {
    let parsed = ipaddr.parse(address);
    if (parsed.kind() === "ipv6" && (parsed as ipaddr.IPv6).isIPv4MappedAddress()) {
      parsed = (parsed as ipaddr.IPv6).toIPv4Address();
    }
    if (parsed.range() !== "unicast") {
      throw new Error("Destination address is not allowed");
    }
  }
  return url;
}
