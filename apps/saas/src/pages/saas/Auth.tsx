import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, MousePointer2, ArrowLeft, Mail, TriangleAlert, CheckCircle2 } from 'lucide-react'
import { BRAND, parseProducts } from '../../saas/products'
import {
  LOCK_AFTER, RESET_MINUTES, canHash, checkPassword, hashPassword, isOnboarded, isSignedIn, lockAfterFail, newResetToken,
  passwordProblem, passwordScore, resetValid, sameEmail, useSaas, validEmail,
} from '../../saas/account'
import '../../saas/saas.css'

/**
 * Register, log in, forgot password and reset password. There is no server yet: the account lives
 * in this browser, the password is stored only as a salted PBKDF2 hash, and no email is sent (the
 * reset email is shown on the page instead). Each page says so where it matters.
 */

/** Only paths inside the panel can be the place to go after logging in. */
const safeNext = (v: string | null) => (v && /^\/app(\/[\w/-]*)?(\?[\w=&%-]*)?$/.test(v) ? v : '/app')

function Shell({ title, sub, children, foot }: { title: string; sub?: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode }) {
  useEffect(() => { document.title = `${title} · ${BRAND}`; window.scrollTo(0, 0) }, [title])
  return (
    <div className="lp lp-signup lp-auth">
      <header className="lp-wrap lp-signup-head">
        <Link to="/landingpage" className="lp-logo"><span className="lp-mark" aria-hidden><MousePointer2 size={15} /></span>{BRAND}</Link>
        <Link to="/landingpage" className="lp-btn ghost sm"><ArrowLeft size={14} /> Website</Link>
      </header>
      <main className="lp-wrap lp-signup-main">
        <div className="lp-auth-col">
          <div className="lp-form lp-auth-card">
            <div><h1>{title}</h1>{sub && <p className="lp-muted">{sub}</p>}</div>
            {children}
          </div>
          {foot && <p className="lp-auth-foot">{foot}</p>}
        </div>
      </main>
    </div>
  )
}

function PasswordField({ label, value, onChange, autoComplete, invalid, error, hint, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; autoComplete: 'new-password' | 'current-password'; invalid?: boolean; error?: string; hint?: React.ReactNode; autoFocus?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <label className="lp-field">{label}
      <span className="lp-pass">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} maxLength={200} aria-invalid={invalid} autoFocus={autoFocus} />
        <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide' : 'Show'}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
      </span>
      {error ? <span className="lp-error">{error}</span> : hint}
    </label>
  )
}

const STRENGTH = ['', 'Weak', 'Fair', 'Good', 'Strong']
function Strength({ pw }: { pw: string }) {
  const n = passwordScore(pw)
  if (!pw) return <span className="lp-hint">At least 8 characters. Longer is stronger.</span>
  return (
    <span className="lp-strength" aria-live="polite">
      <span className="lp-strength-bar" aria-hidden>{[1, 2, 3, 4].map((i) => <i key={i} className={i <= n ? `on s${n}` : ''} />)}</span>
      <span className="lp-hint">{STRENGTH[n]}</span>
    </span>
  )
}

const LocalNote = ({ children }: { children: React.ReactNode }) => <p className="lp-note"><TriangleAlert size={13} /> {children}</p>
const NoCrypto = () => <p className="lp-error">This page isn’t on a secure address (https or localhost), so the browser can’t protect a password here.</p>

/* ---------- register ---------- */

