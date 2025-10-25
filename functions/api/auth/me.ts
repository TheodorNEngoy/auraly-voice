export const onRequestGet: PagesFunction<{ DB: D1Database }> = async ({ env, request }) => {
  const m = /(?:^|;\s*)s=([^;]+)/.exec(request.headers.get("Cookie")||"");
  const token = m?.[1] || "";
  if (!token) return new Response("Unauthorized", { status: 401 });
  const row = await env.DB.prepare(`
    SELECT u.id, u.email, u.name, u.image_url
    FROM sessions s JOIN users u ON u.id=s.user_id
    WHERE s.token=? AND datetime(s.expires_at)>datetime('now')
  `).bind(token).first<any>();
  if (!row) return new Response("Unauthorized", { status: 401 });
  return new Response(JSON.stringify(row), { headers:{ "Content-Type":"application/json", "Cache-Control":"no-store" }});
};
