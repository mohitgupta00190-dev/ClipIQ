# ClipIQ — Infrastructure

## Proxy routes (workspace)
- `/` → reverse_proxy :3000 (demo/static server)

## Background services
- `demo-server`: `node /workspace/demo/server.js` (serves /workspace/demo on
  0.0.0.0:3000, including /clipiq.zip download)

## Env vars (backend-managed)
None required by the demo server. The NVIDIA API key lives inside the
extension's own chrome.storage (user-managed, editable in Options) — it is NOT
a server env var because the extension calls NVIDIA directly from the user's
browser.

## Ports
- 3000: demo server (Caddy target)

## Extension packaging
`/workspace/clipiq/` is the load-unpacked source; zip built to
`/workspace/demo/clipiq.zip` for download via preview URL.
