import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { supabaseEnv } from './supabase-env.ts'

/**
 * The SaaS builds into the root of the repository's dist. Its page is app.html, served at /app
 * (vercel.json); the site's root is the website (apps/landing). Its public files stay at the root:
 * /embed/vibe.js (customers' snippets), /embed-demo.html. The content site lives in dist/content
 * beside it, so this build must not empty dist (the root build script cleans dist once).
 */
export default defineConfig(({ mode }) => {
  const sb = supabaseEnv(mode)
  return {
    plugins: [react()],
    base: './',
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(sb.url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(sb.key),
      'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(sb.turnstile),
    },
    build: { outDir: '../../dist', emptyOutDir: false, rollupOptions: { input: 'app.html' } },
    server: { open: '/app.html' },
  }
})
