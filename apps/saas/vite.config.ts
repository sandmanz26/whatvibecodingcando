import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * The SaaS is the deployment's main site: it builds into the root of the repository's dist, served
 * at "/". The content site lives in dist/content beside it, so this build must not empty dist (the
 * root build script cleans dist once, before both apps build).
 */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../../dist', emptyOutDir: false },
})
