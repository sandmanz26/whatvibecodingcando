import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** The SaaS app builds into the repository's dist/saas: one Vercel deployment serves it at /saas. */
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../../dist/saas', emptyOutDir: true },
})
