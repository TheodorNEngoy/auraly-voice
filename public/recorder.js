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
function updateUploadEnabled() { uploadBtn.disabled = !(hasToken && hasRecording); }

function pickMime() {
  const cands = ["audio/webm;codecs=opus","audio/webm","audio/mp4;codecs=aac","audio/mp4","audio/mpeg"];
  for (const t of cands) if (window.MediaRecorder?.isTypeSupported?.(t)) return t;
  return "";
}

// Render Turnstile and track token state
document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetch("/api/public-config", { cache: "no-store" });
  const { turnstileSiteKey } = await res.json();

  widgetId = turnstile.render("#turnstile-container", {
    sitekey: turnstileSiteKey,
    "response-field": true,
    "response-field-name": "cf-turnstile-response",
    "refresh-expired": "auto",
    callback: () => { hasToken = true; updateUploadEnabled(); },
    "expired-callback": () => { hasToken = false; updateUploadEnabled(); },
    "error-callback":   () => { hasToken = false; updateUploadEnabled(); }
  });
});

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
    alert("Mic permission denied or unsupported browser.");
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
  if (!hasRecording) return alert("Record something first.");

  const token = window.turnstile && widgetId ? window.turnstile.getResponse(widgetId) : "";
  if (!token) {
    statusEl.textContent = "Security check not ready. Try again.";
    return;
  }

  statusEl.textContent = "Uploading...";
  const blob = new Blob(chunks, { type: mediaRec?.mimeType || "audio/webm" });
  const filename = (titleEl.value || "clip") + (blob.type.includes("webm") ? ".webm" : ".m4a");

  const form = new FormData(formEl);
  form.set("cf-turnstile-response", token);
  form.append("file", blob, filename);

  try {
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const body = await res.text().catch(()=> "");
    if (!res.ok) { statusEl.textContent = "Upload failed: " + (body || ""); return; }

    const data = JSON.parse(body || "{}");
    statusEl.innerHTML = `Done! <a href="${data.playback}" target="_blank" rel="noopener">Open</a> • <button id="copyLink">Copy link</button>`;
    document.getElementById("copyLink").onclick = async () => {
      await navigator.clipboard.writeText(location.origin + data.playback);
      statusEl.textContent = "Link copied. Check the Feed!";
    };
    uploadBtn.disabled = true;
  } finally {
    // IMPORTANT: Always refresh token after we consumed it
    if (window.turnstile && widgetId) {
      window.turnstile.reset(widgetId);
      hasToken = false;            // wait for next callback to set true again
      updateUploadEnabled();
    }
  }
};
