/**
 * Product analytics (PostHog) for the hosted product's own pages at /app: never in the script that
 * runs on customers' sites (src/core/embed), which must stay small and private.
 *
 * Off unless the build has VITE_POSTHOG_KEY (a public project key, phc_…). When on:
 * - PostHog loads after the page (its own chunk), and events wait in a queue until it has.
 * - No autocapture, no session recording, no surveys or flags: only page views and the named
 *   events below. Never comment text, field values, emails or names; the account id only.
 * - A first-party cookie keeps the anonymous id, so the website (/) and the app (/app) are one visit.
 * - Addresses are cleaned before sending: share-link tokens and sign-in codes never leave.
 */
import type { PostHog } from 'posthog-js'

const KEY: string = import.meta.env.VITE_POSTHOG_KEY ?? ''
const HOST: string = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'
export const analyticsOn = /^phc_[A-Za-z0-9]{20,}$/.test(KEY)

/**
 * The named events, object_action in snake_case (docs/POSTHOG.md lists what each answers).
 * Journey: signup_started → signup_completed → onboarding_completed → snippet_copied → install_detected
 * → review_link_created → first_comment_received → comment_resolved / fix_prompt_copied, plus research
 * (study_created, study_results_viewed), rounds (round_started, round_approved_seen) and settings.
 */
export type FunnelEvent =
  | 'signup_started' | 'signup_completed' | 'login_completed' | 'onboarding_completed' | 'snippet_copied'
  | 'widget_published' | 'open_my_site' | 'install_detected' | 'review_link_created' | 'first_comment_received'
  | 'comment_resolved' | 'fix_prompt_copied' | 'csv_exported' | 'study_created' | 'study_results_viewed'
  | 'rounds_turned_on' | 'rounds_turned_off' | 'round_started' | 'round_approved_seen' | 'settings_notify_changed'
  | 'checkout_started' | 'subscription_activated'
export type Props = Record<string, string | number | boolean | string[]>
/** How the account signed up or in. */
export type Method = 'email' | 'google' | 'demo'

let ph: PostHog | null = null
let started = false
const queue: ((p: PostHog) => void)[] = []
const run = (f: (p: PostHog) => void) => { if (!analyticsOn) return; if (ph) f(ph); else { queue.push(f); start() } }

/** Removes secrets from an address: share-link tokens, sign-in codes and review hints. */
export function cleanUrl(v: string): string {
  return v
    .replace(/(#\/share\/)[^/?&#]+/g, '$1:token')
    .replace(/([?&](?:code|token_hash|access_token|refresh_token|auth|error_description|vibe_t|vibe_r)=)[^&#]*/g, '$1…')
    .replace(/(#.*?[?&](?:token_hash|code)=)[^&]*/g, '$1…')
}

function start() {
  if (started || !analyticsOn) return
  started = true
  void import('posthog-js').then(({ default: p }) => {
    p.init(KEY, {
      api_host: HOST,
      persistence: 'cookie',
      person_profiles: 'identified_only',
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_web_experiments: true,
      advanced_disable_flags: true,
      before_send: (e) => {
        if (!e) return e
        for (const [k, v] of Object.entries(e.properties ?? {})) if (typeof v === 'string' && (v.includes('://') || v.includes('#/'))) e.properties[k] = cleanUrl(v)
        return e
      },
    })
    ph = p
    for (const f of queue.splice(0)) f(p)
  }).catch(() => { /* analytics never breaks the app */ })
}

export const pageview = () => run((p) => p.capture('$pageview'))
export const track = (event: FunnelEvent, props?: Props) => run((p) => p.capture(event, props))

/**
 * Safe person properties: ids, counts, dates and choices only. Never email, name or anything typed.
 * plan, signup_method, created_at, projects, has_installed, products (the tool ids picked).
 */
export interface PersonProps {
  plan?: string; signup_method?: Method; created_at?: string; projects?: number; has_installed?: boolean; products?: string[]
}
/** The signed-in account, by its id only (never email or name), with safe person properties. */
export const identify = (id: string, props?: PersonProps) => run((p) => {
  if (p.get_distinct_id() !== id) p.identify(id)
  if (props) {
    const { created_at, signup_method, ...rest } = props
    // created_at and the signup method never change: set once; the rest follows the account.
    p.setPersonProperties(clean(rest), clean({ created_at, signup_method }))
  }
})
/** Updates safe person properties of the signed-in account (e.g. has_installed once a script is seen). */
export const setPerson = (props: PersonProps) => run((p) => p.setPersonProperties(clean({ ...props })))
/** The workspace as a PostHog group (group analytics): its id and counts only, never its name. */
export const group = (workspaceId: string, props: { projects: number; plan?: string }) =>
  run((p) => p.group('workspace', workspaceId, clean(props)))
const clean = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))
export const resetAnalytics = () => { if (ph) ph.reset() }

/** An event that counts once per project (or per account) in this browser: first comment, install seen. */
export function trackOnce(event: FunnelEvent, project: string, props?: Props) {
  if (!analyticsOn) return
  const k = `vibe.analytics.${event}.${project}`
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1') } catch { /* still count it */ }
  track(event, props)
}
