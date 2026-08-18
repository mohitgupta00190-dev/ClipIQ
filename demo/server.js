// ClipIQ demo static server — serves /workspace/demo on :3000
// Buffered responses (readFileSync + Content-Length) for reliable proxying.
// Security: only /clipiq/* may resolve outside the docroot; dotfiles always 404.
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname; // /workspace/demo
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".zip": "application/zip",
};

// Whitelisted prefixes allowed to resolve outside ROOT (the extension source)
const ALLOWED_EXTERNAL = ["/clipiq/", "/clipiq.zip"];

function resolveFile(urlPath) {
  if (urlPath.split("/").some((seg) => seg.startsWith("."))) return null; // no dotfiles/dotdirs
  let p = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  let file = path.join(ROOT, p);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  const external = ALLOWED_EXTERNAL.some((prefix) => p === "/clipiq.zip" || p.startsWith(prefix));
  if (!external) return null;
  const alt = path.join(ROOT, "..", p);
  if (fs.existsSync(alt) && fs.statSync(alt).isFile()) return alt;
  return null;
}

// --- AI passthrough proxy (demo mode only) ---
// The packed extension calls the provider directly (MV3 host_permissions
// bypass CORS). A plain web page cannot — so the demo forwards through here.
// Pure passthrough: auth comes from the client (same keys the public JS
// bundle already contains); the server adds nothing. Rate-limited so the
// public demo can't be abused as a free API oracle.
const aiWindow = { start: 0, count: 0 };
function aiRateLimited() {
  const now = Date.now();
  if (now - aiWindow.start > 60000) { aiWindow.start = now; aiWindow.count = 0; }
  return ++aiWindow.count > 30;
}
function proxyAi(req, res) {
  if (aiRateLimited()) {
    res.writeHead(429, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "demo rate limit — try again in a minute" }));
    return;
  }
  let body = [];
  req.on("data", (c) => body.push(c));
  req.on("end", () => {
    const payload = Buffer.concat(body);
    const upstream = https.request(
      {
        hostname: "integrate.api.nvidia.com",
        path: "/v1/chat/completions",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: req.headers.authorization || "",
          "Content-Length": payload.length,
        },
        timeout: 25000,
      },
      (ur) => {
        res.writeHead(ur.statusCode, {
          "Content-Type": ur.headers["content-type"] || "application/json",
        });
        ur.pipe(res);
      }
    );
    upstream.on("timeout", () => upstream.destroy(new Error("upstream timeout")));
    upstream.on("error", () => {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upstream failed" }));
    });
    upstream.end(payload);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && (req.url || "").split("?")[0] === "/api/ai") {
    return proxyAi(req, res);
  }
  try {
    let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    if (urlPath === "/") urlPath = "/index.html";
    if (urlPath === "/favicon.ico") urlPath = "/clipiq/icons/128.png";
    const file = resolveFile(urlPath);
    if (!file) {
      const body = Buffer.from("not found");
      res.writeHead(404, { "Content-Type": "text/plain", "Content-Length": body.length });
      res.end(body);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    const buf = fs.readFileSync(file);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": buf.length,
      "Cache-Control": "no-store",
    });
    res.end(buf);
  } catch (e) {
    const body = Buffer.from("error");
    res.writeHead(500, { "Content-Type": "text/plain", "Content-Length": body.length });
    res.end(body);
  }
});

const PORT = process.env.DEMO_PORT || 3000;
server.listen(PORT, "0.0.0.0", () => console.log("demo server on :" + PORT));
