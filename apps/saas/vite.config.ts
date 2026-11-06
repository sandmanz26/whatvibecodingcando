import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** The SaaS app builds into its own dist/ (apps/saas/dist). */
export default defineConfig({
  plugins: [react()],
  base: './',
})
