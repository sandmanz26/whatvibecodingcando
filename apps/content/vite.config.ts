import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Production hardening (docs/SECURITY.md): no debugger statements, console.log/debug/info removed, no licence/comment banners.
  esbuild: { drop: ['debugger'], pure: ['console.log', 'console.debug', 'console.info'], legalComments: 'none' },
  base: './',
  // One Vercel deployment serves both apps: the SaaS at the root, the content site at /content.
  build: { sourcemap: false, outDir: '../../dist/content', emptyOutDir: true },
})
