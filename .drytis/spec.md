# ClipIQ — Blueprint

## What
A lightweight Chrome MV3 clipboard-history extension with instant search, smart
clip cards, pinning, private clips, a minimal snippet expander, and an AI search
assistant powered by NVIDIA NIM (OpenAI-compatible endpoint).

Differentiator vs the category incumbents: zero-config simplicity (one box, one
keystroke), auto-rendered smart cards, and AI-assisted natural-language search
over the user's own clipboard history.

## Tech stack
- Chrome Extension Manifest V3, vanilla JS (no build step, no framework)
- chrome.storage.local for clips/snippets/settings (local-only, no cloud)
- Offscreen document for clipboard polling (MV3-safe capture)
- Content script for paste-back and snippet expansion
- NVIDIA NIM chat completions (streaming) with a 4-model failover chain
- Demo page (same popup code in web mode) served by a static Node server for
  the workspace preview

## Key decisions
1. **No framework** — keeps the extension tiny, reviewable, and fast to load.
2. **AI chain order (benchmark-verified 2026-08-17)**:
   1. nvidia/nemotron-3-nano-30b-a3b (primary: 3/3 correct, ~1-2s)
   2. openai/gpt-oss-20b (fastest first token, 3/3)
   3. nvidia/nemotron-3-nano-omni-30b-a3b-reasoning (2/3, fast)
   4. nvidia/llama-3.3-nemotron-super-49b-v1.5 (3/3, slow ~20s — last resort)
3. **Web-demo mode** — popup.js detects `window.isWebDemo` and swaps
   chrome.* calls for localStorage + demo seed clips so the tester sub-agent
   can exercise the full UI at the preview URL without installing the CRX.
4. **API key** — user's NVIDIA key is the shipped default; editable in Options
   and stored in chrome.storage.sync (extension-local, never sent anywhere
   except integrate.api.nvidia.com).

## Modules
- background: capture orchestration, dedupe, privacy filtering, badge count
- offscreen: clipboard reader (navigator.clipboard.readText via focused doc)
- popup: search UI, smart cards, pin/private actions, AI panel
- content: paste-back at caret, snippet expansion (;trigger)
- options: snippets CRUD, blocked sites, theme, API key + model chain display

## Out of scope
Cloud sync, accounts, tags/folders, floating widget, stats dashboard, image
clips (phase 2), fullscreen manager.
