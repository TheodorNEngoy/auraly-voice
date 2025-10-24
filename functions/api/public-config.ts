const TEST_SITE = "1x00000000000000000000AA"; // Cloudflare Turnstile test key (always passes)

export const onRequestGet: PagesFunction = async (ctx) => {
  const siteKey = (ctx.env as any).NEXT_PUBLIC_TURNSTILE_SITE_KEY || TEST_SITE;
  return new Response(JSON.stringify({ turnstileSiteKey: siteKey }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
