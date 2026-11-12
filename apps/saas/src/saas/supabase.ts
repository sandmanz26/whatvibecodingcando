/**
 * The Supabase client for the SaaS panel, when the build was given a project (see vite.config.ts).
 * Without one, `supabase` is null and the panel keeps its browser-only demo account.
 *
 * Only the project URL and the public (anon / publishable) key are here. Row level security on
 * the database decides what a signed-in user may read or change.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { TURNSTILE_KEY, turnstileToken } from '../core/embed/turnstile'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null = URL_ && KEY
  ? createClient(URL_, KEY, {
    auth: {
      // PKCE: links in emails come back with ?code=, which doesn't clash with the app's hash routes.
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'vibe-auth',
    },
  })
  : null
/** Accounts, workspaces and projects live on the server (true) or only in this browser (false). */
export const cloud = !!supabase
export const supabaseUrl = URL_ ?? ''

/**
 * A CAPTCHA token for Supabase Auth, when the build has a Turnstile site key (else undefined and
 * nothing loads). Usually invisible; when Cloudflare wants a click, a small box shows over the page.
 */
export async function captcha(): Promise<string | undefined> {
  if (!TURNSTILE_KEY) return undefined
  const wrap = document.createElement('div')
  wrap.style.cssText = 'position:fixed;inset:0;display:none;place-items:center;background:rgba(0,0,0,.35);z-index:9999'
  const box = document.createElement('div')
  box.style.cssText = 'background:#fff;padding:16px;border-radius:12px;min-width:300px;min-height:65px'
  wrap.append(box)
  document.body.append(wrap)
  // A failed check sends no token: Supabase then refuses with captcha_failed, shown by authMessage.
  try { return await turnstileToken(box, () => { wrap.style.display = 'grid' }, () => { wrap.style.display = 'none' }) }
  catch { return undefined }
  finally { wrap.remove() }
}

/**
 * Whether the Supabase project lets reviewers get a session (Auth → anonymous sign-ins). Reviewers on
 * customers' sites need it; null when unknown (demo mode, or the check failed).
 */
let anonCheck: Promise<boolean | null> | null = null
export function anonymousSignInsOn(): Promise<boolean | null> {
  if (!URL_ || !KEY) return Promise.resolve(null)
  anonCheck ??= fetch(`${URL_}/auth/v1/settings`, { headers: { apikey: KEY } })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && typeof j.external?.anonymous_users === 'boolean' ? j.external.anonymous_users as boolean : null))
    .catch(() => null)
  return anonCheck
}

/** Where links in emails come back to: this site's root, with what the link was for. */
export const authReturnUrl = (what: 'signup' | 'recovery' | 'email_change') =>
  `${window.location.origin}${window.location.pathname}?auth=${what}`

/**
 * Coming back from a link in an email (?auth=…&code=… or an error): once Supabase has traded the
 * code for a session, tidy the address and go to the right page. Runs once, at start.
 */
export async function finishAuthReturn() {
  if (!supabase) return
  const q = new URLSearchParams(window.location.search)
  // ?auth= is ours; a bare ?code= comes back when Supabase used its Site URL instead (redirect not allowed).
  const what = q.get('auth') ?? (q.has('code') ? 'signup' : null)
  const err = q.get('error_description') || new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('error_description')
  if (!what && !err) return
  const { data } = await supabase.auth.getSession()
  const clean = `${window.location.origin}${window.location.pathname}`
  let route = '#/app'
  if (err || !data.session) route = `#/app/login?link=${encodeURIComponent(err ? 'expired' : 'other-browser')}`
  else if (what === 'recovery') route = '#/app/reset'
  history.replaceState(null, '', `${clean}${route}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** A Supabase auth error as a sentence for people. */
export function authMessage(e: { message?: string; code?: string; status?: number } | null | undefined): string {
  if (!e) return ''
  const code = e.code ?? ''
  if (code === 'invalid_credentials') return 'Email or password is incorrect.'
  if (code === 'email_not_confirmed') return 'confirm-first'
  // Two different limits: emails per hour for the whole project, and attempts per person.
  if (code === 'over_email_send_rate_limit') return 'We can’t send more emails right now: the hourly email limit is reached. Try again in an hour.'
  if (code === 'over_request_rate_limit' || e.status === 429) return 'Too many tries. Wait a few minutes and try again.'
  if (code === 'captcha_failed' || /captcha/i.test(e.message ?? '')) return 'The check that you’re a person didn’t pass. Try again; if it keeps failing, reload the page.'
  if (code === 'weak_password') return 'That password is too weak. Use a longer one.'
  if (code === 'same_password') return 'Use a password different from the current one.'
  if (code === 'email_address_not_authorized') return 'Emails can’t be sent to this address yet: the project’s email (SMTP) isn’t set up.'
  // The project's email provider refused or failed (wrong SMTP settings, or an address it may not send to).
  if (/error sending .*email/i.test(e.message ?? '')) return 'We couldn’t send the email just now. Try again in a little while; if it keeps happening, let us know.'
  if (code === 'otp_expired' || code === 'flow_state_expired' || code === 'flow_state_not_found') return 'expired'
  if (e.status === 0 || /fetch|network/i.test(e.message ?? '')) return 'Can’t reach the server. Check your connection and try again.'
  return e.message ?? 'Something went wrong. Try again.'
}
