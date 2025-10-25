export const onRequestPost: PagesFunction<{ DB: D1Database }> = async ({ env, request }) => {
  const m = /(?:^|;\s*)s=([^;]+)/.exec(request.headers.get("Cookie")||"");
  const token = m?.[1] || "";
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(token).run();
  return new Response(null, { headers:{ "Set-Cookie":"s=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" }});
};
