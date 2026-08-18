// ClipIQ — background service worker
// Orchestrates clipboard capture, dedupe, privacy filtering, badge count.

import "../lib/mellowtel.js";
import { MELLOWTEL_CONFIG_KEY } from "./mellowtel-config.js";

let mellowtelInstance = null;
(async () => {
  try {
    const Lib = (typeof Mellowtel !== "undefined" && Mellowtel.default) || Mellowtel;
    mellowtelInstance = new Lib(MELLOWTEL_CONFIG_KEY);
    await mellowtelInstance.initBackground();
  } catch (e) {
    // monetization must never break the clipboard — silent fallback
  }
  await restoreProFromStorage();
})();

const DEFAULT_SETTINGS = {
  blockedSites: [],
  theme: "system",
  maxClips: 500,
  aiEnabled: true,
};

const OFFSCREEN_URL = "offscreen.html";
let lastHash = null;
let lastOrigin = "";

async function getStore() {
  try {
    const data = await chrome.storage.local.get(["clips", "snippets", "settings", "lastHash"]);
    return {
      clips: data.clips || [],
      snippets: data.snippets || [],
      settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
      lastHash: data.lastHash || null,
    };
  } catch (e) {
    return { clips: [], snippets: [], settings: { ...DEFAULT_SETTINGS }, lastHash: null };
  }
}

async function setStore(part) {
  await chrome.storage.local.set(part);
}

function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

async function hashText(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalize(text)));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function ensureOffscreen() {
  const has = await chrome.offscreen.hasDocument();
  if (!has) {
    await chrome.offscreen.createDocument({
      url: OFFSCREEN_URL,
      reasons: ["CLIPBOARD"],
      justification: "Read the clipboard to build ClipIQ history",
    });
  }
}

async function readClipboardViaOffscreen() {
  await ensureOffscreen();
  return new Promise((resolve) => {
    let settled = false;
    const done = (text) => {
      if (settled) return;
      settled = true;
      resolve(text || "");
    };
    try {
      chrome.runtime.sendMessage({ type: "READ_CLIPBOARD" }, (resp) => {
        if (chrome.runtime.lastError) return done("");
        done(resp && resp.ok ? resp.text : "");
      });
    } catch {
      done("");
    }
    setTimeout(() => done(""), 2500);
  });
}

function originAllowed(origin, blockedSites) {
  if (!origin) return true;
  try {
    const host = new URL(origin).hostname;
    return !blockedSites.some((b) => host === b || host.endsWith("." + b));
  } catch {
    return true;
  }
}

function safeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

async function saveClip(text) {
  const { clips, settings } = await getStore();
  const norm = normalize(text);
  if (!norm) return;
  const existing = clips.find((c) => normalize(c.text) === norm);
  const now = Date.now();
  if (existing) {
    existing.ts = now;
    existing.copies = (existing.copies || 1) + 1;
    const rest = clips.filter((c) => c.id !== existing.id);
    const pinned = rest.filter((c) => c.pinned);
    const unpinned = rest.filter((c) => !c.pinned);
    const updated = [...pinned, existing, ...unpinned];
    await setStore({ clips: updated });
  } else {
    const clip = {
      id: "c_" + now + "_" + Math.random().toString(36).slice(2, 6),
      text: String(text).slice(0, 100000),
      ts: now,
      copies: 1,
      pinned: false,
      private: false,
    };
    const pinned = clips.filter((c) => c.pinned);
    const unpinned = clips.filter((c) => !c.pinned);
    const next = [...pinned, clip, ...unpinned];
    while (next.filter((c) => !c.pinned).length > settings.maxClips) {
      for (let i = next.length - 1; i >= 0; i--) {
        if (!next[i].pinned) {
          next.splice(i, 1);
          break;
        }
      }
    }
    await setStore({ clips: next });
  }
  await updateBadge();
}

async function updateBadge() {
  const { clips } = await getStore();
  const count = clips.length;
  const pro = await getProStatusCached();
  await chrome.action.setBadgeText({ text: count > 0 ? String(Math.min(count, 99)) : "" });
  await chrome.action.setBadgeBackgroundColor({ color: pro ? "#B8860B" : "#6C5CE7" });
}

// ---------- Pro state (live opt-in/out) ----------
let proStatus = { optedIn: false, checkedAt: 0 };
const PRO_POLL_MS = 20 * 1000; // poll the source at most every 20s

async function getProStatusCached() {
  return proStatus;
}

