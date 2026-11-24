import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BRAND, WEBSITE } from '../../saas/products'
import { cloud } from '../../saas/supabase'
import { unsubscribeCloud } from '../../saas/cloud'
import { BrandMark } from '../../components/BrandMark'
import '../../saas/saas.css'

/**
 * The unsubscribe link of lifecycle emails (#/unsubscribe?t=<token>): one click turns "Tips and
 * product updates" off, without signing in. Activity emails have their own setting in the panel.
 */
export function Unsubscribe() {
  const [params] = useSearchParams()
  const token = params.get('t') ?? ''
  const [state, setState] = useState<'working' | 'done' | 'failed'>('working')
  useEffect(() => {
    document.title = `Unsubscribe · ${BRAND}`
    if (!cloud || !/^[0-9a-f]{64}$/.test(token)) { setState('failed'); return }
    void unsubscribeCloud(token).then((ok) => setState(ok ? 'done' : 'failed'))
  }, [token])
  return (
    <div className="lp lp-legal">
      <header className="lp-wrap lp-signup-head">
        <a href={WEBSITE} className="lp-logo"><span className="lp-mark" aria-hidden><BrandMark size={17} /></span>{BRAND}</a>
      </header>
      <main className="lp-wrap lp-legal-main" aria-live="polite">
        {state === 'working' && <h1>Unsubscribing…</h1>}
        {state === 'done' && <>
          <h1>You’re unsubscribed</h1>
          <p>You won’t get tips or product updates from {BRAND} any more. Emails about your projects (new comments, results, approvals) are separate: change them in the panel.</p>
          <p><Link to="/app/settings" className="lp-btn primary sm">Email settings</Link></p>
        </>}
        {state === 'failed' && <>
          <h1>This link didn’t work</h1>
          <p>It may be incomplete or out of date. Log in and turn off “Tips and product updates” in Settings → Notifications instead.</p>
          <p><Link to="/app/settings" className="lp-btn primary sm">Email settings</Link></p>
        </>}
      </main>
    </div>
  )
}
