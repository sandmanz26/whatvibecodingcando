// Demo-mode check (no server) of one default (★) study per research module and the "Everyone" widget:
// onboarding with Heatmaps + Usability + 5-second → Research shows one ★ per module → audience Everyone →
// a visitor sees every module, consents with one click, clicks are recorded, sees no results → the team's
// heatmap shows the visitor's clicks → pausing a ★ hides the module → an "old" project (audience reviewers)
// behaves as before → no "New study" button anywhere. Run: npm run build (root); node serve.mjs &; node default-studies.mjs
import { chromium } from 'playwright'
const BASE = 'http://localhost:8080'

const b = await chromium.launch().catch(() => chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }))
const ctx = await b.newContext()
const p = await ctx.newPage()
p.on('pageerror', e => console.log('PAGEERR', e.message))
await p.goto(`${BASE}/app#/app/register`)
const inputs = p.locator('form input')
await inputs.nth(0).fill('Owner'); await inputs.nth(1).fill('o@x.com'); await inputs.nth(2).fill('password123'); await inputs.nth(3).fill('password123')
await p.click('text=Create account'); await p.waitForTimeout(1200)
for (const t of ['Heatmaps', 'Usability tests', '5-second tests']) await p.getByText(t, { exact: true }).click()
console.log('picked', await p.$$eval('[aria-pressed="true"], [aria-checked="true"]', els => els.map(e => e.textContent.slice(0,20))))
await p.click('text=Continue'); await p.waitForTimeout(600)
await p.locator('input').first().fill('Demo shop')
await p.click('text=Create project'); await p.waitForTimeout(1500)
await p.click('text=Go to my panel'); await p.waitForTimeout(1200)
console.log('URL', p.url())
await p.goto(`${BASE}/app#/app/research`); await p.waitForTimeout(1000)
console.log('RESEARCH:', (await p.locator('.up-page').innerText()).slice(0, 1800))
await p.screenshot({ path: 'research.png', fullPage: true })
await p.goto(`${BASE}/app#/app/widget`); await p.waitForTimeout(1000)
await p.getByText('Everyone visiting').click(); await p.waitForTimeout(300)
console.log('publish buttons', await p.$$eval('button', els => els.map(e => e.textContent.trim()).filter(t => /update|publish/i.test(t))))
await p.getByRole('button', { name: 'Update site' }).first().click(); await p.waitForTimeout(800)
console.log('after update buttons', await p.$$eval('[role=dialog] button, .modal button', els => els.map(e => e.textContent.trim())))
const dlg = p.locator('[role=dialog] button.primary, .modal button.primary'); if (await dlg.count()) { await dlg.first().click(); await p.waitForTimeout(800) }
console.log('live audience', await p.evaluate(() => JSON.parse(localStorage.getItem('saas:vibe:config:demo-shop')).live.config.audience))
const v = await ctx.newPage()
v.on('pageerror', e => console.log('VPAGEERR', e.message))
v.on('console', m => { if (/ourhunch/.test(m.text())) console.log('VCONSOLE', m.text()) })
await v.goto(`${BASE}/embed-demo.html?project=demo-shop`); await v.waitForTimeout(500)
// a plain visitor: no team session in this browser
await v.evaluate(() => { for (const k of Object.keys(localStorage)) if (/:(session|invited|reviewer):/.test(k)) localStorage.removeItem(k) })
await v.reload(); await v.waitForTimeout(2500)
const dock = async () => v.evaluate(() => { const r = document.querySelector('vibe-collab')?.shadowRoot; return r ? [...r.querySelectorAll('.vc-dock button')].map(b => b.getAttribute('aria-label') || b.textContent.trim()) : null })
console.log(await v.evaluate(() => Object.keys(localStorage).filter(k => /demo-shop|session|invited/.test(k)).map(k => k + ' = ' + localStorage.getItem(k).slice(0, 400))))
console.log('VISITOR DOCK', await dock())
// open heatmap research
await v.evaluate(() => document.querySelector('vibe-collab').shadowRoot.querySelector('[data-vc-research="heatmap"]').click()); await v.waitForTimeout(400)
console.log('CONSENT', await v.evaluate(() => document.querySelector('vibe-collab').shadowRoot.querySelector('[data-vc-consent]')?.innerText))
await v.evaluate(() => [...document.querySelector('vibe-collab').shadowRoot.querySelectorAll('button')].find(b => b.textContent.trim() === 'OK').click()); await v.waitForTimeout(800)
console.log('AFTER OK', await v.evaluate(() => document.querySelector('vibe-collab').shadowRoot.innerText?.slice(0, 300) || document.querySelector('vibe-collab').shadowRoot.textContent.slice(0,300)))
// real clicks on the page
for (const [x, y] of [[200, 300], [400, 350], [600, 200], [300, 500]]) { await v.mouse.click(x, y); await v.waitForTimeout(150) }
await v.waitForTimeout(5000)
const store = await v.evaluate(() => JSON.parse(localStorage.getItem('saas:vibe:lheat:demo-shop')))
console.log('RUNS', store.runs.map(r => r.source), 'CLICK EVENTS', store.events.filter(e => e.kind === 'click').length)
// finish
await v.evaluate(() => [...document.querySelector('vibe-collab').shadowRoot.querySelectorAll('button')].find(b => /Finish/.test(b.textContent)).click()); await v.waitForTimeout(500)
await v.evaluate(() => [...document.querySelector('vibe-collab').shadowRoot.querySelectorAll('button')].find(b => /Close/.test(b.textContent))?.click()); await v.waitForTimeout(500)
console.log('VISITOR DOCK AFTER', await dock())
console.log('VISITOR has heatmap results tool?', (await dock()).some(l => /^Heatmap$/.test(l)))

