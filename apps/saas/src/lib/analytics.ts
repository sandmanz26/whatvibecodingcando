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

/** The events of the funnel (website → sign-up → installed → first feedback). */
export type FunnelEvent =
  | 'signup_completed' | 'login_completed' | 'onboarding_completed' | 'snippet_copied' | 'site_updated'
  | 'open_my_site' | 'script_detected' | 'review_link_created' | 'first_comment_received' | 'study_created'
  | 'comments_exported' | 'fix_prompt_copied'

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
export const track = (event: FunnelEvent, props?: Record<string, string | number | boolean>) => run((p) => p.capture(event, props))
/** The signed-in account, by its id only (never email or name). */
export const identify = (id: string) => run((p) => { if (p.get_distinct_id() !== id) p.identify(id) })
export const resetAnalytics = () => { if (ph) ph.reset() }

/** An event that counts once per project in this browser (first comment, script first seen). */
export function trackOnce(event: FunnelEvent, project: string, props?: Record<string, string | number | boolean>) {
  if (!analyticsOn) return
  const k = `vibe.analytics.${event}.${project}`
  try { if (localStorage.getItem(k)) return; localStorage.setItem(k, '1') } catch { /* still count it */ }
  track(event, props)
}
