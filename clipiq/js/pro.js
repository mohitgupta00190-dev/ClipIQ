// ClipIQ — Pro gating.
// Pro = the user opted into ClipIQ Support (consensual bandwidth sharing).
// There is NO paid tier, NO API keys, NO AI configuration. Users unlock
// AI features by opting in on the support page — and can opt out any time.
(function (root) {
  const MELLOWTEL_KEY = "intgr-zDEGSxJqid";
  let statusCache = { optedIn: false, checkedAt: 0 };

  // 30s cache — popup opens frequently; don't re-query on every keystroke
  async function getProStatus(force) {
    const now = Date.now();
    if (!force && now - statusCache.checkedAt < 30000) return statusCache;
    let optedIn = false;
    try {
      if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
        // extension context — ask the background service worker (it owns the
        // Mellowtel instance; content/popup contexts can't always reach the lib)
        const resp = await new Promise((resolve) => {
          try {
            chrome.runtime.sendMessage({ type: "GET_PRO_STATUS" }, (r) => {
              if (chrome.runtime.lastError) return resolve(null);
              resolve(r);
            });
          } catch {
            resolve(null);
          }
        });
        if (resp && resp.ok) optedIn = !!resp.optedIn;
      } else if (typeof localStorage !== "undefined") {
        // web demo: support opt-in simulated in localStorage
        optedIn = localStorage.getItem("clipiq:support") === "1";
      }
    } catch {
      optedIn = false;
    }
    statusCache = { optedIn, checkedAt: now };
    return statusCache;
  }

  async function isPro() {
    const s = await getProStatus();
    return !!s.optedIn;
  }

  const api = { getProStatus, isPro, MELLOWTEL_KEY, PRO_FEATURES: [
    { icon: "💬", name: "AI Chat", desc: "Chat about anything you copied — ask, refine, transform." },
    { icon: "🔎", name: "AI Search", desc: "Describe what you need in plain words; ClipIQ finds the clip." },
    { icon: "🏷️", name: "AI Labels", desc: "One-tap smart labels on any clip." },
    { icon: "👑", name: "Premium Look", desc: "Gold icon & premium UI while Pro is active." },
  ] };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof self !== "undefined") self.ClipIQPro = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
