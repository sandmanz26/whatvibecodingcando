import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Supabase settings for the browser: the project URL and the anon (publishable) key, both public by
 * design (row level security guards the data). They are read from VITE_SUPABASE_URL /
 * VITE_SUPABASE_ANON_KEY, or from the names Vercel's Supabase integration sets (SUPABASE_URL,
 * SUPABASE_ANON_KEY, NEXT_PUBLIC_…), so either way of connecting works.
 *
 * Only these two values ever reach the browser. The build refuses to run if the "anon" value is
 * really a service role or secret key: that one bypasses row level security and must never ship.
 */
function supabaseEnv(mode: string) {
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
  // Shown in the build log (Vercel → Deployments → the build → Logs), never the key itself.
  console.log(url && key ? `[supabase] connected: ${url} (public key, ${key.length} characters)` : `[supabase] not configured${url ? ' (URL set, key missing)' : key ? ' (key set, URL missing)' : ''}: the app keeps using this browser's storage`)
  return { url: url.replace(/\/$/, ''), key }
}

/**
 * The SaaS is the deployment's main site: it builds into the root of the repository's dist, served
 * at "/". The content site lives in dist/content beside it, so this build must not empty dist (the
 * root build script cleans dist once, before both apps build).
 */
export default defineConfig(({ mode }) => {
  const sb = supabaseEnv(mode)
  return {
    plugins: [react()],
    base: './',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(sb.url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(sb.key),
    },
    build: { outDir: '../../dist', emptyOutDir: false },
  }
})
