export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env, request }) => {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get("limit") || "20", 10)));
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const res = await env.DB.prepare(
    `SELECT p.id, p.title, p.r2_key as key, p.content_type, p.size, p.created_at, p.transcript,
            u.id as user_id, u.name as user_name, u.image_url as user_image
       FROM posts p LEFT JOIN users u ON u.id = p.user_id
      ORDER BY datetime(p.created_at) DESC
      LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  const items = (res.results || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    key: r.key,
    playback: `/api/media/${encodeURIComponent(r.key)}`,
    created_at: r.created_at,
    transcript: r.transcript,
    author: r.user_id ? { id: r.user_id, name: r.user_name, image_url: r.user_image } : null
  }));

  return new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json" } });
};
