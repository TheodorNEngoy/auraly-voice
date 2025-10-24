export const onRequestPost: PagesFunction<{ AUDIO: R2Bucket, TURNSTILE_SECRET_KEY: string }> = async (context) => {
  try {
    const { request, env } = context;
    const form = await request.formData();

    // --- 1) Verify Turnstile
    const token = String(form.get("cf-turnstile-response") || "");
    const secret = (env.TURNSTILE_SECRET_KEY as string) || "1x0000000000000000000000000000000AA"; // TEST secret (always passes)
    const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
    });
    const verdict = await verifyRes.json<any>();
    if (!verdict.success) {
      return new Response(JSON.stringify({ error: "bot_check_failed", verdict, hasToken: !!token }), {
        status: 403, headers: { "Content-Type": "application/json" }
      });
    }

    // --- 2) Validate file
    const file = form.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "missing_file" }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    // --- 3) Prepare object metadata
    const type = file.type || "audio/webm";
    const ext = type.includes("webm") ? "webm"
              : (type.includes("mp4") || type.includes("aac")) ? "m4a"
              : type.includes("mpeg") || type.includes("mp3") ? "mp3"
              : type.includes("ogg") ? "ogg" : "bin";
    const key = `raw/${crypto.randomUUID()}.${ext}`;

    // --- 4) Safety: ensure R2 binding exists
    const bindingPresent = (env as any).AUDIO && typeof (env as any).AUDIO.put === "function";
    if (!bindingPresent) {
      return new Response(JSON.stringify({ error: "storage_binding_missing", hint: "Check wrangler.toml [[r2_buckets]] and bucket name" }), {
        status: 500, headers: { "Content-Type": "application/json" }
      });
    }

    // --- 5) Put using ArrayBuffer (known-length) to avoid stream length issues
    const data = await file.arrayBuffer();
    await env.AUDIO.put(key, data, { httpMetadata: { contentType: type } });

    const playback = `/api/media/${encodeURIComponent(key)}`;
    return new Response(JSON.stringify({ key, playback }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "exception", message: err?.message || String(err) }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
};
