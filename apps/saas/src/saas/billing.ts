/**
 * Billing in the panel (docs/BILLING.md). Off until the owner switches it on: while the database
 * setting app_settings.billing_enabled is false, the panel says "Free during the beta" and nothing
 * here charges anyone. Payments happen on the provider's checkout (Paddle, merchant of record);
 * card data never reaches ourhunch.
 */
import { supabase } from './supabase'
import { currentWorkspace } from './cloud'
import { track } from '../lib/analytics'

export interface BillingStatus {
  plan: 'free' | 'pro' | 'pro_beta' | 'founding'
  source: 'subscription' | 'override' | 'free'
  price_tier: 'founding' | 'normal' | null
  status: 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | null
  paid_sites: number | null
  site_limit: number | null
  sites_used: number
  billing_enabled: boolean
  current_period_end?: string | null
  cancel_at?: string | null
  founding_left: number
  founding_mine: boolean
  can_manage: boolean
  has_customer: boolean
}

export async function billingStatus(): Promise<BillingStatus | null> {
  const ws = currentWorkspace()
  if (!supabase || !ws) return null
  const { data, error } = await supabase.rpc('billing_status', { p_ws: ws })
  if (error) throw error
  return data as BillingStatus
}

async function call(route: 'checkout' | 'portal'): Promise<string> {
  const ws = currentWorkspace()
  if (!supabase || !ws) throw new Error('Billing needs the server.')
  const { data, error } = await supabase.functions.invoke(`billing?route=${route}`, { body: { workspace_id: ws } })
  if (error) {
    const body = await (error as { context?: Response }).context?.json?.().catch(() => null) as { message?: string } | null
    throw new Error(body?.message ?? 'The billing server didn’t answer. Try again in a minute.')
  }
  return (data as { url: string }).url
}

/** Starts checkout: the provider's page opens in this tab. */
export async function startCheckout(sites: number, tier: string) {
  const url = await call('checkout')
  track('checkout_started', { sites, tier })
  window.location.assign(url)
}

/** The provider's customer portal: payment method, invoices, number of sites, cancel. */
export async function openPortal() {
  window.location.assign(await call('portal'))
}

/** Once per page: the subscription became active (ids and plan only). */
export function trackActivated(s: BillingStatus) {
  const ws = currentWorkspace()
  if (!ws || s.source !== 'subscription') return
  const key = `vibe.sub.${ws}`
  try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1') } catch { /* ignore */ }
  track('subscription_activated', { plan: 'pro', tier: s.price_tier ?? 'normal', sites: s.paid_sites ?? 0, workspace: ws })
}

/**
 * Paddle's checkout opens on our own page (the "default payment link" set in Paddle is /app):
 * Paddle adds ?_ptxn=txn_… and Paddle.js, loaded only then, shows the checkout over the panel.
 */
const PADDLE_TOKEN: string = import.meta.env.VITE_PADDLE_CLIENT_TOKEN ?? ''
export function openPendingCheckout() {
  const txn = new URLSearchParams(window.location.search).get('_ptxn')
  if (!txn || !/^txn_[a-z0-9]+$/i.test(txn) || !/^(test|live)_[A-Za-z0-9]+$/.test(PADDLE_TOKEN)) return
  const s = document.createElement('script')
  s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
  s.async = true
  s.onload = () => {
    const P = (window as unknown as { Paddle?: { Environment: { set(e: string): void }; Initialize(o: unknown): void } }).Paddle
    if (!P) return
    if (PADDLE_TOKEN.startsWith('test_')) P.Environment.set('sandbox')
    P.Initialize({ token: PADDLE_TOKEN, checkout: { settings: { successUrl: `${window.location.origin}/app#/app/billing?done=1` } } })
  }
  document.head.append(s)
}
