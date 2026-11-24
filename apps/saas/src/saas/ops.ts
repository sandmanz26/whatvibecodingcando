// Internal ops panel (founder only): every read and write goes through admin-only database
// functions (supabase/migrations/…_ops.sql). Nothing here is shown to normal users.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

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
  if (!supabase) throw new Error('Ops needs the server')
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

/** Is the signed-in user a platform admin? Reads only their own row (row level security). */
export async function amAdmin(): Promise<boolean> {
  if (!supabase) return false
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false
  const { data, error } = await supabase.from('platform_admins').select('user_id').eq('user_id', session.user.id).maybeSingle()
  return !error && !!data
}

/** For the panel's nav: shows the Ops link only when the server says so. */
export function useIsAdmin(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    let live = true
    void amAdmin().then((x) => { if (live) setOn(x) }).catch(() => {})
    return () => { live = false }
  }, [])
  return on
}

export const opsOverview = () => rpc<Overview>('ops_overview')
export const opsDaily = (days: number) => rpc<Day[]>('ops_signups_daily', { p_days: days })
export const opsFunnel = (days: number) => rpc<Funnel>('ops_funnel', { p_days: days })
export const opsUsers = (search: string, limit: number, offset: number) =>
  rpc<{ total: number; rows: OpsUser[] }>('ops_users', { p_search: search || null, p_limit: limit, p_offset: offset })
export const opsUserDetail = (id: string) => rpc<UserDetail | null>('ops_user_detail', { p_user: id })
export const opsAudit = (limit = 30) => rpc<AuditRow[]>('ops_audit_recent', { p_limit: limit })
export const opsSetPlan = (id: string, plan: Plan, note: string) => rpc<unknown>('ops_set_plan', { p_user: id, p_plan: plan, p_note: note || null })
