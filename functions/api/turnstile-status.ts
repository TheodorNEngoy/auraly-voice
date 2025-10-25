export const onRequestGet: PagesFunction = async (ctx) => {
  const siteKey = (ctx.env as any).NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;
  const hasSecret = !!(ctx.env as any).TURNSTILE_SECRET_KEY;
  return new Response(JSON.stringify({ siteKey, hasSecret }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
};
