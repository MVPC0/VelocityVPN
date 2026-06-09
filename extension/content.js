// ─── VelocityVPN Content Script ───────────────────────────────
// Intercepts all fetch() and XMLHttpRequest calls on every page
// Routes them through our backend proxy when VPN is active
// Zero cost — uses existing backend infrastructure

const PROXY_BASE = "https://xgv7tgjaub4hq.kimi.page/proxy?url=";

let vpnEnabled = false;

// ─── Check VPN Status ─────────────────────────────────────────
async function checkStatus() {
  try {
    const stored = await chrome.storage.local.get(["vpnConnected"]);
    vpnEnabled = stored.vpnConnected || false;
    updateIndicator();
  } catch {
    // Extension context invalid
  }
}

// ─── Listen for state changes from background ─────────────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "vpnStateChanged") {
    vpnEnabled = msg.enabled;
    updateIndicator();
  }
});

// ─── Intercept fetch() ────────────────────────────────────────
const originalFetch = window.fetch;
window.fetch = async function(input, init) {
  await checkStatus();
  if (!vpnEnabled) {
    return originalFetch.call(this, input, init);
  }

  let url;
  if (typeof input === "string") {
    url = input;
  } else if (input instanceof Request) {
    url = input.url;
  } else if (input instanceof URL) {
    url = input.toString();
  } else {
    return originalFetch.call(this, input, init);
  }

  // Don't proxy our own domain or data/blob URLs
  if (url.startsWith("https://xgv7tgjaub4hq.kimi.page") ||
      url.startsWith("http://xgv7tgjaub4hq.kimi.page") ||
      url.startsWith("data:") ||
      url.startsWith("blob:") ||
      url.startsWith("chrome-extension:")) {
    return originalFetch.call(this, input, init);
  }

  // Route through proxy
  const proxyUrl = PROXY_BASE + encodeURIComponent(url);
  const proxyInit = init ? { ...init } : {};
  // Remove forbidden headers
  if (proxyInit.headers) {
    const headers = new Headers(proxyInit.headers);
    headers.delete("origin");
    headers.delete("referer");
    proxyInit.headers = headers;
  }

  try {
    const response = await originalFetch.call(this, proxyUrl, proxyInit);
    // Create a clean response without CORS issues
    const body = await response.blob();
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (e) {
    // Proxy failed, fall back to direct
    console.warn("[VelocityVPN] Proxy failed, falling back:", e);
    return originalFetch.call(this, input, init);
  }
};

// ─── Intercept XMLHttpRequest ─────────────────────────────────
const OriginalXHR = window.XMLHttpRequest;

function ProxiedXHR() {
  const xhr = new OriginalXHR();
  const originalOpen = xhr.open;
  let _url = "";

  xhr.open = function(method, url, async, user, password) {
    _url = url;
    return originalOpen.call(this, method, url, async ?? true, user, password);
  };

  const originalSend = xhr.send;
  xhr.send = async function(body) {
    await checkStatus();
    if (vpnEnabled && _url && !_url.includes("xgv7tgjaub4hq.kimi.page")) {
      // Re-open with proxied URL
      const proxyUrl = PROXY_BASE + encodeURIComponent(_url);
      originalOpen.call(this, xhr.method || "GET", proxyUrl, true);
    }
    return originalSend.call(this, body);
  };

  return xhr;
}

// Copy all static properties
Object.setPrototypeOf(ProxiedXHR, OriginalXHR);
Object.setPrototypeOf(ProxiedXHR.prototype, OriginalXHR.prototype);
window.XMLHttpRequest = ProxiedXHR;

// ─── Protection Indicator ─────────────────────────────────────
let __vvIndicator = null;

function getIndicator() {
  if (__vvIndicator) return __vvIndicator;
  if (document.getElementById("velocityvpn-indicator")) {
    __vvIndicator = document.getElementById("velocityvpn-indicator");
    return __vvIndicator;
  }
  const el = document.createElement("div");
  el.id = "velocityvpn-indicator";
  el.style.cssText = `
    position: fixed;
    bottom: 12px;
    right: 12px;
    z-index: 999999;
    padding: 6px 12px;
    border-radius: 20px;
    font-family: system-ui, sans-serif;
    font-size: 11px;
    font-weight: 700;
    display: none;
    align-items: center;
    gap: 6px;
    transition: all 0.3s;
    pointer-events: none;
  `;
  document.body.appendChild(el);
  __vvIndicator = el;
  return el;
}

function updateIndicator() {
  const indicator = getIndicator();
  if (vpnEnabled) {
    indicator.style.display = "flex";
    indicator.style.background = "rgba(74,222,128,0.9)";
    indicator.style.color = "#050507";
    indicator.innerHTML = "&#x1F512; VelocityVPN Active";
  } else {
    indicator.style.display = "none";
  }
}

function addProtectionIndicator() {
  getIndicator();
  checkStatus();
  // Keep checking periodically
  setInterval(checkStatus, 3000);
}

// Wait for DOM
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", addProtectionIndicator);
} else {
  addProtectionIndicator();
}

console.log("[VelocityVPN] Content script loaded. VPN fetch interceptor active.");
