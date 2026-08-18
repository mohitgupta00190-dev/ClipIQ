const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

// Load ai.js in a browser-like global scope
const src = fs.readFileSync(path.join(__dirname, "..", "..", "clipiq", "js", "ai.js"), "utf8");
global.self = global;
eval(src);

test("chain order matches benchmark ranking", () => {
  assert.strictEqual(AI_CHAIN.length, 4);
  assert.strictEqual(AI_CHAIN[0].model, "nvidia/nemotron-3-nano-30b-a3b");
  assert.strictEqual(AI_CHAIN[1].model, "openai/gpt-oss-20b");
  assert.strictEqual(AI_CHAIN[2].model, "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning");
  assert.strictEqual(AI_CHAIN[3].model, "nvidia/llama-3.3-nemotron-super-49b-v1.5");
});

test("built-in key pool assembled from fragments, never visible as full literals", () => {
  assert.strictEqual(ClipIQAI.KEY_POOL_LENGTH, 4);
  const pool = ClipIQAI.KEY_POOL;
  for (const k of pool) {
    assert.ok(k.startsWith("nvapi-"));
    assert.ok(k.length > 60);
  }
});

test("key rotation round-robins across all four keys", () => {
  const seen = [];
  for (let i = 0; i < 8; i++) {
    seen.push(ClipIQAI.nextKey().index);
  }
  assert.deepStrictEqual(seen.sort(), [0, 0, 1, 1, 2, 2, 3, 3]);
});

test("auth failure (401/429) rotates to NEXT KEY, same model", async () => {
  const usedKeys = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    usedKeys.push(JSON.stringify(opts.headers.Authorization));
    if (usedKeys.length === 1) {
      const e = new Error("HTTP 429");
      e.status = 429;
      throw e;
    }
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"index": 2, "reason": "ok"}' } }] }),
    };
  };
  try {
    const res = await askChain("q", ["a", "b", "c"], {});
    assert.strictEqual(res.index, 2);
    assert.strictEqual(res.ok, true);
    assert.strictEqual(res.attempts.length, 2, "two key attempts on same model");
    assert.strictEqual(res.attempts[0].model, res.attempts[1].model);
    assert.notStrictEqual(usedKeys[0], usedKeys[1], "different keys used");
  } finally {
    global.fetch = realFetch;
  }
});

test("model failure (timeout/5xx) cascades to NEXT MODEL", async () => {
  const models = [];
  const realFetch = global.fetch;
  global.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    models.push(body.model);
    if (body.model === AI_CHAIN[0].model) {
      const e = new Error("HTTP 503");
      e.status = 503;
      throw e;
    }
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: '{"index": 1, "reason": "fallback"}' } }] }),
    };
  };
  try {
    const res = await askChain("q", ["a", "b"], {});
    assert.strictEqual(res.model, AI_CHAIN[1].model);
    assert.strictEqual(res.reason, "fallback");
    assert.ok(models.includes(AI_CHAIN[1].model));
  } finally {
    global.fetch = realFetch;
  }
});

test("full outage: all models × keys exhausted gracefully", async () => {
  const realFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push(JSON.parse(opts.body).model);
    const e = new Error("HTTP 503");
    e.status = 503;
    throw e;
  };
  try {
    const res = await askChain("q", ["a"], { timeoutMs: 50 });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.index, null);
    assert.strictEqual(res.attempts.length, 4, "one attempt per model (transport failures)");
    assert.strictEqual(new Set(calls).size, 4, "all four models tried");
  } finally {
    global.fetch = realFetch;
  }
});

test("parseAnswer handles prose-wrapped JSON", () => {
  assert.deepStrictEqual(parseAnswer('Sure! {"index": 3, "reason": "x"} hope that helps'), {
    index: 3, reason: "x",
  });
  assert.deepStrictEqual(parseAnswer('{"index": -1, "reason": "no match"}'), {
    index: -1, reason: "no match",
  });
  assert.strictEqual(parseAnswer("garbage no json here"), null);
  assert.deepStrictEqual(parseAnswer('"index": 5, "reason": "y"'), { index: 5, reason: "y" });
});

test("search prompt lists clips and demands JSON", () => {
  const p = buildSearchPrompt("my key", ["alpha", "beta"]);
  assert.ok(p.includes("[0] alpha"));
  assert.ok(p.includes("[1] beta"));
  assert.ok(p.includes('"index"'));
});

test("no literal nvapi- key anywhere in shipped source", () => {
  // the full keys must not appear in ANY extension file (fragments only)
  const fullKeys = ClipIQAI.KEY_POOL;
  const files = ["ai.js", "popup.js", "options.js", "background.js", "content.js", "detect.js", "pro.js"];
  for (const f of files) {
    const s = fs.readFileSync(path.join(__dirname, "..", "..", "clipiq", "js", f), "utf8");
    for (const k of fullKeys) {
      assert.ok(!s.includes(k), `${f} contains a full literal key`);
    }
  }
});

test("model labels are provider-neutral (no NVIDIA/Nemotron/GPT-OSS in UI strings)", () => {
  for (const e of AI_CHAIN) {
    assert.ok(e.label && /^ClipIQ /.test(e.label), `label not neutral: ${e.label}`);
    assert.ok(!/nvidia|nemotron|gpt-oss|openai/i.test(e.label), `label leaks provider: ${e.label}`);
  }
  const popupSrc = fs.readFileSync(path.join(__dirname, "..", "..", "clipiq", "js", "popup.js"), "utf8");
  assert.ok(!/nemotron|gpt-oss/i.test(popupSrc), "popup.js mentions provider models");
  const popupHtml = fs.readFileSync(path.join(__dirname, "..", "..", "clipiq", "popup.html"), "utf8");
  assert.ok(!/nvidia|nemotron|gpt-oss/i.test(popupHtml), "popup.html mentions provider");
});

test("pro gate module loads and defaults to locked", async () => {
  const proSrc = fs.readFileSync(path.join(__dirname, "..", "..", "clipiq", "js", "pro.js"), "utf8");
  const run = new Function(proSrc + "\n; return self.ClipIQPro;")();
  const s = await run.isPro();
  assert.strictEqual(s, false, "pro defaults to locked when no support opt-in");
});

test("no AI configuration UI exists in options page", () => {
  const opts = fs.readFileSync(path.join(__dirname, "..", "..", "clipiq", "options.html"), "utf8");
  assert.ok(!/api.?key/i.test(opts), "options page mentions api key");
  assert.ok(!opts.includes("js/ai.js"), "options page loads ai.js");
});
