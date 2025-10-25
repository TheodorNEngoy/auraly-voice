function parseRange(range: string | null, size: number) {
  if (!range || !range.startsWith("bytes=")) return null;
  const [startStr, endStr] = range.replace("bytes=", "").split("-", 2);
  let start = startStr ? parseInt(startStr, 10) : 0;
  let end = endStr ? parseInt(endStr, 10) : size - 1;
  if (isNaN(start)) start = 0;
  if (isNaN(end) || end >= size) end = size - 1;
  if (start > end) return null;
  return { start, end };
}

export const onRequestGet: PagesFunction<{ AUDIO: R2Bucket }> = async (context) => {
  const { request, env, params } = context;
  const seg = (params as any).key;
  const path = Array.isArray(seg) ? seg.join("/") : String(seg || "");
  const key = decodeURIComponent(path);

  const head = await env.AUDIO.head(key);
  if (!head) return new Response("Not found", { status: 404 });

  const size = head.size;

  // Cloudflare recommends httpEtag when emitting a header (already quoted)
  const etag = (head as any).httpEtag || (head as any).etag || "";
  const inmRaw = request.headers.get("If-None-Match") || "";
  const norm = (s: string) => s.trim().replace(/^W\//, "");
  const inmList = inmRaw.split(",").map(norm);
  const myTag  = norm(etag);

  const baseHeaders: Record<string,string> = {
    "Accept-Ranges": "bytes",
    "Content-Type": head.httpMetadata?.contentType || "application/octet-stream",
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (etag) baseHeaders["ETag"] = etag;

  // Conditional GET: return 304 if any tag matches
  if (etag && inmList.includes(myTag)) {
    return new Response(null, { status: 304, headers: baseHeaders });
  }

  const rangeHeader = request.headers.get("Range");
  const r = parseRange(rangeHeader, size);
  if (r) {
    const { start, end } = r;
    const obj = await env.AUDIO.get(key, { range: { offset: start, length: end - start + 1 } });
    if (!obj) return new Response("Not found", { status: 404 });
    return new Response(obj.body as ReadableStream, {
      status: 206,
      headers: { ...baseHeaders, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }

  const obj = await env.AUDIO.get(key);
  if (!obj) return new Response("Not found", { status: 404 });
  return new Response(obj.body as ReadableStream, {
    status: 200,
    headers: { ...baseHeaders, "Content-Length": String(size) },
  });
};
