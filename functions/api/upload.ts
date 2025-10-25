export const onRequestPost: PagesFunction<{ AUDIO: R2Bucket, TURNSTILE_SECRET_KEY: string, NEXT_PUBLIC_TURNSTILE_SITE_KEY: string, UPLOAD_LIMIT: any }> = async (context) => {
  try {
    const { request, env } = context;

    // --- Rate limit: 5 uploads/min per IP ---
    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    const rl = await (env as any).UPLOAD_LIMIT.limit({ key: `ip:${ip}:upload` });
    if (!rl?.success) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 429, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      });
    }

    const form = await request.formData();

    // --- Turnstile: require real secret in prod, allow test in preview ---
    const siteKey = (env as any).NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
    const IS_TEST = siteKey === "1x00000000000000000000AA";
    let secret: string | undefined = (env.TURNSTILE_SECRET_KEY as string | undefined);
    if (IS_TEST && !secret) secret = "1x0000000000000000000000000000000AA";
    if (!secret) {
      return new Response(JSON.stringify({ error: "server_missing_secret" }), { status: 500, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
    }

    const token = String(form.get("cf-turnstile-response") || "");
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const verdict = await verifyRes.json<any>();
    if (!verdict.success) {
      return new Response(JSON.stringify({ error: "bot_check_failed", verdict, hasToken: !!token }), {
        status: 403, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
      });
    }

    // --- File validation (12MB cap + common audio types) ---
    const file = form.get("file");
    if (!(file instanceof File)) return new Response(JSON.stringify({ error: "missing_file" }), { status: 400, headers: { "Content-Type": "application/json" } });

    const maxBytes = 12 * 1024 * 1024;
    if (file.size > maxBytes) return new Response(JSON.stringify({ error: "too_large", limit: maxBytes }), { status: 413, headers: { "Content-Type": "application/json" } });

    const allowed = ["audio/webm", "audio/mpeg", "audio/mp4", "audio/aac", "audio/ogg"];
    const t = file.type || "application/octet-stream";
    if (!allowed.some(a => t.startsWith(a))) return new Response(JSON.stringify({ error: "unsupported_type", type: t }), { status: 415, headers: { "Content-Type": "application/json" } });

    const ext = t.includes("webm") ? "webm" : (t.includes("mp4") || t.includes("aac")) ? "m4a" : t.includes("mpeg") || t.includes("mp3") ? "mp3" : t.includes("ogg") ? "ogg" : "bin";
    const key = `raw/${crypto.randomUUID()}.${ext}`;

    const data = await file.arrayBuffer();
    await env.AUDIO.put(key, data, { httpMetadata: { contentType: t } });

    return new Response(JSON.stringify({ key, playback: `/api/media/${encodeURIComponent(key)}` }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "exception", message: err?.message || String(err) }), {
      status: 500, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
    });
  }
};
