export const onRequestGet: PagesFunction<{ DB: D1Database, GOOGLE_CLIENT_ID: string }> = async ({ env, request }) => {
  const clientId = (env as any).GOOGLE_CLIENT_ID as string;
  const redirectUri = new URL("/api/auth/callback", new URL(request.url).origin).toString();

  // PKCE: state + code_challenge
  const rand=(n:number)=>{const a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a).map(b=>b.toString(16).padStart(2,"0")).join("")};
  const base64url=(buf:ArrayBuffer)=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  const code_verifier=rand(32);
  const digest=await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code_verifier));
  const code_challenge=base64url(digest);
  const state=rand(16);

  await env.DB.prepare("INSERT INTO oauth_state(state, code_verifier, created_at) VALUES(?,?,?)")
    .bind(state, code_verifier, new Date().toISOString()).run();

  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", "openid email profile");
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", code_challenge);
  u.searchParams.set("code_challenge_method", "S256");
  return Response.redirect(u.toString(), 302);
};