// Cold-start restore: MV3 kills idle service workers, wiping in-memory state.
// Before any live poll returns, re-hydrate from storage so a Pro user's icon/
// badge never flash back to the default look on browser restart or SW revive.
async function restoreProFromStorage() {
  try {
    const { proActive } = await chrome.storage.local.get("proActive");
    if (proActive === true && !proStatus.optedIn) {
      proStatus = { optedIn: true, checkedAt: 0 };
      await applyProChange(true); // re-apply icon/badge without broadcasting spam
    }
  } catch {}
}

async function getProStatusLive(force) {
  const now = Date.now();
  if (!force && now - proStatus.checkedAt < PRO_POLL_MS) return proStatus;
  let optedIn = false;
  try {
    const s = mellowtelInstance ? await mellowtelInstance.getOptInStatus() : false;
    optedIn = !!s;
  } catch {
    optedIn = proStatus.optedIn;
  }
  const prev = proStatus.optedIn;
  proStatus = { optedIn, checkedAt: now };
  if (prev !== optedIn) await applyProChange(optedIn);
  return proStatus;
}

async function applyProChange(optedIn) {
  try {
    if (optedIn) {
      await chrome.action.setIcon({ path: {
        16: "icons/gold-16.png", 48: "icons/gold-48.png", 128: "icons/gold-128.png",
      } });
    } else {
      await chrome.action.setIcon({ path: {
        16: "icons/16.png", 48: "icons/48.png", 128: "icons/128.png",
      } });
    }
  } catch {}
  try {
    await chrome.storage.local.set({ proActive: optedIn });
  } catch {}
  try {
    await chrome.runtime.sendMessage({ type: "PRO_STATUS_CHANGED", optedIn });
  } catch {}
  await updateBadge();
}

async function syncProState(force) {
  return getProStatusLive(force);
}

// ---------- capture: primary (page copy events) + offscreen poll fallback ----------
// CAPTURE_COPY comes from the content script the moment a copy happens on any
// page — fast, reliable, works even when the offscreen reader can't.
async function handleCapture(text, senderOrigin) {
  const { settings } = await getStore();
  if (!originAllowed(senderOrigin, settings.blockedSites)) return;
  lastHash = await hashText(text);
  await saveClip(text);
}

// COPY_KEY_PRESSED: a Ctrl+C happened but no copy event text arrived (page
// blocked it, or copy came from a native input). Two recovery paths:
//  1) ask the focused tab's content script for the selected substring of the
//     focused input/textarea (works for copies of field values the page copy
//     event misses);
//  2) fall back to an offscreen clipboard read slightly after the OS
//     clipboard actually updates.
async function handleCopyKey(senderTabId) {
  // Path 1: field-value read via the content script
  try {
    const tabId = senderTabId != null ? senderTabId : (await getActiveTabId());
    if (tabId != null) {
      const resp = await new Promise((resolve) => {
        let settled = false;
        const done = (v) => {
          if (!settled) {
            settled = true;
            resolve(v);
          }
        };
        try {
          chrome.tabs.sendMessage(tabId, { type: "GET_FIELD_SELECTION" }, (r) => {
            if (chrome.runtime.lastError) return done(null);
            done(r);
          });
        } catch {
          done(null);
        }
        setTimeout(() => done(null), 700);
      });
      if (resp && resp.ok && resp.text && resp.text.trim()) {
        await handleCapture(resp.text, lastOrigin);
        return;
      }
    }
  } catch {}
  // Path 2: offscreen clipboard read (works when Chrome allows it)
  setTimeout(() => pollClipboard(), 350);
}

async function getActiveTabId() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return tab ? tab.id : null;
  } catch {
    return null;
  }
}

// Poll path (fallback + popup refresh): read clipboard via the offscreen doc.
// NOTE: navigator.clipboard.readText() in an offscreen doc usually fails
// (needs document focus); we still try — when it works (some setups) it's
// free. The copy-event capture path is the primary and doesn't need it.
async function pollClipboard() {
  try {
    const text = await readClipboardViaOffscreen();
    const norm = normalize(text);
    if (!norm) return;
    const h = await hashText(norm);
    if (h === lastHash) return;
    const { settings } = await getStore();
    if (!originAllowed(lastOrigin, settings.blockedSites)) return;
    lastHash = h;
    await saveClip(text);
  } catch (e) {
    // silent — permission or focus issues shouldn't spam
  }
}

