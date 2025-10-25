export const onRequestPost: PagesFunction<{ DB: D1Database, AUDIO: R2Bucket, AI: any }> = async ({ env, request }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return new Response(JSON.stringify({ error: "missing_id" }), { status: 400, headers: { "Content-Type": "application/json" } });

    // Look up the post to get the R2 key
    const row = await env.DB.prepare("SELECT r2_key, transcript FROM posts WHERE id = ?").bind(id).first<any>();
    if (!row)  return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "Content-Type": "application/json" } });
    if (row.transcript) return new Response(JSON.stringify({ text: row.transcript, cached: true }), { headers: { "Content-Type": "application/json" } });

    // Fetch audio bytes from R2
    const obj = await env.AUDIO.get(row.r2_key);
    if (!obj)  return new Response(JSON.stringify({ error: "audio_missing" }), { status: 404, headers: { "Content-Type": "application/json" } });
    const buf = await obj.arrayBuffer();    // R2ObjectBody has arrayBuffer()
    const audio = [...new Uint8Array(buf)];

    // Run Whisper via Workers AI
    const result = await (env as any).AI.run("@cf/openai/whisper", { audio });
    const text: string = String((result && result.text) || "").trim();

    // Save back to D1
    const now = new Date().toISOString();
    await env.DB.prepare("UPDATE posts SET transcript = ?, transcribed_at = ? WHERE id = ?").bind(text, now, id).run();

    return new Response(JSON.stringify({ text }), { headers: { "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: "exception", message: e?.message || String(e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
