# Chrome Web Store — Privacy tab answers (copy-paste values)

Live URLs:
- Privacy policy: https://index-heading-page-iy7sbr.drytis.dev/privacy.html
- Demo/homepage: https://index-heading-page-iy7sbr.drytis.dev/

---

## Single purpose description (≤1000 chars)

> ClipIQ is a clipboard history manager. It captures the text you copy across all sites, stores it locally on your device, and lets you search, preview, categorize, and instantly re-paste any previous copy via a popup, keyboard shortcut, or right-click menu. Optional opt-in Pro features (AI search/chat/labels) and an optional Mellowtel bandwidth-sharing layer are off by default and only activate with the user's explicit consent.

(424 chars)

---

## Permission justifications (≤1000 chars each)

**storage**
> Storage is where ClipIQ keeps the clipboard history the user copies, plus their settings (favorites, trash, ignore list, theme). The entire product is a searchable history of copies; without storage there is no history. All data stays on the user's device and is deleted on uninstall.

(289 chars)

**offscreen**
> Chrome only allows clipboard reads from a document context. ClipIQ uses a hidden offscreen document as a fallback reader to capture the user's copies when a page copy event is not available (e.g. copies from desktop apps). This is required for the extension's single purpose — capturing clipboard text — and nothing else.

(318 chars)

**clipboardRead**
> Reading the clipboard is the extension's single purpose: ClipIQ saves the text the user copies so they can find and re-use it later. clipboardRead lets the extension detect and capture new copies (both from page copy events and via the offscreen fallback reader). No clipboard content leaves the device unless the user explicitly invokes an opt-in AI feature.

(355 chars)

**clipboardWrite**
> clipboardWrite lets ClipIQ paste a previously-saved clip back at the cursor when the user selects it from the popup or presses Enter — the "history you can re-use" half of the single purpose. It is used only when the user explicitly requests a paste.

(272 chars)

**alarms**
> Alarms run two periodic tasks the MV3 service worker cannot keep in memory: (1) a ~1.2s clipboard poll fallback so copies are still captured after service-worker idle shutdown, and (2) a once-per-minute Pro status check so opting out of the optional Pro layer immediately disables all Pro features and restores the normal UI/icon. Alarms trigger no network calls in the free tier.

(354 chars)

**activeTab**
> activeTab grants access only to the site the user is currently on, only at the moment they interact with ClipIQ (popup, shortcut, or context-menu). It is used to paste the selected clip into that page's focused field — the core paste-back flow — without requesting standing access to every site.

(300 chars)

**scripting**
> scripting is used for one narrowly-scoped action: when the user right-clicks and chooses "Search ClipIQ", the extension injects a single function that opens the ClipIQ popup on that tab. It never reads or modifies page content and never runs without that explicit user gesture.

(284 chars)

**contextMenus**
> Adds the right-click menu entry "Search ClipIQ" so users can open the clipboard search from any page. This is a standard access point for the extension's core popup; the menu item performs no page access itself.

(232 chars)

**declarativeNetRequestWithHostAccess**
> Used exclusively by the optional, off-by-default Mellowtel support layer the user explicitly opts into when unlocking Pro. Mellowtel requires this permission to modify request headers for its consensual bandwidth-sharing sessions. If the user never opts in — or opts out later — no session rules are ever created and all Pro features disable automatically. ClipIQ's core clipboard features do not use this permission.

(432 chars)

**Host permission (<all_urls>)**
> Two uses, both scoped to the single purpose: (1) a content script listens for copy/paste events on every site so captures work anywhere the user copies text — it reads only text the user themselves selects and copies, never page contents; (2) the optional Mellowtel support layer (opt-in, off by default) needs host access for its consensual bandwidth-sharing sessions. Pasting saved clips back uses the narrower activeTab permission instead. ClipIQ never collects browsing history or page content, and its privacy policy (https://index-heading-page-iy7sbr.drytis.dev/privacy.html) documents this in full.

(636 chars)

---

## Are you using remote code?

**No, I am not using Remote code.**

(All JavaScript is bundled in the extension package: our own code plus the Mellowtel SDK library compiled into lib/mellowtel.js. No external script tags, no eval, no CDN loads.)

---

## Data usage — checkboxes

Tick ONLY these two:
- ✅ **User activity** — "network monitoring, clicks, mouse position, scroll, or keystroke logging"
- ✅ **Website content** — "text, images, sounds, videos, or hyperlinks"

Leave all others UNCHECKED:
- ❌ Personally identifiable information
- ❌ Health information
- ❌ Financial and payment information
- ❌ Authentication information
- ❌ Personal communications
- ❌ Location
- ❌ Web history

Rationale if asked: the "user activity" disclosure covers the optional Mellowtel bandwidth-sharing layer (network), and "website content" covers the clipboard text users themselves copy (captured locally; only sent off-device when the user invokes an opt-in AI feature). No PII, health, financial, auth, communications, location, or web-history data is collected.

---

## Certifications (check all three)

- ✅ I do not sell or transfer user data to third parties, outside of the approved use cases
- ✅ I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- ✅ I do not use or transfer user data to determine creditworthiness or for lending purposes

---

## Privacy policy URL

> https://index-heading-page-iy7sbr.drytis.dev/privacy.html

(Live, 200 OK — hosted on the same domain as the extension's homepage/demo.)
