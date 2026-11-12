import { loadEnv } from 'vite'

/**
 * Supabase settings for the browser: the project URL and the anon (publishable) key, both public by
 * design (row level security guards the data). They are read from VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY, or from the names Vercel's Supabase integration sets (SUPABASE_URL,
 * SUPABASE_ANON_KEY, NEXT_PUBLIC_…), so either way of connecting works.
 *
 * Only these two values ever reach the browser. The build refuses to run if the "anon" value is
 * really a service role or secret key: that one bypasses row level security and must never ship.
 */
export function supabaseEnv(mode: string) {
  const env: Record<string, string | undefined> = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const key = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '').trim()
  if (key.startsWith('sb_secret_')) throw new Error('Refusing to build: the Supabase key given for the browser is a secret key. Use the anon / publishable key.')
  if (key.split('.').length === 3) {
    let role = ''
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role ?? '' } catch { /* not a JWT */ }
    if (role === 'service_role') throw new Error('Refusing to build: the Supabase key given for the browser is the service_role key. Use the anon key.')
  }
  if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/.test(url.replace(/\/$/, ''))) throw new Error(`Refusing to build: "${url}" doesn't look like a Supabase project URL (https://<ref>.supabase.co).`)
  // A production deployment must never fall back to the browser-only demo without anyone noticing.
  if (env.VERCEL_ENV === 'production' && !(url && key)) throw new Error('Refusing to build for production: the Supabase project URL and anon key are not set (see apps/saas/supabase/README.md).')
  // Shown in the build log (Vercel → Deployments → the build → Logs), never the key itself.
  console.log(url && key ? `[supabase] connected: ${url} (public key, ${key.length} characters)` : `[supabase] not configured${url ? ' (URL set, key missing)' : key ? ' (key set, URL missing)' : ''}: the app keeps using this browser's storage`)
  // Cloudflare Turnstile's site key (public; the secret key goes into Supabase → Auth → Attack Protection only).
  const turnstile = (env.VITE_TURNSTILE_SITE_KEY || '').trim()
  if (turnstile && !/^[0-9A-Za-z_-]{10,100}$/.test(turnstile)) throw new Error('Refusing to build: VITE_TURNSTILE_SITE_KEY doesn’t look like a Turnstile site key.')
  console.log(turnstile ? '[captcha] Turnstile site key set' : '[captcha] off (no VITE_TURNSTILE_SITE_KEY)')
  return { url: url.replace(/\/$/, ''), key, turnstile }
}