export function Register() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [state, update] = useSaas()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const products = parseProducts(params.get('products'))
  const onboarding = `/app/onboarding${products.length ? `?products=${products.join(',')}` : ''}`

  if (busy === false && isSignedIn(state)) return <Navigate to={isOnboarded(state) ? '/app' : onboarding} replace />
  if (state.account && !busy) return (
    <Shell title="You already have a workspace" sub={<>This browser already has one for <b>{state.account.email}</b>. The beta keeps one workspace per browser.</>}
      foot={<>Want to start over? Log in, then delete the workspace in Settings.</>}>
      <Link to="/app/login" className="lp-btn primary full">Log in</Link>
      <Link to="/app/forgot" className="lp-btn ghost full">Forgot password?</Link>
    </Shell>
  )

  const emailOk = validEmail(email)
  const pwProblem = passwordProblem(pw, email)
  const match = pw === pw2
  const submit = async () => {
    setTried(true)
    if (!name.trim() || !emailOk || pwProblem || !match || busy) return
    if (!canHash()) { setError('no-crypto'); return }
    setBusy(true); setError('')
    try {
      const password = await hashPassword(pw)
      const ok = update(() => ({ account: { name: name.trim(), email: email.trim(), createdAt: new Date().toISOString(), password }, projects: [], current: null, invites: [], signedIn: true, onboarded: false }))
      if (!ok) { setBusy(false); setError('This browser’s storage is full or blocked, so the account couldn’t be saved.'); return }
      nav(onboarding, { replace: true })
    } catch {
      setBusy(false); setError('The password couldn’t be protected in this browser. Try another browser.')
    }
  }

  return (
    <Shell title="Create your account" sub="Free during the beta. Next, you’ll set up your first project."
      foot={<>Already have an account? <Link to="/app/login">Log in</Link></>}>
      <form className="lp-auth-fields" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        <label className="lp-field">Your name
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" aria-invalid={tried && !name.trim()} />
          {tried && !name.trim() && <span className="lp-error">Enter your name.</span>}
        </label>
        <label className="lp-field">Work email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" aria-invalid={tried && !emailOk} />
          {tried && !emailOk && <span className="lp-error">Enter an email like name@company.com.</span>}
        </label>
        <PasswordField label="Password" value={pw} onChange={setPw} autoComplete="new-password" invalid={tried && !!pwProblem} error={tried ? pwProblem : ''} hint={<Strength pw={pw} />} />
        <PasswordField label="Confirm password" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={tried && !match} error={tried && !match ? 'The passwords don’t match.' : ''} />
        {error === 'no-crypto' ? <NoCrypto /> : error && <p className="lp-error">{error}</p>}
        <button type="submit" className="lp-btn primary full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <LocalNote>Beta without a server: your account is saved in this browser only and nothing is sent anywhere. The password is kept only as a salted hash.</LocalNote>
      </form>
    </Shell>
  )
}

/* ---------- log in ---------- */

export function Login() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [state, update] = useSaas()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const next = safeNext(params.get('next'))
  const until = state.lock?.until ?? 0
  const locked = until > now
  useEffect(() => {
    if (!locked) return
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [locked])

  if (isSignedIn(state) && !busy) return <Navigate to={next} replace />

  const submit = async () => {
    setNow(Date.now())
    if (busy || (state.lock?.until ?? 0) > Date.now()) return
    if (!validEmail(email) || !pw) { setError('Enter your email and password.'); return }
    const acc = state.account
    if (acc && sameEmail(acc.email, email) && !acc.password) { setError('legacy'); return }
    if (!canHash()) { setError('no-crypto'); return }
    setBusy(true); setError('')
    const ok = !!acc?.password && sameEmail(acc.email, email) && await checkPassword(pw, acc.password).catch(() => false)
    if (ok) {
      update((x) => ({ ...x, signedIn: true, lock: undefined }))
      nav(next, { replace: true })
      return
    }
    // The same message whether the email or the password was wrong.
    update((x) => ({ ...x, lock: lockAfterFail(x.lock) }))
    setBusy(false); setPw(''); setNow(Date.now())
    setError('Email or password is incorrect.')
  }
  const wait = Math.ceil((until - now) / 1000)
  const fails = state.lock?.fails ?? 0

  return (
    <Shell title="Log in" sub="Welcome back. Log in to your workspace."
      foot={<>New here? <Link to="/app/register">Create an account</Link></>}>
      <form className="lp-auth-fields" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        <label className="lp-field">Email
          <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="username" />
        </label>
        <PasswordField label="Password" value={pw} onChange={setPw} autoComplete="current-password"
          hint={<Link to={`/app/forgot${validEmail(email) ? `?email=${encodeURIComponent(email.trim())}` : ''}`} className="lp-auth-link">Forgot password?</Link>} />
        {locked ? <p className="lp-error" role="alert">Too many wrong tries. Try again in {wait} s, or reset your password.</p>
          : error === 'legacy' ? <p className="lp-error" role="alert">This workspace was made before passwords existed. <Link to={`/app/forgot?email=${encodeURIComponent(email.trim())}`}>Set a password</Link> to log in.</p>
            : error === 'no-crypto' ? <NoCrypto />
              : error && <p className="lp-error" role="alert">{error}{fails > 0 && fails < LOCK_AFTER && fails >= 3 ? ` ${LOCK_AFTER - fails} more tr${LOCK_AFTER - fails === 1 ? 'y' : 'ies'} before a short pause.` : ''}</p>}
        <button type="submit" className="lp-btn primary full" disabled={busy || locked}>{busy ? 'Logging in…' : 'Log in'}</button>
        <LocalNote>Beta without a server: you can log in only in the browser where you created the account.</LocalNote>
      </form>
    </Shell>
  )
}

/* ---------- forgot password ---------- */

