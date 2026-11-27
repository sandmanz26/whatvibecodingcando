// Cloudflare Pages reads dist/_headers and dist/_redirects instead of vercel.json. This writes both from
// vercel.json at the end of every build, so the two hosts always serve the same headers (CSP included),
// redirects and rewrites. vercel.json stays the one place to edit. An unknown pattern fails the build.
import { readFileSync, writeFileSync } from 'node:fs'

const v = JSON.parse(readFileSync('vercel.json', 'utf8'))

/** Vercel source pattern → Cloudflare path patterns (Cloudflare has no regex, only * and :name). */
const PATHS = {
  '/(.*)': ['/*'],
  '/((?!embed/).*)': ['/*'], // everything; the embed rules below detach these headers again
  '/embed/(.*)': ['/embed/*'],
  '/embed/session.html': ['/embed/session.html'],
  '/app': ['/app'],
  '/assets/(.*)': ['/assets/*'],
  '/landing/assets/(.*)': ['/landing/assets/*'],
  '/content/assets/(.*)': ['/content/assets/*'],
  '/landing/(frames|clips)/(.*)': ['/landing/frames/*', '/landing/clips/*'],
}
const pathsOf = (src) => {
  const p = PATHS[src]
  if (!p) throw new Error(`[cloudflare] no Cloudflare path for vercel.json header source "${src}": add it to scripts/cloudflare-config.mjs`)
  return p
}

// Headers. Rules are written in vercel.json's order; the site-wide page headers are taken off /embed/*
// (customers' sites load those files cross-origin) with Cloudflare's "! Name" detach lines.
const blocks = new Map()
const add = (path, line) => { if (!blocks.has(path)) blocks.set(path, []); blocks.get(path).push(line) }
const notEmbed = v.headers.find((h) => h.source === '/((?!embed/).*)')
for (const h of v.headers) {
  for (const path of pathsOf(h.source)) {
    for (const { key, value } of h.headers) add(path, `  ${key}: ${value}`)
  }
  if (h.source === '/embed/(.*)' && notEmbed) for (const { key } of notEmbed.headers) add('/embed/*', `  ! ${key}`)
}
// session.html: drop the page-wide CSP inherited from /*, then set its own (it is written after, so it wins).
if (blocks.has('/embed/session.html')) blocks.get('/embed/session.html').unshift('  ! Content-Security-Policy', '  ! X-Robots-Tag')
const headers = [...blocks].map(([path, lines]) => `${path}\n${lines.join('\n')}`).join('\n\n') + '\n'

// Redirects and rewrites. Cloudflare serves /app for app.html by itself (and sends /app.html to /app).
const toCf = (s) => s.replace(/:path\*/g, '*').replace(/:path/g, ':path')
const lines = []
for (const r of v.redirects) {
  if (r.source === '/app.html' || r.source === '/app/') continue // built into Cloudflare's clean URLs
  const dest = r.destination.replace(/:path\*/g, ':splat')
  lines.push(`${toCf(r.source)} ${dest} ${r.permanent ? 301 : 302}`)
}
for (const r of v.rewrites ?? []) {
  if (r.source === '/app' && r.destination === '/app.html') continue // clean URLs again
  lines.push(`${toCf(r.source)} ${r.destination} 200`)
}

writeFileSync('dist/_headers', headers)
writeFileSync('dist/_redirects', lines.join('\n') + '\n')
console.log(`[cloudflare] dist/_headers (${blocks.size} paths) and dist/_redirects (${lines.length} rules) written from vercel.json`)
