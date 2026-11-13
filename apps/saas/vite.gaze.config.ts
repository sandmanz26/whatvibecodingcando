import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import { copyFileSync, mkdirSync } from 'node:fs'

/**
 * The script's eye tracking module (dist/embed/gaze.js, from src/core/embed/gaze-entry.ts), loaded by
 * vibe.js only for a study participant who agreed to eye tracking. The face model's WebAssembly is
 * copied beside it as files (a library build would otherwise inline 13 MB into the script).
 */
function copyMediapipe(): Plugin {
  return {
    name: 'copy-mediapipe',
    writeBundle(o) {
      const dir = `${o.dir}/mediapipe`
      mkdirSync(dir, { recursive: true })
      for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) copyFileSync(fileURLToPath(new URL(`./node_modules/@mediapipe/tasks-vision/wasm/${f}`, import.meta.url)), `${dir}/${f}`)
    },
  }
}
export default defineConfig({
  plugins: [copyMediapipe()],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: '../../dist/embed',
    emptyOutDir: false,
    copyPublicDir: false,
    lib: { entry: fileURLToPath(new URL('./src/core/embed/gaze-entry.ts', import.meta.url)), formats: ['es'], fileName: () => 'gaze.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
