export const onRequestPost: PagesFunction<{ AUDIO: R2Bucket, TURNSTILE_SECRET_KEY: string }> = async (context) => {
  const { request, env } = context;
  const form = await request.formData();

  const token = String(form.get("cf-turnstile-response") || "");
  const secret = (env.TURNSTILE_SECRET_KEY as string) || "1x0000000000000000000000000000000AA"; // Turnstile TEST secret

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

  const file = form.get("file");
  if (!(file instanceof File)) {
    return new Response(JSON.stringify({ error: "missing_file" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const type = file.type || "audio/webm";
  const ext = type.includes("webm") ? "webm"
            : (type.includes("mp4") || type.includes("aac")) ? "m4a"
            : type.includes("mpeg") || type.includes("mp3") ? "mp3"
            : type.includes("ogg") ? "ogg" : "bin";

  const key = `raw/${crypto.randomUUID()}.${ext}`;
  await env.AUDIO.put(key, file.stream(), { httpMetadata: { contentType: type } });

  return new Response(JSON.stringify({ key, playback: `/api/media/${encodeURIComponent(key)}` }), {
    headers: { "Content-Type": "application/json" }
  });
};
