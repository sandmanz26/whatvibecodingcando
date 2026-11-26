// Demo-mode check (no server) of layout versions, page snapshots and eye tracking needing the camera:
// onboarding with Heatmaps → Open my site → layout 1 recorded and its snapshot taken (masked) → the same
// page redesigned (?v=2) → layout 2 and its own snapshot → the panel's Research shows the page split
// into two layouts, drawn on the snapshots, "Layout changed" and Compare → an Eye tracking study link:
// "No thanks" to the camera ends it, nothing recorded → a usability test with optional eye tracking
// continues without it. Run: npm run build (root); node serve.mjs &; node snapshots-layouts.mjs
import { chromium } from 'playwright'
import fs from 'fs'
const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }))
const ctx = await b.newContext()
// The test site on the panel's origin (the demo keeps everything in this origin's browser storage).
await ctx.route((u) => u.port === '8080' && (u.pathname === '/' || u.pathname === '/layout-test.html'), async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(/localhost:8080\/(layout-test\.html)?/, 'localhost:8080/layout-test.html') }) }))
const pg = await ctx.newPage()
let fails = 0
const ok = (c, what) => { console.log(c ? 'PASS' : 'FAIL', what); if (!c) fails++ }
pg.on('pageerror', (e) => console.log('ERR', e.message))
await pg.goto('http://localhost:8080/app#/register')
await pg.getByLabel('Your name').fill('Tess')
await pg.getByLabel('Work email').fill('tess@example.com')
const pw = pg.locator('input[type=password]'); for (let i = 0; i < await pw.count(); i++) await pw.nth(i).fill('correct horse battery 9')
await pg.getByRole('button', { name: 'Create account' }).click(); await pg.waitForTimeout(1500)
const heat = pg.locator('button.lp-check', { hasText: 'Heatmaps' })
if ((await heat.getAttribute('aria-pressed')) !== 'true') await heat.click()
await pg.getByRole('button', { name: /Continue/ }).click()
await pg.getByLabel('Project name').fill('Mint shop')
await pg.getByPlaceholder('localhost:3000').fill('localhost:8080')
await pg.getByRole('button', { name: /Create project/ }).click(); await pg.waitForTimeout(2500)
const pid = /data-project=(?:&quot;|")([\w-]+)/.exec(await pg.content())?.[1]
fs.writeFileSync(new URL('pid', import.meta.url), pid)
await pg.getByRole('button', { name: /Skip for now|Go to my panel/ }).first().click(); await pg.waitForTimeout(1500)
await pg.goto('http://localhost:8080/app#/app'); await pg.waitForTimeout(1500)
const [site] = await Promise.all([ctx.waitForEvent('page'), pg.getByRole('button', { name: /Open my site/ }).first().click()])
site.on('pageerror', (e) => console.log('SITE ERR', e.message))
await site.waitForLoadState(); await site.waitForTimeout(6000)
for (let i = 0; i < 3; i++) { await site.click('#buy'); await site.waitForTimeout(250) }
await site.waitForTimeout(5000)
const store = () => site.evaluate((p) => JSON.parse(localStorage.getItem(`saas:vibe:lheat:${p}`)), pid)
let s = await store()
ok(s.layouts?.length === 1, `layout 1 recorded (${s.layouts?.length})`)
ok(s.snaps?.filter((x) => x.taken).length === 1, 'snapshot of layout 1 taken')
const svg = await site.evaluate(() => window.__vibeSnapSvg ?? '')
ok(svg.length > 500 && !svg.includes('secret-typed') && !svg.includes('owner@mint') && !svg.includes('Jane'), `masked: no field value, email or private text in the snapshot (svg ${svg.length} chars)`)
if (!svg) console.log('site', site.url())
const pic = await site.evaluate((p) => Object.values(JSON.parse(localStorage.getItem(`saas:vibe:lsnap:${p}`) ?? '{}')).map((u) => Math.round(u.length * 0.75 / 1024)), pid)
console.log('snapshot sizes (KB)', pic)
await site.goto('http://localhost:8080/?v=2'); await site.waitForTimeout(6000)
for (let i = 0; i < 3; i++) { await site.click('#buy'); await site.waitForTimeout(250) }
await site.waitForTimeout(5000)
s = await store()
ok(s.layouts?.length === 2, `redesign: layout 2 (${s.layouts?.length})`)
ok(s.snaps?.filter((x) => x.taken).length === 2, 'its own snapshot')
const svg2 = await site.evaluate(() => window.__vibeSnapSvg ?? '')
ok(!svg2.includes('hidden-value-123'), 'layout 2 snapshot: field value masked')
const lays = new Set(s.events.filter((e) => e.kind === 'click').map((e) => e.lh)); ok(lays.size === 2, 'clicks carry their layout')
// panel
await pg.goto('http://localhost:8080/app#/app/research'); await pg.waitForTimeout(1500)
const page = pg.locator('[data-local-heat="click"] [data-layout-page="/"]')
ok(await page.count() === 1, 'panel: the page is listed once')
ok(await page.locator('[data-layout]').count() === 2, 'split into two layouts')
ok(await page.locator('[data-layout-changed]').count() === 1, `note: ${await page.locator('[data-layout-changed]').innerText().catch(() => '')}`)
ok(await page.locator('svg[data-snapshot="yes"]').count() === 1, 'heatmap drawn on the snapshot')
await page.locator('[data-layout-compare]').click(); await pg.waitForTimeout(300)
ok(await page.locator('svg[data-snapshot="yes"]').count() === 2, 'compare: before and after side by side, each on its snapshot')
await pg.screenshot({ path: '/tmp/snapheat.png', fullPage: true })

// eye tracking: make the ★ studies the server would (Eye tracking; usability with optional eye tracking)
const tokens = await site.evaluate((p) => {
  const k = `saas:vibe:lheat:${p}`; const st = JSON.parse(localStorage.getItem(k)); st.more ??= {}
  st.more.gaze = { id: 'g1', name: 'Eye tracking', token: 'a'.repeat(32), open: true, module: 'gaze' }
  st.more.usability = { id: 'u1', name: 'Usability test', token: 'b'.repeat(32), open: true, module: 'usability', eye: true }
  localStorage.setItem(k, JSON.stringify(st)); return [st.more.gaze.token, st.more.usability.token]
}, pid)
const sr = (p) => p.locator('vibe-collab')
const part = await ctx.newPage()
part.on('pageerror', (e) => console.log('PART ERR', e.message))
await part.goto(`http://localhost:8080/#vibe_r=${tokens[0]}`); await part.waitForTimeout(3500)
const runsBefore = (await store()).runs.length
await sr(part).getByRole('button', { name: /I agree/ }).click(); await part.waitForTimeout(1500)
const ask = await sr(part).locator('[aria-label="Eye tracking"]').innerText().catch(() => '')
ok(/Needed for this study/i.test(ask) && /No thanks/i.test(ask) && !/go on without/i.test(ask), 'eye tracking study: camera needed, no "go on without"')
await sr(part).getByRole('button', { name: 'No thanks' }).click(); await part.waitForTimeout(1200)
ok(/Eye tracking needs your camera\. Nothing was recorded\./.test(await sr(part).locator('[data-vc-nocam]').innerText().catch(() => '')), 'declined: honest message')
ok((await store()).runs.length === runsBefore, 'nothing recorded (the run was discarded)')
await sr(part).getByRole('button', { name: /Back to the site/ }).click(); await part.waitForTimeout(500)
ok(await sr(part).locator('[data-vc-nocam]').count() === 0, 'back to the site')
const p3 = await ctx.newPage()
await p3.goto(`http://localhost:8080/#vibe_r=${tokens[1]}`); await p3.waitForTimeout(3500)
await sr(p3).getByRole('button', { name: /I agree/ }).click(); await p3.waitForTimeout(1500)
await sr(p3).getByRole('button', { name: 'Continue the test without eye tracking' }).click(); await p3.waitForTimeout(800)
ok(/Task 1 of/i.test(await sr(p3).locator('[aria-label="Your task"]').innerText().catch(() => '')), 'usability with optional eye tracking continues without it')
await b.close()
console.log(fails ? `FAILED: ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
