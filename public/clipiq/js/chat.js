// ClipIQ — premium AI chat window
(function () {
  const $ = (id) => document.getElementById(id);

  // demo mode: this page is served from the demo server like the popup
  const WEB = typeof window !== "undefined" && window.isWebDemo === true;
  const IS_EXT = !WEB && typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;

  // ---- Pro gate: live ----
  async function checkPro() {
    if (window.ClipIQPro) {
      const s = await window.ClipIQPro.getProStatus(true);
      return !!s.optedIn;
    }
    return false;
  }

  function renderGate(show) {
    $("gate").hidden = !show;
    if (show) $("chatMain").hidden = true;
    const list = $("gateList");
    list.innerHTML = "";
    const feats = (window.ClipIQPro && window.ClipIQPro.PRO_FEATURES) || [];
    for (const f of feats) {
      const li = document.createElement("li");
      li.innerHTML = `<span class="fi">${f.icon}</span><div><b>${f.name}</b><br><span class="d">${f.desc}</span></div>`;
      list.appendChild(li);
    }
  }

  function renderChat(show) {
    $("chatMain").hidden = !show;
    $("app").classList.toggle("pro", show);
  }

  // ---- messages ----
  let clips = [];
  async function loadClips() {
    if (WEB) {
      try { clips = JSON.parse(localStorage.getItem("clipiq:clips") || "[]"); } catch { clips = []; }
    } else if (IS_EXT) {
      clips = await new Promise((res) => chrome.runtime.sendMessage({ type: "GET_STATE" }, (r) => res(r && r.clips ? r.clips : [])));
    }
  }

  function addMsg(role, text, cls) {
    const wrap = document.createElement("div");
    wrap.className = "msg " + role;
    const b = document.createElement("div");
    b.className = "bubble" + (cls ? " " + cls : "");
    b.textContent = text;
    wrap.appendChild(b);
    $("msgs").appendChild(wrap);
    $("msgs").scrollTop = $("msgs").scrollHeight;
    return b;
  }

  function buildContext() {
    const recent = clips.slice(0, 20).map((c, i) => `[${i}] ${c.text.slice(0, 200)}`).join("\n");
    return recent ? `User's recent clips:\n${recent}` : "(no clips yet)";
  }

  async function send() {
    const ta = $("chatInput");
    const q = ta.value.trim();
    if (!q) return;
    ta.value = "";
    addMsg("user", q);
    const think = addMsg("ai", "Thinking…", "thinking");
    try {
      const full = await ClipIQAI.chatStream(
        [
          { role: "system", content: "You are ClipIQ AI, a helpful clipboard assistant. Be concise and friendly. Context: " + buildContext() },
          { role: "user", content: q },
        ],
        {
          onToken: (_t, full) => { think.textContent = full || "…"; $("msgs").scrollTop = $("msgs").scrollHeight; },
        }
      );
      think.textContent = full || "(empty response)";
      think.classList.remove("thinking");
    } catch (e) {
      think.classList.remove("thinking");
      think.classList.add("err");
      think.textContent = "AI is unavailable right now. Please try again in a moment.";
    }
  }

  // ---- init ----
  (async () => {
    const pro = await checkPro();
    await loadClips();
    renderGate(!pro);
    renderChat(pro);
    $("chatSend").addEventListener("click", send);
    $("chatInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
    });
    $("gateBtn").addEventListener("click", () => {
      if (WEB) {
        window.open("/#support", "_self");
      } else {
        try { chrome.runtime.sendMessage({ type: "MELLOWTEL_SETTINGS" }); } catch {}
      }
    });

    // live gate: opt-in unlocks the locked window; opt-out re-locks an open one
    if (IS_EXT) {
      chrome.runtime.onMessage.addListener((msg) => {
        if (msg && msg.type === "PRO_STATUS_CHANGED") {
          const on = !!msg.optedIn;
          renderGate(!on);
          renderChat(on);
        }
      });
    } else if (WEB) {
      window.addEventListener("storage", (e) => {
        if (e.key === "clipiq:support") {
          const on = localStorage.getItem("clipiq:support") === "1";
          renderGate(!on);
          renderChat(on);
        }
      });
    }

    // incoming query from popup (?q=)
    const params = new URLSearchParams(location.search);
    const q0 = params.get("q");
    if (q0 && pro) { $("chatInput").value = q0; send(); }
  })();
})();