// --- lifecycle ---
chrome.runtime.onInstalled.addListener(async (details) => {
  await chrome.alarms.create("poll", { periodInMinutes: 0.02 }); // ~1.2s
  await chrome.alarms.create("pro-check", { periodInMinutes: 1 }); // live opt-in/out
  await chrome.contextMenus.create({
    id: "clipiq-search",
    title: "Search clipboard with ClipIQ",
    contexts: ["all"],
  });
  await updateBadge();
  await syncProState(true);

  // consensual support: show the opt-in page once, on fresh install only
  if (details && details.reason === "install" && mellowtelInstance) {
    try {
      await mellowtelInstance.generateAndOpenOptInLink();
    } catch {}
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.alarms.create("poll", { periodInMinutes: 0.02 });
  await chrome.alarms.create("pro-check", { periodInMinutes: 1 });
  await updateBadge();
  await syncProState(true);
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll") pollClipboard();
  if (alarm.name === "pro-check") syncProState(false);
});

// track origin of the last focused tab for blocked-site filtering
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    lastOrigin = tab.url ? new URL(tab.url).origin : "";
  } catch {}
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  try {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab && tab.url) lastOrigin = new URL(tab.url).origin;
  } catch {}
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "clipiq-search") {
    if (tab && tab.id) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => chrome.action.openPopup?.(),
      }).catch(() => {});
    }
  }
});

// command: open popup won't work directly; use action.openPopup where available
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "open-clipiq") {
    chrome.action.openPopup?.().catch?.(() => {});
  }
});

// --- message router ---
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return false; // not ours — let other listeners handle
  (async () => {
    switch (msg.type) {
      case "CAPTURE_COPY": {
        const origin = sender && sender.tab && sender.tab.url ? safeOrigin(sender.tab.url) : "";
        if (origin) lastOrigin = origin;
        await handleCapture(msg.text, origin || lastOrigin);
        sendResponse({ ok: true });
        break;
      }
      case "COPY_KEY_PRESSED": {
        const senderTabId = sender && sender.tab ? sender.tab.id : null;
        await handleCopyKey(senderTabId);
        sendResponse({ ok: true });
        break;
      }
      case "GET_FIELD_SELECTION":
        // answered synchronously by the content script itself
        sendResponse({ ok: true });
        break;
      case "GET_STATE": {
        const store = await getStore();
        sendResponse({ ok: true, ...store });
        break;
      }
      case "SAVE_CLIP": {
        lastHash = await hashText(msg.text);
        await saveClip(msg.text);
        sendResponse({ ok: true });
        break;
      }
      case "DELETE_CLIP": {
        const { clips } = await getStore();
        await setStore({ clips: clips.filter((c) => c.id !== msg.id) });
        await updateBadge();
        sendResponse({ ok: true });
        break;
      }
      case "UPDATE_CLIP": {
        const { clips } = await getStore();
        const i = clips.findIndex((c) => c.id === msg.clip.id);
        if (i >= 0) {
          clips[i] = { ...clips[i], ...msg.clip };
          await setStore({ clips });
          if (msg.clip.private) await updateBadge();
        }
        sendResponse({ ok: true });
        break;
      }
      case "SAVE_SNIPPETS": {
        await setStore({ snippets: msg.snippets });
        sendResponse({ ok: true });
        break;
      }
      case "SAVE_SETTINGS": {
        await setStore({ settings: msg.settings });
        sendResponse({ ok: true });
        break;
      }
      case "POLL_NOW": {
        await pollClipboard();
        sendResponse({ ok: true });
        break;
      }
      case "CONTENT_FOCUS": {
        if (sender && sender.tab && sender.tab.url) {
          try {
            lastOrigin = new URL(sender.tab.url).origin;
          } catch {}
        }
        sendResponse({ ok: true });
        break;
      }
      case "CLIPBOARD_TEXT": {
        // from offscreen — handled by dedicated listener in readClipboardViaOffscreen
        sendResponse({ ok: true });
        break;
      }
      case "MELLOWTEL_SETTINGS": {
        try {
          const url = await mellowtelInstance.generateSettingsLink();
          await chrome.tabs.create({ url });
          sendResponse({ ok: true });
        } catch {
          sendResponse({ ok: false });
        }
        break;
      }
      case "GET_PRO_STATUS": {
        sendResponse({ ok: true, ...(await getProStatusLive(msg.force)) });
        break;
      }
      case "OPEN_AI_CHAT": {
        try {
          const url = "chat.html" + (msg && msg.query ? "?q=" + encodeURIComponent(msg.query) : "");
          await chrome.windows.create({ url, type: "popup", width: 460, height: 640 });
          sendResponse({ ok: true });
        } catch {
          sendResponse({ ok: false });
        }
        break;
      }
      default:
        sendResponse({ ok: false, error: "unknown message " + msg.type });
    }
  })();
  return true; // async response
});
