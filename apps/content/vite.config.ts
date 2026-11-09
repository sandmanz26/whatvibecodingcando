import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // One Vercel deployment serves both apps: the SaaS at the root, the content site at /content.
  build: { outDir: '../../dist/content', emptyOutDir: true },
})
