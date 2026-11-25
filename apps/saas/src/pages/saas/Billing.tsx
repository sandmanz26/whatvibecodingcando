// Settings → Billing: the workspace's plan, sites used vs paid, price, upgrade and manage billing.
// While billing is off (the default) it says so plainly: free during the beta, nothing to pay.
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cloud } from '../../saas/supabase'
import { PRICING } from '../../saas/products'
import { billingStatus, openPortal, startCheckout, trackActivated, type BillingStatus } from '../../saas/billing'
import { useStore } from '../../store/store'

const PLAN_NAME: Record<BillingStatus['plan'], string> = { free: 'Free', pro: 'Pro', pro_beta: 'Pro (beta)', founding: 'Founding' }
const STATUS: Record<string, string> = { trialing: 'Trial', active: 'Active', past_due: 'Payment failed: update your card in Manage billing', paused: 'Paused', canceled: 'Canceled' }
const day = (v?: string | null) => (v ? new Date(v).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '')

export function BillingPage() {
  const { toast } = useStore()
  const [params] = useSearchParams()
  const [s, setS] = useState<BillingStatus | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!cloud) return
    let live = true
    void billingStatus().then((v) => { if (live && v) { setS(v); trackActivated(v) } }, () => { if (live) setError('Couldn’t load billing. Try again in a minute.') })
    return () => { live = false }
  }, [])
  const go = (f: () => Promise<void>) => { setBusy(true); f().catch((e: Error) => { toast(e.message, 'error'); setBusy(false) }) }

  const head = <div className="up-head"><div><Link to="/app/settings" className="up-muted"><ArrowLeft size={12} /> Settings</Link><h1>Billing</h1></div></div>
  if (!cloud) return <div className="up-page">{head}<section className="up-card"><h2>Free during the beta</h2><p>This browser-only demo has no billing. Everything is free.</p></section></div>
  if (error) return <div className="up-page">{head}<section className="up-card"><p>{error}</p></section></div>
  if (!s) return <div className="up-page">{head}<section className="up-card"><p className="up-muted">Loading…</p></section></div>

  const sub = s.source === 'subscription'
  const tier = sub ? s.price_tier : s.founding_mine || s.founding_left > 0 ? 'founding' : 'normal'
  const price = tier === 'founding' ? PRICING.foundingPerSite : PRICING.proPerSite
  const over = s.site_limit != null && s.sites_used > s.site_limit

  if (!s.billing_enabled) {
    return (
      <div className="up-page">{head}
        <section className="up-card">
          <h2>Free during the beta</h2>
          <p>Billing isn’t switched on yet. Every feature is free while ourhunch is in beta, with no limit on sites, and there’s nothing to pay or set up.</p>
          <p className="up-muted">When paid plans start, we’ll email you beforehand. The plans then: {PRICING.freeSites} site stays free; Pro is {PRICING.proPerSite} per site a month, and the first {PRICING.foundingCustomers} paying workspaces keep {PRICING.foundingPerSite} per site for as long as their subscription stays active. Nothing you make now is ever deleted.</p>
          <p className="up-muted">You use {s.sites_used} site{s.sites_used === 1 ? '' : 's'}.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="up-page">{head}
      {params.get('done') && !sub && <section className="up-card"><p>Thanks! Your payment is being confirmed; this page shows Pro within a minute. Reload if it doesn’t.</p></section>}
      <section className="up-card">
        <h2>{PLAN_NAME[s.plan]}{sub && s.price_tier === 'founding' ? ' · founding price' : ''}</h2>
        <dl className="up-grid2">
          <div className="lp-field">Sites used<span className="up-static">{s.sites_used}{s.site_limit != null ? ` of ${s.site_limit} ${sub ? 'paid' : 'included'}` : ' (no limit)'}</span></div>
          {sub && <div className="lp-field">Price<span className="up-static">{price} per site a month × {s.paid_sites}</span></div>}
          {sub && s.status && <div className="lp-field">Status<span className="up-static">{STATUS[s.status] ?? s.status}</span></div>}
          {sub && (s.cancel_at || s.current_period_end) && <div className="lp-field">{s.cancel_at ? 'Ends on' : 'Renews on'}<span className="up-static">{day(s.cancel_at ?? s.current_period_end)}</span></div>}
          {s.source === 'override' && <div className="lp-field">Plan<span className="up-static">Set by the ourhunch team: no site limit.</span></div>}
        </dl>
        {over && <p className="up-error">You have {s.sites_used} sites and your plan covers {s.site_limit}. Your oldest {s.site_limit === 1 ? 'site keeps' : `${s.site_limit} sites keep`} working; the others don’t collect new comments until you add sites to your plan. Nothing is deleted: you can still read, resolve and export everything.</p>}
        {!s.can_manage && <p className="up-muted">Only the workspace’s owner or an admin can change billing.</p>}
        {s.can_manage && (
          <div className="up-row">
            {!sub && s.source !== 'override' && <button className="lp-btn primary sm" disabled={busy} onClick={() => go(() => startCheckout(Math.max(1, s.sites_used), tier ?? 'normal'))}>
              Upgrade to Pro: {price} per site a month{tier === 'founding' ? ' (founding)' : ''}</button>}
            {s.has_customer && <button className="lp-btn sm" disabled={busy} onClick={() => go(openPortal)}>Manage billing</button>}
          </div>
        )}
        {s.can_manage && <p className="lp-hint">{sub
          ? 'Change the number of sites, your card, or cancel in Manage billing; invoices are there too. Payments are handled by Paddle, our reseller (merchant of record), which also handles tax.'
          : `Checkout opens Paddle’s secure page for ${Math.max(1, s.sites_used)} site${s.sites_used > 1 ? 's' : ''}. ${tier === 'founding' ? `Founding price: ${s.founding_left} of ${PRICING.foundingCustomers} left, kept while your subscription stays active.` : ''}`}</p>}
      </section>
    </div>
  )
}
