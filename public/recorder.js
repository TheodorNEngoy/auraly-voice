const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const uploadBtn = document.getElementById("uploadBtn");
const preview = document.getElementById("preview");
const statusEl = document.getElementById("status");
const titleEl = document.getElementById("title");
const formEl = document.getElementById("uploadForm");

let mediaRec = null;
let chunks = [];
let widgetId = null;

function pickMime() {
  const cands = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=aac",
    "audio/mp4",
    "audio/mpeg"
  ];
  for (const t of cands) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

async function renderTurnstile() {
  // Ask server for site key; it falls back to the official Cloudflare TEST key
  const res = await fetch("/api/public-config", { cache: "no-store" });
  const { turnstileSiteKey } = await res.json();

  const mount = () => {
    if (!window.turnstile) return;
    widgetId = window.turnstile.render("#turnstile-container", {
      sitekey: turnstileSiteKey
    });
  };

  if (window.turnstile && window.turnstile.ready) {
    window.turnstile.ready(mount);
  } else {
    window.addEventListener("load", () => {
      if (window.turnstile && window.turnstile.ready) window.turnstile.ready(mount);
      else mount();
    });
  }
}
renderTurnstile();

startBtn.onclick = async () => {
  try {
    chunks = [];
    const mimeType = pickMime();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    mediaRec.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRec.mimeType });
      preview.src = URL.createObjectURL(blob);
      uploadBtn.disabled = false;
      statusEl.textContent = `Ready to upload (${(blob.size/1024).toFixed(1)} KB, ${mediaRec.mimeType})`;
    };
    mediaRec.start(250);
    startBtn.disabled = true; stopBtn.disabled = false; uploadBtn.disabled = true;
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
  if (!chunks.length) return alert("Record something first.");

  const blob = new Blob(chunks, { type: mediaRec?.mimeType || "audio/webm" });
  statusEl.textContent = "Uploading...";

  // IMPORTANT: Build FormData from the FORM so the hidden cf-turnstile-response is included
  const form = new FormData(formEl);

  // Extra safety: if the hidden field didn't get injected, fetch it manually
  if (!form.get("cf-turnstile-response") && window.turnstile && widgetId) {
    const token = window.turnstile.getResponse(widgetId);
    if (token) form.set("cf-turnstile-response", token);
  }

  const filename = (titleEl.value || "clip") + (blob.type.includes("webm") ? ".webm" : ".m4a");
  form.append("file", blob, filename);

  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const msg = await res.text();
    console.error("Upload failed", msg);
    statusEl.textContent = "Upload failed.";
    return;
  }
  const data = await res.json();
  statusEl.textContent = "Done! Open the Feed to see your post.";
  uploadBtn.disabled = true;
};
