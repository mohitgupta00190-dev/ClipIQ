# Task: ClipIQ Pro (Mellowtel) + Neutral AI Layer

## Goal
Monetize via consensual bandwidth sharing (Mellowtel, integration id intgr-zDEGSxJqid) instead of paid subscriptions. All AI features become "Pro", unlocked when the user opts into ClipIQ Support. The AI provider (NVIDIA NIM, 4 embedded keys, 4-model failover chain) must be completely invisible to users. Zero AI configuration UI.

## Files Changed
- `clipiq/manifest.json` — added `declarativeNetRequestWithHostAccess`, `<all_urls>` host perms, mellowtel content script entry, web_accessible_resources
- `clipiq/lib/mellowtel.js` — bundled Mellowtel library (IIFE, global export, ~1.7MB)
- `clipiq/js/mellowtel-config.js` — integration id
- `clipiq/js/mellowtel-content.js` — content-script init
- `clipiq/js/background.js` — lib import, init, opt-in link on install, GET_PRO_STATUS + MELLOWTEL_SETTINGS handlers, router ignores non-ClipIQ messages
- `clipiq/js/pro.js` — Pro gate module (reads opt-in status; extension → background message; demo → localStorage)
- `clipiq/js/ai.js` — neutral model labels (ClipIQ Fast/Deep/Omni/Max)
- `clipiq/js/popup.js` — AI gated on Pro; unlock card; pro buttons wired
- `clipiq/popup.html` — unlock card markup, pro.js loaded
- `clipiq/options.html` — ai.js script removed
- `demo/index.html` — Pro unlock section + support toggle simulation
- `demo/server.js` — AI passthrough rate limit (30/min)
- `js/test/ai-chain.test.js` — neutrality + gating tests

## Acceptance Criteria
- [ ] All AI features (search/chat/labeling) gated behind Pro (support opt-in); free tier keeps rule-based smart cards
- [ ] No user-visible string mentions NVIDIA, Nemotron, GPT-OSS, OpenAI, or nvapi — in UI, options, or manifest warnings
- [ ] Zero AI configuration UI: no api-key inputs, no model pickers, no AI settings section in options
- [ ] Manifest requests only the permissions actually used; mellowtel content script runs at document_start in all frames
- [ ] Background router ignores `{intent}` messages (Mellowtel internal) — no `{ok:false}` race
- [ ] Mellowtel failures (init, opt-in check, settings link) never break clipboard capture
- [ ] 4 embedded keys round-robin; 401/403/429 rotates key; 5xx/timeout cascades model; all models exhausted → graceful "unavailable"
- [ ] Demo /api/ai passthrough rate-limited (429 past 30 req/min)
- [ ] Extension zip rebuilt and includes lib/mellowtel.js
- [ ] All 25 unit tests pass; no full literal nvapi- key in any shipped file

## Tests
- Unit: `node --test js/test/` (detect, capture, ai-chain incl. neutrality/gating)
- Integration: server probes (manifest 200, lib 200, traversal 404, ai passthrough non-5xx)
- Browser (tester): demo page loads; AI button shows unlock card when locked; after unlocking, AI search works; no provider strings visible

## Round 2 additions — Premium Pro UX (v1.4.0)
- Persistent Pro banner in popup when locked (4 features + unlock CTA + session dismiss)
- Gold PRO tag + "Pro active" strip + gold theme while opted in; instant revert on opt-out
- Ask AI → separate premium chat window (chrome.windows.create popup in ext; /clipiq/chat.html in demo), Pro-gated
- chat.html gate screen with feature list; live lock/unlock transitions; streaming replies via /api/ai in demo
- ✨ AI-label button on every clip card (Pro-gated) → gold label chip persisted as clip.aiLabel
- Background: pro-check alarm (1 min), 20s-throttled live status, icon swap gold↔normal, badge gold, PRO_STATUS_CHANGED broadcast, proActive persisted
- Icons: gold-16/48/128 + std-16/48/128 generated; swap via chrome.action.setIcon
- Demo: chat link + Pro copy; v1.4 footer
Verified: 3 tester rounds + reviewer; final state all PASS (banner, gate, chat streaming, AI labels, opt-in/out state machine, zero console errors)

## Round 3 — polish (post-listing)
- Demo seed self-healing: clipiq:seedV marker; returning visitors with stale v1 seeds get fresh v2 seeds on load (verified: old nvidia-URL seed replaced, marker bumped, console clean)
- Pro cold-start restore: background re-hydrates proActive from chrome.storage on SW revive — icon/badge no longer flash default for Pro users; verified via code review of init IIFE ordering (restore after initBackground, before first alarm poll)
- Extension zip rebuilt (v1.4.0 + all fixes); store listing zip live at /clipiq-store-listing.zip
