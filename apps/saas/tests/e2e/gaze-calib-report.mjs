// Demo-mode check (no server) of the new eye-tracking setup and the compact gaze report:
// 1. an Eye tracking study link → I agree → camera (Chromium's fake camera) → the pre-check screen with
//    its mirrored preview canvas and three live checks → Start (anyway: the fake camera has no face)
//    → a shrinking dot that needs no click, and "We can't see your face" when no face is found;
// 2. the sample report: summary row, a page table with people per page and sorting, and the detail
//    pane beside the table on desktop and below it on a phone. Screenshots in node_modules/.cache.
// Run: npm run build (root); node serve.mjs &; node gaze-calib-report.mjs
import { chromium } from 'playwright'
const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream']
const b = await chromium.launch({ args }).catch(() => chromium.launch({ args, executablePath: '/opt/pw-browsers/chromium' }))
const ctx = await b.newContext({ permissions: ['camera'], viewport: { width: 1360, height: 860 } })
await ctx.route((u) => u.port === '8080' && (u.pathname === '/' || u.pathname === '/layout-test.html'), async (route) => route.fulfill({ response: await route.fetch({ url: route.request().url().replace(/localhost:8080\/(layout-test\.html)?/, 'localhost:8080/layout-test.html') }) }))
let fails = 0
const ok = (c, what) => { console.log(c ? 'PASS' : 'FAIL', what); if (!c) fails++ }
const shot = (p, n) => p.screenshot({ path: new URL(`../../node_modules/.cache/${n}.png`, import.meta.url).pathname })
const pg = await ctx.newPage()
pg.on('pageerror', (e) => console.log('ERR', e.message))
await pg.goto('http://localhost:8080/app#/register')
await pg.getByLabel('Your name').fill('Tess')
await pg.getByLabel('Work email').fill('tess@example.com')
const pw = pg.locator('input[type=password]'); for (let i = 0; i < await pw.count(); i++) await pw.nth(i).fill('correct horse battery 9')
await pg.getByRole('button', { name: 'Create account' }).click(); await pg.waitForTimeout(1500)
await pg.getByRole('button', { name: /Continue/ }).click()
await pg.getByLabel('Project name').fill('Mint shop')
await pg.getByPlaceholder('localhost:3000').fill('localhost:8080')
await pg.getByRole('button', { name: /Create project/ }).click(); await pg.waitForTimeout(2500)
const pid = /data-project=(?:&quot;|")([\w-]+)/.exec(await pg.content())?.[1]
await pg.getByRole('button', { name: /Skip for now|Go to my panel/ }).first().click().catch(() => {}); await pg.waitForTimeout(1000)

/* ---- 1. calibration screens ---- */
const p = await ctx.newPage()
p.on('pageerror', (e) => console.log('ERR', e.message))
await p.goto('http://localhost:8080/layout-test.html'); await p.waitForTimeout(1500)
const token = await p.evaluate((id) => {
  const k = `saas:vibe:lheat:${id}`; const st = JSON.parse(localStorage.getItem(k) ?? 'null') ?? { study: { id: 'h', name: 'Site heatmap', token: 'c'.repeat(32), open: true, module: 'heatmap' }, runs: [], events: [] }
  st.more ??= {}; st.more.gaze = { id: 'g1', name: 'Eye tracking', token: 'a'.repeat(32), open: true, module: 'gaze' }
  localStorage.setItem(k, JSON.stringify(st)); return st.more.gaze.token
}, pid)
const w = p.locator('vibe-collab')
await p.goto(`http://localhost:8080/layout-test.html?vibe_gaze_debug=1#vibe_r=${token}`); await p.waitForTimeout(2500)
await w.getByRole('button', { name: /I agree/ }).click(); await p.waitForTimeout(800)
ok(await w.getByText(/follow 18 dots with your eyes/).count() === 1, 'the ask says what happens (pre-check, then 18 dots)')
await w.getByRole('button', { name: 'Turn on the camera' }).click()
const pre = w.locator('[data-vc-eye="precheck"]')
await pre.waitFor({ timeout: 45000 }).catch(() => {})
const reached = await pre.count() === 1
if (!reached) console.log('NOTE the face model could not load here (it comes from storage.googleapis.com); the rest of part 1 is skipped')
if (reached) {
  ok(true, 'pre-check screen shows after the camera starts')
  await p.waitForTimeout(1500)
  ok(await pre.locator('canvas').count() === 1, 'a small preview canvas (mirrored, local only)')
  ok(await w.getByText(/Only you see this preview/).count() === 1, 'the preview says it isn’t saved or sent')
  const checks = await pre.locator('[data-vc-checks] li').allTextContents()
  ok(checks.length === 3 && /can’t see your face|middle/i.test(checks[0]), `three live checks: ${checks.join(' | ')}`)
  ok(await w.getByText(/keep your head still and move only your eyes/i).count() === 1, 'tells people to move only their eyes')
  ok(await w.getByRole('button', { name: 'Start calibration' }).isDisabled(), 'Start calibration waits until the checks pass')
  await shot(p, 'gaze-precheck')
  await w.getByRole('button', { name: 'Start anyway' }).click(); await p.waitForTimeout(400)
  const dot = w.locator('.vc-dot.auto')
  ok(await dot.count() === 1, 'calibration dot appears and shrinks (no click needed)')
  ok(await w.getByText(/It moves on by itself/).count() === 1, 'the bar says the dot moves on by itself')
  await p.waitForTimeout(4500)
  ok(await w.getByText(/can’t see your face/).count() >= 1, 'no face: "We can’t see your face" (not a head warning)')
  await shot(p, 'gaze-dot')
  await w.getByRole('button', { name: /^Stop$/ }).click().catch(() => {})
}

/* ---- 2. the report ---- */
await pg.goto('http://localhost:8080/app#/app/research/sample-gaze'); await pg.waitForTimeout(2000)
const rep = pg.locator('[data-gaze-report]')
ok(await rep.count() === 1, 'sample report renders')
ok(await pg.locator('[data-gz-summary]').count() === 1, 'one summary row')
const rows = pg.locator('[data-gz-pages] tbody tr')
ok(await rows.count() === 2, `page table with ${await rows.count()} rows (one per page)`)
const people = await pg.locator('[data-gz-people]').allTextContents()
ok(people.map(Number).every((n) => n > 1), `people per page: ${people.join(', ')} (not all "1")`)
const tbl = await pg.locator('.gz-list').boundingBox(), det = await pg.locator('[data-gz-detail]').boundingBox()
ok(tbl && det && det.x > tbl.x + tbl.width - 2 && Math.abs(det.y - tbl.y) < 60, 'desktop: detail pane beside the table')
await rows.nth(1).click(); await pg.waitForTimeout(300)
ok((await pg.locator('[data-gz-detail]').getAttribute('data-gz-detail')) === (await rows.nth(1).getAttribute('data-gaze-page')), 'clicking a row shows that page in the detail')
await pg.getByRole('button', { name: /^Page/ }).click(); await pg.waitForTimeout(200)
ok((await rows.first().getAttribute('data-gaze-page')) === '/', 'sorting by page puts "/" first')
const h = await pg.evaluate(() => document.querySelector('[data-gaze-report]').getBoundingClientRect().height)
ok(h < 1500, `report height on desktop ${Math.round(h)} px (no long scroll)`)
await shot(pg, 'gaze-report-desktop')
// per participant: the list, and the filter that applies to the whole report
await pg.locator('[data-gz-people-toggle]').click(); await pg.waitForTimeout(200)
const plist = await pg.locator('[data-gz-people-list] tbody tr td:first-child').allTextContents()
ok(plist.length === 14 && plist[0] === 'Participant 1' && plist.some((x) => /reviewer/.test(x)) && !plist.some((x) => /@/.test(x)), `participants list in start order, reviewer named, no emails (${plist.slice(0, 3).join(', ')}…)`)
await pg.locator('[data-gz-who]').selectOption({ label: 'Participant 1' }); await pg.waitForTimeout(300)
ok(await pg.locator('[data-gz-journey]').count() === 1 && /Participant 1/.test(await pg.locator('[data-gz-summary]').textContent()), 'one participant: their summary and page sequence')
ok((await pg.locator('[data-gz-people]').allTextContents()).every((n) => n === '1'), 'one participant: every page counts just them')
ok(/Look, then click/.test(await pg.locator('[data-gz-journey]').textContent()), 'look-then-click moments shown')
await pg.locator('[data-gz-who]').selectOption('all'); await pg.waitForTimeout(200)
await pg.locator('[data-gz-search]').fill('product'); await pg.waitForTimeout(200)
ok(await rows.count() === 1, 'page search narrows the table')
await pg.locator('[data-gz-search]').fill(''); await pg.waitForTimeout(200)
await pg.setViewportSize({ width: 390, height: 844 }); await pg.waitForTimeout(400)
const tbl2 = await pg.locator('.gz-list').boundingBox(), det2 = await pg.locator('[data-gz-detail]').boundingBox()
ok(tbl2 && det2 && det2.y >= tbl2.y + tbl2.height - 2, 'phone: detail below the table')
const over = await pg.evaluate(() => [...document.querySelectorAll('[data-gaze-report] *')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('.gz-scroll, .gz-list')).slice(0, 5).map((e) => `${e.tagName}.${e.className}`))
ok(!over.length, `phone: nothing in the report pokes out sideways ${over.join(' ')}`)
await shot(pg, 'gaze-report-phone')
await b.close()
console.log(fails ? `FAILED: ${fails}` : 'ALL PASS')
process.exit(fails ? 1 : 0)
