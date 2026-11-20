import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The landing page is its own system and the site's front page. It builds into dist/landing (its
 * assets, frames and clips live there), and the root build copies its index.html to dist/index.html,
 * so it is served at "/". Hence an absolute base: the same page works at / and at /landing/.
 */
export default defineConfig({
  plugins: [react()],
  base: '/landing/',
  build: { outDir: '../../dist/landing', emptyOutDir: true },
})
