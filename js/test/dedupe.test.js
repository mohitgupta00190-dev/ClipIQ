const { test } = require("node:test");
const assert = require("node:assert");

// Mirrors background.js saveClip logic (kept in sync manually — background
// runs in a service worker, so we test the algorithm here).
function normalize(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function saveClipAlgorithm(clips, text, maxClips) {
  const norm = normalize(text);
  if (!norm) return { clips, changed: false };
  const existing = clips.find((c) => normalize(c.text) === norm);
  const now = Date.now();
  let next;
  if (existing) {
    existing.ts = now;
    existing.copies = (existing.copies || 1) + 1;
    const rest = clips.filter((c) => c.id !== existing.id);
    next = [...rest.filter((c) => c.pinned), existing, ...rest.filter((c) => !c.pinned)];
    return { clips: next, changed: true, deduped: true };
  }
  const clip = { id: "c_" + now, text, ts: now, copies: 1, pinned: false, private: false };
  next = [clip, ...clips.filter((c) => c.pinned), ...clips.filter((c) => !c.pinned)];
  // wait — new clip should sit BELOW pinned clips, above unpinned; fix order:
  next = [...clips.filter((c) => c.pinned), clip, ...clips.filter((c) => !c.pinned)];
  while (next.filter((c) => !c.pinned).length > maxClips) {
    for (let i = next.length - 1; i >= 0; i--) {
      if (!next[i].pinned) { next.splice(i, 1); break; }
    }
  }
  return { clips: next, changed: true, deduped: false };
}

test("new clip is added at top, pinned stay above", () => {
  const pinned = { id: "p1", text: "pinned clip", ts: 1, copies: 1, pinned: true, private: false };
  const old = { id: "o1", text: "old clip", ts: 2, copies: 1, pinned: false, private: false };
  const { clips } = saveClipAlgorithm([old, pinned], "new clip", 500);
  // new (unpinned) clip is inserted above unpinned but BELOW pinned
  assert.strictEqual(clips[0].id, "p1", "pinned stays first");
  assert.strictEqual(clips[1].text, "new clip", "new clip above old unpinned");
  assert.strictEqual(clips.length, 3);
});

test("re-copy dedupes: single entry, copies++", () => {
  const a = { id: "a", text: "hello  world", ts: 1, copies: 1, pinned: false, private: false };
  const b = { id: "b", text: "other", ts: 2, copies: 1, pinned: false, private: false };
  const { clips, deduped } = saveClipAlgorithm([b, a], "hello world", 500);
  assert.ok(deduped);
  assert.strictEqual(clips.length, 2);
  const h = clips.find((c) => c.text.startsWith("hello"));
  assert.strictEqual(h.id, "a", "same entry reused, not duplicated");
  assert.strictEqual(h.copies, 2, "copy count incremented");
});

test("max clips eviction never removes pinned", () => {
  const pinned = { id: "pin", text: "pinned", ts: 1, copies: 1, pinned: true, private: false };
  const rest = Array.from({ length: 10 }, (_, i) => ({
    id: "c" + i, text: "t" + i, ts: i, copies: 1, pinned: false, private: false,
  }));
  const { clips } = saveClipAlgorithm([pinned, ...rest], "newest", 10);
  assert.ok(clips.some((c) => c.id === "pin"));
  assert.strictEqual(clips.filter((c) => !c.pinned).length, 10);
});

test("empty/whitespace text ignored", () => {
  const { clips, changed } = saveClipAlgorithm([], "   \n\t  ", 500);
  assert.strictEqual(changed, false);
  assert.strictEqual(clips.length, 0);
});
