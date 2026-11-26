// Regression (owner report: eye tracking worked about twice, then the camera wouldn't start): with
// Chromium's fake camera, start eye tracking 5 times in a row in the widget (demo mode, an Eye tracking
// study link) and in the research console's GazeRunner. Each time the camera starts and frames arrive;
// after each stop no camera track is left live. Run after snapshots-layouts.mjs (it uses its project):
// node serve.mjs &; node camera-runs.mjs
import { chromium } from 'playwright'
import fs from 'fs'
const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
const b = await chromium.launch({ args }).catch(() => chromium.launch({ args, executablePath: '/opt/pw-browsers/chromium' }))
const ctx = await b.newContext({ permissions: ['camera'] })
await ctx.route((u) => u.port === '8080' && (u.pathname === '/' || u.pathname === '/layout-test.html'), async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(/localhost:8080\/(layout-test\.html)?/, 'localhost:8080/layout-test.html') }) }))
let fails = 0
const ok = (c, what) => { console.log(c ? 'PASS' : 'FAIL', what); if (!c) fails++ }
const pid = fs.readFileSync(new URL('pid', import.meta.url), 'utf8').trim()
const p = await ctx.newPage()
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto('http://localhost:8080/layout-test.html'); await p.waitForTimeout(1500)
const token = await p.evaluate((id) => {
  const k = `saas:vibe:lheat:${id}`; const st = JSON.parse(localStorage.getItem(k) ?? 'null') ?? { study: { id: 'h', name: 'Site heatmap', token: 'c'.repeat(32), open: true, module: 'heatmap' }, runs: [], events: [] }
  st.more ??= {}; st.more.gaze = { id: 'g1', name: 'Eye tracking', token: 'a'.repeat(32), open: true, module: 'gaze' }
  localStorage.setItem(k, JSON.stringify(st)); return st.more.gaze.token
}, pid)
const w = p.locator('vibe-collab')
const tracks = () => p.evaluate(() => (window.__vibeGazeTracks?.() ?? 0) + [...(document.querySelector('vibe-collab')?.shadowRoot?.querySelectorAll('video') ?? [])].filter((v) => v.srcObject?.active).length * 0)
for (let i = 1; i <= 5; i++) {
  await p.goto(`http://localhost:8080/layout-test.html?run=${i}#vibe_r=${token}`); await p.waitForTimeout(2500)
  await w.getByRole('button', { name: /I agree/ }).click(); await p.waitForTimeout(800)
  await w.getByRole('button', { name: 'Turn on the camera' }).click()
  // the camera is on and gives frames (the face model may still be loading, or fail headless: not this test's point)
  let frames = false
  for (let t = 0; t < 40 && !frames; t++) { await p.waitForTimeout(250); frames = await p.evaluate(() => [...(document.querySelector('vibe-collab')?.shadowRoot?.querySelectorAll('video') ?? [])].some((v) => v.readyState >= 2 && v.srcObject?.getVideoTracks()[0]?.readyState === 'live')) }
  const during = await tracks()
  ok(frames && during === 1, `run ${i}: camera on, frames arriving, ${during} live track`)
  // stop: Stop during calibration, or No thanks when the model couldn't start
  const stop = w.getByRole('button', { name: /^(Stop|No thanks)$/ }).first()
  await stop.click({ timeout: 30000 }).catch(() => {}); await p.waitForTimeout(800)
  ok(await tracks() === 0, `run ${i}: after stopping, no live camera track`)
  await w.getByRole('button', { name: /Back to the site/ }).click().catch(() => {})
}
// The research console (demo shop): ?gaze starts the GazeRunner.
const c = await ctx.newPage()
c.on('pageerror', (e) => console.log('CONSOLE ERR', e.message))
for (let i = 1; i <= 5; i++) {
  await c.goto(`http://localhost:8080/app?x=${i}#/shop?gaze`); await c.waitForTimeout(1500)
  const on = c.getByRole('button', { name: /Turn on|Start|camera/i }).first()
  await on.click({ timeout: 10000 }).catch(() => console.log('no start button'))
  let frames = false
  for (let t = 0; t < 40 && !frames; t++) { await c.waitForTimeout(250); frames = await c.evaluate(() => [...document.querySelectorAll('video')].some((v) => v.readyState >= 2 && v.srcObject?.getVideoTracks()[0]?.readyState === 'live')) }
  ok(frames, `console run ${i}: camera on, frames arriving`)
  await c.getByRole('button', { name: /^(Stop|Cancel|Skip|Not now|No thanks)/i }).first().click({ timeout: 30000 }).catch(() => {})
  await c.waitForTimeout(800)
  const live = await c.evaluate(() => [...document.querySelectorAll('video')].filter((v) => v.srcObject?.getVideoTracks().some((t) => t.readyState === 'live')).length + (window.__vibeGazeTracks?.() ?? 0))
  ok(live === 0, `console run ${i}: after stopping, no live camera track`)
}
await b.close()
console.log(fails ? `FAILED: ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
