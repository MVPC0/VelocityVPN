// ─── VelocityVPN Extension Popup ──────────────────────────────
// Routes browser traffic through a proxy server the user configures.
// Protection is only reported when chrome.proxy is really applied.

const els = {
  statusDot: document.getElementById("statusDot"),
  protectionBanner: document.getElementById("protectionBanner"),
  protectionIcon: document.getElementById("protectionIcon"),
  protectionLabel: document.getElementById("protectionLabel"),
  protectionSublabel: document.getElementById("protectionSublabel"),
  ipLabel: document.getElementById("ipLabel"),
  ipValue: document.getElementById("ipValue"),
  ipLocation: document.getElementById("ipLocation"),
  connectBtn: document.getElementById("connectBtn"),
  proxyForm: document.getElementById("proxyForm"),
  proxyScheme: document.getElementById("proxyScheme"),
  proxyHost: document.getElementById("proxyHost"),
  proxyPort: document.getElementById("proxyPort"),
  proxyState: document.getElementById("proxyState"),
  proxyHint: document.getElementById("proxyHint"),
};

const state = {
  connected: false,
  configured: false,
  proxy: null,
  ip: null,
  baselineIp: null,
  loading: false,
  error: null,
};

const HOST_PATTERN = /^[A-Za-z0-9.-]{1,253}$|^\[[0-9A-Fa-f:]+\]$/;

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

async function refreshStatus() {
  const status = await sendMessage({ action: "status" });
  state.connected = Boolean(status?.connected);
  state.configured = Boolean(status?.configured);
  state.proxy = status?.proxy ?? null;
  if (status?.lastProxyError && state.connected) {
    state.error = `Proxy error: ${status.lastProxyError}`;
  }
  const { baselineIp } = await chrome.storage.local.get(["baselineIp"]);
  state.baselineIp = baselineIp ?? null;
}

async function loadProxyForm() {
  const { proxyHost, proxyPort, proxyScheme } = await chrome.storage.local.get([
    "proxyHost",
    "proxyPort",
    "proxyScheme",
  ]);
  els.proxyHost.value = proxyHost ?? "";
  els.proxyPort.value = proxyPort ?? "";
  els.proxyScheme.value = proxyScheme ?? "http";
}

// ─── Detect IP ────────────────────────────────────────────────
async function detectIP() {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    const data = await res.json();
    state.ip = data;
    if (!state.connected && data?.ip) {
      state.baselineIp = data.ip;
      await chrome.storage.local.set({ baselineIp: data.ip });
    }
  } catch {
    state.ip = null;
  }
  updateIPDisplay();
  updateProtectionUI();
}

function ipChanged() {
  return Boolean(state.ip?.ip && state.baselineIp && state.ip.ip !== state.baselineIp);
}

function updateIPDisplay() {
  if (!state.ip) {
    els.ipLabel.textContent = state.connected ? "EXIT IP" : "PUBLIC IP";
    els.ipValue.textContent = "--.--.--.--";
    els.ipValue.style.color = "#fff";
    els.ipLocation.textContent = "Unable to detect";
    return;
  }
  const where = `${state.ip.city ?? "?"}, ${state.ip.country ?? "?"}`;
  els.ipValue.textContent = state.ip.ip;
  if (state.connected && ipChanged()) {
    els.ipLabel.textContent = "PROXY EXIT IP";
    els.ipValue.style.color = "#4ADE80";
    els.ipLocation.textContent = `${where} — via proxy`;
  } else {
    els.ipLabel.textContent = "PUBLIC IP";
    els.ipValue.style.color = "#fff";
    els.ipLocation.textContent = `${where} — exposed`;
  }
}

// ─── Update Protection UI ─────────────────────────────────────
function setLabel(text, badge, color, bg) {
  els.protectionLabel.textContent = `${text} `;
  const span = document.createElement("span");
  span.style.cssText = `font-size:9px;padding:2px 6px;border-radius:4px;background:${bg};color:${color};`;
  span.textContent = badge;
  els.protectionLabel.appendChild(span);
}

