// Build check (docs/SECURITY.md "Content-Security-Policy"): every inline <script> in the built pages
// must be allowed by its SHA-256 hash in vercel.json's Content-Security-Policy, or the browser would
// block it in production. Change an inline script → copy the hash this prints into vercel.json.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const csp = JSON.stringify(JSON.parse(readFileSync('vercel.json', 'utf8')).headers)
const pages = []
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (!/frames|clips|assets|mediapipe/.test(f)) walk(p) } else if (f.endsWith('.html')) pages.push(p) } }
walk('dist')
const missing = []
for (const p of pages) {
  const html = readFileSync(p, 'utf8')
  for (const m of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/application\/ld\+json/.test(m[1]) || !m[2].trim()) continue
    const h = `'sha256-${createHash('sha256').update(m[2], 'utf8').digest('base64')}'`
    if (!csp.includes(h)) missing.push(`${p}: ${h}`)
  }
}
if (missing.length) {
  console.error(`[csp] inline scripts not allowed by vercel.json's Content-Security-Policy:\n  ${missing.join('\n  ')}`)
  process.exit(1)
}
console.log(`[csp] ${pages.length} pages: every inline script is allowed by hash`)
