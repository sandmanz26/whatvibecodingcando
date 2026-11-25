#!/usr/bin/env node
/**
 * Records the short hover previews of the product cards (onboarding and Products):
 * public/previews/<product-id>.{webm,mp4,jpg}.
 *
 *   npm run build                              (at the repository root; demo mode, no Supabase keys)
 *   (cd dist && python3 -m http.server 4173)   (in another terminal)
 *   node apps/saas/scripts/record-previews.cjs [product-id ...]
 *
 * Needs Playwright with Chromium and ffmpeg (libvpx-vp9, libx264). Everything recorded is the demo
 * site (embed-demo.html) or the demo console with its made-up data: never real people's data.
 * Eye tracking runs on Chromium's fake camera (a test pattern) and shows the calibration only.
 */
const { chromium } = require('playwright')
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

const BASE = process.env.PREVIEW_BASE || 'http://localhost:4173'
const OUT = path.join(__dirname, '..', 'public', 'previews')
const W = 960, H = 600
const wait = (p, ms) => p.waitForTimeout(ms)
const demo = (products, extra = '') => `${BASE}/embed-demo.html?project=preview&products=${products}${extra}`
const dock = (p, label, exact = false) => p.locator('#vibe-collab').getByRole('button', { name: label, exact }).first()
/** The demo site, without its "You picked" note (that note is for people trying their own picks). */
async function site(p, products) {
  await p.addInitScript(() => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '#trial { display: none !important }'; document.head.appendChild(s) }))
  await p.goto(demo(products)); await wait(p, 1100)
}
/** The demo console, with its made-up sample research data. */
async function consolePage(p, route) {
  await p.goto(`${BASE}/app.html#/console/report`); await wait(p, 800)
  const add = p.getByRole('button', { name: /sample research data/i }).first()
  if (await add.count()) { await add.click(); await wait(p, 500) }
  await p.goto(`${BASE}/app.html#/console/${route}`); await wait(p, 1200)
  // The demo console's own dock isn't part of the product being shown.
  await p.addStyleTag({ content: '.dock, [class*="dock"] { visibility: hidden !important }' }).catch(() => {})
}
/** Scrolls the page, or the console's own scrolling area, smoothly. */
async function scrollBy(p, dy) {
  await p.evaluate(async (dy) => {
    const box = [document.scrollingElement, ...document.querySelectorAll('main, .main, [class*="content"]')].find((el) => el && el.scrollHeight > el.clientHeight + 20 && (el === document.scrollingElement || /auto|scroll/.test(getComputedStyle(el).overflowY)))
    if (box) box.scrollBy({ top: dy, behavior: 'smooth' })
  }, dy)
  await wait(p, 700)
}
/** The console's page area, without its side menu: x, y, width, height (16:10). */
const MAIN = [216, 0, 744, 465]
/** Moves the mouse there in visible steps, so the clip shows the pointer travelling. */
async function glide(p, x, y, steps = 18) { await p.mouse.move(x, y, { steps }) }
async function center(p, sel) { const b = await p.locator(sel).first().boundingBox(); return b ? [b.x + b.width / 2, b.y + b.height / 2] : [W / 2, H / 2] }
async function clickAt(p, sel) { const [x, y] = await center(p, sel); await glide(p, x, y); await wait(p, 200); await p.mouse.click(x, y) }

