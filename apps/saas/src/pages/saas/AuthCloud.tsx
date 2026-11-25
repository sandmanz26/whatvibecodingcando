import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail, CheckCircle2 } from 'lucide-react'
import { parseProducts } from '../../saas/products'
import { isOnboarded, isSignedIn, passwordProblem, refreshCloud, useSaas, useSaasReady, validEmail } from '../../saas/account'
import { authMessage, authReturnUrl, captcha, googleOn, signInWithGoogle, supabase } from '../../saas/supabase'
import { PasswordField, Shell, Strength, safeNext } from './Auth'
import '../../saas/saas.css'
import { track } from '../../lib/analytics'

/**
 * Register, log in, forgot and reset password against Supabase Auth: real accounts, emails for
 * confirming the address and resetting the password. Used when the build has a Supabase project.
 * Error messages never say whether an email has an account.
 */

const sb = () => supabase!
const Loading = () => <Shell title="One moment…"><p className="lp-muted">Checking your session.</p></Shell>

/** "Check your email", with a resend button that waits a minute between sends. */
function CheckEmail({ email, what, onResend }: { email: string; what: string; onResend: () => Promise<string> }) {
  const [wait, setWait] = useState(60)
  const [note, setNote] = useState('')
  useEffect(() => { if (wait <= 0) return; const t = window.setTimeout(() => setWait((w) => w - 1), 1000); return () => window.clearTimeout(t) }, [wait])
  return (
    <>
      <p className="lp-ok"><Mail size={16} /> We sent a link to <b>{email}</b> to {what}.</p>
      <p className="lp-muted">Open it on any device. Nothing there after a few minutes? Check spam, or send it again.</p>
      <button className="lp-btn full" disabled={wait > 0} onClick={async () => { setNote(await onResend()); setWait(60) }}>{wait > 0 ? `Send again in ${wait} s` : 'Send again'}</button>
      {note && <p className="lp-hint">{note}</p>}
    </>
  )
}

/** Google's "G" mark, in its brand colours (Google's sign-in button guidelines). */
const GoogleG = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
)

/**
 * "Continue with Google", shown only when Google is switched on in the Supabase project, so turning
 * it on there needs no new build. One button for both pages: Google creates the account on first use.
 */
function GoogleButton({ before }: { before?: () => void }) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { let live = true; void googleOn().then((v) => { if (live) setOn(v) }); return () => { live = false } }, [])
  if (!on) return null
  return (
    <>
      <button type="button" className="lp-btn full lp-google" disabled={busy} onClick={async () => {
        before?.()
        setBusy(true); setError('')
        const e = await signInWithGoogle()
        if (e) { setBusy(false); setError(e) }
      }}><GoogleG /> {busy ? 'Opening Google…' : 'Continue with Google'}</button>
      {error && <p className="lp-error" role="alert">{error}</p>}
      <div className="lp-or" role="separator"><span>or with email</span></div>
    </>
  )
}

export function CloudRegister() {
  useEffect(() => { track('signup_started', { method: 'email' }) }, [])
  const [params] = useSearchParams()
  const [state] = useSaas()
  const ready = useSaasReady()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const products = parseProducts(params.get('products'))
  const onboarding = `/app/onboarding${products.length ? `?products=${products.join(',')}` : ''}`
  if (!ready) return <Loading />
  if (isSignedIn(state) && !sent) return <Navigate to={isOnboarded(state) ? '/app' : onboarding} replace />

  const emailOk = validEmail(email)
  const pwProblem = passwordProblem(pw, email)
  const match = pw === pw2
  const submit = async () => {
    setTried(true)
    if (!name.trim() || !emailOk || pwProblem || !match || busy) return
    setBusy(true); setError('')
    try { sessionStorage.setItem('vibe.onboarding.products', products.join(',')) } catch { /* ignore */ }
    const { data, error: e } = await sb().auth.signUp({ email: email.trim(), password: pw, options: { data: { name: name.trim().slice(0, 40), onboarded: false }, emailRedirectTo: authReturnUrl('signup'), captchaToken: await captcha() } })
    setBusy(false)
    if (e) { setError(authMessage(e)); return }
    track('signup_completed', { method: 'email', products: products.length })
    // With email confirmation off, the account is signed in at once; otherwise it waits for the link.
    if (data.session) { await refreshCloud(); return }
    setSent(true)
  }
  if (sent) return (
    <Shell title="Confirm your email" foot={<>Wrong address? <button className="up-linkbtn" onClick={() => setSent(false)}>Go back</button></>}>
      <CheckEmail email={email.trim()} what="confirm it and finish creating your account" onResend={async () => {
        const { error: e } = await sb().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authReturnUrl('signup'), captchaToken: await captcha() } })
        return e ? authMessage(e) : 'Sent again.'
      }} />
    </Shell>
  )
  return (
    <Shell title="Create your account" sub="Free during the beta. Next, you’ll set up your first project." foot={<>Already have an account? <Link to="/app/login">Log in</Link></>}>
      <GoogleButton before={() => { try { sessionStorage.setItem('vibe.onboarding.products', products.join(',')) } catch { /* ignore */ } }} />
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
        {error && <p className="lp-error" role="alert">{error}</p>}
        <button type="submit" className="lp-btn primary full" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</button>
        <p className="lp-hint">By creating an account you agree to the <Link to="/terms">terms</Link> and the <Link to="/privacy">privacy policy</Link>.</p>
      </form>
    </Shell>
  )
}

