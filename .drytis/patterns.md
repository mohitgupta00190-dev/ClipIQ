# ClipIQ — Patterns

## Style
- Vanilla ES2022 modules, no build step. Files load as classic scripts in
  extension pages (no bundler) — use plain script tags, no imports in popup.
- 2-space indent, semicolons, double quotes for strings.
- All DOM built in JS or static HTML + small template strings; escape any
  user text via `esc()` helper before innerHTML (XSS rule: never interpolate
  raw clip text).

## Naming
- storage keys: `clips`, `snippets`, `settings` (single objects)
- message types: SCREAMING_SNAKE (`CLIP_CAPTURED`, `INSERT_TEXT`, `AI_QUERY`)
- clip ids: `c_<epoch>_<rand4>`

## Error handling
- Every chrome.storage read wrapped in try/catch with `{clips:[],snippets:[],settings:{}}`
  defaults.
- AI calls: per-model timeout 12s, catch → next in chain; final fallback
  returns local fuzzy results with a note.
- Never throw uncaught in service worker; log to console only.

## Testing
- Unit: js/test/*.test.js run under Node (node --test) covering detect.js
  type detection, storage dedupe logic, snippet parser, AI chain order.
- Integration: demo server + popup in web mode exercised via tester sub-agent
  (Playwright at preview URL).
- No browser tests written by the leader — tester handles those.

## Security
- innerHTML only with escaped text; clip content treated as hostile.
- API key stored only in chrome.storage; sent only to
  integrate.api.nvidia.com as Authorization header.
- Content script uses insertText (no HTML insertion into pages).
