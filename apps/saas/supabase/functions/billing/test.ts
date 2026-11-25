// Tests for the billing function, without Deno or a server (the provider's API and Supabase are mocked).
// Run from apps/saas: npx esbuild supabase/functions/billing/test.ts --bundle --platform=node --format=esm --outfile=/tmp/billing-test.mjs && node /tmp/billing-test.mjs
import { handle, type Deps } from './handler.ts'
import { paddle } from './paddle.ts'
import { hmacHex } from './provider.ts'

let fails = 0
const ok = (c: boolean, m: string) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++ }
const SECRET = 'pdl_ntfset_test_secret'
const WS = '00000000-0000-0000-0000-0000000b1a01'
const PRICES = { BILLING_PRICE_FOUNDING: 'pri_founding', BILLING_PRICE_NORMAL: 'pri_normal' }

// fixture: a Paddle subscription.created event (trimmed to the fields we read, plus some we must drop)
const fixture = (id: string, quantity: number, status = 'active', at = '2026-11-26T10:00:00Z') => JSON.stringify({
  event_id: id, event_type: 'subscription.created', occurred_at: at, notification_id: 'ntf_1',
  data: { id: 'sub_01', status, customer_id: 'ctm_01', address_id: 'add_01', updated_at: at,
    items: [{ quantity, price: { id: 'pri_founding', unit_price: { amount: '200', currency_code: 'USD' } } }],
    current_billing_period: { starts_at: at, ends_at: '2026-12-26T10:00:00Z' },
    scheduled_change: null, custom_data: { workspace_id: WS },
    billing_details: { payment_terms: null }, card: { last4: '4242' } },
})
const sign = async (body: string, ts = Math.floor(Date.now() / 1000)) => `ts=${ts};h1=${await hmacHex(SECRET, `${ts}:${body}`)}`
const req = (route: string, body: string, headers: Record<string, string> = {}) =>
  new Request(`https://x.test/billing?route=${route}`, { method: 'POST', body, headers })

// a fake database: billing_apply_event stores each event id once (as the SQL does)
function fakeDb(enabled = true) {
  const seen = new Set<string>(); const applied: Record<string, unknown>[] = []; const calls: string[] = []
  const rpc = async <T,>(fn: string, a: Record<string, unknown>): Promise<T> => {
    calls.push(fn)
    if (fn === 'billing_apply_event') {
      if (seen.has(String(a.p_event_id))) return 'duplicate' as T
      seen.add(String(a.p_event_id)); applied.push(a); return 'applied' as T
    }
    if (fn === 'billing_enabled') return enabled as T
    if (fn === 'billing_checkout_context') return (a.p_user === 'owner' ? { sites: 3, customer_id: null, live: false } : null) as T
    if (fn === 'billing_reserve_tier') return 'founding' as T
    throw new Error('unexpected rpc ' + fn)
  }
  return { rpc, applied, calls }
}
const paddleFetch: { url: string; body: string }[] = []
const fakeFetch = (async (url: string, init: RequestInit) => {
  paddleFetch.push({ url, body: String(init.body) })
  if (url.endsWith('/transactions')) return Response.json({ data: { id: 'txn_1', checkout: { url: 'https://ourhunch.test/app?_ptxn=txn_1' } } })
  return Response.json({ data: { urls: { general: { overview: 'https://customer.paddle.com/x' } } } })
}) as unknown as typeof fetch
const provider = paddle({ apiKey: 'k', webhookSecret: SECRET, sandbox: true, fetch: fakeFetch })
const deps = (db: ReturnType<typeof fakeDb>, env: Record<string, string> = {}): Deps => ({
  env: (k) => ({ BILLING_ENABLED: 'true', ...PRICES, ...env } as Record<string, string>)[k] ?? '',
  provider, rpc: db.rpc,
  user: async (a) => (a === 'Bearer owner-token-xxxxxxxxxxxxxxxx' ? { id: 'owner' } : a === 'Bearer member-token-xxxxxxxxxxxxxxx' ? { id: 'member' } : null),
})

