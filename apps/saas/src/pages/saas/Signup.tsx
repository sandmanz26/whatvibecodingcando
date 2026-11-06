import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { Check, ArrowLeft, ArrowRight, MousePointer2 } from 'lucide-react'
import { BRAND, PRODUCTS, parseProducts } from '../../saas/products'
import { newProject, originOf, slug, useSaas, validEmail } from '../../saas/account'
import '../../saas/saas.css'

/**
 * Creating the demo account: products → project → you. Nothing is saved until the last step,
 * and Back keeps what was entered. There is no password because there is no server yet.
 */
export default function Signup() {
  const [params] = useSearchParams()
  const [state, update] = useSaas()
  const [step, setStep] = useState(0)
  const [products, setProducts] = useState<string[]>(() => { const p = parseProducts(params.get('products')); return p.length ? p : ['comments'] })
  const [project, setProject] = useState('')
  const [site, setSite] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [tried, setTried] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState(false)
  useEffect(() => { setTried(false); window.scrollTo(0, 0) }, [step])

  // Signed up already (or just now): this page must never create a second account over the first.
  if (state.account) return <Navigate to={created ? '/app?welcome=1' : '/app'} replace />

  const siteOk = !site.trim() || !!originOf(site)
  const projectOk = !!slug(project)
  const emailOk = validEmail(email)
  const toggle = (id: string) => setProducts((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))
  const next = () => {
    setTried(true)
    if (step === 0 && !products.length) return
    if (step === 1 && (!projectOk || !siteOk)) return
    if (step < 2) { setStep(step + 1); return }
    if (!name.trim() || !emailOk) return
    const p = newProject(project, site, products, [])
    setCreated(true)
    const ok = update(() => ({ account: { name: name.trim(), email: email.trim(), createdAt: new Date().toISOString() }, projects: [p], current: p.id, invites: [] }))
    if (!ok) { setCreated(false); setError('This browser’s storage is full or blocked, so the account couldn’t be saved.') }
  }

  return (
    <div className="lp lp-signup">
      <header className="lp-wrap lp-signup-head">
        <Link to="/landingpage" className="lp-logo"><span className="lp-mark" aria-hidden><MousePointer2 size={15} /></span>{BRAND}</Link>
        <ol className="lp-progress" aria-label="Steps">
          {['Tools', 'Project', 'You'].map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{i < step ? <Check size={12} /> : i + 1} {s}</li>)}
        </ol>
      </header>
      <main className="lp-wrap lp-signup-main">
        <form className="lp-form" onSubmit={(e) => { e.preventDefault(); next() }} noValidate>
          {step === 0 && (
            <>
              <h1>What do you want to use?</h1>
              <p className="lp-muted">Pick any. You can change this later, per project.</p>
              <div className="lp-checks">
                {PRODUCTS.map((p) => {
                  const Icon = p.icon
                  const on = products.includes(p.id)
                  return (
                    <button type="button" key={p.id} className={`lp-check ${on ? 'on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={on}>
                      <span className="lp-icon sm" style={{ background: p.hue }}><Icon size={15} /></span>
                      <span className="lp-grow"><b>{p.name}</b><small>{p.status === 'script' ? 'On your site today' : 'Early access'}</small></span>
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
              <p className="lp-muted">A project is one site or app. Comments and settings belong to it.</p>
              <label className="lp-field">Project name
                <input autoFocus value={project} onChange={(e) => setProject(e.target.value)} maxLength={60} placeholder="e.g. Shop website" aria-invalid={tried && !projectOk} />
                {tried && !projectOk ? <span className="lp-error">Give the project a name with letters or digits.</span> : project && <span className="lp-hint">Project id: <code>{slug(project)}</code> (used in your snippet)</span>}
              </label>
              <label className="lp-field">Site address <span className="lp-muted">(optional)</span>
                <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="e.g. shop.example.com" inputMode="url" aria-invalid={!siteOk} />
                {!siteOk ? <span className="lp-error">That doesn’t look like a web address.</span> : <span className="lp-hint">Used for “open on site” links and as the first allowed domain.</span>}
              </label>
            </>
          )}
          {step === 2 && (
            <>
              <h1>About you</h1>
              <p className="lp-muted">Shown next to your comments.</p>
              <label className="lp-field">Your name
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-invalid={tried && !name.trim()} />
                {tried && !name.trim() && <span className="lp-error">Enter your name.</span>}
              </label>
              <label className="lp-field">Work email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} aria-invalid={tried && !emailOk} />
                {tried && !emailOk && <span className="lp-error">Enter an email like name@company.com.</span>}
              </label>
              <p className="lp-note">This beta has no server yet: your account and projects are saved in this browser only, nothing is sent anywhere, and there is no password.</p>
            </>
          )}
          {error && <p className="lp-error">{error}</p>}
          <div className="lp-row lp-form-foot">
            {step > 0 ? <button type="button" className="lp-btn" onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Back</button> : <Link to="/landingpage" className="lp-btn ghost">Cancel</Link>}
            <span className="lp-grow" />
            <button type="submit" className="lp-btn primary">{step < 2 ? <>Continue <ArrowRight size={15} /></> : 'Create my workspace'}</button>
          </div>
        </form>
      </main>
    </div>
  )
}
