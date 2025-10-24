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

// Render Turnstile explicitly AFTER the script has loaded (defer) and DOM is ready
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("/api/public-config", { cache: "no-store" });
    const { turnstileSiteKey } = await res.json();

    // With defer, api.js executes before DOMContentLoaded, so window.turnstile should exist now.
    if (window.turnstile) {
      widgetId = window.turnstile.render("#turnstile-container", {
        sitekey: turnstileSiteKey,
        "refresh-expired": "auto"
      });
    } else {
      // Fallback: poll briefly in case of slow network
      let tries = 0;
      const id = setInterval(() => {
        if (window.turnstile) {
          clearInterval(id);
          widgetId = window.turnstile.render("#turnstile-container", {
            sitekey: turnstileSiteKey,
            "refresh-expired": "auto"
          });
        } else if (++tries > 100) {
          clearInterval(id);
          console.warn("Turnstile did not load yet");
        }
      }, 50);
    }
  } catch (e) {
    console.error("Failed to fetch public config", e);
  }
});

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

  // Ensure the Turnstile token is present before submitting
  const hidden = formEl.querySelector('input[name="cf-turnstile-response"]');
  let token = hidden ? hidden.value : "";
  if (!token && window.turnstile && widgetId) {
    token = window.turnstile.getResponse(widgetId);
    if (token) {
      // Ensure it is included in the form
      if (hidden) hidden.value = token;
      else {
        const h = document.createElement("input");
        h.type = "hidden";
        h.name = "cf-turnstile-response";
        h.value = token;
        formEl.appendChild(h);
      }
    }
  }
  if (!token) {
    statusEl.textContent = "Security check not ready. Please wait a second and try Upload again.";
    return;
  }

  statusEl.textContent = "Uploading...";
  const blob = new Blob(chunks, { type: mediaRec?.mimeType || "audio/webm" });
  const filename = (titleEl.value || "clip") + (blob.type.includes("webm") ? ".webm" : ".m4a");

  const form = new FormData(formEl);      // includes the hidden token now
  form.append("file", blob, filename);

  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const msg = await res.text().catch(()=> "");
    console.error("Upload failed", msg);
    statusEl.textContent = "Upload failed.";
    return;
  }
  const data = await res.json();
  statusEl.textContent = "Done! Open the Feed to see your post.";
  uploadBtn.disabled = true;
};
