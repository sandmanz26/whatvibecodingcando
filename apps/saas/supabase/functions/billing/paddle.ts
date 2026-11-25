/**
 * Paddle Billing (merchant of record). API: https://developer.paddle.com/api-reference/overview
 * - Checkout: POST /transactions with the price and quantity; Paddle answers with checkout.url, which
 *   opens the "default payment link" set in Paddle (our /app page loads Paddle.js for it: src/saas/billing.ts).
 * - Portal: POST /customers/{id}/portal-sessions.
 * - Webhooks: header Paddle-Signature "ts=…;h1=…", h1 = HMAC-SHA256(secret, ts + ":" + raw body).
 */
import { hmacHex, same, type BillingEvent, type BillingProvider, type Prices, type SubStatus } from './provider.ts'

const STATUSES: SubStatus[] = ['trialing', 'active', 'past_due', 'paused', 'canceled']
/** Signatures older than this are refused (replays). */
const TOLERANCE_S = 300

export function paddle(o: { apiKey: string; webhookSecret: string; sandbox: boolean; fetch?: typeof fetch }): BillingProvider {
  const base = o.sandbox ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com'
  const f = o.fetch ?? fetch
  async function api<T>(path: string, body: unknown): Promise<T> {
    const r = await f(base + path, { method: 'POST', headers: { Authorization: `Bearer ${o.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({})) as { data?: T; error?: { code?: string; detail?: string } }
    if (!r.ok || !j.data) throw new Error(`paddle ${path}: ${r.status} ${j.error?.code ?? ''}`)
    return j.data
  }
  return {
    name: 'paddle',
    async createCheckout(i) {
      const d = await api<{ checkout?: { url?: string } }>('/transactions', {
        items: [{ price_id: i.priceId, quantity: i.quantity }],
        ...(i.customerId ? { customer_id: i.customerId } : {}),
        custom_data: { workspace_id: i.workspaceId },
        collection_mode: 'automatic',
      })
      if (!d.checkout?.url) throw new Error('paddle: no checkout url (set a default payment link in Paddle)')
      return d.checkout.url
    },
    async portalUrl(customerId) {
      const d = await api<{ urls?: { general?: { overview?: string } } }>(`/customers/${encodeURIComponent(customerId)}/portal-sessions`, {})
      if (!d.urls?.general?.overview) throw new Error('paddle: no portal url')
      return d.urls.general.overview
    },
    async verify(raw, headers, now = Date.now()) {
      const h = headers.get('paddle-signature') ?? ''
      if (!o.webhookSecret || !h) return false
      const parts = h.split(';').map((p) => p.split('=') as [string, string])
      const ts = parts.find(([k]) => k === 'ts')?.[1] ?? ''
      const sigs = parts.filter(([k]) => k === 'h1').map(([, v]) => v ?? '')
      if (!/^\d{1,12}$/.test(ts) || !sigs.length) return false
      if (Math.abs(now / 1000 - Number(ts)) > TOLERANCE_S) return false
      const want = await hmacHex(o.webhookSecret, `${ts}:${raw}`)
      return sigs.some((s) => same(s, want))
    },
    parse(raw, prices: Prices) {
      let e: { event_id?: string; event_type?: string; occurred_at?: string; data?: Record<string, unknown> }
      try { e = JSON.parse(raw) } catch { return null }
      if (!e || typeof e.event_id !== 'string' || typeof e.event_type !== 'string') return null
      const d = (e.data ?? {}) as {
        id?: string; status?: string; customer_id?: string; updated_at?: string
        items?: { quantity?: number; price?: { id?: string } }[]
        current_billing_period?: { ends_at?: string } | null
        scheduled_change?: { action?: string; effective_at?: string } | null
        custom_data?: { workspace_id?: string } | null
      }
      const ws = typeof d.custom_data?.workspace_id === 'string' && /^[0-9a-f-]{36}$/i.test(d.custom_data.workspace_id) ? d.custom_data.workspace_id : null
      const out: BillingEvent = { id: e.event_id.slice(0, 100), type: e.event_type.slice(0, 80), workspaceId: ws, sub: null, payload: {} }
      if (!e.event_type.startsWith('subscription.') || !d.id || !d.customer_id) return out
      const item = d.items?.find((i) => i.price?.id === prices.founding || i.price?.id === prices.normal) ?? d.items?.[0]
      const priceId = item?.price?.id ?? ''
      const status = STATUSES.includes(d.status as SubStatus) ? d.status as SubStatus : null
      if (!status) return out
      const cancelAt = d.scheduled_change?.action === 'cancel' ? d.scheduled_change.effective_at ?? null : null
      out.sub = {
        customer_id: d.customer_id, subscription_id: d.id, status,
        price_tier: priceId && priceId === prices.founding ? 'founding' : 'normal',
        quantity: Math.max(1, Math.min(1000, Math.floor(Number(item?.quantity) || 1))),
        current_period_end: d.current_billing_period?.ends_at ?? null,
        cancel_at: cancelAt,
        occurred_at: e.occurred_at ?? d.updated_at ?? new Date().toISOString(),
      }
      out.payload = { subscription_id: d.id, status, quantity: out.sub.quantity, price_id: priceId || null, occurred_at: out.sub.occurred_at }
      return out
    },
  }
}
