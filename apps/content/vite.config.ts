import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // One Vercel deployment serves both apps: the content site at /content, the SaaS at /saas.
  build: { outDir: '../../dist/content', emptyOutDir: true },
})
