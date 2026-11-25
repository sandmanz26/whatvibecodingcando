import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/**
 * Builds the installable script (dist/embed/vibe.js, from this app's own src/core/embed): one self-contained file with no CSS
 * file beside it, so a site needs a single <script> tag. Runs after the app's own build.
 */
export default defineConfig({
  plugins: [react()],
  // Production hardening (docs/SECURITY.md): no debugger statements, console.log/debug/info removed, no licence/comment banners.
  esbuild: { drop: ['debugger'], pure: ['console.log', 'console.debug', 'console.info'], legalComments: 'none' },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    sourcemap: false,
    outDir: '../../dist/content/embed',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: { entry: fileURLToPath(new URL('./src/core/embed/main.tsx', import.meta.url)), formats: ['iife'], name: 'VibeCollab', fileName: () => 'vibe.js' },
  },
})
