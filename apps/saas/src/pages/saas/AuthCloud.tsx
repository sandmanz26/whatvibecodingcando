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
 * Register, log in, forgot and reset password against Supabase Auth. Email users sign in with a
 * one-time code by email (passwordless first); Google is one click; passwords stay as a second way. Used when the build has a Supabase project.
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

/** The one-time code's own errors, as sentences (authMessage covers the rest). */
function codeMessage(e: { message?: string; code?: string; status?: number }): string {
  const m = authMessage(e)
  if (m === 'expired') return 'That code is wrong or has expired. Check the latest email, or send a new code.'
  if (m === 'Email or password is incorrect.' || /token|otp|invalid/i.test(e.message ?? '')) return 'That code isn’t right. Check the latest email and try again.'
  return m
}

/**
 * The 6-digit code screen: one field (paste works; phones offer the code from the email), resend
 * after a minute, and the code is checked as soon as six digits are in.
 */
function CodeStep({ email, sentNote, onResend, onVerified, onBack }: {
  email: string; sentNote: React.ReactNode; onResend: () => Promise<string>; onVerified: () => Promise<void>; onBack: () => void
}) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [wait, setWait] = useState(60)
  useEffect(() => { if (wait <= 0) return; const t = window.setTimeout(() => setWait((w) => w - 1), 1000); return () => window.clearTimeout(t) }, [wait])
  const verify = async (token: string) => {
    if (busy) return
    if (!/^\d{6}$/.test(token)) { setError('Enter the 6-digit code from the email.'); return }
    setBusy(true); setError(''); setNote('')
    const { error: e } = await sb().auth.verifyOtp({ email, token, type: 'email' })
    if (e) { setBusy(false); setCode(''); setError(codeMessage(e)); return }
    await onVerified()
  }
  return (
    <Shell title="Check your email" sub={sentNote} foot={<>Wrong address? <button className="up-linkbtn" onClick={onBack}>Use another email</button></>}>
      <form className="lp-auth-fields" onSubmit={(e) => { e.preventDefault(); void verify(code) }} noValidate>
        <label className="lp-field">6-digit code
          <input autoFocus value={code} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} aria-invalid={!!error}
            onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setCode(v); if (v.length === 6) void verify(v) }}
            style={{ fontSize: 24, letterSpacing: '0.4em', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} />
        </label>
        {error && <p className="lp-error" role="alert">{error}</p>}
        <button type="submit" className="lp-btn primary full" disabled={busy}>{busy ? 'Checking…' : 'Continue'}</button>
        <button type="button" className="lp-btn full" disabled={wait > 0 || busy} onClick={async () => { setError(''); setNote(await onResend()); setWait(60) }}>{wait > 0 ? `Send a new code in ${wait} s` : 'Send a new code'}</button>
        {note && <p className="lp-hint" role="status">{note}</p>}
        <p className="lp-hint">The code works once and expires after 10 minutes. Not there? Check spam.</p>
      </form>
    </Shell>
  )
}

export function CloudRegister() {
  useEffect(() => { track('signup_started', { method: 'email' }) }, [])
  const [params] = useSearchParams()
  const [state] = useSaas()
  const ready = useSaasReady()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const products = parseProducts(params.get('products'))
  const onboarding = `/app/onboarding${products.length ? `?products=${products.join(',')}` : ''}`
  if (!ready) return <Loading />
  if (isSignedIn(state)) return <Navigate to={isOnboarded(state) ? '/app' : onboarding} replace />

  const emailOk = validEmail(email)
  const send = async () => (await sb().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true, data: { name: name.trim().slice(0, 40), onboarded: false }, emailRedirectTo: authReturnUrl('signup'), captchaToken: await captcha() } })).error
  const submit = async () => {
    setTried(true)
    if (!name.trim() || !emailOk || busy) return
    setBusy(true); setError('')
    try { sessionStorage.setItem('vibe.onboarding.products', products.join(',')) } catch { /* ignore */ }
    const e = await send()
    setBusy(false)
    if (e) { setError(codeMessage(e)); return }
    setSent(true)
  }
  if (sent) return (
    <CodeStep email={email.trim()} sentNote={<>We sent a 6-digit code to <b>{email.trim()}</b>. Enter it to create your account.</>}
      onBack={() => setSent(false)}
      onResend={async () => { const e = await send(); return e ? codeMessage(e) : 'A new code is on its way.' }}
      onVerified={async () => { track('signup_completed', { method: 'email', via: 'code', products: products.length }); await refreshCloud() }} />
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
        {error && <p className="lp-error" role="alert">{error}</p>}
        <button type="submit" className="lp-btn primary full" disabled={busy}>{busy ? 'Sending…' : 'Email me a code'}</button>
        <p className="lp-hint">No password needed: we email you a 6-digit code. By creating an account you agree to the <Link to="/terms">terms</Link> and the <Link to="/privacy">privacy policy</Link>.</p>
      </form>
    </Shell>
  )
}

