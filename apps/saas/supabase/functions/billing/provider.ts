/**
 * What every billing provider must do. The Edge Function (index.ts) only talks to this interface, so
 * another provider is one new file (like paddle.ts) plus a line in providerFor().
 * No card data ever passes through here: the provider's own checkout collects it.
 */
export type Tier = 'founding' | 'normal'
export type SubStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled'

export interface CheckoutInput {
  priceId: string
  /** paid sites */
  quantity: number
  workspaceId: string
  /** the provider's customer of this workspace, when it already has one */
  customerId?: string | null
}

/** A webhook event reduced to what the database stores (billing_apply_event). */
export interface BillingEvent {
  id: string
  type: string
  workspaceId: string | null
  /** null for events that don't change a subscription */
  sub: {
    customer_id: string
    subscription_id: string
    status: SubStatus
    price_tier: Tier
    quantity: number
    current_period_end: string | null
    cancel_at: string | null
    occurred_at: string
  } | null
  /** ids, status, quantity, price id, dates: never card, address or name data */
  payload: Record<string, string | number | null>
}

export interface Prices { founding: string; normal: string }

export interface BillingProvider {
  name: 'paddle'
  /** A URL to send the browser to (the provider's checkout). */
  createCheckout(input: CheckoutInput): Promise<string>
  /** A URL of the provider's customer portal: payment method, invoices, cancel. */
  portalUrl(customerId: string): Promise<string>
  /** True when the raw body was signed with the webhook secret (and is recent). */
  verify(rawBody: string, headers: Headers, now?: number): Promise<boolean>
  /** The event, or null when it isn't JSON we understand. */
  parse(rawBody: string, prices: Prices): BillingEvent | null
}

/** HMAC-SHA256 as lowercase hex (Web Crypto: Deno and Node 20+). */
export async function hmacHex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)))
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Compares secrets in constant time. */
export function same(a: string, b: string) {
  if (!a || a.length !== b.length) return false
  let x = 0
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return x === 0
}
