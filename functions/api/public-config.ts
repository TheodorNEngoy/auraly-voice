export const onRequestGet: PagesFunction = async (context) => {
  const siteKey = context.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined;
  return new Response(JSON.stringify({ turnstileSiteKey: siteKey || null }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
};