// signature verification
{
  const body = fixture('evt_1', 3)
  ok(await provider.verify(body, new Headers({ 'paddle-signature': await sign(body) })), 'a correctly signed event is accepted')
  ok(!(await provider.verify(body + ' ', new Headers({ 'paddle-signature': await sign(body) }))), 'a changed body is refused')
  ok(!(await provider.verify(body, new Headers({ 'paddle-signature': (await sign(body)).replace(/h1=[0-9a-f]+/, 'h1=' + '0'.repeat(64)) }))), 'a wrong signature is refused')
  ok(!(await provider.verify(body, new Headers({ 'paddle-signature': await sign(body, Math.floor(Date.now() / 1000) - 3600) }))), 'an old signature (replay) is refused')
  ok(!(await provider.verify(body, new Headers())), 'no signature is refused')
  const two = `${await sign(body)};h1=deadbeef`
  ok(await provider.verify(body, new Headers({ 'paddle-signature': two })), 'any of several h1 signatures (secret rotation) is accepted')
}

// parsing: minimal payload, tier from the price id
{
  const e = provider.parse(fixture('evt_1', 3), { founding: 'pri_founding', normal: 'pri_normal' })!
  ok(e.workspaceId === WS && e.sub?.quantity === 3 && e.sub.price_tier === 'founding' && e.sub.status === 'active', 'subscription event parsed: workspace, quantity, founding tier')
  ok(!JSON.stringify(e).includes('4242') && !JSON.stringify(e).includes('add_01'), 'no card or address data is kept')
  ok(provider.parse('not json', { founding: 'a', normal: 'b' }) === null, 'junk is refused')
}

// webhook route: idempotent
{
  const db = fakeDb()
  const body = fixture('evt_9', 2)
  const r1 = await (await handle(req('webhook', body, { 'paddle-signature': await sign(body) }), deps(db))).json()
  const r2 = await (await handle(req('webhook', body, { 'paddle-signature': await sign(body) }), deps(db))).json()
  ok(r1.result === 'applied' && r2.result === 'duplicate' && db.applied.length === 1, 'the same event twice is applied once')
  const bad = await handle(req('webhook', body, { 'paddle-signature': 'ts=1;h1=00' }), deps(db))
  ok(bad.status === 401 && db.applied.length === 1, 'an unsigned webhook changes nothing')
  const off = await handle(req('webhook', fixture('evt_10', 1), { 'paddle-signature': await sign(fixture('evt_10', 1)) }), deps(fakeDb(false), { BILLING_ENABLED: '' }))
  ok(off.status === 200, 'webhooks are still recorded while billing is off (nothing is lost)')
}

// checkout and portal
{
  const db = fakeDb(false)
  const r = await handle(req('checkout', JSON.stringify({ workspace_id: WS }), { Authorization: 'Bearer owner-token-xxxxxxxxxxxxxxxx' }), deps(db))
  ok(r.status === 503 && (await r.json()).error === 'billing_disabled', 'checkout: clear error while the database switch is off')
  const r0 = await handle(req('checkout', JSON.stringify({ workspace_id: WS }), { Authorization: 'Bearer owner-token-xxxxxxxxxxxxxxxx' }), deps(fakeDb(), { BILLING_ENABLED: 'false' }))
  ok(r0.status === 503, 'checkout: clear error while the secret switch is off')
  const on = fakeDb()
  const anon = await handle(req('checkout', JSON.stringify({ workspace_id: WS })), deps(on))
  ok(anon.status === 401, 'checkout needs a signed-in user')
  const mem = await handle(req('checkout', JSON.stringify({ workspace_id: WS }), { Authorization: 'Bearer member-token-xxxxxxxxxxxxxxx' }), deps(on))
  ok(mem.status === 403, 'checkout: only owners and admins')
  paddleFetch.length = 0
  const good = await handle(req('checkout', JSON.stringify({ workspace_id: WS }), { Authorization: 'Bearer owner-token-xxxxxxxxxxxxxxxx' }), deps(on))
  const g = await good.json()
  const sent = JSON.parse(paddleFetch[0]?.body ?? '{}')
  ok(good.status === 200 && g.url.includes('_ptxn=txn_1') && g.tier === 'founding', 'checkout returns the provider’s URL')
  ok(sent.items?.[0]?.price_id === 'pri_founding' && sent.items[0].quantity === 3 && sent.custom_data?.workspace_id === WS, 'checkout: founding price, quantity = sites, workspace id attached')
  ok(paddleFetch[0].url.startsWith('https://sandbox-api.paddle.com'), 'sandbox keys use the sandbox API')
  const portal = await handle(req('portal', JSON.stringify({ workspace_id: WS }), { Authorization: 'Bearer owner-token-xxxxxxxxxxxxxxxx' }), deps(on))
  ok(portal.status === 404, 'portal: no customer yet is a clear error')
}

console.log(fails ? `${fails} FAILED` : 'billing function: all passed')
if (fails) (globalThis as unknown as { process: { exit(n: number): void } }).process.exit(1)
