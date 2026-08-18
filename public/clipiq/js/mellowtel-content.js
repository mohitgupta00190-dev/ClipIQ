// ClipIQ — Mellowtel content script (consensual support layer).
// Runs at document_start in an isolated world; does not touch page content.
// Opt-in/out is managed by the user on the support page — never by us.
(async () => {
  try {
    if (typeof Mellowtel === "undefined") return; // lib not loaded (shouldn't happen)
    const m = new (Mellowtel.default || Mellowtel)("intgr-zDEGSxJqid");
    await m.initContentScript();
  } catch (e) {
    // never break the host page
  }
})();
