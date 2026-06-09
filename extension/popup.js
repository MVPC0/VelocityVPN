// ─── VelocityVPN Extension Popup ──────────────────────────────
// Zero-cost VPN using our existing backend proxy tunnel

const API_BASE = "https://xgv7tgjaub4hq.kimi.page/api/trpc";

// Server list (matches backend)
const SERVERS = [
  { id: 1, name: "US-West", city: "Los Angeles", countryCode: "US", flag: "\uD83C\uDDFA\uD83C\uDDF8", region: "North America" },
  { id: 2, name: "US-South", city: "Dallas", countryCode: "US", flag: "\uD83C\uDDFA\uD83C\uDDF8", region: "North America" },
  { id: 3, name: "US-Central", city: "Chicago", countryCode: "US", flag: "\uD83C\uDDFA\uD83C\uDDF8", region: "North America" },
  { id: 4, name: "US-East", city: "New York", countryCode: "US", flag: "\uD83C\uDDFA\uD83C\uDDF8", region: "North America" },
  { id: 5, name: "Japan", city: "Tokyo", countryCode: "JP", flag: "\uD83C\uDDEF\uD83C\uDDF5", region: "Asia-Pacific" },
  { id: 6, name: "Europe-West", city: "Amsterdam", countryCode: "NL", flag: "\uD83C\uDDF3\uD83C\uDDF1", region: "Europe" },
  { id: 7, name: "South Korea", city: "Seoul", countryCode: "KR", flag: "\uD83C\uDDF0\uD83C\uDDF7", region: "Asia-Pacific" },
  { id: 8, name: "UK", city: "London", countryCode: "GB", flag: "\uD83C\uDDEC\uD83C\uDDE7", region: "Europe" },
  { id: 9, name: "New Zealand", city: "Auckland", countryCode: "NZ", flag: "\uD83C\uDDF3\uD83C\uDDFF", region: "Oceania" },
  { id: 10, name: "Europe-East", city: "Warsaw", countryCode: "PL", flag: "\uD83C\uDDF5\uD83C\uDDF1", region: "Europe" },
  { id: 11, name: "Australia-East", city: "Sydney", countryCode: "AU", flag: "\uD83C\uDDE6\uD83C\uDDFA", region: "Oceania" },
  { id: 12, name: "Hong Kong", city: "Hong Kong", countryCode: "HK", flag: "\uD83C\uDDED\uD83C\uDDF0", region: "Asia-Pacific" },
  { id: 13, name: "Australia-West", city: "Perth", countryCode: "AU", flag: "\uD83C\uDDE6\uD83C\uDDFA", region: "Oceania" },
  { id: 14, name: "Europe-North", city: "Stockholm", countryCode: "SE", flag: "\uD83C\uDDF8\uD83C\uDDEA", region: "Europe" },
  { id: 15, name: "Singapore", city: "Singapore", countryCode: "SG", flag: "\uD83C\uDDF8\uD83C\uDDEC", region: "Asia-Pacific" },
  { id: 16, name: "Brazil", city: "Sao Paulo", countryCode: "BR", flag: "\uD83C\uDDE7\uD83C\uDDF7", region: "South America" },
  { id: 17, name: "Dubai", city: "Dubai", countryCode: "AE", flag: "\uD83C\uDDE6\uD83C\uDDEA", region: "Middle East" },
  { id: 18, name: "South Africa", city: "Johannesburg", countryCode: "ZA", flag: "\uD83C\uDDFF\uD83C\uDDE6", region: "Africa" },
];

// ─── DOM Elements ─────────────────────────────────────────────
const els = {
  statusDot: document.getElementById("statusDot"),
  protectionBanner: document.getElementById("protectionBanner"),
  protectionIcon: document.getElementById("protectionIcon"),
  protectionLabel: document.getElementById("protectionLabel"),
  protectionSublabel: document.getElementById("protectionSublabel"),
  ipLabel: document.getElementById("ipLabel"),
  ipValue: document.getElementById("ipValue"),
  ipLocation: document.getElementById("ipLocation"),
  serverList: document.getElementById("serverList"),
  connectBtn: document.getElementById("connectBtn"),
};

// ─── State ────────────────────────────────────────────────────
let state = {
  connected: false,
  selectedServerId: 1,
  ip: null,
  loading: false,
};

// ─── Load State ───────────────────────────────────────────────
async function loadState() {
  const stored = await chrome.storage.local.get(["vpnConnected", "vpnServerId"]);
  state.connected = stored.vpnConnected || false;
  state.selectedServerId = stored.vpnServerId || 1;
}