/** One clip per product: where it starts and what it does. Each runs for about 5 seconds. */
const CLIPS = {
  async comments(p) {
    await site(p, 'comments')
    await dock(p, 'Comment', true).click(); await wait(p, 400)
    await clickAt(p, '#cta'); await wait(p, 400)
    await p.keyboard.type('Make this button say “Try it free”', { delay: 45 }); await wait(p, 300)
    await p.keyboard.press('Control+Enter'); await wait(p, 1500)
  },
  async compare(p) {
    await site(p, 'comments,compare')
    await dock(p, 'Compare').click(); await wait(p, 300)
    await clickAt(p, '#card-fast'); await wait(p, 500)
    await clickAt(p, '#card-shared'); await wait(p, 700)
    await p.keyboard.type('Same padding as A', { delay: 50 }); await wait(p, 1500)
  },
  async inspect(p) {
    await site(p, 'inspect')
    await dock(p, 'Inspect').click(); await wait(p, 400)
    for (const s of ['#headline', '#cta', '#card-fast', '#card-safe']) { const [x, y] = await center(p, s); await glide(p, x, y, 22); await wait(p, 700) }
  },
  async dscheck(p) {
    await site(p, 'dscheck')
    await dock(p, 'Design system check').click(); await wait(p, 900)
    const run = p.locator('#vibe-collab').getByRole('button', { name: /scan|check/i }).first()
    if (await run.count()) { await run.click().catch(() => {}) }
    await wait(p, 3000)
  },
  async tokens(p) {
    await site(p, 'tokens')
    await dock(p, 'Design tokens').click(); await wait(p, 600)
    const input = p.locator('#vibe-collab').locator('input[type=file]').first()
    const file = path.join(os.tmpdir(), 'preview-tokens.json')
    fs.writeFileSync(file, JSON.stringify({ color: { brand: { $type: 'color', $value: '#7048e8' }, text: { $type: 'color', $value: '#1b1b1f' }, surface: { $type: 'color', $value: '#f3f0ff' } }, radius: { md: { $type: 'dimension', $value: '14px' } } }))
    if (await input.count()) { await input.setInputFiles(file).catch(() => {}) }
    await wait(p, 900)
    const apply = p.locator('#vibe-collab').getByRole('button', { name: /apply|simulate|preview/i }).first()
    if (await apply.count()) await apply.click().catch(() => {})
    await wait(p, 2500)
  },
  heatmap: { crop: MAIN, async run(p) { await consolePage(p, 'heatmap'); const open = p.getByRole('link', { name: /open|view/i }).first(); if (await open.count()) { await open.click().catch(() => {}); await wait(p, 1200) } await scrollBy(p, 300); await wait(p, 600); await scrollBy(p, 250); await p.mouse.move(500, 300, { steps: 20 }); await wait(p, 2200) } },
  narration: { async run(p) { await consolePage(p, 'narration'); await p.getByRole('button', { name: /start narrating/i }).first().click().catch(() => {}); await wait(p, 1500); await p.mouse.move(300, 200, { steps: 25 }); await wait(p, 800); await p.mouse.move(700, 400, { steps: 25 }); await wait(p, 2000) } },
  insights: { crop: MAIN, async run(p) { await consolePage(p, 'sessions'); await p.mouse.wheel(0, 200); await wait(p, 1500); await p.mouse.wheel(0, 200); await wait(p, 1500) } },
  usability: { async run(p) { await consolePage(p, 'tests'); const t = p.getByRole('link', { name: /try it/i }).first(); const href = await t.getAttribute('href').catch(() => null); if (href) await p.goto(new URL(href, p.url()).href); await wait(p, 1500); for (const b of [/^begin$/i, /continue without/i, /^start/i]) { const x = p.getByRole('button', { name: b }).first(); if (await x.count()) { await x.click().catch(() => {}); await wait(p, 900) } } await p.mouse.move(500, 140, { steps: 25 }); await wait(p, 2500) } },
  fivesec: { crop: MAIN, async run(p) { await consolePage(p, 'fivesec'); await p.mouse.wheel(0, 250); await wait(p, 1500); await p.mouse.wheel(0, 250); await wait(p, 1800) } },
  gaze: { async run(p) { await consolePage(p, 'gaze'); const href = await p.getByRole('link', { name: /start a session/i }).first().getAttribute('href').catch(() => null); if (href) { await p.goto(new URL(href, p.url()).href); await wait(p, 1500) } for (const b of [/turn on the camera/i, /start|continue|begin/i]) { const x = p.getByRole('button', { name: b }).first(); if (await x.count()) { await x.click().catch(() => {}); await wait(p, 1500) } } await wait(p, 3000) } },
  report: { crop: MAIN, async run(p) { await consolePage(p, 'report'); await p.mouse.wheel(0, 200); await wait(p, 1500); await p.mouse.wheel(0, 250); await wait(p, 1800) } },
}

function encode(src, id, skip, crop) {
  const vf = `${crop ? `crop=${crop[2]}:${crop[3]}:${crop[0]}:${crop[1]},` : ''}scale=480:300:flags=lanczos,fps=15`
  const common = ['-y', '-loglevel', 'error', '-ss', String(skip), '-i', src, '-t', '5.5', '-an', '-vf', vf]
  execFileSync('ffmpeg', [...common, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '42', '-row-mt', '1', '-deadline', 'good', path.join(OUT, `${id}.webm`)])
  execFileSync('ffmpeg', [...common, '-c:v', 'libx264', '-crf', '30', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(OUT, `${id}.mp4`)])
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(skip + 3.5), '-i', src, '-frames:v', '1', '-vf', vf, '-q:v', '5', path.join(OUT, `${id}.jpg`)])
}

;(async () => {
  fs.mkdirSync(OUT, { recursive: true })
  const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CLIPS)
  const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'previews-'))
  for (const id of want) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, recordVideo: { dir: tmp, size: { width: W, height: H } }, reducedMotion: 'no-preference' })
    const page = await ctx.newPage()
    const t0 = Date.now()
    const clip = typeof CLIPS[id] === 'function' ? { run: CLIPS[id] } : CLIPS[id]
    try { await clip.run(page) } catch (e) { console.warn(id, e.message) }
    const total = (Date.now() - t0) / 1000
    const video = page.video()
    await ctx.close()
    const src = await video.path()
    // The first second is the page loading: leave it out.
    encode(src, id, Math.max(1.2, total - 5.5), clip.crop)
    const kb = (f) => Math.round(fs.statSync(path.join(OUT, `${id}.${f}`)).size / 1024)
    console.log(`${id}: webm ${kb('webm')} KB, mp4 ${kb('mp4')} KB, jpg ${kb('jpg')} KB`)
  }
  await browser.close()
  fs.rmSync(tmp, { recursive: true, force: true })
})()
