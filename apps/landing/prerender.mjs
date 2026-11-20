// After the client build: puts the page's HTML into index.html (crawlers, link previews and the
// first paint get the content without waiting for JavaScript) and writes robots.txt and
// sitemap.xml. The root build copies index.html, robots.txt and sitemap.xml to the site's root.
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SITE = (process.env.VITE_SITE_URL || 'https://whatvibecodingcando.vercel.app').replace(/\/$/, '')
const out = fileURLToPath(new URL('../../dist/landing/', import.meta.url))
const ssr = fileURLToPath(new URL('./.ssr/', import.meta.url))

const { render } = await import(new URL('./.ssr/entry-server.js', import.meta.url).href)
const html = render()
const file = out + 'index.html'
const page = readFileSync(file, 'utf8')
if (!page.includes('<div id="root"></div>')) throw new Error('prerender: no empty #root in index.html')
writeFileSync(file, page.replace('<div id="root"></div>', `<div id="root">${html}</div>`).replaceAll('__SITE__', SITE))

writeFileSync(out + 'robots.txt', `User-agent: *\nAllow: /\nDisallow: /app\nDisallow: /embed/\n\nSitemap: ${SITE}/sitemap.xml\n`)
writeFileSync(out + 'sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>\n</urlset>\n`)
rmSync(ssr, { recursive: true, force: true })
console.log(`[prerender] ${Math.round(html.length / 1024)} kB of HTML in index.html; robots.txt and sitemap.xml for ${SITE}`)