export function CloudLogin() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [state] = useSaas()
  const ready = useSaasReady()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState('')
  const next = safeNext(params.get('next'))
  const link = params.get('link')
  if (!ready) return <Loading />
  if (isSignedIn(state) && !busy) return <Navigate to={next} replace />

  const submit = async () => {
    if (busy) return
    if (!validEmail(email) || !pw) { setError('Enter your email and password.'); return }
    setBusy(true); setError(''); setResent('')
    const { error: e } = await sb().auth.signInWithPassword({ email: email.trim(), password: pw, options: { captchaToken: await captcha() } })
    if (e) { setBusy(false); setPw(''); setError(authMessage(e)); return }
    await refreshCloud()
    track('login_completed', { method: 'email' })
    nav(next, { replace: true })
  }
  return (
    <Shell title="Log in" sub="Welcome back. Log in to your workspace." foot={<>New here? <Link to="/app/register">Create an account</Link></>}>
      <GoogleButton before={() => { try { sessionStorage.setItem('vibe.auth.next', next) } catch { /* ignore */ } }} />
      <form className="lp-auth-fields" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        {params.get('confirmed') && <p className="lp-ok"><CheckCircle2 size={16} /> Email confirmed. Log in to continue.</p>}
        {link === 'expired' && <p className="lp-error" role="alert">That link has expired or was already used. Log in, or ask for a new one.</p>}
        {link === 'google' && <p className="lp-error" role="alert">Google sign-in didn’t finish. Try again, or log in with your email.</p>}
        {link === 'other-browser' && <p className="lp-error" role="alert">That link was opened in a different browser from the one it was asked in. Log in here, or open the link in the first browser.</p>}
        <label className="lp-field">Email
          <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="username" />
        </label>
        <PasswordField label="Password" value={pw} onChange={setPw} autoComplete="current-password"
          hint={<Link to={`/app/forgot${validEmail(email) ? `?email=${encodeURIComponent(email.trim())}` : ''}`} className="lp-auth-link">Forgot password?</Link>} />
        {error === 'confirm-first' ? (
          <p className="lp-error" role="alert">Confirm your email first: open the link we sent. <button type="button" className="up-linkbtn" onClick={async () => {
            const { error: e } = await sb().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authReturnUrl('signup'), captchaToken: await captcha() } })
            setResent(e ? authMessage(e) : 'Sent again. Check your inbox.')
          }}>Send it again</button></p>
        ) : error && <p className="lp-error" role="alert">{error}</p>}
        {resent && <p className="lp-hint">{resent}</p>}
        <button type="submit" className="lp-btn primary full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
    </Shell>
  )
}

