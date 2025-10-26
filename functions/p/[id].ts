export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env, params, request }) => {
  const id = String((params as any).id || "");
  const row = await env.DB.prepare(
    "SELECT id, title, r2_key, created_at, transcript FROM posts WHERE id = ?"
  ).bind(id).first<any>();

  if (!row) return new Response("Not found", { status: 404, headers: { "content-type": "text/plain" } });

  const origin = new URL(request.url).origin;
  const playback = `${origin}/api/media/${encodeURIComponent(row.r2_key)}`;
  const title = (row.title || "Voice post on Auraly").slice(0, 140);
  const desc  = row.transcript ? (row.transcript.slice(0, 160) + (row.transcript.length>160?"…":"")) : "Listen on Auraly";

  const html = `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escape(title)}</title>
<link rel="stylesheet" href="/styles.css"/>
<meta property="og:title" content="${escape(title)}"/>
<meta property="og:description" content="${escape(desc)}"/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="${origin}/p/${id}"/>
<meta name="twitter:card" content="summary"/>
</head>
<body>
<header class="top"><h1>🎙️ Auraly</h1><nav><a href="/index.html">Record</a> <a href="/feed.html">Feed</a></nav></header>
<main class="card">
  <h2>${escape(title)}</h2>
  <audio controls src="${playback}" style="width:100%"></audio>
  ${row.transcript ? `<h3>Transcript</h3><pre>${escape(row.transcript)}</pre>` : `<p class="muted">No transcript yet.</p>`}
</main>
</body></html>`;

  const csp = "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; "
    + "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com; "
    + "style-src 'self' 'unsafe-inline'; "
    + "img-src 'self' data: https://lh3.googleusercontent.com https://*.googleusercontent.com; "
    + "connect-src 'self' https://challenges.cloudflare.com https://cloudflareinsights.com; "
    + "frame-src https://challenges.cloudflare.com; media-src 'self' blob:";

  return new Response(html, { headers: {
    "content-type": "text/html; charset=utf-8",
    "Content-Security-Policy": csp,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff"
  }});

  function escape(s: string){ return s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] as string)); }
};
