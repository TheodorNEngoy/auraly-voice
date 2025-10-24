function parseRange(range: string | null, size: number) {
  if (!range || !range.startsWith('bytes=')) return null;
  const [startStr, endStr] = range.replace('bytes=', '').split('-', 2);
  let start = startStr ? parseInt(startStr, 10) : 0;
  let end = endStr ? parseInt(endStr, 10) : size - 1;
  if (isNaN(start)) start = 0;
  if (isNaN(end) || end >= size) end = size - 1;
  if (start > end) return null;
  return { start, end };
}

export const onRequestGet: PagesFunction<{ AUDIO: R2Bucket }> = async (context) => {
  const { request, env, params } = context;
  const key = decodeURIComponent((params as any).key as string);
  const head = await env.AUDIO.head(key);
  if (!head) return new Response('Not found', { status: 404 });

  const size = head.size;
  const rangeHeader = request.headers.get('Range');
  let resBody: ReadableStream | null = null;
  let status = 200;
  let headers: Record<string, string> = {
    'Accept-Ranges': 'bytes',
    'Content-Type': head.httpMetadata?.contentType || 'application/octet-stream',
    'Cache-Control': 'public, max-age=3600',
  };

  const parsed = parseRange(rangeHeader, size);
  if (parsed) {
    const { start, end } = parsed;
    const obj = await env.AUDIO.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!obj) return new Response('Not found', { status: 404 });
    resBody = obj.body as ReadableStream;
    status = 206;
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    headers['Content-Length'] = String(end - start + 1);
  } else {
    const obj = await env.AUDIO.get(key);
    if (!obj) return new Response('Not found', { status: 404 });
    resBody = obj.body as ReadableStream;
    headers['Content-Length'] = String(size);
  }

  return new Response(resBody, { status, headers });
};