export function CloudLogin() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [state] = useSaas()
  const ready = useSaasReady()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [pw, setPw] = useState('')
  const [usePw, setUsePw] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [resent, setResent] = useState('')
  const next = safeNext(params.get('next'))
  const link = params.get('link')
  if (!ready) return <Loading />
  if (isSignedIn(state) && !busy && !sent) return <Navigate to={next} replace />

  const done = async (method: 'email_code' | 'password') => { await refreshCloud(); track('login_completed', { method: 'email', via: method === 'email_code' ? 'code' : 'password' }); nav(next, { replace: true }) }
  // Logging in never creates an account. An unknown address gets the same answer as a known one.
  const sendCode = async () => {
    const { error: e } = await sb().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, captchaToken: await captcha() } })
    if (!e) return ''
    if (e.code === 'otp_disabled' || e.code === 'user_not_found' || e.code === 'signup_disabled' || /signups not allowed|not found/i.test(e.message ?? '')) return ''
    return codeMessage(e)
  }
  const submitCode = async () => {
    if (busy) return
    if (!validEmail(email)) { setError('Enter an email like name@company.com.'); return }
    setBusy(true); setError('')
    const m = await sendCode()
    setBusy(false)
    if (m) { setError(m); return }
    setSent(true)
  }
  const submitPw = async () => {
    if (busy) return
    if (!validEmail(email) || !pw) { setError('Enter your email and password.'); return }
    setBusy(true); setError(''); setResent('')
    const { error: e } = await sb().auth.signInWithPassword({ email: email.trim(), password: pw, options: { captchaToken: await captcha() } })
    if (e) { setBusy(false); setPw(''); setError(authMessage(e)); return }
    await done('password')
  }
  if (sent) return (
    <CodeStep email={email.trim()}
      sentNote={<>If <b>{email.trim()}</b> has an account, we sent it a 6-digit code. No email? <Link to="/app/register">Create an account</Link> instead.</>}
      onBack={() => setSent(false)}
      onResend={async () => (await sendCode()) || 'If this email has an account, a new code is on its way.'}
      onVerified={() => done('email_code')} />
  )
  return (
    <Shell title="Log in" sub="Welcome back. Log in to your workspace." foot={<>New here? <Link to="/app/register">Create an account</Link></>}>
      <GoogleButton before={() => { try { sessionStorage.setItem('vibe.auth.next', next) } catch { /* ignore */ } }} />
      <form className="lp-auth-fields" onSubmit={(e) => { e.preventDefault(); void (usePw ? submitPw() : submitCode()) }} noValidate>
        {params.get('confirmed') && <p className="lp-ok"><CheckCircle2 size={16} /> Email confirmed. Log in to continue.</p>}
        {link === 'expired' && <p className="lp-error" role="alert">That link has expired or was already used. Log in, or ask for a new one.</p>}
        {link === 'google' && <p className="lp-error" role="alert">Google sign-in didn’t finish. Try again, or log in with your email.</p>}
        {link === 'other-browser' && <p className="lp-error" role="alert">That link was opened in a different browser from the one it was asked in. Log in here, or open the link in the first browser.</p>}
        <label className="lp-field">Email
          <input type="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} maxLength={120} autoComplete="username" />
        </label>
        {usePw && <PasswordField label="Password" value={pw} onChange={setPw} autoComplete="current-password" autoFocus
          hint={<Link to={`/app/forgot${validEmail(email) ? `?email=${encodeURIComponent(email.trim())}` : ''}`} className="lp-auth-link">Forgot password?</Link>} />}
        {error === 'confirm-first' ? (
          <p className="lp-error" role="alert">Confirm your email first: open the link we sent. <button type="button" className="up-linkbtn" onClick={async () => {
            const { error: e } = await sb().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: authReturnUrl('signup'), captchaToken: await captcha() } })
            setResent(e ? authMessage(e) : 'Sent again. Check your inbox.')
          }}>Send it again</button></p>
        ) : error && <p className="lp-error" role="alert">{error}</p>}
        {resent && <p className="lp-hint">{resent}</p>}
        <button type="submit" className="lp-btn primary full" disabled={busy}>{usePw ? (busy ? 'Logging in…' : 'Log in') : (busy ? 'Sending…' : 'Email me a code')}</button>
        <button type="button" className="up-linkbtn lp-auth-link" onClick={() => { setUsePw(!usePw); setError(''); setPw('') }}>{usePw ? 'Email me a code instead' : 'Use a password instead'}</button>
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
