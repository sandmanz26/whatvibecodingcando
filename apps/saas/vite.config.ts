import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { supabaseEnv } from './supabase-env.ts'

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
