# Auraly (voice-only social) — Cloudflare Pages starter

This repo is ready to deploy on **Cloudflare Pages** with **Pages Functions** and an **R2** bucket.
It records audio in the browser, uploads it via a Functions endpoint to R2, and plays it back.
A simple feed lists the latest uploads from the bucket.

## Deploy on Cloudflare Pages

- **Build command:** `exit 0`
- **Build output directory:** `public`
- **Functions:** enabled (this repo provides `/functions`)
- **Custom domain:** attach e.g. `voice.theodornengoy.com` in Pages → *your project* → **Custom domains**

### Required bindings & env vars

In Pages → *your project* → **Settings → Functions → Bindings**:
- **R2 bucket binding**: Variable name **AUDIO**, select your R2 bucket (e.g., `auraly-audio`)

In Pages → *your project* → **Settings → Environment variables**:
- `TURNSTILE_SECRET_KEY` (server-side)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client-side)

Later (optional):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` (STT v2 service account JSON)

## Local development

You can run `npx wrangler pages dev public --compatibility-date=2025-10-24`
and it will pick up the functions in `/functions`. Add a `.dev.vars` file for local env values.
