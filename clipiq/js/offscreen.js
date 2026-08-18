// ClipIQ — offscreen clipboard reader
// Multiple read strategies; returns the first that yields text.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "READ_CLIPBOARD") {
    readClipboard()
      .then((text) => sendResponse({ ok: true, text: text || "" }))
      .catch(() => sendResponse({ ok: false, text: "" }));
    return true; // async
  }
});

async function readClipboard() {
  // Strategy 1: async clipboard API
  try {
    const t = await navigator.clipboard.readText();
    if (t && t.trim()) return t;
  } catch {}
  // Strategy 2: legacy execCommand paste into a focused textarea
  try {
    const ta = document.getElementById("t");
    if (ta) {
      ta.value = "";
      ta.focus();
      const ok = document.execCommand("paste");
      if (ok && ta.value && ta.value.trim()) {
        const v = ta.value;
        ta.value = "";
        ta.blur();
        return v;
      }
      ta.blur();
    }
  } catch {}
  return "";
}
