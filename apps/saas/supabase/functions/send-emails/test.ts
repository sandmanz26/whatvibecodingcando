// Tests for the email function, without Deno or a server (Deno, fetch, Supabase and Resend are mocked).
// Run from apps/saas: npx esbuild supabase/functions/send-emails/test.ts --bundle --platform=node --format=esm --outfile=/tmp/send-emails-test.mjs && node /tmp/send-emails-test.mjs
import { render, renderLifecycle, renderWeekly, elementLine, deviceText } from './render.ts'
let fails = 0
const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++ }
const d = { project_id: 'toko', project_name: 'Toko <Budi>', site_url: null, outbox_ids: [1, 2], total: 23, recipients: ['a@x.com', 'b@x.com'],
  items: [{ id: 1, at: '', type: 'comment', kind: 'comment', page: '/checkout', thread_id: 't', author: 'Ani', text: '<script>alert(1)</script> button hidden' },
          { id: 2, at: '', type: 'reply', kind: 'voice', page: '/', thread_id: 't', author: 'Budi', text: 'still there' }] } as any
const out = render(d, 'https://app.test/', false)
ok(out.length === 2 && out[0].to === 'a@x.com', 'one email per member')
ok(out[0].subject === 'Toko <Budi>: 23 new comments and replies', 'subject: ' + out[0].subject)
ok(!out[0].html.includes('<script>') && out[0].html.includes('&lt;script&gt;') && out[0].html.includes('Toko &lt;Budi&gt;'), 'names and comments are escaped in HTML')
ok(out[0].html.includes('https://app.test/app#/app/comments') && out[0].html.includes('…and 21 more'), 'link to the inbox and the count of the rest')
ok(out[0].text.includes('Budi replied on /') , 'plain-text version: ' + out[0].text.split('\n')[3])
const one = render({ ...d, total: 1, items: [d.items[0]] }, 'https://app.test', true)
ok(one[0].subject === 'Today on Toko <Budi>: a new comment', 'daily subject: ' + one[0].subject)
const appr = render({ ...d, total: 1, items: [{ id: 9, at: '', type: 'approval', kind: null, page: '', thread_id: null, author: 'Ani <b>', text: 'Round 2', version: '1.4', open_comments: 2, round_n: 2 }] } as any, 'https://app.test', false)
ok(appr[0].subject === 'Toko <Budi>: Ani <b> approved Round 2', 'approval subject: ' + appr[0].subject)
ok(appr[0].html.includes('Ani &lt;b&gt;') && appr[0].html.includes('Site version 1.4') && appr[0].html.includes('2 comments still open') && appr[0].html.includes('/app#/app/rounds'), 'approval email: escaped name, version, open comments, link to Rounds')
ok(appr[0].text.includes('not a legal signature'), 'approval email says it is a record, not a signature')

// ---- polish: context, kinds, frame
const ctx = render({ ...d, total: 1, items: [{ id: 3, at: '', type: 'comment', kind: 'voice', page: '/cart', thread_id: 't', author: 'Ani', text: 'x'.repeat(400), round_n: 2, round_name: 'Round 2',
  element: { tag: 'button', text: 'Pay now' }, device: { browser: 'Chrome 131', os: 'macOS', w: 1280, h: 800 } }] } as any, { appUrl: 'https://app.test', postal: 'Jl. Contoh 1, Bali' }, false)[0]
ok(ctx.html.includes('button “Pay now”') && ctx.html.includes('Chrome 131 · macOS · 1280×800') && ctx.html.includes('Voice note') && ctx.html.includes('Round 2'), 'comment shows element, device, voice marker and round')
ok(ctx.text.includes('x'.repeat(279) + '…') && !ctx.text.includes('x'.repeat(281)), 'comment excerpt is at most 280 characters')
ok(ctx.html.includes('>Open comment<') && ctx.html.includes('Jl. Contoh 1, Bali') && ctx.text.includes('Jl. Contoh 1, Bali'), 'one comment: “Open comment”; postal address in the footer')
ok(!out[0].html.includes('Contoh'), 'no postal line when EMAIL_POSTAL_ADDRESS is unset')
ok(ctx.html.includes('display:none') && ctx.html.includes('max-width:600px') && ctx.html.includes('role="presentation"'), 'preheader, 600px, table layout')
const res = render({ ...d, total: 3, items: [1, 2, 3].map((k) => ({ id: k, at: '', type: 'result', kind: null, page: '', thread_id: null, author: '', text: 'Checkout test', study_id: 's1', results_total: 7, tasks: { ok: 3, all: 4 } })) } as any, 'https://app.test', false)[0]
ok(res.subject === 'Toko <Budi>: 3 new results in “Checkout test”' && res.html.includes('75% of tasks completed so far') && res.html.includes('>See results<'), 'results are grouped per study with the success rate: ' + res.subject)
const live = render({ ...d, total: 1, items: [{ id: 4, at: '', type: 'live', kind: null, page: '', thread_id: null, author: '', text: 'shop.test', host: 'shop.test' }] } as any, 'https://app.test', false)[0]
ok(live.subject === 'ourhunch is live on shop.test' && live.html.includes('>Send your first review link<') && live.html.includes('/app#/app/reviewers'), 'first install: “live on …”, next step review link')
const rnd = render({ ...d, total: 2, items: [{ id: 5, at: '', type: 'due', kind: null, page: '', thread_id: null, author: '', text: 'Round 3', round_name: 'Round 3', due: '2026-12-01' },
  { id: 6, at: '', type: 'reviewing', kind: null, page: '', thread_id: null, author: 'Ani', text: 'Round 3', round_name: 'Round 3' }] } as any, 'https://app.test', false)[0]