// ─── Detect IP ────────────────────────────────────────────────
async function detectIP() {
  try {
    const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    const data = await res.json();
    state.ip = data;
    updateIPDisplay();
  } catch {
    els.ipValue.textContent = "--.--.--.--";
    els.ipLocation.textContent = "Unable to detect";
  }
}

function updateIPDisplay() {
  if (!state.ip) return;
  if (state.connected) {
    els.ipLabel.textContent = "VPN EXIT IP";
    els.ipValue.textContent = state.ip.ip;
    els.ipValue.style.color = "#4ADE80";
    els.ipLocation.textContent = `${state.ip.city}, ${state.ip.country} — via VPN`;
  } else {
    els.ipLabel.textContent = "PUBLIC IP";
    els.ipValue.textContent = state.ip.ip;
    els.ipValue.style.color = "#fff";
    els.ipLocation.textContent = `${state.ip.city}, ${state.ip.country} — exposed`;
  }
}

// ─── Render Servers ───────────────────────────────────────────
function renderServers() {
  els.serverList.innerHTML = "";
  SERVERS.forEach((server) => {
    const item = document.createElement("div");
    item.className = "server-item" +
      (state.connected && state.selectedServerId === server.id ? " connected" : "") +
      (!state.connected && state.selectedServerId === server.id ? " selected" : "");

    item.innerHTML = `
      <span class="server-flag">${server.flag}</span>
      <div class="server-info">
        <div class="server-name">${server.name}</div>
        <div class="server-city">${server.city} — ${server.region}</div>
      </div>
    `;

    item.addEventListener("click", async () => {
      if (state.connected) return; // Can't switch while connected
      state.selectedServerId = server.id;
      await chrome.storage.local.set({ vpnServerId: server.id });
      renderServers();
    });

    els.serverList.appendChild(item);
  });
}

// ─── Update Protection UI ─────────────────────────────────────
function updateProtectionUI() {
  if (state.connected) {
    els.statusDot.className = "status-dot active";
    els.protectionBanner.className = "protection-banner protected";
    els.protectionIcon.textContent = "\uD83D\uDD12";
    els.protectionLabel.innerHTML = `PROTECTED <span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(74,222,128,0.3);color:#4ADE80;">VPN ON</span>`;
    const server = SERVERS.find((s) => s.id === state.selectedServerId);
    els.protectionSublabel.textContent = `Traffic routed through ${server?.city || "VPN"}. Real IP hidden.`;
  } else {
    els.statusDot.className = "status-dot";
    els.protectionBanner.className = "protection-banner exposed";
    els.protectionIcon.textContent = "\uD83D\uDD34";
    els.protectionLabel.innerHTML = `EXPOSED <span style="font-size:9px;padding:2px 6px;border-radius:4px;background:rgba(239,68,68,0.3);color:#EF4444;">NO VPN</span>`;
    els.protectionSublabel.textContent = "Your real IP is visible to websites";
  }
}

// ─── Connect / Disconnect ─────────────────────────────────────
async function toggleConnection() {
  if (state.loading) return;
  state.loading = true;
  updateButton();

  if (!state.connected) {
    // CONNECT — activate proxy
    const server = SERVERS.find((s) => s.id === state.selectedServerId);
    try {
      // Enable proxy via background script
      await chrome.runtime.sendMessage({
        action: "connect",
        serverId: server.id,
        serverName: server.name,
        serverCity: server.city,
      });
      state.connected = true;
      await chrome.storage.local.set({ vpnConnected: true, vpnServerId: server.id });
    } catch (e) {
      console.error("Connect failed:", e);
    }
  } else {
    // DISCONNECT
    try {
      await chrome.runtime.sendMessage({ action: "disconnect" });
      state.connected = false;
      await chrome.storage.local.set({ vpnConnected: false });
    } catch (e) {
      console.error("Disconnect failed:", e);
    }
  }

  state.loading = false;
  updateProtectionUI();
  updateButton();
  renderServers();
  detectIP(); // Re-check IP
}

function updateButton() {
  const btn = els.connectBtn;
  if (state.loading) {
    btn.disabled = true;
    btn.innerHTML = `<div class="spinner"></div> ${state.connected ? "Disconnecting..." : "Connecting..."}`;
    return;
  }

  btn.disabled = false;
  if (state.connected) {
    btn.className = "connect-btn disconnect";
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
      Disconnect
    `;
  } else {
    btn.className = "connect-btn connect";
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Connect
    `;
  }
}

// ─── Initialize ───────────────────────────────────────────────
async function init() {
  await loadState();
  updateProtectionUI();
  updateButton();
  renderServers();
  detectIP();

  els.connectBtn.addEventListener("click", toggleConnection);
}

init();
