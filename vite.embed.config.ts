import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Builds the installable script (dist/embed/vibe.js): one self-contained file with no CSS
 * file beside it, so a site needs a single <script> tag. Runs after the app's own build.
 */
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist/embed',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: { entry: 'src/embed/main.tsx', formats: ['iife'], name: 'VibeCollab', fileName: () => 'vibe.js' },
  },
})
