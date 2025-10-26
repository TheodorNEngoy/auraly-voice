(() => {
  const startBtn  = document.getElementById("startBtn");
  const stopBtn   = document.getElementById("stopBtn");
  const uploadBtn = document.getElementById("uploadBtn");
  const preview   = document.getElementById("preview");
  const statusEl  = document.getElementById("status");
  const titleEl   = document.getElementById("title");
  const formEl    = document.getElementById("uploadForm");

  let mediaRec = null;
  let chunks = [];
  let widgetId = null;

  let hasToken = false;
  let hasRecording = false;
  let isAuthed = false;

  function updateUploadEnabled() {
    uploadBtn.disabled = !(isAuthed && hasToken && hasRecording);
  }

  function pickMime() {
    const cands = ["audio/webm;codecs=opus","audio/webm","audio/mp4;codecs=aac","audio/mp4","audio/mpeg"];
    for (const t of cands) if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
    return "";
  }

  // reflect auth state from /auth.js
  document.addEventListener("auth:ready", () => {
    isAuthed = !!window.__user;
    updateUploadEnabled();
    if (!isAuthed) statusEl.textContent = "Sign in to upload.";
  });

  // Start first (independent of Turnstile load)
  startBtn.onclick = async () => {
    try {
      chunks = [];
      hasRecording = false; updateUploadEnabled();

      const mimeType = pickMime();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mediaRec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      mediaRec.onstop = () => {
        const blob = new Blob(chunks, { type: mediaRec.mimeType });
        preview.src = URL.createObjectURL(blob);
        hasRecording = true;
        updateUploadEnabled();
        statusEl.textContent = `Ready to upload (${(blob.size/1024).toFixed(1)} KB, ${mediaRec.mimeType})`;
      };

      mediaRec.start(250);
      startBtn.disabled = true; stopBtn.disabled = false;
      statusEl.textContent = "Recording...";
    } catch (e) {
      console.error(e);
      alert((e && (e.name + ": " + e.message)) || "Mic error");
    }
  };

  stopBtn.onclick = () => {
    if (mediaRec && mediaRec.state !== "inactive") {
      mediaRec.stop();
      for (const t of mediaRec.stream.getTracks()) t.stop();
    }
    startBtn.disabled = false; stopBtn.disabled = true;
    statusEl.textContent = "Stopped.";
  };

  formEl.onsubmit = async (ev) => {
    ev.preventDefault();
    if (!isAuthed) { alert("Please sign in first."); return; }
    if (!hasRecording) { alert("Record something first."); return; }

    let token = "";
    try { token = (window.turnstile && widgetId) ? window.turnstile.getResponse(widgetId) : ""; } catch {}
    if (!token) { statusEl.textContent = "Security check not ready. Try again in a second."; return; }

    statusEl.textContent = "Uploading...";
    const blob = new Blob(chunks, { type: mediaRec?.mimeType || "audio/webm" });
    const filename = (titleEl.value || "clip") + (blob.type.includes("webm") ? ".webm" : ".m4a");

    const form = new FormData(formEl);
    form.set("cf-turnstile-response", token);
    form.append("title", titleEl.value || "");
    form.append("file", blob, filename);

    const res  = await fetch("/api/upload", { method: "POST", body: form });
    const body = await res.text().catch(()=> "");
    if (!res.ok) {
      let j; try { j = JSON.parse(body); } catch {}
      const codes = j?.verdict?.["error-codes"]?.join(",") || j?.error || "";
      statusEl.textContent = codes ? `Upload blocked (${codes}).` : "Upload failed.";
      try { if (window.turnstile && widgetId) { window.turnstile.reset(widgetId); hasToken = false; updateUploadEnabled(); } } catch {}
      return;
    }
    const data = JSON.parse(body);
    statusEl.textContent = "Uploaded.";
    uploadBtn.disabled = true;
    if (data?.share) statusEl.innerHTML = `Uploaded. <a href="${data.share}" target="_blank" rel="noopener">Open post</a>`;
  };

  // Turnstile (explicit render)
  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const res = await fetch("/api/public-config", { cache: "no-store" });
      const { turnstileSiteKey } = await res.json();

      const tryRender = () => {
        try {
          if (!window.turnstile) return false;
          widgetId = window.turnstile.render("#turnstile-container", {
            sitekey: turnstileSiteKey,
            "response-field": true,
            "response-field-name": "cf-turnstile-response",
            "refresh-expired": "auto",
            callback: () => { hasToken = true; updateUploadEnabled(); },
            "expired-callback": () => { hasToken = false; updateUploadEnabled(); },
            "error-callback":   () => { hasToken = false; updateUploadEnabled(); }
          });
          return true;
        } catch (e) { console.warn("Turnstile render error", e); return false; }
      };

      if (!tryRender()) {
        let tries = 0;
        const id = setInterval(() => { if (tryRender() || ++tries > 80) clearInterval(id); }, 100);
      }
    } catch (e) { console.warn("Failed to init Turnstile", e); }
  });
})();
