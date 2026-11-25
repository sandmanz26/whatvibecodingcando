import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ArrowLeft, ArrowRight, ExternalLink, LogOut } from 'lucide-react'
import { BRAND, PRODUCTS, inScript, parseProducts, productOf, statusLabel, CATEGORIES, CAT_HELP, WEBSITE } from '../../saas/products'
import { SAAS_ERROR, settled, freeId, isOnboarded, isSignedIn, newProject, originOf, slug, useSaas, useSaasReady, type Project } from '../../saas/account'
import { copyText, demoUrl, installSnippet } from '../../saas/snippet'
import { WithPreview } from './ProductPreview'
import { addAddress, draftOf, publish, serveProject } from '../../saas/widget'
import { hostProblem, isLocalHost, type Env } from '../../core/embed/config'
import { InstallCheck, InstallSteps } from './InstallFlow'
import { cloud } from '../../saas/supabase'
import '../../saas/saas.css'
import { resetAnalytics, track } from '../../lib/analytics'
import { BrandMark } from '../../components/BrandMark'

const STEPS = ['Tools', 'Project', 'Install']

const LOCAL_SUGGESTIONS = ['localhost:3000', 'localhost:5173', 'localhost:8080']
/** A host typed with or without http:// and a trailing path. */
const bareHost = (s: string) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')

/**
 * After registering: tools → first project and where it goes → install. Continue on the project step
 * creates the project with its addresses as environments and publishes the widget settings (the same
 * as Update site), so the snippet works as soon as it is pasted. The install step then shows the
 * snippet, the three steps and the live install check. Leaving before Finish brings you back here.
 */
