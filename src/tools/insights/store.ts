/**
 * Click insights — event types and storage.
 *
 * Privacy rules (non-negotiable):
 * - Never record what is typed into a field, field values, names, emails or
 *   page content. For a field we record only its placeholder / name / type.
 * - The session id is random, per browser tab (sessionStorage), and not linked
 *   to any user. A session starts counting on the app's main page and ends when
 *   the tab closes, the participant ends it, it sits idle, or recording stops.
 * - Labels are a control's visible name (aria-label, else its own text, max
 *   100 chars) — never the surrounding content.
 * - Production builds default to OFF until the product owner decides on
 *   consent (banner / privacy policy). See `DEFAULTS` in ../shared.ts.
 */
import { APP, LOCAL_SCOPE, TOOLS_API, readJSON, writeJSON } from '../shared'

interface Base {
  t: string
  sid: string
  page: string
  /** the screen's filters and tabs, never free text — see safeQuery() */
  query?: string
  vw: number
  vh: number
}

export interface ViewEvent extends Base {
  type: 'view'
  from?: string
}

export type ClickKind = 'toggle' | 'field' | 'tab' | 'menu item' | 'chip' | 'card' | 'link' | 'button' | 'not a control'
export type ClickEffect = 'navigated' | 'changed' | 'nothing'

export interface ClickEvent extends Base {
  type: 'click'
  x: number
  y: number
  docH: number
  label: string
  tag: string
  href?: string
  kind: ClickKind
  section: string
  sel: string
  ex: number
  ey: number
  ew: number
  eh: number
  state?: Record<string, string>
  ms: number
  sy: number
  rage?: boolean
  dead?: boolean
  fx: ClickEffect
  to?: string
}

/** Why a session ended. 'closed' is withdrawn if the same tab carries on (a reload). */
export type EndReason = 'ended' | 'closed' | 'idle' | 'stopped'

export interface EndEvent extends Base {
  type: 'end'
  reason: EndReason
}

export type InsightEvent = ViewEvent | ClickEvent | EndEvent

export const LOCAL_KEY = `${APP}.insights.clicks`
const LOCAL_MAX = 3000

export interface Loaded {
  configured: boolean
  scope: string
  events: InsightEvent[]
}

export function appendLocal(events: InsightEvent[]) {
  if (!events.length) return
  const all = readJSON<InsightEvent[]>(LOCAL_KEY, [])
  writeJSON(LOCAL_KEY, [...all, ...events].slice(-LOCAL_MAX))
}

/** Server first when one is configured, else this browser's copy. */
export async function loadEvents(): Promise<Loaded> {
  if (TOOLS_API) {
    try {
      const r = await fetch(`${TOOLS_API}/clicks`, { cache: 'no-store' })
      const j = await r.json()
      if (j.configured) return { configured: true, scope: `Server · ${j.scope}`, events: Array.isArray(j.events) ? j.events : [] }
    } catch { /* fall through to local */ }
  }
  return { configured: false, scope: LOCAL_SCOPE, events: readJSON<InsightEvent[]>(LOCAL_KEY, []) }
}

export async function clearEvents(configured: boolean) {
  if (configured && TOOLS_API) {
    await fetch(`${TOOLS_API}/clicks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clear: true }) })
    return
  }
  try { localStorage.removeItem(LOCAL_KEY) } catch { /* ignore */ }
}

export type Layout = 'mobile' | 'tablet' | 'desktop'
export const layoutOf = (vw: number): Layout => (vw < 640 ? 'mobile' : vw < 1024 ? 'tablet' : 'desktop')