export function CloudForgot() {
  const [params] = useSearchParams()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [tried, setTried] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const emailOk = validEmail(email)
  const send = async () => {
    setTried(true)
    if (!emailOk) return
    const { error: e } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: authReturnUrl('recovery'), captchaToken: await captcha() })
    // The same answer whether or not the address has an account; only real failures are shown.
    const m = e ? authMessage(e) : ''
    if (m && m !== 'Email or password is incorrect.') { setError(m); return }
    setSent(true)
  }
  if (sent) return (
    <Shell title="Check your email" sub={<>If an account uses <b>{email.trim()}</b>, we’ve sent a link to set a new password. It works once and expires after an hour.</>}
      foot={<Link to="/app/login">Back to log in</Link>}>
      <CheckEmail email={email.trim()} what="reset your password" onResend={async () => {
        const { error: e } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: authReturnUrl('recovery'), captchaToken: await captcha() })
        return e ? authMessage(e) : 'Sent again.'
      }} />
    </Shell>
  )
  return (
    <Shell title="Forgot your password?" sub="Enter the email you signed up with and we’ll send you a link to set a new one." foot={<>Remembered it? <Link to="/app/login">Log in</Link></>}>
      <form className="lp-auth-fields" onSubmit={(e) => { e.preventDefault(); void send() }} noValidate>
        <label className="lp-field">Email
          <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="email" aria-invalid={tried && !emailOk} />
          {tried && !emailOk && <span className="lp-error">Enter an email like name@company.com.</span>}
        </label>
        {error && <p className="lp-error" role="alert">{error}</p>}
        <button type="submit" className="lp-btn primary full">Send reset link</button>
      </form>
    </Shell>
  )
}

/** After the reset link: the link signed this browser in for recovery; set the new password. */
export function CloudReset() {
  const nav = useNavigate()
  const [state] = useSaas()
  const ready = useSaasReady()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  if (!ready) return <Loading />
  if (done) return (
    <Shell title="Password changed" sub="You’re logged in with your new password.">
      <button className="lp-btn primary full" onClick={() => nav('/app', { replace: true })}>Open your panel</button>
    </Shell>
  )
  if (!isSignedIn(state)) return (
    <Shell title="This link doesn’t work" sub="Reset links work once and expire after an hour." foot={<Link to="/app/login">Back to log in</Link>}>
      <Link to="/app/forgot" className="lp-btn primary full">Send a new link</Link>
    </Shell>
  )
  const problem = passwordProblem(pw, state.account?.email)
  const match = pw === pw2
  const submit = async () => {
    setTried(true)
    if (problem || !match || busy) return
    setBusy(true); setError('')
    const { error: e } = await sb().auth.updateUser({ password: pw })
    setBusy(false)
    if (e) { setError(authMessage(e)); return }
    setDone(true)
  }
  return (
    <Shell title="Set a new password" sub={<>For <b>{state.account?.email}</b>.</>}>
      <form className="lp-auth-fields" onSubmit={(e) => { e.preventDefault(); void submit() }} noValidate>
        <PasswordField label="New password" value={pw} onChange={setPw} autoComplete="new-password" autoFocus invalid={tried && !!problem} error={tried ? problem : ''} hint={<Strength pw={pw} />} />
        <PasswordField label="Confirm new password" value={pw2} onChange={setPw2} autoComplete="new-password" invalid={tried && !match} error={tried && !match ? 'The passwords don’t match.' : ''} />
        {error && <p className="lp-error" role="alert">{error}</p>}
        <button type="submit" className="lp-btn primary full" disabled={busy}>{busy ? 'Saving…' : 'Save and log in'}</button>
      </form>
    </Shell>
  )
}

/**
 * Links from the email templates (#/app/confirm?token_hash=…&type=…). They work on any device,
 * unlike Supabase's default links, which only work in the browser that asked for them.
 */
export function Confirm() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [error, setError] = useState('')
  useEffect(() => {
    const token_hash = params.get('token_hash') ?? ''
    const type = params.get('type') ?? ''
    if (!/^[\w-]{10,200}$/.test(token_hash) || !['email', 'signup', 'recovery', 'invite', 'magiclink', 'email_change'].includes(type)) { setError('expired'); return }
    let live = true
    void sb().auth.verifyOtp({ token_hash, type: (type === 'signup' ? 'email' : type) as 'email' | 'recovery' | 'invite' | 'magiclink' | 'email_change' }).then(async ({ error: e }) => {
      if (!live) return
      if (e) { setError(authMessage(e)); return }
      await refreshCloud()
      nav(type === 'recovery' ? '/app/reset' : '/app', { replace: true })
    })
    return () => { live = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  if (!error) return <Shell title="One moment…"><p className="lp-muted">Checking your link.</p></Shell>
  return (
    <Shell title="This link doesn’t work" sub={error === 'expired' ? 'It has expired or was already used.' : error} foot={<Link to="/app/login">Back to log in</Link>}>
      <Link to="/app/forgot" className="lp-btn full">Reset your password</Link>
      <Link to="/app/login" className="lp-btn primary full">Log in</Link>
    </Shell>
  )
}
