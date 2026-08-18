// ClipIQ — options page
(function () {
  // WEB = demo context (demo shell sets isWebDemo) OR any non-extension host
  // (e.g. someone opens /clipiq/options.html directly on the demo server,
  // where chrome.* APIs don't exist). Both fall back to localStorage.
  const HAS_CHROME = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  const WEB = !HAS_CHROME || (typeof window !== "undefined" && window.isWebDemo === true);
  const $ = (id) => document.getElementById(id);

  const DEFAULTS = {
    blockedSites: [],
    theme: "system",
    maxClips: 500,
  };

  let settings = { ...DEFAULTS };
  let snippets = [];
  let clips = [];

  async function load() {
    let d = {};
    if (WEB) {
      try {
        d = {
          settings: JSON.parse(localStorage.getItem("clipiq:settings") || "{}"),
          snippets: JSON.parse(localStorage.getItem("clipiq:snippets") || "[]"),
          clips: JSON.parse(localStorage.getItem("clipiq:clips") || "[]"),
        };
      } catch {}
    } else {
      d = await chrome.storage.local.get(["settings", "snippets", "clips"]);
    }
    settings = { ...DEFAULTS, ...(d.settings || {}) };
    snippets = d.snippets || [];
    clips = d.clips || [];
    $("blocked").value = (settings.blockedSites || []).join("\n");
    $("theme").value = settings.theme || "system";
    $("maxClips").value = settings.maxClips || 500;
    $("clipCount").textContent = clips.length + " clips stored";
    renderSnippets();
    applyTheme();
  }

  function applyTheme() {
    const t = $("theme").value || "system";
    const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }

  async function save() {
    settings.blockedSites = $("blocked").value.split("\n").map((s) => s.trim()).filter(Boolean);
    settings.theme = $("theme").value;
    settings.maxClips = Math.max(50, Math.min(2000, parseInt($("maxClips").value, 10) || 500));
    if (WEB) {
      localStorage.setItem("clipiq:settings", JSON.stringify(settings));
    } else {
      await chrome.storage.local.set({ settings });
    }
    applyTheme();
  }

  function renderSnippets() {
    const el = $("snipRows");
    if (!snippets.length) {
      el.innerHTML = '<p class="muted">No snippets yet — add one below.</p>';
      return;
    }
    el.innerHTML = snippets
      .map(
        (s, i) =>
          '<div class="snip-row" data-i="' + i + '"><span class="trig">' + esc(s.trigger) + '</span><span class="txt">' +
          esc(s.text) + '</span>' +
          '<button class="del" data-act="edit" data-i="' + i + '" title="Edit">✏</button>' +
          '<button class="del" data-act="del" data-i="' + i + '" title="Remove">🗑</button></div>'
      )
      .join("");
    el.querySelectorAll(".del").forEach((b) =>
      b.addEventListener("click", async () => {
        const i = parseInt(b.dataset.i, 10);
        if (b.dataset.act === "edit") {
          // load into the add-row for editing
          editingIndex = i;
          $("snipTrigger").value = snippets[i].trigger;
          $("snipText").value = snippets[i].text;
          $("snipAdd").textContent = "Save";
          $("snipTrigger").focus();
        } else {
          if (editingIndex === i) resetEditRow();
          snippets.splice(i, 1);
          await persistSnippets();
          renderSnippets();
        }
      })
    );
  }

  let editingIndex = -1;
  function resetEditRow() {
    editingIndex = -1;
    $("snipTrigger").value = "";
    $("snipText").value = "";
    $("snipAdd").textContent = "Add";
  }

  async function persistSnippets() {
    if (WEB) localStorage.setItem("clipiq:snippets", JSON.stringify(snippets));
    else await chrome.storage.local.set({ snippets });
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // --- wiring ---
  ["blocked", "theme", "maxClips"].forEach((id) => $(id).addEventListener("change", save));

  $("snipAdd").addEventListener("click", async () => {
    const trig = $("snipTrigger").value.trim();
    const text = $("snipText").value.trim();
    if (!trig.startsWith(";")) { $("snipTrigger").focus(); return; }
    if (!text) { $("snipText").focus(); return; }
    if (editingIndex >= 0) {
      snippets[editingIndex] = { ...snippets[editingIndex], trigger: trig, text };
      resetEditRow();
    } else {
      snippets = snippets.filter((s) => s.trigger !== trig);
      snippets.push({ id: "s_" + Date.now(), trigger: trig, text });
    }
    $("snipTrigger").value = "";
    $("snipText").value = "";
    await persistSnippets();
    renderSnippets();
  });

  $("clearAll").addEventListener("click", async () => {
    if (!confirm("Delete ALL clips permanently?")) return;
    clips = [];
    if (WEB) localStorage.setItem("clipiq:clips", "[]");
    else await chrome.storage.local.set({ clips: [] });
    $("clipCount").textContent = "0 clips stored";
  });

  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ clips, snippets, settings }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "clipiq-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("importFile").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = async () => {
      try {
        const d = JSON.parse(rd.result);
        if (Array.isArray(d.snippets)) snippets = d.snippets;
        if (d.settings) settings = { ...settings, ...d.settings };
        if (WEB) {
          localStorage.setItem("clipiq:snippets", JSON.stringify(snippets));
          localStorage.setItem("clipiq:settings", JSON.stringify(settings));
        } else {
          await chrome.storage.local.set({ snippets, settings });
        }
        renderSnippets();
        $("clipCount").textContent = "imported ✅";
      } catch {
        alert("Invalid backup file");
      }
    };
    rd.readAsText(f);
  });

  document.addEventListener("DOMContentLoaded", load);
})();
