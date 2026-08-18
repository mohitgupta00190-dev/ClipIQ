const { test } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const detect = require(path.join(__dirname, "..", "..", "clipiq", "js", "detect.js"));
const { detectType, domainOf } = detect;

test("url detection", () => {
  assert.strictEqual(detectType("https://example.com/page"), "url");
  assert.strictEqual(detectType("www.github.com/nvidia"), "url");
  assert.notStrictEqual(detectType("hello world https://x.com"), "url");
});

test("color detection", () => {
  assert.strictEqual(detectType("#3B82F6"), "color");
  assert.strictEqual(detectType("#fff"), "color");
  assert.strictEqual(detectType("#3b82f680"), "color");
  assert.notStrictEqual(detectType("#ffzzz"), "color");
});

test("email detection", () => {
  assert.strictEqual(detectType("john.malkovich@acmecorp.com"), "email");
  assert.notStrictEqual(detectType("not-an-email@"), "email");
});

test("code detection", () => {
  assert.strictEqual(detectType("const x = 1;\nfunction f() { return x; }"), "code");
  assert.strictEqual(detectType("SELECT * FROM users WHERE id = 7;"), "code");
  assert.strictEqual(detectType("git commit -m \"fix: race condition\""), "code");
  assert.notStrictEqual(detectType("Hey team, the meeting moved to Friday."), "code");
});

test("plain text detection", () => {
  assert.strictEqual(detectType("The quick brown fox jumps over the lazy dog again and again"), "text");
});

test("domain extraction", () => {
  assert.strictEqual(domainOf("https://www.github.com/nvidia/nim"), "github.com");
  assert.strictEqual(domainOf("www.example.io"), "example.io");
});