ok(rnd.subject.includes('your client started reviewing') && rnd.subject.includes('Round 3 is due tomorrow') && rnd.html.includes('>Open Rounds<'), 'round reminders in one email: ' + rnd.subject)
const ap2 = render({ ...d, total: 1, items: [{ id: 9, at: '', type: 'approval', kind: null, page: '', thread_id: null, author: 'Ani', text: 'Round 2', approval_id: 'ap-1', version: '1.4', open_comments: 0 }] } as any, 'https://app.test', false)[0]
ok(ap2.html.includes('/app#/app/rounds/ap-1/record') && ap2.html.includes('>View approval record<'), 'approval links to its record')
ok(elementLine({ sel: '#x > div' }) === '#x > div' && elementLine({ tag: 'a', label: 'Pricing' }) === 'link “Pricing”' && deviceText(null) === '', 'element and device lines')

// ---- lifecycle
const brand = { appUrl: 'https://ourhunch.test', founder: 'Rina', replyTo: 'rina@ourhunch.test', unsubscribeEndpoint: 'https://sb.test/functions/v1/send-emails', postal: 'Somewhere 1' }
const tok = 'a'.repeat(64)
const w = renderLifecycle({ user_id: 'u', email: 'n@x.test', token: tok, kind: 'welcome', has_project: false, installed: null, project_name: null, project_id: null }, brand)
ok(w.subject === 'Welcome to ourhunch' && w.html.includes('Rina') && w.replyTo === 'rina@ourhunch.test' && w.html.includes('>Set up your first site<'), 'welcome: signed by the founder, reply-to, first-site button')
ok(w.html.includes('$2') && w.html.includes('$4.80') && w.html.includes('first 200') && w.text.includes('I read every one'), 'welcome: founding price note from PRICING, honest reply line')
ok(w.headers?.['List-Unsubscribe'] === `<https://sb.test/functions/v1/send-emails?unsubscribe=${tok}>` && w.headers?.['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click', 'lifecycle: List-Unsubscribe one-click headers')
ok(w.html.includes(`https://ourhunch.test/app#/unsubscribe?t=${tok}`) && w.text.includes('Unsubscribe: https://ourhunch.test/app#/unsubscribe'), 'lifecycle: unsubscribe link in HTML and text')
const w2 = renderLifecycle({ user_id: 'u', email: 'n@x.test', token: tok, kind: 'welcome', has_project: true, installed: false, project_name: 'P', project_id: 'p-01' }, { appUrl: 'https://ourhunch.test' })
ok(w2.html.includes('>Add the script<') && w2.html.includes('The ourhunch team') && !w2.replyTo, 'welcome with a project: “Add the script”; fallback signature')
const d1 = renderLifecycle({ user_id: 'u', email: 'n@x.test', token: tok, kind: 'day1', has_project: true, installed: false, project_name: 'P', project_id: 'shop-01' }, brand)
ok(d1.subject === 'Add ourhunch in 2 minutes' && d1.html.includes('data-project=&quot;shop-01&quot;') && d1.html.includes('AI builder') && d1.html.includes('/app#/app/install'), 'day 1: snippet with their project id, AI-builder tip, install page')
const d3 = renderLifecycle({ user_id: 'u', email: 'n@x.test', token: tok, kind: 'day3', has_project: true, installed: true, project_name: 'P', project_id: 'p' }, brand)
const d7 = renderLifecycle({ user_id: 'u', email: 'n@x.test', token: tok, kind: 'day7', has_project: true, installed: true, project_name: 'P', project_id: 'p' }, brand)
ok(d3.html.includes('/app#/app/reviewers') && d7.html.includes('/app#/app/research') && d7.html.includes('5-second test'), 'day 3 → Reviewers, day 7 → Research')
ok(!ctx.headers && !res.headers, 'activity emails carry no unsubscribe headers (settings link instead)')
const wk = renderWeekly({ user_id: 'u', email: 'o@x.test', kind: 'weekly-2026-48', projects: [{ project_id: 'p', project_name: 'Toko <B>', comments: 4, resolved: 2, results: 1, approvals: 0 }] }, brand)
ok(wk.subject === 'Your week on Toko <B>' && wk.html.includes('Toko &lt;B&gt;') && wk.html.includes('4 new comments') && wk.html.includes('2 resolved') && !wk.html.includes('approval'), 'weekly summary: escaped, only non-zero numbers')

// ---- the function: auth, sending, retries
const envs: Record<string, string> = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', RESEND_API_KEY: 're_x', EMAIL_FROM: 'VC <n@x.test>', EMAIL_CRON_SECRET: 'secret-123', APP_URL: 'https://app.test' }
let handler: (r: Request) => Promise<Response>
;(globalThis as any).Deno = { env: { get: (k: string) => envs[k] }, serve: (h: any) => { handler = h } }
const calls: string[] = []; let resendFails = false; let lifecycle: unknown[] = []
;(globalThis as any).fetch = async (url: string, init: any) => {
  calls.push(url.replace('https://', '') + ' ' + (init?.body ?? '').slice(0, 60))
  if (url.endsWith('/rpc/email_due')) return new Response(JSON.stringify([{ project_id: 'p', project_name: 'P', site_url: null, outbox_ids: [5, 6], total: 2, recipients: ['o@x.test'], items: [{ id: 5, at: '', type: 'comment', kind: 'comment', page: '/', thread_id: 't', author: 'Ani', text: 'hi' }] }]))
  if (url.endsWith('/rpc/email_done') || url.endsWith('/rpc/email_sent_mark')) return new Response(null, { status: 204 })
  if (url.endsWith('/rpc/email_lifecycle_due')) return new Response(JSON.stringify(lifecycle))
  if (url.endsWith('/rpc/email_weekly_due')) return new Response(JSON.stringify([{ user_id: 'u1', email: 'o@x.test', kind: 'weekly-2026-48', projects: [{ project_id: 'p', project_name: 'P', comments: 1, resolved: 0, results: 0, approvals: 0 }] }]))
  if (url.endsWith('/rpc/email_unsubscribe')) return new Response('true')
  if (url.includes('resend.com')) return resendFails ? new Response('bad', { status: 422 }) : new Response('{"data":[]}')
  return new Response('nope', { status: 404 })
}
await import('./index.ts')
const call = (auth: string, body = '{"mode":"instant"}') => handler(new Request('https://fn.test', { method: 'POST', headers: { Authorization: auth }, body }))
ok((await call('Bearer wrong')).status === 401 && calls.length === 0, 'a wrong secret is refused before anything runs')
let r = await (await call('Bearer secret-123')).json()
ok(r.emails === 1 && r.failed === 0, 'sends one email: ' + JSON.stringify(r))
ok(calls.some((c) => c.includes('resend.com/emails/batch')) && calls.some((c) => c.includes('email_done') && c.includes('[5,6]')), 'marks the outbox rows done after sending')
calls.length = 0; resendFails = true
r = await (await call('Bearer secret-123', '{"mode":"daily"}')).json()
ok(r.failed === 1 && !calls.some((c) => c.includes('email_done')), 'a failed send leaves the rows pending for the next run')
ok(calls[0].includes('"p_daily":true'), 'daily mode asks for the daily summary')
ok(!calls.some((c) => c.includes('lifecycle')), 'the daily run sends no lifecycle emails')
resendFails = false; calls.length = 0
lifecycle = [{ user_id: 'u1', email: 'n@x.test', token: 'b'.repeat(64), kind: 'welcome', has_project: false, installed: null, project_name: null, project_id: null }]
r = await (await call('Bearer secret-123')).json()
ok(r.emails === 2 && calls.some((c) => c.includes('email_lifecycle_due') && c.includes('"p_welcome_only":true')) && calls.some((c) => c.includes('email_sent_mark')), 'instant run also sends welcomes and records them: ' + JSON.stringify(r))
calls.length = 0
r = await (await call('Bearer secret-123', '{"mode":"lifecycle"}')).json()
ok(calls.some((c) => c.includes('"p_welcome_only":false')) && !calls.some((c) => c.includes('email_due')), 'lifecycle run: every kind, no activity emails')
calls.length = 0
r = await (await call('Bearer secret-123', '{"mode":"weekly"}')).json()
ok(r.emails === 1 && calls.some((c) => c.includes('email_weekly_due')), 'weekly run sends the weekly summary')
calls.length = 0
const unsub = await handler(new Request('https://fn.test/?unsubscribe=' + 'c'.repeat(64), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'List-Unsubscribe=One-Click' }))
ok(unsub.status === 200 && calls.some((c) => c.includes('email_unsubscribe')), 'one-click unsubscribe works without the cron secret')
calls.length = 0
const unsub2 = await handler(new Request('https://fn.test/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unsubscribe: 'd'.repeat(64) }) }))
ok(unsub2.status === 200 && calls.some((c) => c.includes('email_unsubscribe')), 'the app’s unsubscribe page works with the token only')
calls.length = 0
const bad = await handler(new Request('https://fn.test/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ unsubscribe: 'nope', mode: 'instant' }) }))
ok(bad.status === 400 && calls.length === 0, 'a malformed token is refused and sends nothing')

console.log(fails ? fails + ' FAILED' : 'ALL PASS')
if (fails) throw new Error('email tests failed')
