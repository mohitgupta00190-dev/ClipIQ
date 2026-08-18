# ClipIQ — Scope

## In scope (v1)
1. Auto-capture every copy (Ctrl+C) into local history, max 500 items
2. Dedupe: re-copied item moves to top, bumps copy-count
3. Popup (Ctrl+Shift+V command + toolbar icon): search-as-you-type (fuzzy)
4. Smart cards: code (mono + tinted), link (favicon + domain), color (swatch +
   hex), email (mail chip), plain text (clean preview)
5. Pin/unpin (pinned float on top), delete, copy-again
6. Private clips: mark clip private → excluded from history list by default,
   burn-after-paste (delete after first paste)
7. Paste-back: Enter on selected clip inserts text at the caret in the last
   focused input; popup closes
8. Snippets: `;trigger` expands in any input (content script), managed on
   Options page
9. Blocked sites: copies from listed origins are never saved
10. Options page: snippets manager, blocked sites, theme (light/dark/system),
    history size, NVIDIA API key + model chain status
11. AI search: "Ask AI" in popup — natural-language query over recent clips
    with model failover chain; response can insert the matched clip
12. Demo web page replicating popup for preview/testing

## Out of scope (v1)
Cloud sync, accounts, tags, folders, image clips, floating page widget,
stats, share buttons, context-menu paste menus, mobile app.

## Phases
P1 Core capture: manifest + background + offscreen + dedupe + blocked sites
P2 Popup: search, cards, pin/private/delete, paste-back content script
P3 Snippets: expander + options manager
P4 AI search: chain + popup panel + options integration
P5 Demo site + packaging + full verification
