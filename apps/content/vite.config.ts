import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  // The content site still builds into the repository's dist/, so the existing deployment
  // (npm run build at the root, output dist/) keeps working after the move to a monorepo.
  build: { outDir: '../../dist', emptyOutDir: true },
})
