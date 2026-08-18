# Task: ClipIQ v1 — full extension build

## Files to create
- clipiq/manifest.json, popup.html, options.html, offscreen.html
- clipiq/js/{background,offscreen,popup,content,options,ai,detect}.js
- clipiq/css/{popup,options}.css
- clipiq/icons/{16,48,128}.png
- js/test/{detect.test.js,dedupe.test.js,ai-chain.test.js} (Node --test)
- demo/{index.html,server.js} — web-mode replica of popup

## Acceptance criteria
- [ ] Copy any text in Chrome → appears in popup list within ~2s, newest first
- [ ] Re-copy same text → single entry, moved to top, copy count increments
- [ ] Fuzzy search filters list live as you type (case-insensitive, subsequence)
- [ ] Smart cards: URL → link chip w/ domain; color hex → swatch; email → mail
      chip; code-ish → mono tinted card; else plain preview
- [ ] Pin: pinned clips render above unpinned; persists across popup opens
- [ ] Private: marking private hides from main list (toggle to view), deletes
      itself after paste (burn)
- [ ] Delete removes clip permanently
- [ ] Enter pastes selected clip into last focused input (content script
      insertText), popup closes
- [ ] Typing `;trigger` + space in any input expands to snippet text
- [ ] Snippet manager: add/edit/remove snippets on Options page
- [ ] Blocked sites: origin in list → copies from that site not saved
- [ ] Theme: light/dark/system toggle applies to popup + options
- [ ] AI search: query returns matched clip index via NVIDIA chain; failing
      model auto-cascades to next; UI shows which model answered
- [ ] Demo page at preview URL shows identical popup UI with seeded clips;
      search/pin/delete/AI panel all work in web mode
- [ ] Extension zip downloadable from demo page
- [ ] Unit tests: detect, dedupe, ai-chain — all pass under `node --test`
- [ ] No hardcoded preview URL / workspace paths in extension source
- [ ] API key not echoed in DOM; stored in chrome.storage only

## Tests
- node --test js/test/ (unit)
- Playwright via tester sub-agent on demo page (integration)

---

## v1.3.0 — capture & AI regression fix (user-reported)

**Symptoms:** auto-save of copied text stopped working in the packed extension; "Ask AI" appeared dead.

**Root causes fixed:**
1. content.js had no page copy/cut event capture — added CAPTURE_COPY listener (fires for Ctrl+C, right-click copy, Edit-menu copy on every page).
2. COPY_KEY_PRESSED (Ctrl+C keydown fallback) existed in content.js but background never queried the tab for the field selection — GET_FIELD_SELECTION now asked of the active/sender tab via chrome.tabs.sendMessage with 700ms timeout, offscreen read as path 2.
3. Ask AI was a downstream casualty of zero clips (early return with no feedback). Popup now opens the AI panel with explicit feedback states (empty query, no clips, attempt failures).
4. offscreen.js navigator.clipboard.readText requires document focus an offscreen doc never has — kept as opportunistic fallback only; copy-event capture is the primary path.
5. Manifest bumped 1.2.0 → 1.3.0.

**Tests:** capture.test.js added (3 tests: copy event → CAPTURE_COPY, cut event, Ctrl+C keydown → COPY_KEY_PRESSED, plain 'c' must not fire). Suite 22/22 pass. Browser-verified 5/5 on the demo (8 seed clips, plain search, AI matched query via Nemotron Nano 30B, nonsense query → "No matching clip found." via Nemotron Omni Reasoning — chain rotation working, 0 console errors).

**User instructions after reload:** existing installs must click the extension's "reload" icon once (chrome://extensions) for the new content script to take effect; capture starts the moment Chrome restarts, from any tab.