/** "Paste it on localhost:3000 and shop.example.com." */
function siteTargetsText(p: Project) {
  const hosts = draftOf(p).envs.map((e) => e.host)
  return hosts.length ? `Paste it into your site at ${hosts.join(' and ')}. It works on every page.` : 'Paste it into your site. It works on every page.'
}

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
  const [local, setLocal] = useState('')
  // The project, once created on leaving the project step (its id is fixed from then on).
  const [made, setMade] = useState<string | null>(null)
  const [since, setSince] = useState<number | null>(null)
  const [goTo, setGoTo] = useState('/app?welcome=1')
  const [tried, setTried] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const refused = useRef(false)
  const [finished, setFinished] = useState(false)
  // On the server: wait for its answer before leaving onboarding, so a refusal is shown here.
  const [saving, setSaving] = useState(false)
  // The server refused part of it (the project may exist already): stay here and say so.
  const [failed, setFailed] = useState(false)
  useEffect(() => { setTried(false); window.scrollTo(0, 0) }, [step])
  useEffect(() => { document.title = `Set up your workspace · ${BRAND}` }, [])
  // The server refused the new workspace or project (the state is back to what it has): say why.
  useEffect(() => {
    const on = (e: Event) => { refused.current = true; setFinished(false); setFailed(true); setError(`Couldn’t finish setting up: ${(e as CustomEvent<string>).detail}`) }
    window.addEventListener(SAAS_ERROR, on)
    return () => window.removeEventListener(SAAS_ERROR, on)
  }, [])

  const taken = state.projects.filter((p) => p.id !== made).map((p) => p.id)
  const draft = useMemo(() => newProject(project || 'my-project', site, products, taken), [project, site, products, taken.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const created: Project | null = made ? state.projects.find((p) => p.id === made) ?? null : null
  const code = installSnippet(created?.id ?? draft.id)
  // The demo's script reads the published settings from this browser (the panel does this too).
  useEffect(() => { if (created) serveProject(created) }, [created])

  if (!ready) return null
  if (!state.account) return <Navigate to="/app/register" replace />
  if (!isSignedIn(state)) return <Navigate to="/app/login?next=/app/onboarding" replace />
  if (isOnboarded(state) && !saving && !failed) return <Navigate to={finished ? goTo : '/app'} replace />

  const siteHost = originOf(site) ? new URL(originOf(site)!).host : ''
  const siteOk = !site.trim() || (!!siteHost && !hostProblem(siteHost) && !isLocalHost(siteHost))
  const localHost = bareHost(local)
  const localOk = !localHost || (isLocalHost(localHost) && !hostProblem(localHost))
  const projectOk = !!slug(project)
  const toggle = (id: string) => setProducts((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const by = state.account?.name ?? 'You'
  /**
   * Creates the project with its addresses (the live site and/or the local dev address) as
   * environments, and publishes the first widget settings: reviewers only, on those addresses and the
   * demo site. Back on this step after that only changes the addresses (the id is in the snippet).
   */
  const create = async () => {
    const envs: Env[] = [
      ...(siteHost ? [{ id: 'site', name: 'Website', host: siteHost, on: true }] : []),
      ...(localHost ? [{ id: 'local', name: 'Local dev', host: localHost, on: true }] : []),
    ]
    const base: Project = created
      ? { ...created, name: project.trim() || created.name, siteUrl: originOf(site) ?? (localHost ? `http://${localHost}` : '') }
      : newProject(project || 'my-project', site.trim() || (localHost ? `http://${localHost}` : ''), products, taken)
    const p = publish({ ...base, products, domains: envs.map((e) => e.host), config: { ...draftOf(base), envs } }, by)
    if (cloud) setSaving(true)
    setError(''); setFailed(false)
    const ok = update((x) => ({ ...x, projects: created ? x.projects.map((q) => (q.id === p.id ? p : q)) : [...x.projects, p], current: p.id }))
    if (!ok) { setSaving(false); setError('This browser’s storage is full or blocked, so the project couldn’t be saved.'); return }
    refused.current = false
    setMade(p.id)
    if (cloud) await settled()
    setSaving(false)
    if (refused.current) { if (!created) setMade(null); return }
    setStep(2)
  }
  const finish = (to = '/app?welcome=1') => {
    setGoTo(to)
    setFinished(true)
    if (cloud) setSaving(true)
    const ok = update((x) => ({ ...x, onboarded: true }))
    if (!ok) { setSaving(false); setFinished(false); setError('This browser’s storage is full or blocked, so the workspace couldn’t be saved.'); return }
    track('onboarding_completed', { products, products_count: products.length, site: !!siteHost, local: !!localHost, copied: copied === code })
    if (cloud) void settled().then(() => setSaving(false))
  }
  const next = () => {
    setTried(true)
    if (step === 0 && !products.length) return
    if (step === 1 && (!projectOk || !siteOk || !localOk)) return
    if (step === 1) void create()
    else if (step < 2) setStep(step + 1)
    else finish()
  }
  const copy = async () => {
    if (await copyText(code)) {
      setCopied(code); setSince((x) => x ?? Date.now())
      if (created) update((x) => ({ ...x, projects: x.projects.map((q) => (q.id === created.id ? { ...q, copiedSnippet: code } : q)) }))
      track('snippet_copied', { where: 'onboarding' })
    } else setError('Copy failed. Select the snippet and copy it by hand.')
  }
  const toast = (t: string, k?: 'error') => { if (k === 'error') setError(t); else { setError(''); setNote(t) } }
  const addHost = (h: string) => {
    if (!created) return false
    const nextP = addAddress(created, h, by)
    if (!nextP) { setError(`Couldn’t add ${h}. Check the address.`); return false }
    const ok = update((x) => ({ ...x, projects: x.projects.map((q) => (q.id === created.id ? nextP : q)) }))
    if (ok) track('address_added', { where: 'onboarding', local: isLocalHost(h) })
    return ok
  }
  const logOut = () => { update((x) => ({ ...x, signedIn: false })); resetAnalytics(); nav('/app/login', { replace: true }) }
  const first = state.account.name.split(' ')[0]

  return (
    <div className="lp lp-signup">
      <header className="lp-wrap lp-signup-head">
        <a href={WEBSITE} className="lp-logo"><span className="lp-mark" aria-hidden><BrandMark size={17} /></span>{BRAND}</a>
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
              {CATEGORIES.map((cat) => <div key={cat} className="lp-checkgroup">
              <h2 className="lp-checkhead">{cat}<small> · {CAT_HELP[cat]}</small></h2>
              <div className="lp-checks">
                {PRODUCTS.filter((p) => p.category === cat).map((p) => {
                  const Icon = p.icon
                  const on = products.includes(p.id)
                  return (
                    <WithPreview key={p.id} p={p} selected={on} onSelect={p.soon ? undefined : () => toggle(p.id)}>
                    <button type="button" className={`lp-check ${on ? 'on' : ''} ${p.soon ? 'soon' : ''}`} onClick={() => !p.soon && toggle(p.id)} aria-pressed={on} disabled={p.soon}>
                      <span className="lp-icon sm" style={{ background: p.hue }}><Icon size={15} /></span>
                      <span className="lp-grow"><b>{p.name}{p.labs && <span className="lp-labs">Labs</span>}</b><small>{p.soon ? 'Coming soon' : statusLabel(p.status)}</small></span>
                      <span className="lp-tick">{on && <Check size={13} />}</span>
                    </button>
                    </WithPreview>
                  )
                })}
              </div>
              </div>)}
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
              <fieldset className="lp-field ih-where">
                <legend><b>Where will you add it?</b></legend>
                <span className="lp-hint">The widget only runs on the addresses you list, so other sites can’t use your snippet. Add one or both; you can change them later in <b>Widget → Website</b>.</span>
                <label className="lp-field">On your computer <span className="lp-muted">(the address your dev server prints)</span>
                  <input value={local} onChange={(e) => setLocal(e.target.value)} placeholder="localhost:3000" inputMode="url" aria-invalid={!localOk} aria-describedby="local-help" />
                  <span className="ih-chips" aria-label="Common dev addresses">{LOCAL_SUGGESTIONS.map((x) => <button key={x} type="button" aria-pressed={localHost === x} onClick={() => setLocal(localHost === x ? '' : x)}>{x}</button>)}</span>
                  {!localOk ? <span className="lp-error" id="local-help">Type a local address like <code>localhost:3000</code> or <code>127.0.0.1:5173</code>.</span>
                    : <span className="lp-hint" id="local-help">For trying it while you build: Next.js and Create React App use <code>localhost:3000</code>, Vite <code>localhost:5173</code>.</span>}
                </label>
                <label className="lp-field">Live website <span className="lp-muted">(optional)</span>
                  <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="e.g. shop.example.com" inputMode="url" autoComplete="url" aria-invalid={!siteOk} aria-describedby="site-help" />
                  {!siteOk ? <span className="lp-error" id="site-help">{siteHost && isLocalHost(siteHost) ? <>Put local addresses in the field above.</> : <>Type an address like <code>shop.example.com</code> or <code>https://my-app.vercel.app</code>.</>}</span>
                    : <span className="lp-hint" id="site-help">With or without <code>https://</code>. Comments get an “open on site” link to the right page.</span>}
                </label>
                {!siteHost && !localHost && <span className="lp-hint">Neither yet? Leave both empty: you can still try everything on our demo site.</span>}
              </fieldset>
            </>
          )}
          {step === 2 && created && (
            <>
              <h1>Put it on your site</h1>
              <p className="lp-muted">{siteTargetsText(created)} You can also do this later from Install in your panel.</p>
              <InstallSteps project={created} code={code} copied={copied === code} onCopy={() => void copy()} toast={toast} />
              <InstallCheck project={created} since={since} onAdd={addHost} toast={toast} next={<button type="button" className="lp-btn" onClick={() => finish('/app/reviewers')}>Next: invite a reviewer</button>} />
              <p className="lp-hint">No site to paste it in yet? <a href={demoUrl(created.id, products)} target="_blank" rel="noopener">Try it on the demo site <ExternalLink size={12} /></a></p>
              {products.some((id) => productOf(id)?.status === 'console') && <p className="lp-hint">In the script today: {inScript()}. The other tools you picked are marked early access.</p>}
            </>
          )}
          {note && !error && <p className="lp-hint" role="status">{note}</p>}
          {error && <p className="lp-error" role="alert">{error}</p>}
          {failed && isOnboarded(state) && <p className="lp-hint">Your project was created. <button type="button" className="up-linkbtn" onClick={() => nav('/app/widget', { replace: true })}>Open your panel</button> and press Update site in Widget.</p>}
          <div className="lp-row lp-form-foot">
            {step > 0 && <button type="button" className="lp-btn" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Back</button>}
            <span className="lp-grow" />
            {step === 2 && copied !== code && <button type="button" className="lp-btn ghost" onClick={() => finish()}>Skip for now</button>}
            <button type="submit" className="lp-btn primary" disabled={saving || (failed && isOnboarded(state))}>{saving ? (step === 1 ? 'Creating…' : 'Saving…') : step === 1 ? <>Create project <ArrowRight size={15} /></> : step < 2 ? <>Continue <ArrowRight size={15} /></> : 'Go to my panel'}</button>
          </div>
        </form>
      </main>
    </div>
  )
}
