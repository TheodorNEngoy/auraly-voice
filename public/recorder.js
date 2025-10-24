const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const uploadBtn = document.getElementById('uploadBtn');
const preview = document.getElementById('preview');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('title');

let mediaRec = null;
let chunks = [];
let mimeType = '';

function pickMime() {
  const cands = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=aac',
    'audio/mp4',
    'audio/mpeg'
  ];
  for (const t of cands) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

startBtn.onclick = async () => {
  try {
    chunks = [];
    mimeType = pickMime();
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
    statusEl.textContent = 'Recording...';
  } catch (e) {
    console.error(e);
    alert('Mic permission denied or unsupported browser.');
  }
};

stopBtn.onclick = () => {
  if (mediaRec && mediaRec.state !== 'inactive') {
    mediaRec.stop();
    for (const t of mediaRec.stream.getTracks()) t.stop();
  }
  startBtn.disabled = false; stopBtn.disabled = true;
  statusEl.textContent = 'Stopped.';
};

uploadBtn.onclick = async () => {
  if (!chunks.length) return;
  const blob = new Blob(chunks, { type: mediaRec?.mimeType || 'audio/webm' });
  statusEl.textContent = 'Uploading...';

  const form = new FormData();
  form.append('file', blob, (titleEl.value || 'clip') + (blob.type.includes('webm') ? '.webm' : '.m4a'));
  // Turnstile injects a hidden input named 'cf-turnstile-response' into the form automatically
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) { alert('Upload failed'); return; }
  const data = await res.json();
  statusEl.textContent = 'Done! Open the Feed to see your post.';
  uploadBtn.disabled = true;
};


async function renderTurnstile() {
  try {
    const res = await fetch('/api/public-config');
    const cfg = await res.json();
    const siteKey = cfg.turnstileSiteKey;
    if (!siteKey) {
      console.warn('Turnstile site key not set; uploads will be blocked.');
      return;
    }
    const container = document.getElementById('turnstile-container');
    const render = () => window.turnstile && window.turnstile.render(container, { sitekey: siteKey });
    if (window.turnstile) render();
    else window.addEventListener('load', render);
  } catch(e){ console.error(e); }
}

renderTurnstile();
