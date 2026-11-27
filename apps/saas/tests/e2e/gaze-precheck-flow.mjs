// Regression (owner, real laptop webcam: all three checks ✓ but "Start calibration" stayed off).
// Chromium's fake camera, and the page's gaze.js swapped (by routing, no product change) for one that
// re-exports the real module but answers detect()/features() with synthetic, noisy eye features for
// where the dot is (tests/gaze-sim.ts), so the face model isn't needed. Flow, with no clicks except
// Start: Get ready (checks go green, Start calibration turns on within ~1 s) → 13 calibration dots that
// move on by themselves → 5 validation dots → the result screen. Then a no-face run: "Start anyway" is
// always there, the dots still move on (timeout), and the result says it couldn't see the face.
// Run: npm run build (root); node serve.mjs &; node gaze-precheck-flow.mjs   (after snapshots-layouts.mjs or with its pid file)
import { chromium } from 'playwright'
import { execSync } from 'child_process'
import fs from 'fs'
const here = new URL('.', import.meta.url).pathname
const simOut = new URL('../../node_modules/.cache/gaze-sim.mjs', import.meta.url).pathname
execSync(`npx rolldown ${here}../gaze-sim.ts --format esm --platform browser -o ${simOut}`, { cwd: `${here}../..`, stdio: 'ignore' })
const simCode = fs.readFileSync(simOut, 'utf8')
const fake = (face) => `
import * as R from '/embed/gaze.js?real=1';
import { simFrame, makeRand, STILL } from '/__sim.js';
export * from '/embed/gaze.js?real=1';
const r = makeRand(7);
const FACE = ${face};
const target = () => {
  const d = document.querySelector('vibe-collab')?.shadowRoot?.querySelector('.vc-dot');
  if (!d) return { x: innerWidth / 2, y: innerHeight / 2 };
  const b = d.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
};
export async function loadLandmarker() { return {}; }
export function resetLandmarker() {}
export function features() { if (!FACE) return null; const t = target(); return simFrame(r, t.x, t.y, STILL, r.u() < 0.03); }
export function detect() { const f = features(); return { f, face: f ? { cx: 0.5 + r.g() * 0.03, cy: 0.47 + r.g() * 0.03 } : null }; }
`
const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
const b = await chromium.launch({ args, executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch({ args }))
let fails = 0
const ok = (c, what) => { console.log(c ? 'PASS' : 'FAIL', what); if (!c) fails++ }
const pid = fs.readFileSync(new URL('pid', import.meta.url), 'utf8').trim()

async function run(face) {
  const ctx = await b.newContext({ permissions: ['camera'], viewport: { width: 1440, height: 900 } })
  await ctx.route((u) => u.pathname === '/__sim.js', (route) => route.fulfill({ contentType: 'text/javascript', body: simCode }))
  await ctx.route((u) => u.pathname === '/embed/gaze.js' && !u.searchParams.has('real'), (route) => route.fulfill({ contentType: 'text/javascript', body: fake(face), headers: { 'access-control-allow-origin': '*' } }))
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('ERR', e.message))
  await p.goto('http://localhost:8080/layout-test.html'); await p.waitForTimeout(1200)
  const token = await p.evaluate((id) => {
    const k = `saas:vibe:lheat:${id}`; const st = JSON.parse(localStorage.getItem(k) ?? 'null') ?? { study: { id: 'h', name: 'Site heatmap', token: 'c'.repeat(32), open: true, module: 'heatmap' }, runs: [], events: [] }
    st.more ??= {}; st.more.gaze = { id: 'g1', name: 'Eye tracking', token: 'a'.repeat(32), open: true, module: 'gaze' }
    localStorage.setItem(k, JSON.stringify(st)); return st.more.gaze.token
  }, pid)
  const w = p.locator('vibe-collab')
  await p.goto(`http://localhost:8080/layout-test.html?face=${face}#vibe_r=${token}`); await p.waitForTimeout(2000)
  await w.getByRole('button', { name: /I agree/ }).click(); await p.waitForTimeout(500)
  await w.getByRole('button', { name: 'Turn on the camera' }).click()
  const pre = w.locator('[data-vc-eye="precheck"]')
  await pre.waitFor({ timeout: 20000 })
  ok(await w.locator('[data-vc-start-anyway]').count() === 1, `${face ? 'face' : 'no face'}: "Start anyway" is always shown`)
  const start = w.locator('[data-vc-start]')
  if (face) {
    const t0 = Date.now()
    await p.waitForFunction(() => { const e = document.querySelector('vibe-collab')?.shadowRoot?.querySelector('[data-vc-start]'); return e && !e.disabled }, null, { timeout: 5000 }).catch(() => {})
    const ms = Date.now() - t0
    const rows = await pre.locator('[data-vc-checks] li.yes').count()
    ok(rows === 3 && await start.isEnabled(), `three ✓ and Start calibration on (${ms} ms after the screen showed)`)
    ok(ms < 2500, 'on within the first second or two of the camera (300 ms debounce)')
    await start.click()
  } else {
    await p.waitForTimeout(1500)
    ok(await start.isDisabled() && await pre.locator('[data-vc-check="face"].no').count() === 1, 'no face: the face row says so (not ✓), and Start calibration waits')
    ok(await pre.locator('[data-vc-checks] li.yes').count() === 0, 'no face: no ✓ is shown for rows that can’t be judged')
    await w.locator('[data-vc-start-anyway]').click()
  }
  ok(await w.locator('[data-vc-calib="calibrate"]').count() === 1, 'calibration starts')
  const t1 = Date.now()
  const result = w.locator('[data-vc-eye="result"]')
  let sawValidate = false
  while (Date.now() - t1 < 120000 && !(await result.count())) { if (await w.locator('[data-vc-calib="validate"]').count()) sawValidate = true; await p.waitForTimeout(250) }
  const secs = Math.round((Date.now() - t1) / 1000)
  ok(await result.count() === 1, `the result screen comes by itself (${secs} s, no clicks)`)
  if (face) {
    ok(sawValidate, 'validation dots ran after calibration')
    const g = await w.locator('[data-vc-grade]').getAttribute('data-vc-grade')
    ok(['good', 'rough', 'poor'].includes(g), `a grade is shown: ${g}`)
    ok(await w.getByRole('button', { name: /^Continue/ }).count() >= 1, 'a way on: Continue')
  } else {
    ok(await w.locator('[data-vc-grade="none"]').count() === 1, 'no face: the result says it couldn’t see the eyes')
    ok(await w.getByRole('button', { name: 'Try again' }).count() === 1 && await w.getByRole('button', { name: /^(Stop|Continue without eye tracking)$/ }).count() === 1, 'and offers Try again and a way out')
  }
  await ctx.close()
}
await run(true)
await run(false)
await b.close()
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
process.exit(fails ? 1 : 0)
