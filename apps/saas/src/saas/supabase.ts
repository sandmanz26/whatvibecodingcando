/**
 * The Supabase client for the SaaS panel, when the build was given a project (see vite.config.ts).
 * Without one, `supabase` is null and the panel keeps its browser-only demo account.
 *
 * Only the project URL and the public (anon / publishable) key are here. Row level security on
 * the database decides what a signed-in user may read or change.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
  const what = q.get('auth')
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
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || e.status === 429) return 'Too many tries. Wait a minute and try again.'
  if (code === 'weak_password') return 'That password is too weak. Use a longer one.'
  if (code === 'same_password') return 'Use a password different from the current one.'
  if (code === 'email_address_not_authorized') return 'Emails can’t be sent to this address yet: the project’s email (SMTP) isn’t set up.'
  if (code === 'otp_expired' || code === 'flow_state_expired' || code === 'flow_state_not_found') return 'expired'
  if (e.status === 0 || /fetch|network/i.test(e.message ?? '')) return 'Can’t reach the server. Check your connection and try again.'
  return e.message ?? 'Something went wrong. Try again.'
}
