# ClipIQ — Architecture

## Extension layout (clipiq/)
```
clipiq/
  manifest.json          MV3, commands, offscreen, content scripts
  icons/                 16/48/128 PNG (generated)
  js/
    background.js        service worker: capture loop, storage, badge, routing
    offscreen.js         clipboard reader (runs in offscreen document)
    popup.js             search UI logic (works in web-demo mode too)
    content.js           paste-back at caret + snippet expansion + focus tracking
    options.js           settings page logic
    ai.js                NVIDIA NIM client with failover chain (shared popup/options)
    detect.js            clip type detection (code/link/color/email/text)
  css/
    popup.css            card UI, light/dark
    options.css
  popup.html
  options.html
  offscreen.html
```

## Data model — chrome.storage.local
```
clips: [{
  id: "c_<ts>_<rand>",
  text: string,
  ts: number,            // last-copied time
  copies: number,        // dedupe counter
  pinned: bool,
  private: bool,
  burnt: bool            // private clip already pasted → removed
}]
snippets: [{ trigger: ";addr", text: "Full address", id }]
settings: {
  blockedSites: ["bank.com"],
  theme: "system"|"light"|"dark",
  maxClips: 500,
  nvApiKey: string,
  aiEnabled: true
}
```

## Capture flow
copy → background alarm (every 1s while active) → focus offscreen doc →
offscreen reads navigator.clipboard.readText() → compares hash to last →
if new: check blockedSites(origin of last focused tab) → save clip
(dedupe by normalized text) → update badge count.

Paste-back: popup → chrome.tabs.sendMessage(lastFocusedTabId, {insert: text})
→ content.js inserts at saved caret via execCommand('insertText') fallback.

## AI flow (ai.js)
Query + last 40 non-private clips → chain[nemotron-3-nano-30b-a3b,
gpt-oss-20b, nemotron-3-nano-omni-30b-a3b-reasoning,
llama-3.3-nemotron-super-49b-v1.5] → fetch stream → first model that returns
a parsed JSON answer wins; failures cascade in order; 12s per-model timeout.

## Demo mode
demo/index.html loads popup.js with window.isWebDemo=true → storage shim
(localStorage) + seed clips → identical UI at the preview URL.
Static Node server (demo/server.js) serves /workspace/demo on :3000, Caddy
proxies / → :3000. Extension zip served at /clipiq.zip.
