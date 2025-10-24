export const onRequestGet: PagesFunction<{ AUDIO: R2Bucket }> = async (context) => {
  const { env } = context;
  const list = await env.AUDIO.list({ prefix: 'raw/', limit: 50 });
  const items = (list.objects || []).sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime()).map(o => ({
    key: o.key,
    size: o.size,
    uploaded: o.uploaded.toISOString(),
    playback: `/api/media/${encodeURIComponent(o.key)}`,
    title: null
  }));
  return new Response(JSON.stringify({ items }), { headers: { 'Content-Type': 'application/json' } });
};
