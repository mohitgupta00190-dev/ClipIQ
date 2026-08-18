// ClipIQ — clip type detection
(function (root) {
  const URL_RE = /^(https?:\/\/|www\.)[^\s]+$/i;
  const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const CODE_HINTS = [
    /;\s*$/m,
    /\b(function|const|let|var|=>|return|import|export|class)\b/,
    /\b(select|insert|update|delete|create table|alter table)\b[\s\S]*\b(from|into|set|values|table)\b/i,
    /^\s*(\/\/|#|\/\*|\*)/m,
    /^\s*(curl|sudo|npm|pip|git|docker|kubectl|cd|ls|chmod|grep|awk|sed)\s+\S/m,
    /[<][a-z][\s\S]*[>]/,
    /\$\{[^}]*\}/,
    /::|\w+\(\s*\)|\w+\([^)]*\)\s*[;{]/,
    /\s-{1,2}[a-z][a-z-]{1,}\s|\s-m\s/, // command flags like -H, --verbose, -m
    /"\w[\w :.-]{2,}"(\s|$)/, // quoted shell/git message
  ];
  const PHONE_RE = /^\+?[\d\s().-]{7,18}$/;

  function codeScore(t) {
    let hits = 0;
    for (const re of CODE_HINTS) if (re.test(t)) hits++;
    return hits;
  }

  function detectType(text) {
    const t = String(text || "").trim();
    if (!t) return "empty";
    if (URL_RE.test(t) && !/\s/.test(t)) return "url";
    if (COLOR_RE.test(t) && !/\s/.test(t)) return "color";
    if (EMAIL_RE.test(t) && !/\s/.test(t)) return "email";
    const score = codeScore(t);
    const long = t.includes("\n") || t.length > 40;
    if (score >= 2) return "code";          // two or more strong signals
    if (long && score >= 1 && /[;{}()=<>]/.test(t)) return "code"; // long + one signal + syntax chars
    return "text";
  }

  function domainOf(url) {
    try {
      const u = new URL(url.startsWith("www.") ? "https://" + url : url);
      return u.hostname.replace(/^www\./, "");
    } catch {
      return url.replace(/^https?:\/\//, "").split("/")[0];
    }
  }

  const api = { detectType, domainOf, URL_RE, COLOR_RE, EMAIL_RE, CODE_HINTS, PHONE_RE };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof self !== "undefined") self.ClipIQDetect = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
