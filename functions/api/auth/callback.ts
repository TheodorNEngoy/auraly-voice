export const onRequestGet: PagesFunction<{ DB: D1Database, GOOGLE_CLIENT_ID: string, GOOGLE_CLIENT_SECRET: string, SESSION_SECRET: string }> = async ({ env, request }) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !state) return new Response("Bad request", { status: 400 });

  const row = await env.DB.prepare("SELECT code_verifier FROM oauth_state WHERE state=?").bind(state).first<any>();
  if (!row) return new Response("Invalid state", { status: 400 });

  const redirectUri = new URL("/api/auth/callback", url.origin).toString();
  const tRes = await fetch("https://oauth2.googleapis.com/token", {
    method:"POST", headers:{ "Content-Type":"application/x-www-form-urlencoded" },
    body:new URLSearchParams({
      client_id:(env as any).GOOGLE_CLIENT_ID as string,
      client_secret:(env as any).GOOGLE_CLIENT_SECRET as string,
      grant_type:"authorization_code", code, code_verifier:row.code_verifier, redirect_uri:redirectUri
    })
  });
  if (!tRes.ok) return new Response("Token exchange failed", { status: 401 });
  const token:any = await tRes.json();

  const ui = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers:{ Authorization:`Bearer ${token.access_token}` }
  });
  if (!ui.ok) return new Response("Userinfo failed", { status: 401 });
  const u:any = await ui.json();

  // upsert user
  const now = new Date().toISOString();
  const existing = await env.DB.prepare("SELECT id FROM users WHERE google_sub=? OR email=?").bind(u.sub, u.email||null).first<any>();
  const userId = existing?.id || crypto.randomUUID();
  if (!existing) {
    await env.DB.prepare("INSERT INTO users(id, google_sub, email, name, image_url, created_at) VALUES(?,?,?,?,?,?)")
      .bind(userId, u.sub, u.email||null, u.name||u.given_name||"", u.picture||null, now).run();
  }

  // session 30d
  const sess = crypto.randomUUID().replace(/-/g,"")+crypto.randomUUID().replace(/-/g,"");
  const exp = new Date(Date.now()+30*24*3600*1000).toISOString();
  await env.DB.prepare("INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES(?,?,?,?)")
    .bind(sess, userId, now, exp).run();
  await env.DB.prepare("DELETE FROM oauth_state WHERE state=?").bind(state).run();

  return new Response(null, { status:302, headers:{
    "Location": "/feed.html",
    "Set-Cookie": `s=${sess}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30*24*3600}`
  }});
};