function updateProtectionUI() {
  els.proxyState.textContent = state.configured
    ? `${state.proxy.scheme.toUpperCase()} ${state.proxy.host}:${state.proxy.port}`
    : "NOT CONFIGURED";

  if (state.connected && ipChanged()) {
    els.statusDot.className = "status-dot active";
    els.protectionBanner.className = "protection-banner protected";
    els.protectionIcon.textContent = "\uD83D\uDD12";
    setLabel("PROTECTED", "PROXY ON", "#4ADE80", "rgba(74,222,128,0.3)");
    els.protectionSublabel.textContent = `Traffic routed through ${state.proxy?.host ?? "your proxy"}.`;
  } else if (state.connected) {
    els.statusDot.className = "status-dot";
    els.protectionBanner.className = "protection-banner exposed";
    els.protectionIcon.textContent = "\u26A0\uFE0F";
    setLabel("UNVERIFIED", "PROXY SET", "#F59E0B", "rgba(245,158,11,0.3)");
    els.protectionSublabel.textContent =
      state.error ?? "Proxy applied, but your public IP has not changed yet.";
  } else {
    els.statusDot.className = "status-dot";
    els.protectionBanner.className = "protection-banner exposed";
    els.protectionIcon.textContent = "\uD83D\uDD34";
    setLabel(
      state.configured ? "EXPOSED" : "NOT CONFIGURED",
      "NO VPN",
      "#EF4444",
      "rgba(239,68,68,0.3)",
    );
    els.protectionSublabel.textContent =
      state.error ??
      (state.configured
        ? "Your real IP is visible to websites"
        : "Add a proxy server below to enable protection");
  }
}

function updateButton() {
  const btn = els.connectBtn;
  btn.replaceChildren();
  if (state.loading) {
    btn.disabled = true;
    const spinner = document.createElement("div");
    spinner.className = "spinner";
    btn.append(spinner, state.connected ? " Disconnecting..." : " Connecting...");
    return;
  }

  if (state.connected) {
    btn.disabled = false;
    btn.className = "connect-btn disconnect";
    btn.textContent = "Disconnect";
  } else {
    btn.disabled = !state.configured;
    btn.className = "connect-btn connect";
    btn.textContent = state.configured ? "Connect" : "Configure a proxy first";
  }
}

function render() {
  updateIPDisplay();
  updateProtectionUI();
  updateButton();
}

// ─── Save Proxy ───────────────────────────────────────────────
async function saveProxy(event) {
  event.preventDefault();
  state.error = null;
  const host = els.proxyHost.value.trim();
  const port = Number(els.proxyPort.value);
  const scheme = els.proxyScheme.value;

  if (!host) {
    await chrome.storage.local.remove(["proxyHost", "proxyPort", "proxyScheme"]);
    if (state.connected) await sendMessage({ action: "disconnect" });
    els.proxyHint.textContent = "Proxy removed.";
  } else if (!HOST_PATTERN.test(host) || !Number.isInteger(port) || port < 1 || port > 65535) {
    els.proxyHint.textContent = "Enter a valid host name or IP and a port between 1 and 65535.";
    return;
  } else {
    await chrome.storage.local.set({ proxyHost: host, proxyPort: port, proxyScheme: scheme });
    els.proxyHint.textContent = "Proxy saved.";
    if (state.connected) {
      const res = await sendMessage({ action: "connect" });
      if (!res?.success) state.error = res?.error ?? "Could not apply proxy";
    }
  }

  await refreshStatus();
  render();
  detectIP();
}

// ─── Connect / Disconnect ─────────────────────────────────────
async function toggleConnection() {
  if (state.loading) return;
  state.loading = true;
  state.error = null;
  updateButton();

  try {
    const res = await sendMessage({ action: state.connected ? "disconnect" : "connect" });
    if (!res?.success) state.error = res?.error ?? "Request failed";
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
  }

  await refreshStatus();
  state.loading = false;
  render();
  detectIP();
}

// ─── Initialize ───────────────────────────────────────────────
async function init() {
  await loadProxyForm();
  await refreshStatus();
  render();
  detectIP();

  els.connectBtn.addEventListener("click", toggleConnection);
  els.proxyForm.addEventListener("submit", saveProxy);
}

init();
