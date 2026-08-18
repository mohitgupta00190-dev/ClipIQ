# ClipIQ — Schema

## Storage (chrome.storage.local / demo localStorage shim)
| Key | Type | Notes |
|---|---|---|
| clips | Clip[] | newest first, capped at settings.maxClips |
| snippets | Snippet[] | trigger must start with `;` |
| settings | Settings | see below |

Clip: { id, text, ts, copies, pinned, private }
Snippet: { id, trigger, text }
Settings: { blockedSites: string[], theme, maxClips, nvApiKey, aiEnabled }

## Runtime messages (chrome.runtime)
| Message | Direction | Payload |
|---|---|---|
| CLIP_CAPTURED | bg → none (internal) | — |
| INSERT_TEXT | popup → content | { text } |
| FOCUS_TRACK | content → bg | { tabId } (implicit via sender) |
| GET_STATE | any → bg | → { clips, snippets, settings } |
| READ_CLIPBOARD | bg → offscreen | → { text } |

## Endpoints
- NVIDIA NIM POST /v1/chat/completions (browser fetch, streaming SSE)
- Model chain (fixed order, benchmarked):
  1. nvidia/nemotron-3-nano-30b-a3b
  2. openai/gpt-oss-20b
  3. nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
  4. nvidia/llama-3.3-nemotron-super-49b-v1.5

## Demo endpoints (localhost:3000)
- GET / → demo page
- GET /clipiq.zip → extension package
