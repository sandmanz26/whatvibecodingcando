// Internal ops panel (founder only): every read and write goes through admin-only database
// functions (supabase/migrations/…_ops.sql). Nothing here is shown to normal users.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { authMessage, captcha } from './supabase'

/**
 * The ops panel signs in on its own, apart from the customer panel: its own Supabase client and
 * session, kept in sessionStorage (gone when the tab closes), email and password only.
 */
const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
let client: SupabaseClient | null = null
function admin(): SupabaseClient | null {
  if (!URL_ || !KEY) return null
  client ??= createClient(URL_, KEY, {
    auth: { storageKey: 'oh-ops-auth', storage: window.sessionStorage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
  })
  return client
}

export const PLANS = ['free', 'pro_beta', 'founding', 'pro'] as const
export type Plan = (typeof PLANS)[number]
export const PLAN_LABEL: Record<Plan, string> = { free: 'Free', pro_beta: 'Pro beta', founding: 'Founding', pro: 'Pro' }

export interface Overview {
  users_total: number; users_24h: number; users_7d: number; users_30d: number; active_7d: number
  projects_total: number; sites_seen: number; sites_shown: number
  comments_total: number; comments_7d: number; studies_7d: number; runs_7d: number; reviewers_total: number
  email_pending: number; email_stuck: number; plans: Partial<Record<Plan, number>>; founding_limit: number
}
export interface Day { day: string; signups: number; projects: number }
export interface Funnel { days: number; signed_up: number; onboarded: number; installed: number; commented: number }
export interface OpsUser { id: string; email: string | null; created_at: string; last_sign_in_at: string | null; provider: string; projects: number; comments: number; plan: Plan }
export interface UserDetail {
  id: string; email: string | null; created_at: string; last_sign_in_at: string | null; provider: string
  plan: { plan: Plan; note: string | null; updated_at: string } | null
  workspaces: { id: string; name: string; role: string; created_at: string; projects: { id: string; name: string; origin: string; public_id: string; created_at: string; installed: boolean; comments: number }[] }[]
}
export interface AuditRow { id: number; admin: string | null; action: string; target: string | null; detail: Record<string, unknown>; at: string }

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const sb = admin()
  if (!sb) throw new Error('Ops needs the server')
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** Is the ops session's user a platform admin? Reads only their own row (row level security). */
export async function amAdmin(): Promise<boolean> {
  const sb = admin()
  if (!sb) return false
  const { data: { session } } = await sb.auth.getSession()
  if (!session) return false
  const { data, error } = await sb.from('platform_admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
  return !error && !!data
}

/** The ops session's email, or null when signed out. */
export async function opsEmail(): Promise<string | null> {
  const sb = admin()
  if (!sb) return null
  const { data: { session } } = await sb.auth.getSession()
  return session?.user.email ?? null
}

/**
 * Signs in to ops. A wrong password and an account without admin access get the same answer, and a
 * non-admin's session is dropped at once.
 */
export async function opsSignIn(email: string, password: string): Promise<string> {
  const sb = admin()
  if (!sb) return 'Ops needs the server.'
  const { error } = await sb.auth.signInWithPassword({ email, password, options: { captchaToken: await captcha() } })
  const refused = 'Email or password is incorrect, or this account has no ops access.'
  if (error) { const m = authMessage(error); return m === 'Email or password is incorrect.' || m === 'confirm-first' ? refused : m }
  if (await amAdmin()) return ''
  await sb.auth.signOut({ scope: 'local' })
  return refused
}

export async function opsSignOut() { await admin()?.auth.signOut({ scope: 'local' }) }

export const opsOverview = () => rpc<Overview>('ops_overview')
export const opsDaily = (days: number) => rpc<Day[]>('ops_signups_daily', { p_days: days })
export const opsFunnel = (days: number) => rpc<Funnel>('ops_funnel', { p_days: days })
export const opsUsers = (search: string, limit: number, offset: number) =>
  rpc<{ total: number; rows: OpsUser[] }>('ops_users', { p_search: search || null, p_limit: limit, p_offset: offset })
export const opsUserDetail = (id: string) => rpc<UserDetail | null>('ops_user_detail', { p_user: id })
export const opsAudit = (limit = 30) => rpc<AuditRow[]>('ops_audit_recent', { p_limit: limit })
export const opsSetPlan = (id: string, plan: Plan, note: string) => rpc<unknown>('ops_set_plan', { p_user: id, p_plan: plan, p_note: note || null })
