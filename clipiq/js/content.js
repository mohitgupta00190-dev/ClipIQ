// ClipIQ — content script: clipboard capture + paste-back + snippet expansion
(function () {
  if (window.__clipiqLoaded) return;
  window.__clipiqLoaded = true;

  let lastCaretTarget = null;

  function editable(el) {
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = (el.tagName || "").toLowerCase();
    return tag === "input" || tag === "textarea" || tag === "select";
  }

  // ---------- CAPTURE LAYER 1: copy/cut events ----------
  // Fires for Ctrl+C, right-click → Copy, and Edit-menu copies on the page.
  document.addEventListener(
    "copy",
    () => {
      try {
        const sel = document.getSelection();
        const text = sel ? sel.toString() : "";
        if (text && text.trim()) {
          chrome.runtime.sendMessage({ type: "CAPTURE_COPY", text: text });
        }
      } catch {}
    },
    true
  );
  document.addEventListener(
    "cut",
    () => {
      try {
        const sel = document.getSelection();
        const text = sel ? sel.toString() : "";
        if (text && text.trim()) {
          chrome.runtime.sendMessage({ type: "CAPTURE_COPY", text: text });
        }
      } catch {}
    },
    true
  );

  // ---------- CAPTURE LAYER 2: keydown fallback for non-selection copies ----------
  // Pages can preventDefault the copy event; a keydown Ctrl/Cmd+C still tells
  // the background "a copy just happened — go read the clipboard".
  document.addEventListener(
    "keydown",
    (e) => {
      const isCopy = (e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C");
      if (!isCopy) return;
      try {
        chrome.runtime.sendMessage({ type: "COPY_KEY_PRESSED" });
      } catch {}
    },
    true
  );

  document.addEventListener(
    "focusin",
    (e) => {
      if (editable(e.target)) {
        lastCaretTarget = e.target;
        try {
          chrome.runtime.sendMessage({ type: "CONTENT_FOCUS" });
        } catch {}
      }
    },
    true
  );

  function insertAtCaret(target, text) {
    if (!target) return false;
    target.focus();
    // record selection for restore-based insertion
    const doc = target.ownerDocument;
    let inserted = false;
    if (target.isContentEditable || (doc && doc.activeElement === target)) {
      try {
        // capture current selection inside the target first
        const sel = doc.getSelection ? doc.getSelection() : null;
        if (sel && sel.rangeCount > 0 && target.contains(sel.anchorNode)) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          const node = doc.createTextNode(text);
          range.insertNode(node);
          range.setStartAfter(node);
          range.setEndAfter(node);
          sel.removeAllRanges();
          sel.addRange(range);
          inserted = true;
        }
      } catch {}
    }
    if (!inserted && typeof target.setRangeText === "function") {
      const start = target.selectionStart != null ? target.selectionStart : target.value.length;
      target.setRangeText(text, start, start, "end");
      inserted = true;
    }
    if (!inserted && document.execCommand) {
      document.execCommand("insertText", false, text);
      inserted = true;
    }
    if (inserted) {
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }
    return inserted;
  }

  // ---------- CAPTURE LAYER 3: read the clipboard content from input context ----------
  // When the user copies the VALUE of an input/textarea (e.g. a password field
  // on a non-blocked site, or select-all in a text box), the copy event's
  // selection.toString() misses it — the selection lives inside the control.
  // On COPY_KEY_PRESSED with focus in an editable, background asks us for the
  // control's selected substring.
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "GET_FIELD_SELECTION") {
      try {
        const el = lastCaretTarget;
        if (el && typeof el.value === "string") {
          const s = el.selectionStart, t = el.selectionEnd;
          if (s != null && t != null && t > s) {
            sendResponse({ ok: true, text: el.value.slice(s, t) });
            return;
          }
        }
        const sel = document.getSelection();
        const text = sel ? sel.toString() : "";
        sendResponse({ ok: true, text: text || "" });
      } catch {
        sendResponse({ ok: false, text: "" });
      }
      return;
    }
    if (msg && msg.type === "INSERT_TEXT") {
      const ok = insertAtCaret(lastCaretTarget, msg.text);
      sendResponse({ ok });
    }
  });

  // --- snippet expansion ---
  let snippets = [];
  function loadSnippets() {
    try {
      chrome.storage.local.get(["snippets"], (d) => {
        snippets = (d && d.snippets) || [];
      });
    } catch {}
  }
  loadSnippets();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.snippets) loadSnippets();
  });


  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === " " || e.key === "Enter" || e.key === "Tab") {
        // run BEFORE the separator lands; if we expand, we preventDefault so
        // the separator is inserted by us (once), not by the browser
        if (tryExpand(e.target, e.key)) e.preventDefault();
      }
    },
    true
  );

  function tryExpand(el, sep) {
    if (!editable(el)) return false;
    if (el.isContentEditable) return false; // expansion limited to text inputs/areas for reliability
    if (typeof el.value !== "string" || el.selectionStart == null || el.selectionStart !== el.selectionEnd) return false;
    const caret = el.selectionStart;
    const before = el.value.slice(0, caret);
    // trigger must sit immediately before the caret, preceded by start-of-string
    // or whitespace. The separator (space/enter/tab) hasn't been inserted yet.
    const m = /(^|\s)(;[a-z0-9_-]{1,30})$/i.exec(before);
    if (!m) return false;
    const trigger = m[2].toLowerCase();
    const snip = snippets.find((s) => (s.trigger || "").toLowerCase() === trigger);
    if (!snip) return false;
    const start = caret - trigger.length;
    const tail = sep === " " ? " " : sep === "Enter" ? "\n" : ""; // Tab: no separator
    const next = before.slice(0, start) + snip.text + tail + el.value.slice(caret);
    el.value = next;
    let caret2 = before.slice(0, start).length + snip.text.length;
    if (sep === "Enter") caret2 += 1; // place caret on the new line
    try {
      el.setSelectionRange(caret2, caret2);
    } catch {}
    el.dispatchEvent(new Event("input", { bubbles: true }));
    // brief highlight pulse to signal expansion
    const oldBg = el.style.boxShadow;
    el.style.boxShadow = "0 0 0 2px rgba(108,92,231,.5)";
    setTimeout(() => (el.style.boxShadow = oldBg || ""), 350);
    return true;
  }
})();
