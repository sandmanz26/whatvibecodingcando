/**
 * The billing routes, without Deno (index.ts serves them; test.ts calls them directly).
 *   POST ?route=checkout  {workspace_id}  signed-in owner/admin → {url}   (quantity = the workspace's sites, at least 1)
 *   POST ?route=portal    {workspace_id}  signed-in owner/admin → {url}
 *   POST ?route=webhook   the provider's signed event → {ok, result}
 * Checkout and portal answer 503 {error:'billing_disabled'} unless BILLING_ENABLED is "true" and the
 * database setting app_settings.billing_enabled is on. Webhooks are applied whenever the provider is
 * configured (so no event is lost while switching on); each event is stored once.
 */
import type { BillingProvider, Prices } from './provider.ts'

export interface Deps {
  env: (k: string) => string
  provider: BillingProvider | null
  /** a Supabase RPC with the service role */
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<T>
  /** the signed-in user of a bearer token, or null */
  user: (authorization: string) => Promise<{ id: string } | null>
}

export const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' }
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: CORS })
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function handle(req: Request, d: Deps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const route = new URL(req.url).searchParams.get('route') ?? ''
  const prices: Prices = { founding: d.env('BILLING_PRICE_FOUNDING'), normal: d.env('BILLING_PRICE_NORMAL') }

  if (route === 'webhook') {
    if (!d.provider) return json({ error: 'billing_not_configured' }, 503)
    const raw = await req.text()
    if (raw.length > 200_000 || !(await d.provider.verify(raw, req.headers))) return json({ error: 'bad_signature' }, 401)
    const e = d.provider.parse(raw, prices)
    if (!e) return json({ error: 'bad_event' }, 400)
    const result = await d.rpc<string>('billing_apply_event', {
      p_provider: d.provider.name, p_event_id: e.id, p_event_type: e.type, p_ws: e.workspaceId, p_sub: e.sub, p_payload: e.payload,
    })
    return json({ ok: true, result })
  }

  if (route !== 'checkout' && route !== 'portal') return json({ error: 'not_found' }, 404)
  const on = d.env('BILLING_ENABLED') === 'true' && !!d.provider && await d.rpc<boolean>('billing_enabled', {}).catch(() => false)
  if (!on) return json({ error: 'billing_disabled', message: 'Billing isn’t switched on yet: ourhunch is free during the beta.' }, 503)
  const u = await d.user(req.headers.get('Authorization') ?? '')
  if (!u) return json({ error: 'not_signed_in' }, 401)
  const body = await req.json().catch(() => ({})) as { workspace_id?: unknown }
  const ws = typeof body.workspace_id === 'string' && UUID.test(body.workspace_id) ? body.workspace_id : ''
  if (!ws) return json({ error: 'bad_request' }, 400)
  const ctx = await d.rpc<{ sites: number; customer_id: string | null; live: boolean } | null>('billing_checkout_context', { p_user: u.id, p_ws: ws })
  if (!ctx) return json({ error: 'not_allowed', message: 'Only the workspace’s owner or an admin can manage billing.' }, 403)

  if (route === 'portal') {
    if (!ctx.customer_id) return json({ error: 'no_customer', message: 'There’s no subscription to manage yet.' }, 404)
    return json({ url: await d.provider!.portalUrl(ctx.customer_id) })
  }
  if (ctx.live) return json({ error: 'already_subscribed', message: 'This workspace already has a subscription: change the number of sites in Manage billing.' }, 409)
  const tier = await d.rpc<'founding' | 'normal'>('billing_reserve_tier', { p_ws: ws })
  const priceId = tier === 'founding' ? prices.founding : prices.normal
  if (!priceId) return json({ error: 'billing_not_configured' }, 503)
  const url = await d.provider!.createCheckout({ priceId, quantity: Math.max(1, Math.min(1000, ctx.sites)), workspaceId: ws, customerId: ctx.customer_id })
  return json({ url, tier })
}
