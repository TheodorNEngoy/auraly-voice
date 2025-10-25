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

  function updateUploadEnabled() {
    uploadBtn.disabled = !(hasToken && hasRecording);
  }

  function pickMime() {
    const cands = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4;codecs=aac",
      "audio/mp4",
      "audio/mpeg"
    ];
    for (const t of cands) if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
    return "";
  }

  // --- 1) Wire up handlers FIRST (so Start works even if Turnstile is slow)
  startBtn.onclick = async () => {
    console.log("[recorder] Start clicked");
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
      const msg = (e && (e.name + ": " + e.message)) || "Unknown error";
      statusEl.textContent = msg;
      alert(msg);
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
    if (!hasRecording) { alert("Record something first."); return; }

    // Always ensure a fresh token (explicitly read from widget if present)
    let token = "";
    try {
      token = (window.turnstile && widgetId) ? window.turnstile.getResponse(widgetId) : "";
    } catch {}
    if (!token) {
      statusEl.textContent = "Security check not ready. Wait a moment and try Upload again.";
      return;
    }

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
      const codes = j?.verdict?.["error-codes"]?.join(",") || "";
      statusEl.textContent = codes ? `Upload blocked (${codes}).` : "Upload failed.";
      console.error("Upload failed", body);
      try { if (window.turnstile && widgetId) { window.turnstile.reset(widgetId); hasToken = false; updateUploadEnabled(); } } catch {}
      return;
    }
    const data = JSON.parse(body);
    statusEl.textContent = "Done! Open the Feed to see your post.";
    uploadBtn.disabled = true;

    // Optional: link to share page
    if (data?.share) statusEl.innerHTML = `Uploaded. <a href="${data.share}" target="_blank" rel="noopener">Open post</a>`;
  };

  // --- 2) TURNSTILE (safe, non-fatal). Render after DOM & after api.js loads
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
        } catch (e) {
          console.warn("Turnstile render error", e);
          return false;
        }
      };

      if (!tryRender()) {
        let tries = 0;
        const id = setInterval(() => {
          if (tryRender() || ++tries > 80) clearInterval(id);
        }, 100);
      }
    } catch (e) {
      console.warn("Failed to init Turnstile", e);
    }
  });
})();
