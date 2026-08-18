// ClipIQ — popup logic (extension mode + web-demo mode)
(function () {
  const WEB = typeof window !== "undefined" && window.isWebDemo === true;

  // ---------- storage adapter ----------
  const Store = WEB
    ? {
        async get(keys) {
          const out = {};
          for (const k of keys) out[k] = JSON.parse(localStorage.getItem("clipiq:" + k) || "null");
          return out;
        },
      }
    : {
        async get(keys) {
          return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
        },
      };

  async function getState() {
    if (WEB) {
      const d = await Store.get(["clips", "snippets", "settings"]);
      return {
        clips: d.clips || [],
        snippets: d.snippets || [],
        settings: Object.assign({ theme: "light", maxClips: 500, aiEnabled: true, blockedSites: [] }, d.settings || {}),
      };
    }
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "GET_STATE" }, (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          chrome.storage.local.get(["clips", "snippets", "settings"], (d) =>
            resolve({
              clips: d.clips || [],
              snippets: d.snippets || [],
              settings: Object.assign({ theme: "system", maxClips: 500, aiEnabled: true, blockedSites: [] }, d.settings || {}),
            })
          );
          return;
        }
        resolve({ clips: resp.clips || [], snippets: resp.snippets || [], settings: resp.settings });
      });
    });
  }

  async function persistClips(clips) {
    if (WEB) localStorage.setItem("clipiq:clips", JSON.stringify(clips));
    else chrome.storage.local.set({ clips });
  }
  async function persistSettings(settings) {
    if (WEB) localStorage.setItem("clipiq:settings", JSON.stringify(settings));
    else chrome.runtime.sendMessage({ type: "SAVE_SETTINGS", settings });
  }

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }
  const detect = window.ClipIQDetect || { detectType: () => "text", domainOf: () => "" };

  function fuzzyScore(needle, hay) {
    needle = needle.toLowerCase();
    hay = hay.toLowerCase();
    if (!needle) return 1;
    let i = 0, score = 0, streak = 0;
    for (const ch of hay) {
      if (i < needle.length && ch === needle[i]) {
        i++; streak++; score += 2 + streak;
      } else streak = 0;
    }
    return i === needle.length ? score : 0;
  }

  function timeAgo(ts) {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return s + "s";
    if (s < 3600) return Math.floor(s / 60) + "m";
    if (s < 86400) return Math.floor(s / 3600) + "h";
    return Math.floor(s / 86400) + "d";
  }

  // ---------- state ----------
  let clips = [];
  let snippets = [];
  let settings = {};
  let query = "";
  let selIdx = 0;
  let visible = [];
  let showPrivate = false;
  let aiMatchIndex = null; // index into `visible` of AI-selected clip

  // ---------- render ----------
  function applyTheme() {
    const t = settings.theme || "system";
    const dark =
      t === "dark" ||
      (t === "system" && typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }

  function cardHtml(clip, idx) {
    const type = detect.detectType(clip.text);
    let inner = "";
    if (type === "url") {
      const d = detect.domainOf(clip.text.trim());
      // privacy: no third-party favicon fetch — render a local letter chip instead
      const letter = (d || "?").charAt(0).toUpperCase();
      inner =
        '<div class="chip"><span class="favicon letter-chip">' + esc(letter) + "</span>" +
        '<span class="domain">' + esc(clip.text.trim()) + "</span></div>";
    } else if (type === "color") {
      inner =
        '<div class="chip"><span class="swatch" style="background:' + esc(clip.text.trim()) + '"></span>' +
        '<span class="domain">' + esc(clip.text.trim()) + "</span></div>";
    } else if (type === "email") {
      inner = '<div class="chip"><span class="mail-chip">✉ ' + esc(clip.text.trim()) + "</span></div>";
    } else {
      inner = '<div class="card-text">' + esc(clip.text) + "</div>";
    }
    const meta =
      '<div class="card-meta"><span class="badge">' + timeAgo(clip.ts) + "</span>" +
      (clip.copies > 1 ? '<span>×' + clip.copies + "</span>" : "") +
      (clip.pinned ? '<span title="pinned">📌</span>' : "") +
      (clip.aiLabel ? '<span class="ai-label-chip" title="AI label">✨ ' + esc(clip.aiLabel) + "</span>" : "") +
      (clip.private ? '<span class="badge private">private</span>' : "") +
      "</div>";
    const actions =
      '<div class="card-actions">' +
      '<button class="act" data-act="ailabel" data-id="' + clip.id + '" title="AI label (Pro)">✨</button>' +
      '<button class="act pin ' + (clip.pinned ? "pin-on" : "") + '" data-act="pin" data-id="' + clip.id + '" title="Pin">' + (clip.pinned ? "★" : "☆") + "</button>" +
      '<button class="act" data-act="private" data-id="' + clip.id + '" title="Mark private">🔒</button>' +
      '<button class="act" data-act="del" data-id="' + clip.id + '" title="Delete">🗑</button>' +
      "</div>";
    return (
      '<div class="card ' + type + (clip.id === (visible[selIdx] && visible[selIdx].id) ? " sel" : "") +
      '" data-idx="' + idx + '" data-id="' + clip.id + '" role="option" tabindex="-1">' +
      '<div class="card-main">' + inner + "</div>" + meta + actions + "</div>"
    );
  }

  function render() {
    const listEl = $("list");
    const q = query.trim();
    visible = clips.filter((c) => (showPrivate ? true : !c.private));
    if (q) {
      visible = visible
        .map((c) => ({ c, s: fuzzyScore(q, c.text) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s || (b.c.pinned - a.c.pinned) || (b.c.ts - a.c.ts))
        .map((x) => x.c);
    } else {
      visible = [...visible].sort((a, b) => (b.pinned - a.pinned) || (b.ts - a.ts) || (a.id < b.id ? -1 : 1));
    }
    if (selIdx >= visible.length) selIdx = 0;
    if (selIdx < 0) selIdx = Math.max(0, visible.length - 1);

    const html = visible.map((c, i) => cardHtml(c, i)).join("");
    listEl.innerHTML = html || "";
    $("empty").hidden = visible.length > 0;
    $("count").textContent = visible.length + (visible.length === 1 ? " clip" : " clips");
    $("privateCount").textContent = String(clips.filter((c) => c.private).length);
    const sel = listEl.querySelector(".card.sel");
    if (sel) sel.scrollIntoView({ block: "nearest" });
  }

  // ---------- actions ----------
  async function togglePin(id) {
    const c = clips.find((x) => x.id === id);
    if (!c) return;
    c.pinned = !c.pinned;
    await persistClips(clips);
    render();
  }

  async function togglePrivate(id) {
    const c = clips.find((x) => x.id === id);
    if (!c) return;
    c.private = !c.private;
    await persistClips(clips);
    render();
  }

  async function removeClip(id) {
    clips = clips.filter((x) => x.id !== id);
    await persistClips(clips);
    if (!WEB) chrome.runtime.sendMessage({ type: "DELETE_CLIP", id });
    render();
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove();
  }

  async function useClip(clip, mode) {
    // mode: "paste" | "copy"
    if (mode === "copy" || WEB) {
      copyText(clip.text);
      if (WEB) {
        // demo: simulate burn-after-paste for private clips
        if (clip.private) {
          clips = clips.filter((c) => c.id !== clip.id);
          await persistClips(clips);
        }
        render();
        return;
      }
      if (mode === "copy") return;
    }
    if (!WEB) {
      // burn private clip after paste
      if (clip.private) {
        clips = clips.filter((c) => c.id !== clip.id);
        await persistClips(clips);
      }
      try {
        const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
        if (tab && tab.id != null) {
          await chrome.tabs.sendMessage(tab.id, { type: "INSERT_TEXT", text: clip.text });
        }
      } catch (e) {
        copyText(clip.text); // fallback: at least put it on the clipboard
      }
      window.close();
    }
  }

  // ---------- AI + Pro (live) ----------
  let proUnlocked = null; // null = unknown; true/false = support opt-in state

  async function refreshPro(force) {
    try {
      const s = window.ClipIQPro ? await window.ClipIQPro.getProStatus(force) : null;
      proUnlocked = !!(s && s.optedIn);
    } catch {
      proUnlocked = false;
    }
    applyProTheme();
  }

  function applyProTheme() {
    document.body.classList.toggle("pro-active-theme", proUnlocked === true);
    $("proTag").hidden = proUnlocked !== true;
    $("proActive").hidden = proUnlocked !== true;
    // banner shown when locked (unless dismissed this session)
    const dismissed = sessionStorage.getItem("clipiq:bannerDismissed") === "1";
    $("proBanner").hidden = proUnlocked === true || dismissed;
    // render feature list once
    const feats = (window.ClipIQPro && window.ClipIQPro.PRO_FEATURES) || [];
    const ul = $("pbFeats");
    if (ul && !ul.dataset.filled) {
      ul.innerHTML = feats.map((f) =>
        `<li><span class="fi">${f.icon}</span><div><b>${f.name}</b> — <span class="d">${f.desc}</span></div></li>`
      ).join("");
      ul.dataset.filled = "1";
    }
  }

  function showProUnlock() {
    $("aiPanel").hidden = true;
    $("proUnlock").hidden = false;
  }

  async function aiSearch() {
    await refreshPro(true);
    if (!proUnlocked) {
      showProUnlock();
      return;
    }
    const q = query.trim() || ($("q").value || "").trim();
    $("aiPanel").hidden = false; // open the panel immediately so the user sees feedback
    const answerEl = $("aiAnswer");
    const modelEl = $("aiModel");
    const insertBtn = $("aiInsert");
    if (!q) {
      answerEl.className = "ai-answer";
      answerEl.textContent = "Type what you're looking for first — e.g. \"the curl command with the key\".";
      modelEl.textContent = "";
      $("q").focus();
      return;
    }
    if (!clips.length) {
      answerEl.className = "ai-answer";
      answerEl.textContent = "No clips yet — copy something first, then ask.";
      modelEl.textContent = "";
      return;
    }
    const candidates = clips
      .filter((c) => !c.private)
      .slice(0, 40)
      .map((c) => c.text);
    if (!candidates.length) {
      answerEl.className = "ai-answer";
      answerEl.textContent = "All your clips are marked private — AI can't see them.";
      modelEl.textContent = "";
      return;
    }

    insertBtn.hidden = true;
    answerEl.className = "ai-answer busy";
    answerEl.textContent = "Asking AI…";
    modelEl.textContent = "";
    aiMatchIndex = null;

    try {
      const res = await askChain(q, candidates, {
        onAttempt: (attempt, label) => {
          modelEl.textContent = (label || attempt.model) + "…";
        },
      });
      answerEl.className = "ai-answer";
      if (res.index != null && res.index >= 0 && res.index < candidates.length) {
        const clip = clips.filter((c) => !c.private)[res.index];
        if (clip) {
          aiMatchIndex = clips.indexOf(clip);
          const i = visible.findIndex((c) => c.id === clip.id);
          if (i >= 0) { selIdx = i; }
          render();
          answerEl.innerHTML = "Matched: " + esc(res.reason || "this clip") +
            '<div class="ai-clip-preview">' + esc(String(clip.text).slice(0, 140)) + "</div>";
          insertBtn.hidden = false;
          insertBtn.dataset.clipId = clip.id;
          modelEl.textContent = res.label || res.model;
          return;
        }
      }
      answerEl.textContent = res.reason === "no match" ? "No matching clip found." : res.reason || "No match.";
      modelEl.textContent = res.label || res.model || "";
      if (!res.ok && res.attempts && res.attempts.length) {
        modelEl.textContent = res.attempts.length + " attempts failed";
      }
    } catch (e) {
      answerEl.className = "ai-answer";
      answerEl.textContent = "AI search unavailable — check your connection and try again.";
    }
  }

  // ✨ AI label (Pro) — ask the AI to name this clip in a few words
  async function aiLabelClip(id) {
    await refreshPro(true);
    if (!proUnlocked) {
      showProUnlock();
      return;
    }
    const clip = clips.find((x) => x.id === id);
    if (!clip) return;
    const btn = document.querySelector('[data-act="ailabel"][data-id="' + id + '"]');
    if (btn) btn.textContent = "⏳";
    try {
      const res = await askChain("", [], {
        rawMode: true,
        promptOverride:
          "Label this clipboard item in 2-5 words. Reply with the label ONLY — no quotes, no punctuation, no explanation.\n\nITEM:\n" +
          clip.text.slice(0, 300),
      });
      const label = (res.reason || "").trim().replace(/^["'\s]+|["'\s]+$/g, "");
      if (label && res.ok !== false) {
        clip.aiLabel = label.slice(0, 40);
        await persistClips(clips);
      }
    } catch {}
    render();
  }

  // ---------- events ----------
  function bind() {
    $("q").addEventListener("input", (e) => {
      query = e.target.value;
      $("btnClear").style.display = query ? "block" : "none";
      render();
    });
    $("btnClear").addEventListener("click", () => {
      $("q").value = "";
      query = "";
      $("btnClear").style.display = "none";
      render();
      $("q").focus();
    });
    $("aiClose").addEventListener("click", () => ($("aiPanel").hidden = true));
    $("proClose").addEventListener("click", () => ($("proUnlock").hidden = true));
    $("proGo").addEventListener("click", async () => {
      if (WEB) {
        window.open("/#support", "_self");
      } else {
        try {
          chrome.runtime.sendMessage({ type: "MELLOWTEL_SETTINGS" });
        } catch {}
      }
      $("proUnlock").hidden = true;
    });
    $("pbClose").addEventListener("click", () => {
      sessionStorage.setItem("clipiq:bannerDismissed", "1");
      $("proBanner").hidden = true;
    });
    $("pbGo").addEventListener("click", async () => {
      if (WEB) {
        window.open("/#support", "_self");
      } else {
        try {
          chrome.runtime.sendMessage({ type: "MELLOWTEL_SETTINGS" });
        } catch {}
      }
    });

    // live Pro status: keep popup in sync with opt-out
    if (!WEB && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "PRO_STATUS_CHANGED") {
          refreshPro(true);
        }
      });
    } else if (WEB) {
      window.addEventListener("storage", (e) => {
        if (e.key === "clipiq:support") refreshPro(true);
      });
    }
    $("aiInsert").addEventListener("click", (e) => {
      const id = e.currentTarget.dataset.clipId;
      const clip = clips.find((c) => c.id === id);
      if (clip) useClip(clip, "paste");
    });
    $("btnPrivate").addEventListener("click", () => {
      showPrivate = !showPrivate;
      $("btnPrivate").classList.toggle("on", showPrivate);
      render();
    });
    $("btnSettings").addEventListener("click", () => {
      if (WEB) {
        window.location.href = "options.html";
      } else {
        chrome.runtime.openOptionsPage();
      }
    });

    $("list").addEventListener("click", (e) => {
      const actBtn = e.target.closest("[data-act]");
      if (actBtn) {
        e.stopPropagation();
        const id = actBtn.dataset.id;
        if (actBtn.dataset.act === "pin") togglePin(id);
        else if (actBtn.dataset.act === "private") togglePrivate(id);
        else if (actBtn.dataset.act === "del") removeClip(id);
        else if (actBtn.dataset.act === "ailabel") aiLabelClip(id);
        return;
      }
      const card = e.target.closest(".card");
      if (card) {
        const clip = visible[parseInt(card.dataset.idx, 10)];
        if (clip) useClip(clip, "paste");
      }
    });

    // Ask AI → premium chat window (Pro-gated)
    $("btnAi").addEventListener("click", openAiChatIfPro);
    async function openAiChatIfPro() {
      await refreshPro(true);
      if (!proUnlocked) {
        showProUnlock();
        return;
      }
      if (WEB) {
        window.open("/clipiq/chat.html", "_blank");
      } else {
        chrome.runtime.sendMessage({ type: "OPEN_AI_CHAT", query: query || $("q").value || "" });
      }
    }

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        selIdx = Math.min(selIdx + 1, visible.length - 1);
        render();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        selIdx = Math.max(selIdx - 1, 0);
        render();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        aiSearch(); // Ctrl+Enter anywhere = ask AI
      } else if (e.key === "Enter") {
        const clip = visible[selIdx];
        if (clip) useClip(clip, "paste");
      } else if (e.key === "Escape") {
        if (!$("aiPanel").hidden) $("aiPanel").hidden = true;
        else if (query) { $("q").value = ""; query = ""; render(); }
      }
    });
  }

  // ---------- init ----------
  async function init() {
    const st = await getState();
    clips = st.clips || [];
    snippets = st.snippets || [];
    settings = st.settings || {};
    applyTheme();
    bind();
    await refreshPro(true); // banner/theme before first paint completes
    $("btnClear").style.display = "none";
    if (WEB) {
      // demo seed on first run — and self-heal returning visitors when the
      // seed set changes (version marker), so stale demo clips never linger
      const SEED_V = 2;
      let seedV = 0;
      try { seedV = parseInt(localStorage.getItem("clipiq:seedV") || "0", 10) || 0; } catch {}
      if (!clips.length || seedV < SEED_V) {
        clips = seedClips();
        await persistClips(clips);
        try { localStorage.setItem("clipiq:seedV", String(SEED_V)); } catch {}
      }
    } else {
      // refresh state in case background captured something new
      chrome.runtime.sendMessage({ type: "POLL_NOW" }, () => {
        if (chrome.runtime.lastError) return;
        getState().then((st2) => {
          clips = st2.clips || clips;
          render();
        });
      });
    }
    render();
    $("q").focus();
  }

  function seedClips() {
    const now = Date.now();
    const mk = (text, minAgo, extra) => ({
      id: "c_" + (now - minAgo * 60000) + "_" + Math.random().toString(36).slice(2, 6),
      text, ts: now - minAgo * 60000, copies: 1, pinned: false, private: false, ...(extra || {}),
    });
    return [
      mk('curl -H "Authorization: Bearer sk-live-abc123" https://api.stripe.com/v1/charges', 2),
      mk("https://github.com/openwebdocs/mdn-examples?tab=readme", 6),
      mk("#3B82F6", 12),
      mk("john.malkovich@acmecorp.com", 25),
      mk("Hey team, pushing the release to Friday — QA found a login bug on Safari.", 47),
      mk("INSERT INTO users (name, role) VALUES ('ada', 'admin');", 90),
      mk("invoice INV-2024-8841 total $1,250.00 due Sept 30", 160),
      mk("git commit -m \"fix: race condition in websocket reconnect\"", 400),
    ];
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init(); // DOM already parsed (e.g. dynamically injected demo mode)
  }
})();
