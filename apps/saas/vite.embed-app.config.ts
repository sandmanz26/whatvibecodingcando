import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { supabaseEnv } from './supabase-env.ts'

/**
 * The widget app (dist/embed/vibe-app.js, from src/core/embed/app.tsx): loaded by vibe.js (the small
 * loader) only for browsers that need it: reviewers, study participants, an open widget. One file,
 * no CSS beside it; the loader adds it as a script tag and calls its boot().
 */
function asciiOnly(): Plugin {
  return {
    name: 'ascii-only',
    generateBundle(_, bundle) {
      for (const f of Object.values(bundle)) if (f.type === 'chunk') f.code = f.code.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
    },
  }
}
export default defineConfig(({ mode }) => {
  const sb = supabaseEnv(mode)
  return {
    plugins: [react(), asciiOnly()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(sb.url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(sb.key),
      'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(sb.turnstile),
    },
    build: {
      outDir: '../../dist/embed',
      emptyOutDir: false,
      copyPublicDir: false,
      // An IIFE like vibe.js (fully minified): it hands its boot() to the loader through one global.
      lib: { entry: fileURLToPath(new URL('./src/core/embed/app.tsx', import.meta.url)), formats: ['iife'], name: '__vibeCollabApp', fileName: () => 'vibe-app.js' },
    },
  }
})
