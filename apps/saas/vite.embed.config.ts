import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/**
 * The script ships as ASCII only, other characters written as \u escapes (valid in strings, template
 * literals and regular expressions alike). A host page without a UTF-8 charset reads a script in its
 * own encoding and would show "’" as "â€™".
 */
function asciiOnly(): Plugin {
  return {
    name: 'ascii-only',
    // After minifying, which would turn escapes back into the characters.
    generateBundle(_, bundle) {
      for (const f of Object.values(bundle)) {
        if (f.type === 'chunk') f.code = f.code.replace(/[^\x00-\x7f]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
      }
    },
  }
}

/**
 * Builds the installable script (dist/embed/vibe.js, from this app's own src/core/embed): one self-contained file with no CSS
 * file beside it, so a site needs a single <script> tag. Runs after the app's own build.
 */
export default defineConfig({
  plugins: [react(), asciiOnly()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: '../../dist/saas/embed',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: { entry: fileURLToPath(new URL('./src/core/embed/main.tsx', import.meta.url)), formats: ['iife'], name: 'VibeCollab', fileName: () => 'vibe.js' },
  },
})