const sr = (pg) => pg.evaluate(() => document.querySelector('vibe-collab')?.shadowRoot?.textContent ?? '')
// 5-second test as a visitor
const v2 = await ctx.newPage()
await v2.goto(`${BASE}/embed-demo.html?project=demo-shop`); await v2.waitForTimeout(2500)
await v2.evaluate(() => document.querySelector('vibe-collab').shadowRoot.querySelector('[data-vc-research="fivesec"]').click()); await v2.waitForTimeout(300)
console.log('FIVESEC CONSENT', (await sr(v2)).match(/5-second test.{0,140}/)?.[0])
await v2.evaluate(() => [...document.querySelector('vibe-collab').shadowRoot.querySelectorAll('button')].find(b => b.textContent.trim() === 'OK').click()); await v2.waitForTimeout(600)
console.log('FIVESEC INTRO', (await sr(v2)).slice(0, 200))
await v2.close()
// usability as a visitor
const v3 = await ctx.newPage()
await v3.goto(`${BASE}/embed-demo.html?project=demo-shop`); await v3.waitForTimeout(2500)
await v3.evaluate(() => document.querySelector('vibe-collab').shadowRoot.querySelector('[data-vc-research="usability"]').click()); await v3.waitForTimeout(300)
console.log('USABILITY CONSENT', (await sr(v3)).match(/Usability test.{0,160}/)?.[0])
await v3.evaluate(() => [...document.querySelector('vibe-collab').shadowRoot.querySelectorAll('button')].find(b => b.textContent.trim() === 'OK').click()); await v3.waitForTimeout(600)
console.log('USABILITY INTRO', (await sr(v3)).slice(0, 200))
await v3.close()
// pause the 5-second default in the demo panel → hidden for visitors
await p.goto(`${BASE}/app#/app/research?module=fivesec`); await p.waitForTimeout(1000)
await p.locator('[data-module-section="fivesec"] button', { hasText: 'Pause' }).click(); await p.waitForTimeout(300)
console.log('PANEL FIVESEC', (await p.locator('[data-module-section="fivesec"]').innerText()).replace(/\n+/g, ' | '))
const v4 = await ctx.newPage()
await v4.goto(`${BASE}/embed-demo.html?project=demo-shop`); await v4.waitForTimeout(2500)
console.log('VISITOR DOCK (5-second paused)', await v4.evaluate(() => [...document.querySelector('vibe-collab').shadowRoot.querySelectorAll('.vc-dock button')].map(b => b.getAttribute('aria-label') || b.textContent.trim())))
await v4.close()
await p.goto(`${BASE}/app#/app/research?module=fivesec`); await p.waitForTimeout(800)
await p.locator('[data-module-section="fivesec"] button', { hasText: 'Resume' }).click()
// as the team: heatmap shows the visitor's clicks
const t = await ctx.newPage()
await t.goto(`${BASE}/embed-demo.html?project=demo-shop`); await t.waitForTimeout(300)
await t.evaluate(() => localStorage.setItem('saas:vibe:session:demo-shop', JSON.stringify({ project: 'demo-shop', exp: Date.now() + 3600e3, preview: false })))
await t.reload(); await t.waitForTimeout(2500)
console.log('TEAM DOCK', await t.evaluate(() => [...document.querySelector('vibe-collab').shadowRoot.querySelectorAll('.vc-dock button')].map(b => b.getAttribute('aria-label') || b.textContent.trim())))
await t.evaluate(() => [...document.querySelector('vibe-collab').shadowRoot.querySelectorAll('.vc-dock button')].find(b => b.getAttribute('aria-label') === 'Heatmap').click()); await t.waitForTimeout(1500)
console.log('TEAM HEATMAP', (await sr(t)).match(/(Sample data|No clicks|\d+ (people|person)[^.]{0,60})/g)?.slice(0, 3))
// an "old" project: pre-change config (audience reviewers), no session → nothing; with team session → as before
const o = await ctx.newPage()
await o.goto(`${BASE}/embed-demo.html?project=old-shop`); await o.waitForTimeout(300)
await o.evaluate(() => localStorage.setItem('saas:vibe:config:old-shop', JSON.stringify({ live: { version: 3, config: { v: 1, on: true, modules: { comments: true, heatmap: true, usability: true }, theme: { accent: '#e8590c', mode: 'light' }, launcher: { kind: 'floating', position: 'right', label: 'Comment', shortcut: true }, audience: 'reviewers', envs: [] }, at: '2026-11-20T00:00:00Z', by: 'Old' }, draft: null })))
await o.reload(); await o.waitForTimeout(2500)
console.log('OLD PROJECT, VISITOR', await o.evaluate(() => document.querySelector('vibe-collab')?.shadowRoot?.querySelectorAll('.vc-dock button').length ?? 'no widget'))
await o.evaluate(() => localStorage.setItem('saas:vibe:session:old-shop', JSON.stringify({ project: 'old-shop', exp: Date.now() + 3600e3, preview: false })))
await o.reload(); await o.waitForTimeout(2500)
console.log('OLD PROJECT, TEAM DOCK', await o.evaluate(() => [...document.querySelector('vibe-collab').shadowRoot.querySelectorAll('.vc-dock button')].map(b => b.getAttribute('aria-label') || b.textContent.trim())))
// stray "New study" anywhere in the panel
for (const path of ['/app', '/app/research', '/app/products', '/app/widget', '/app/install']) { await p.goto(`${BASE}/app#` + path); await p.waitForTimeout(700); const n = await p.getByText(/New study/i).count(); console.log('NEW STUDY on', path, n) }
await b.close()
