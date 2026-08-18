// ClipIQ — Vercel serverless AI passthrough (public demo rate-limited).
// Pure passthrough: auth comes from the client (same keys the public JS
// bundle already contains); the server adds nothing.
// CommonJS for maximum compatibility with the Vercel Node runtime.
const https = require("https");

let window_ = { start: 0, count: 0 };
function rateLimited() {
  const now = Date.now();
  if (now - window_.start > 60000) { window_.start = now; window_.count = 0; }
  return ++window_.count > 30;
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    if (typeof res.status === "function" && typeof res.json === "function") {
      res.status(405).json({ error: "POST only" });
    } else {
      json(res, 405, { error: "POST only" });
    }
    return;
  }
  if (rateLimited()) {
    if (typeof res.status === "function" && typeof res.json === "function") {
      res.status(429).json({ error: "demo rate limit — try again in a minute" });
    } else {
      json(res, 429, { error: "demo rate limit — try again in a minute" });
    }
    return;
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  await new Promise((resolve) => req.on("end", resolve));
  const payload = Buffer.concat(chunks);

  await new Promise((resolve) => {
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
        if (typeof res.status === "function" && typeof res.json === "function") {
          res.status(ur.statusCode);
          res.setHeader("Content-Type", ur.headers["content-type"] || "application/json");
        } else {
          res.writeHead(ur.statusCode, {
            "Content-Type": ur.headers["content-type"] || "application/json",
          });
        }
        ur.pipe(res);
        ur.on("end", resolve);
        ur.on("error", resolve);
      }
    );
    upstream.on("timeout", () => upstream.destroy(new Error("upstream timeout")));
    upstream.on("error", () => {
      if (typeof res.status === "function" && typeof res.json === "function") {
        res.status(502).json({ error: "upstream failed" });
      } else {
        json(res, 502, { error: "upstream failed" });
      }
      resolve();
    });
    upstream.end(payload);
  });
};