export function Forgot() {
  const [params] = useSearchParams()
  const [state, update] = useSaas()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [tried, setTried] = useState(false)
  const [sent, setSent] = useState<{ to: string; token: string | null } | null>(null)
  const emailOk = validEmail(email)

  const send = () => {
    setTried(true)
    if (!emailOk) return
    const match = !!state.account && sameEmail(state.account.email, email)
    let token: string | null = null
    if (match) {
      token = newResetToken()
      // A new link replaces the previous one.
      if (!update((x) => ({ ...x, reset: { token: token!, expires: Date.now() + RESET_MINUTES * 60_000 } }))) token = null
    }
    setSent({ to: email.trim(), token })
  }

  if (sent) return (
    <Shell title="Check your email" sub={<>If an account uses <b>{sent.to}</b>, we’ve sent a link to reset the password. It works once and expires in {RESET_MINUTES} minutes.</>}
      foot={<><Link to="/app/login">Back to log in</Link></>}>
      <div className="lp-mail" aria-label="Demo inbox">
        <span className="lp-mail-tag"><Mail size={13} /> Demo inbox</span>
        <p className="lp-hint">Beta without a server: no email is actually sent. This is what would arrive.</p>
        {sent.token ? (
          <div className="lp-mail-body">
            <b>Reset your {BRAND} password</b>
            <p>Someone asked to reset the password for {sent.to}. If it wasn’t you, ignore this email.</p>
            <Link to={`/app/reset?token=${sent.token}`} className="lp-btn primary">Reset password</Link>
          </div>
        ) : <p className="lp-mail-body">Nothing would arrive: no account in this browser uses this address.</p>}
      </div>
      <button className="lp-btn ghost full" onClick={() => { setSent(null); setTried(false) }}>Use another email</button>
    </Shell>
  )

  return (
    <Shell title="Forgot your password?" sub="Enter the email you signed up with and we’ll send you a link to set a new one."
      foot={<>Remembered it? <Link to="/app/login">Log in</Link></>}>
      <form className="lp-auth-fields" onSubmit={(e) => { e.preventDefault(); send() }} noValidate>
        <label className="lp-field">Email
          <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" aria-invalid={tried && !emailOk} />
          {tried && !emailOk && <span className="lp-error">Enter an email like name@company.com.</span>}
        </label>
        <button type="submit" className="lp-btn primary full">Send reset link</button>
      </form>
    </Shell>
  )
}

/* ---------- reset password ---------- */

export function Reset() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [state, update] = useSaas()
  const token = params.get('token')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  if (done) return (
    <Shell title="Password changed" sub="You’re logged in with your new password.">
      <p className="lp-ok"><CheckCircle2 size={16} /> The reset link has been used and no longer works.</p>
      <button className="lp-btn primary full" onClick={() => nav('/app', { replace: true })}>Open your panel</button>
    </Shell>
  )
  if (!resetValid(state, token) && !busy) return (
    <Shell title="This link doesn’t work" sub="Reset links work once and expire after 30 minutes. A newer link also replaces older ones."
      foot={<><Link to="/app/login">Back to log in</Link></>}>
      <Link to="/app/forgot" className="lp-btn primary full">Send a new link</Link>
    </Shell>
  )

  const email = state.account?.email ?? ''
  const pwProblem = passwordProblem(pw, email)
  const match = pw === pw2
  const submit = async () => {
    setTried(true)
    if (pwProblem || !match || busy) return
    if (!canHash()) { setError('no-crypto'); return }
    setBusy(true); setError('')
    try {
      const password = await hashPassword(pw)
      // Checked again at save time: the link may have been replaced in another tab meanwhile.
      let used = false
      const ok = update((x) => {
        if (!resetValid(x, token) || !x.account) return x
        used = true
        return { ...x, account: { ...x.account, password }, reset: undefined, lock: undefined, signedIn: true }
      })
      if (!ok || !used) { setBusy(false); setError(ok ? 'This link was replaced or has expired. Ask for a new one.' : 'This browser’s storage is full or blocked.'); return }
      setDone(true)
    } catch {
      setBusy(false); setError('The password couldn’t be protected in this browser.')
    }
  }

  return (
    <Shell title="Set a new password" sub={<>For <b>{email}</b>.</>}>
      <form className="lp-auth-fields" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        <PasswordField label="New password" value={pw} onChange={setPw} autoComplete="new-password" autoFocus invalid={tried && !!pwProblem} error={tried ? pwProblem : ''} hint={<Strength pw={pw} />} />
        <PasswordField label="Confirm new password" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={tried && !match} error={tried && !match ? 'The passwords don’t match.' : ''} />
        {error === 'no-crypto' ? <NoCrypto /> : error && <p className="lp-error">{error}</p>}
        <button type="submit" className="lp-btn primary full" disabled={busy}>{busy ? 'Saving…' : 'Save and log in'}</button>
      </form>
    </Shell>
  )
}
