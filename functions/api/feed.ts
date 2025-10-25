export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env, request }) => {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get("limit") || "20", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const res = await env.DB.prepare(
    "SELECT id, title, r2_key as key, content_type, size, created_at, transcript FROM posts ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?"
  ).bind(limit, offset).all();

  const items = (res.results || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    key: r.key,
    playback: `/api/media/${encodeURIComponent(r.key)}`,
    created_at: r.created_at,
    transcript: r.transcript
  }));

  return new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json" } });
};
