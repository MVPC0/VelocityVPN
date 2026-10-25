// ─── VelocityVPN Background Service Worker ────────────────────
// Applies a real chrome.proxy configuration using the proxy server the user
// configured in the popup. Without a configured proxy, nothing is routed and
// the extension never reports protection.

const VALID_SCHEMES = ["http", "https", "socks5"];

function setBadge(on) {
  chrome.action.setBadgeText({ text: on ? "ON" : "" });
  if (on) chrome.action.setBadgeBackgroundColor({ color: "#4ADE80" });
}

async function getProxyConfig() {
  const { proxyHost, proxyPort, proxyScheme } = await chrome.storage.local.get([
    "proxyHost",
    "proxyPort",
    "proxyScheme",
  ]);
  const port = Number(proxyPort);
  if (!proxyHost || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  const scheme = VALID_SCHEMES.includes(proxyScheme) ? proxyScheme : "http";
  return { host: String(proxyHost), port, scheme };
}

async function connect() {
  const proxy = await getProxyConfig();
  if (!proxy) {
    return { success: false, error: "No proxy server configured" };
  }

  await chrome.proxy.settings.set({
    value: {
      mode: "fixed_servers",
      rules: {
        singleProxy: { scheme: proxy.scheme, host: proxy.host, port: proxy.port },
        bypassList: ["localhost", "127.0.0.1", "<local>"],
      },
    },
    scope: "regular",
  });

  const details = await chrome.proxy.settings.get({ incognito: false });
  if (details.levelOfControl !== "controlled_by_this_extension") {
    await chrome.storage.local.set({ vpnConnected: false });
    setBadge(false);
    return {
      success: false,
      error: "Another extension or policy controls the proxy settings",
    };
  }

  await chrome.storage.local.set({ vpnConnected: true, lastProxyError: null });
  setBadge(true);
  return { success: true, proxy };
}

async function disconnect() {
  await chrome.proxy.settings.clear({ scope: "regular" });
  await chrome.storage.local.set({ vpnConnected: false });
  setBadge(false);
  return { success: true };
}

// Verify the stored "connected" flag still matches the real proxy state
async function syncState() {
  const [{ vpnConnected }, details] = await Promise.all([
    chrome.storage.local.get(["vpnConnected"]),
    chrome.proxy.settings.get({ incognito: false }),
  ]);
  const active =
    Boolean(vpnConnected) &&
    details.levelOfControl === "controlled_by_this_extension" &&
    details.value?.mode === "fixed_servers";
  if (!active && vpnConnected) await chrome.storage.local.set({ vpnConnected: false });
  setBadge(active);
  return active;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === "connect") {
        sendResponse(await connect());
      } else if (message.action === "disconnect") {
        sendResponse(await disconnect());
      } else if (message.action === "status") {
        const connected = await syncState();
        const proxy = await getProxyConfig();
        const { lastProxyError } = await chrome.storage.local.get(["lastProxyError"]);
        sendResponse({ success: true, connected, configured: Boolean(proxy), proxy, lastProxyError });
      } else {
        sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (e) {
      sendResponse({ success: false, error: e instanceof Error ? e.message : String(e) });
    }
  })();
  return true;
});

chrome.proxy.onProxyError.addListener((details) => {
  console.warn("[VelocityVPN] Proxy error:", details.error, details.details);
  chrome.storage.local.set({ lastProxyError: details.error });
});

chrome.runtime.onStartup.addListener(() => {
  syncState();
});

chrome.runtime.onInstalled.addListener(() => {
  syncState();
});
