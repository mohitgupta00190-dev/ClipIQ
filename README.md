# ClipIQ — Smart Clipboard History

Copy anything, find it instantly. A local-first clipboard history Chrome extension with smart cards, snippets, private clips, and optional Pro AI features (chat, search, labels) unlocked via a consent-based Mellowtel layer.

## Links

- **Live demo site** — the repo root is fully deployable on Vercel (static site + one serverless AI passthrough at `/api/ai`).
- **Privacy policy** — `/privacy`
- **Chrome extension source** — [`clipiq/`](clipiq/) (also downloadable as `clipiq.zip`)
- **Chrome Web Store listing assets** — [`store-assets/`](store-assets/) (screenshots, promo tiles, icon, listing copy + privacy-form answers)

## Repo layout

```
public/            Static site served at the domain root
  index.html       Interactive demo (real popup UI, try it in-browser)
  privacy.html     Privacy policy page
  clipiq/          The Chrome extension (MV3) — source of truth
  clipiq.zip       Ready-to-load unpacked extension bundle
  store-assets/    Chrome Web Store graphics + listing docs
api/ai.js          Vercel serverless function — AI passthrough (rate-limited)
vercel.json        Vercel config (rewrites, headers, clean URLs)
```

## Run the demo locally

```bash
npx vercel dev     # or: npx serve public
```

## Load the extension in Chrome

1. Download `clipiq.zip` from the live site and unzip it (or clone this repo).
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the `clipiq/` folder.

## Features

- ⚡ Auto-capture everything you copy — links, code, emails, colors, commands
- 🔎 Instant fuzzy search + optional AI search in plain English
- 🧠 Smart cards (URL, email, color, code detection)
- 🔒 Private clips that burn after pasting; auto-exclusion list
- ⌨️ Ctrl+Shift+V popup, right-click menu, keyboard-first navigation
- ✨ Optional Pro (free): AI Chat, AI Search, AI Labels, premium gold UI — unlocked by consensual bandwidth sharing via Mellowtel; opt out any time and everything reverts

## Privacy

Local-first: your clipboard history stays on your device. See [public/privacy.html](public/privacy.html).

## License

MIT
