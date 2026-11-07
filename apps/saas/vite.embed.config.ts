import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

/**
 * Builds the installable script (dist/embed/vibe.js, from packages/core): one self-contained file with no CSS
 * file beside it, so a site needs a single <script> tag. Runs after the app's own build.
 */
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: '../../dist/saas/embed',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: { entry: fileURLToPath(new URL('../../packages/core/src/embed/main.tsx', import.meta.url)), formats: ['iife'], name: 'VibeCollab', fileName: () => 'vibe.js' },
  },
})
