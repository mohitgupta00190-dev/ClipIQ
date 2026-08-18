// Simulates the extension's capture chain in Node:
// content copy event -> CAPTURE_COPY message -> background handleCapture -> saveClip
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");

// minimal chrome shim capturing messages
function makeChrome() {
  const inbox = [];
  return {
    runtime: {
      sendMessage: (msg) => inbox.push(msg),
      onMessage: { addListener: () => {} },
    },
    storage: {
      local: { get: (keys, cb) => cb && cb({}) },
      onChanged: { addListener: () => {} },
    },
    _inbox: inbox,
  };
}

test("content copy listener sends CAPTURE_COPY with selected text", () => {
  const chrome = makeChrome();
  global.chrome = chrome;
  global.window = {};
  // minimal document with selection
  const listeners = { copy: [], cut: [], keydown: [], focusin: [] };
  global.document = {
    addEventListener: (type, fn) => (listeners[type] ? listeners[type].push(fn) : null),
    getSelection: () => ({ toString: () => "Hello from any tab!" }),
  };
  const srcPath = require("path").join(__dirname, "..", "..", "clipiq", "js", "content.js");
  eval(fs.readFileSync(srcPath, "utf8"));
  listeners.copy[0](); // fire a copy event
  assert.strictEqual(chrome._inbox.length, 1);
  assert.strictEqual(chrome._inbox[0].type, "CAPTURE_COPY");
  assert.strictEqual(chrome._inbox[0].text, "Hello from any tab!");
});

test("cut events also captured", () => {
  const chrome = makeChrome();
  global.chrome = chrome;
  global.window = { __clipiqLoaded: false };
  const listeners = { copy: [], cut: [], keydown: [], focusin: [] };
  global.document = {
    addEventListener: (type, fn) => (listeners[type] ? listeners[type].push(fn) : null),
    getSelection: () => ({ toString: () => "cut text" }),
  };
  const srcPath = require("path").join(__dirname, "..", "..", "clipiq", "js", "content.js");
  eval(fs.readFileSync(srcPath, "utf8"));
  listeners.cut[0]();
  assert.strictEqual(chrome._inbox[0].text, "cut text");
});

test("Ctrl+C keydown fires COPY_KEY_PRESSED even without copy event", () => {
  const chrome = makeChrome();
  global.chrome = chrome;
  global.window = { __clipiqLoaded: false };
  const listeners = { copy: [], cut: [], keydown: [], focusin: [] };
  global.document = {
    addEventListener: (type, fn) => (listeners[type] ? listeners[type].push(fn) : null),
    getSelection: () => ({ toString: () => "" }),
  };
  const srcPath = require("path").join(__dirname, "..", "..", "clipiq", "js", "content.js");
  eval(fs.readFileSync(srcPath, "utf8"));
  listeners.keydown[0]({ ctrlKey: true, metaKey: false, key: "c", preventDefault: () => {} });
  assert.ok(chrome._inbox.some((m) => m.type === "COPY_KEY_PRESSED"));
  // plain 'c' without modifier must NOT fire
  chrome._inbox.length = 0;
  listeners.keydown[0]({ ctrlKey: false, metaKey: false, key: "c", preventDefault: () => {} });
  assert.strictEqual(chrome._inbox.length, 0);
});
