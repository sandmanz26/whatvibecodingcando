import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ArrowLeft, ArrowRight, MousePointer2, Copy, ExternalLink, LogOut } from 'lucide-react'
import { BRAND, PRODUCTS, inScript, parseProducts, productOf, statusLabel } from '../../saas/products'
import { SAAS_ERROR, settled, freeId, isOnboarded, isSignedIn, newProject, originOf, slug, useSaas, useSaasReady } from '../../saas/account'
import { copyText, demoUrl, installSnippet } from '../../saas/snippet'
import { publish } from '../../saas/widget'
import { cloud } from '../../saas/supabase'
import '../../saas/saas.css'

const STEPS = ['Tools', 'Project', 'Install']

/**
 * After registering: tools → first project → install snippet. Nothing is saved until Finish (or
 * "Skip for now" on the last step), and Back keeps what was entered. Leaving halfway brings you
 * back here next time, because the panel needs a finished workspace.
 */
export default function Onboarding() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [state, update] = useSaas()
  const [step, setStep] = useState(0)
  const ready = useSaasReady()
  // Picked on the website; kept across the email confirmation in this tab.
  const [products, setProducts] = useState<string[]>(() => {
    let saved = ''
    try { saved = sessionStorage.getItem('vibe.onboarding.products') ?? '' } catch { /* ignore */ }
    const p = parseProducts(params.get('products') || saved)
    return p.length ? p : ['comments']
  })
  const [project, setProject] = useState('')
  const [site, setSite] = useState('')
  const [tried, setTried] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [finished, setFinished] = useState(false)
  // On the server: wait for its answer before leaving onboarding, so a refusal is shown here.
  const [saving, setSaving] = useState(false)
  // The server refused part of it (the project may exist already): stay here and say so.
  const [failed, setFailed] = useState(false)
  useEffect(() => { setTried(false); window.scrollTo(0, 0) }, [step])
  useEffect(() => { document.title = `Set up your workspace · ${BRAND}` }, [])
  // The server refused the new workspace or project (the state is back to what it has): say why.
  useEffect(() => {
    const on = (e: Event) => { setFinished(false); setFailed(true); setError(`Couldn’t finish setting up: ${(e as CustomEvent<string>).detail}`) }
    window.addEventListener(SAAS_ERROR, on)
    return () => window.removeEventListener(SAAS_ERROR, on)
  }, [])

  const taken = state.projects.map((p) => p.id)
  const draft = useMemo(() => newProject(project || 'my-project', site, products, taken), [project, site, products, taken.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const code = installSnippet(draft.id)

  if (!ready) return null
  if (!state.account) return <Navigate to="/app/register" replace />
  if (!isSignedIn(state)) return <Navigate to="/app/login?next=/app/onboarding" replace />
  if (isOnboarded(state) && !saving && !failed) return <Navigate to={finished ? '/app?welcome=1' : '/app'} replace />

  const siteOk = !site.trim() || !!originOf(site)
  const projectOk = !!slug(project)
  const toggle = (id: string) => setProducts((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const finish = () => {
    setFinished(true)
    // The first widget settings are published with the project, so the snippet works as soon as it is pasted:
    // reviewers only, on the site's address (when one was given) and the demo site.
    const p = publish({ ...draft, ...(copied === code ? { copiedSnippet: code } : {}) }, state.account?.name ?? 'You')
    if (cloud) setSaving(true)
    const ok = update((x) => ({ ...x, projects: [...x.projects, p], current: p.id, onboarded: true }))
    if (!ok) { setSaving(false); setFinished(false); setError('This browser’s storage is full or blocked, so the workspace couldn’t be saved.'); return }
    if (cloud) void settled().then(() => setSaving(false))
  }
  const next = () => {
    setTried(true)
    if (step === 0 && !products.length) return
    if (step === 1 && (!projectOk || !siteOk)) return
    if (step < 2) setStep(step + 1)
    else finish()
  }
  const copy = async () => {
    if (await copyText(code)) setCopied(code)
    else setError('Copy failed. Select the snippet and copy it by hand.')
  }
  const logOut = () => { update((x) => ({ ...x, signedIn: false })); nav('/app/login', { replace: true }) }
  const first = state.account.name.split(' ')[0]

  return (
    <div className="lp lp-signup">
      <header className="lp-wrap lp-signup-head">
        <Link to="/landingpage" className="lp-logo"><span className="lp-mark" aria-hidden><MousePointer2 size={15} /></span>{BRAND}</Link>
        <ol className="lp-progress" aria-label="Steps">
          {STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''} aria-current={i === step ? 'step' : undefined}>{i < step ? <Check size={12} /> : i + 1} {s}</li>)}
        </ol>
        <button className="lp-btn ghost sm" onClick={logOut}><LogOut size={14} /> Log out</button>
      </header>
      <main className="lp-wrap lp-signup-main">
        <form className="lp-form" onSubmit={(e) => { e.preventDefault(); next() }} noValidate>
          {step === 0 && (
            <>
              <span className="lp-eyebrow">Welcome, {first}</span>
              <h1>What do you want to use?</h1>
              <p className="lp-muted">Pick any. You can change this later, per project.</p>
              <div className="lp-checks">
                {PRODUCTS.map((p) => {
                  const Icon = p.icon
                  const on = products.includes(p.id)
                  return (
                    <button type="button" key={p.id} className={`lp-check ${on ? 'on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={on}>
                      <span className="lp-icon sm" style={{ background: p.hue }}><Icon size={15} /></span>
                      <span className="lp-grow"><b>{p.name}</b><small>{statusLabel(p.status)}</small></span>
                      <span className="lp-tick">{on && <Check size={13} />}</span>
                    </button>
                  )
                })}
              </div>
              {tried && !products.length && <p className="lp-error">Pick at least one tool.</p>}
            </>
          )}
          {step === 1 && (
            <>
              <h1>Your first project</h1>
              <p className="lp-muted">A project is one website or app you want feedback on. Its comments, studies and settings stay together. You can add more projects later.</p>
              <label className="lp-field">Project name
                <input autoFocus value={project} onChange={(e) => setProject(e.target.value)} maxLength={60} placeholder="e.g. Shop website" aria-invalid={tried && !projectOk} />
                {tried && !projectOk ? <span className="lp-error">Give the project a name with letters or digits.</span>
                  : <span className="lp-hint">Only you and your team see the name.{project && <> Its id, <code>{freeId(project, taken)}</code>, goes into your snippet.</>}</span>}
              </label>
              <label className="lp-field">Where is the site online? <span className="lp-muted">(optional)</span>
                <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="e.g. shop.example.com" inputMode="url" autoComplete="url" aria-invalid={!siteOk} aria-describedby="site-help" />
                {!siteOk ? <span className="lp-error">Type an address like <code>shop.example.com</code> or <code>https://my-app.vercel.app</code>.</span>
                  : originOf(site) ? <span className="lp-hint" id="site-help">The widget will show on <code>{new URL(originOf(site)!).host}</code>. Comments get an “open on site” link to the right page.</span>
                    : <span className="lp-hint" id="site-help">The address people open in their browser, with or without <code>https://</code>. The widget only shows on addresses you list, so other sites can’t use your snippet.</span>}
              </label>
              <ul className="lp-hint lp-hintlist">
                <li>Not online yet? Leave it empty: you can still try everything on our demo site, and add the address later in <b>Widget → Website</b>.</li>
                <li>Staging, preview or <code>localhost</code> addresses are added there too.</li>
              </ul>
            </>
          )}
          {step === 2 && (
            <>
              <h1>Put it on your site</h1>
              <p className="lp-muted">Paste this before <code>&lt;/body&gt;</code> on every page of “{project.trim()}”. You can also do it later from Install in your panel.</p>
              <pre className="lp-code" aria-label="Your snippet">{code}</pre>
              <div className="lp-row">
                <button type="button" className="lp-btn" onClick={() => void copy()}>{copied === code ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy snippet</>}</button>
                <a className="lp-btn ghost" href={demoUrl(draft.id)} target="_blank" rel="noopener">Try it on the demo site <ExternalLink size={14} /></a>
              </div>
              <p className="lp-hint">It starts for <b>reviewers only</b>{originOf(site) ? <> on <code>{new URL(originOf(site)!).host}</code></> : ''}: visitors don’t see it. Invite reviewers, add staging or preview sites, and change the look in Widget.</p>
              {products.some((id) => productOf(id)?.status === 'console') && <p className="lp-hint">In the script today: {inScript()}. The other tools you picked are marked early access.</p>}
            </>
          )}
          {error && <p className="lp-error" role="alert">{error}</p>}
          {failed && isOnboarded(state) && <p className="lp-hint">Your project was created. <button type="button" className="up-linkbtn" onClick={() => nav('/app/widget', { replace: true })}>Open your panel</button> and press Update site in Widget.</p>}
          <div className="lp-row lp-form-foot">
            {step > 0 && <button type="button" className="lp-btn" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Back</button>}
            <span className="lp-grow" />
            {step === 2 && copied !== code && <button type="button" className="lp-btn ghost" onClick={finish}>Skip for now</button>}
            <button type="submit" className="lp-btn primary" disabled={saving || (failed && isOnboarded(state))}>{step < 2 ? <>Continue <ArrowRight size={15} /></> : saving ? 'Creating…' : 'Finish'}</button>
          </div>
        </form>
      </main>
    </div>
  )
}
