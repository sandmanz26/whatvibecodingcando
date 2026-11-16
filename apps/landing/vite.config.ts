import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The landing page is its own system. It builds into dist/landing at the repository root, beside
 * the SaaS (dist) and the content site (dist/content), and is served at /landing/.
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../../dist/landing', emptyOutDir: true },
})
