// Tests for the email function, without Deno or a server (Deno, fetch, Supabase and Resend are mocked).
// Run from apps/saas: npx esbuild supabase/functions/send-emails/test.ts --bundle --platform=node --format=esm --outfile=/tmp/send-emails-test.mjs && node /tmp/send-emails-test.mjs
import { render } from './render.ts'
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
ok(appr[0].html.includes('Ani &lt;b&gt;') && appr[0].html.includes('Site version 1.4') && appr[0].html.includes('2 comments were still open') && appr[0].html.includes('/app#/app/rounds'), 'approval email: escaped name, version, open comments, link to Rounds')
ok(appr[0].text.includes('not a legal signature'), 'approval email says it is a record, not a signature')

// ---- the function: auth, sending, retries
const envs: Record<string, string> = { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'srv', RESEND_API_KEY: 're_x', EMAIL_FROM: 'VC <n@x.test>', EMAIL_CRON_SECRET: 'secret-123', APP_URL: 'https://app.test' }
let handler: (r: Request) => Promise<Response>
;(globalThis as any).Deno = { env: { get: (k: string) => envs[k] }, serve: (h: any) => { handler = h } }
const calls: string[] = []; let resendFails = false
;(globalThis as any).fetch = async (url: string, init: any) => {
  calls.push(url.replace('https://', '') + ' ' + (init?.body ?? '').slice(0, 60))
  if (url.endsWith('/rpc/email_due')) return new Response(JSON.stringify([{ project_id: 'p', project_name: 'P', site_url: null, outbox_ids: [5, 6], total: 2, recipients: ['o@x.test'], items: [{ id: 5, at: '', type: 'comment', kind: 'comment', page: '/', thread_id: 't', author: 'Ani', text: 'hi' }] }]))
  if (url.endsWith('/rpc/email_done')) return new Response(null, { status: 204 })
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

console.log(fails ? fails + ' FAILED' : 'ALL PASS')
if (fails) throw new Error('email tests failed')
