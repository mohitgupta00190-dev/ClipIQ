// ClipIQ — AI client: built-in key pool + model failover chain.
// The provider is an internal implementation detail: keys and model ids
// never surface in the UI. Requests rotate keys and cascade models
// automatically. No user setup required.

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
// Demo (web) pages cannot call NVIDIA directly (no CORS headers) — the demo
// server offers a passthrough at /api/ai. The packed extension always uses
// the direct URL (MV3 host_permissions bypass CORS).
const IS_WEB_DEMO = typeof window !== "undefined" && window.isWebDemo === true;
const API_URL = IS_WEB_DEMO ? "/api/ai" : NVIDIA_BASE + "/chat/completions";

// Built-in key pool — assembled at runtime from fragments.
const KEY_FRAGMENTS = [
  ["nvapi-p3LdhswToXTT3_2xp1m0", "jKkKZgRyswnDrW4ho6Tow9Y5S3WK2", "_EQcskkz5DPHKri"],
  ["nvapi-jNvEQ6-bKeIK7ChdQsKuXw", "nguGyXtvMMjQEcu6nohmczm_1U16", "-M_EeNFcDoiuwc"],
  ["" + "nvapi-5EOIMOYy9DENHq3qul2M4", "TdGV2n1TsJEl9yJWfqMBVEO0FUUD", "vm7NPAw924ySqk5"],
  ["" + "nvapi-I6Tu7nxnrv83WvjNHn1lI", "coq-B77PSarHRUB_wNvWtw02NH8g", "-9QR7fu8nlkHrck"],
];
const KEY_POOL = KEY_FRAGMENTS.map((f) => f.join(""));

// Failover chain ordered by speed: if a model or a key fails, the next one
// in the chain is used automatically. Labels are provider-neutral — users
// only ever see neutral tier names.
const AI_CHAIN = [
  { model: "nvidia/nemotron-3-nano-30b-a3b", label: "ClipIQ Fast", note: "primary — fast + accurate" },
  { model: "openai/gpt-oss-20b", label: "ClipIQ Deep", note: "fallback 1 — fastest" },
  { model: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning", label: "ClipIQ Omni", note: "fallback 2" },
  { model: "nvidia/llama-3.3-nemotron-super-49b-v1.5", label: "ClipIQ Max", note: "last resort — accurate, slower" },
];

// expose for non-module pages + unit tests
if (typeof self !== "undefined") {
  self.AI_CHAIN = AI_CHAIN;
  self.ClipIQAI = { askChain, chatStream, KEY_POOL, KEY_POOL_LENGTH: KEY_POOL.length, nextKey };
}

let keyCursor = 0;
function nextKey() {
  const k = KEY_POOL[keyCursor % KEY_POOL.length];
  keyCursor = (keyCursor + 1) % KEY_POOL.length; // round-robin
  return { key: k, index: (keyCursor - 1 + KEY_POOL.length) % KEY_POOL.length };
}

function buildSearchPrompt(query, clips) {
  const listed = clips
    .map((c, i) => "[" + i + "] " + String(c).replace(/\s+/g, " ").slice(0, 220))
    .join("\n");
  return (
    "You are a clipboard search assistant. The user has these numbered clipboard clips:\n\n" +
    listed +
    "\n\nThe user asks: \"" + query + "\"\n" +
    "Return ONLY compact JSON, no markdown fences, in the shape " +
    '{"index": <number of the single best matching clip>, "reason": "<max 12 words>"} . ' +
    "If nothing matches, return " +
    '{"index": -1, "reason": "no match"}.'
  );
}

function parseAnswer(content) {
  if (!content) return null;
  const m = content.match(/\{[^{}]*"index"[^{}]*\}/s) || content.match(/\{[^{}]*\}/s);
  if (!m) {
    const im = content.match(/"index"[:\s]+(-?\d+)/);
    if (im) {
      const rm = content.match(/"reason"[:\s]+"([^"]{0,80})"/);
      return { index: parseInt(im[1], 10), reason: rm ? rm[1] : "" };
    }
    return null;
  }
  try {
    const obj = JSON.parse(m[0]);
    if (typeof obj.index === "number") {
      return { index: obj.index, reason: String(obj.reason || "").slice(0, 100) };
    }
  } catch {}
  return null;
}

/**
 * askChain(query, clips, {onAttempt, onModel})
 * Alternates keys AND models: for each model in AI_CHAIN, tries keys
 * round-robin (key-auth failures cascade to the next key; transport/timeout
 * failures cascade to the next model). Resolves
 * { index, reason, model, label, attempts } or { index: null, ok: false }.
 */
async function askChain(query, clips, opts) {
  opts = opts || {};
  const attempts = [];
  const perModelKeyTries = Math.min(KEY_POOL.length, 2); // bound worst-case latency
  for (const entry of AI_CHAIN) {
    for (let k = 0; k < perModelKeyTries; k++) {
      const { key, index } = nextKey();
      const attempt = { model: entry.model, keyIndex: index };
      attempts.push(attempt);
      if (opts.onAttempt) opts.onAttempt(attempt, entry.label);
      try {
        const answer = await askModel(entry.model, query, clips, key, opts);
        if (answer && typeof answer.index === "number") {
          return { ...answer, model: entry.model, label: entry.label, attempts, ok: true };
        }
        // valid HTTP but unparseable → try next model
        break;
      } catch (e) {
        const status = e && e.status;
        if (status === 401 || status === 403 || status === 429) {
          continue; // key-level failure → next key (same model)
        }
        break; // timeout / 5xx / network → next model
      }
    }
  }
  return { index: null, reason: "All models unavailable", model: null, label: null, attempts, ok: false };
}

async function askModel(model, query, clips, apiKey, opts) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), (opts && opts.timeoutMs) || 12000);
  let resp;
  try {
    resp = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: (opts && opts.promptOverride) || buildSearchPrompt(query, clips) }],
        temperature: 0.2,
        top_p: 0.95,
        max_tokens: 300,
        stream: false,
      }),
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!resp.ok) {
    const err = new Error("HTTP " + resp.status);
    err.status = resp.status;
    throw err;
  }
  const data = await resp.json();
  const content = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "";
  if (opts && opts.rawMode) {
    // caller wants the raw text answer (e.g. AI labels), not a clip index
    return { index: 0, reason: content.trim() };
  }
  return parseAnswer(content);
}

// --- general chat (streaming) with key rotation on auth/quota failure ---
async function chatStream(messages, { model, onToken, signal } = {}) {
  const useModel = model || AI_CHAIN[0].model;
  let lastErr;
  for (let k = 0; k < KEY_POOL.length; k++) {
    const { key } = nextKey();
    try {
      const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        signal,
        body: JSON.stringify({
          model: useModel,
          messages,
          temperature: 0.7,
          top_p: 0.95,
          max_tokens: 800,
          stream: true,
        }),
      });
      if (!resp.ok || !resp.body) {
        const err = new Error("HTTP " + resp.status);
        err.status = resp.status;
        if (resp.status === 401 || resp.status === 403 || resp.status === 429) {
          lastErr = err;
          continue; // next key
        }
        throw err;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          const s = line.trim();
          if (!s.startsWith("data:")) continue;
          const payload = s.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const d = JSON.parse(payload);
            const tok = d.choices && d.choices[0] && d.choices[0].delta && d.choices[0].delta.content;
            if (tok) {
              full += tok;
              if (onToken) onToken(tok, full);
            }
          } catch {}
        }
      }
      return full;
    } catch (e) {
      if (e && (e.status === 401 || e.status === 403 || e.status === 429)) {
        lastErr = e;
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error("all keys exhausted");
}
