export const onRequestGet: PagesFunction<{ AUDIO: R2Bucket }> = async (ctx) => {
  const out: any = {};
  try {
    const hasBinding = (ctx.env as any).AUDIO && typeof (ctx.env as any).AUDIO.put === "function";
    out.bindingPresent = !!hasBinding;

    if (hasBinding) {
      try {
        const key = `diag/${crypto.randomUUID()}.txt`;
        await ctx.env.AUDIO.put(key, new TextEncoder().encode("ok"), { httpMetadata: { contentType: "text/plain" } });
        out.putOk = true;
        out.testKey = key;
      } catch (e: any) {
        out.putOk = false;
        out.putError = String(e?.message || e);
      }
    }
  } catch (e: any) {
    out.error = String(e?.message || e);
  }
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
};
