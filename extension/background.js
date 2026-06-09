// ─── VelocityVPN Background Service Worker ────────────────────
// Manages VPN state and coordinates with content scripts

// ─── Message Handler ──────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.action === "connect") {
        await chrome.storage.local.set({
          vpnConnected: true,
          vpnServerId: message.serverId,
          vpnServerName: message.serverName,
          vpnServerCity: message.serverCity,
        });
        // Notify all content scripts
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { action: "vpnStateChanged", enabled: true }).catch(() => {});
          }
        }
        // Update badge
        chrome.action.setBadgeText({ text: "ON" });
        chrome.action.setBadgeBackgroundColor({ color: "#4ADE80" });
        sendResponse({ success: true });

      } else if (message.action === "disconnect") {
        await chrome.storage.local.set({ vpnConnected: false });
        // Notify all content scripts
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { action: "vpnStateChanged", enabled: false }).catch(() => {});
          }
        }
        // Update badge
        chrome.action.setBadgeText({ text: "" });
        sendResponse({ success: true });

      } else if (message.action === "status") {
        const stored = await chrome.storage.local.get(["vpnConnected", "vpnServerId"]);
        sendResponse({
          connected: stored.vpnConnected || false,
          serverId: stored.vpnServerId || null,
        });
      }
    } catch (e) {
      sendResponse({ success: false, error: e.message });
    }
  })();
  return true;
});

// ─── Restore Badge on Startup ─────────────────────────────────
chrome.runtime.onStartup.addListener(async () => {
  const stored = await chrome.storage.local.get(["vpnConnected"]);
  if (stored.vpnConnected) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#4ADE80" });
  }
});

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(["vpnConnected"]);
  if (stored.vpnConnected) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#4ADE80" });
  }
});
