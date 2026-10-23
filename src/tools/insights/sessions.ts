/**
 * Sessions: the click data read the way a researcher reads it — one person, in order.
 * A session is one browser tab (the tracker's random per-tab id), never a named user.
 */
import { APP, readJSON, writeJSON } from '../shared'
import { layoutOf, type ClickEvent, type EndReason, type InsightEvent } from './store'
import { zoneOf } from './analyze'

export interface Step {
  /** ms since the session started */
  at: number
  /** wall-clock time, ISO */
  t: string
  kind: 'view' | 'tap'
  page: string
  /** the screen's filters and tabs when it happened */
  query?: string
  /** for views: the page it came from */
  from?: string
  label?: string
  what?: string
  where?: string
  effect?: string
  flags: ('rage' | 'dead' | 'idle')[]
  /** for drawing the tap on the real screen */
  x?: number
  y?: number
  /** where on the element (%), so the tap is drawn on it even when the layout differs */
  ex?: number
  ey?: number
  sel?: string
  vw: number
  vh?: number
}

export interface Session {
  sid: string
  n: number
  start: string
  end: string
  ms: number
  layout: string
  vw: number
  pages: string[]
  taps: number
  problems: number
  steps: Step[]
  /** how it ended; absent while it is still going */
  ended?: EndReason
}

export const ENDED: Record<EndReason, string> = {
  ended: 'Ended',
  closed: 'Closed the tab',
  idle: 'Idle 30 min',
  stopped: 'Recording stopped',
}

const effectText = (c: ClickEvent) =>
  c.fx === 'navigated' ? `opened ${c.to}` : c.fx === 'changed' ? 'the screen changed' : c.kind === 'field' ? 'focused the field' : 'nothing happened'

export function buildSessions(events: InsightEvent[]): Session[] {
  const bySid = new Map<string, InsightEvent[]>()
  events.forEach((e) => bySid.set(e.sid, [...(bySid.get(e.sid) ?? []), e]))
  const sessions = [...bySid.entries()].map(([sid, all]) => {
    const sorted = [...all].sort((a, b) => a.t.localeCompare(b.t))
    // A 'closed' mark followed by more activity was a reload: the session went on.
    const lastEnd = sorted[sorted.length - 1]?.type === 'end' ? sorted[sorted.length - 1] : undefined
    const evs = sorted.filter((e) => e.type !== 'end')
    if (!evs.length) return null
    const list = evs
    const t0 = new Date(evs[0].t).getTime()
    const steps: Step[] = list.flatMap((e): Step[] => {
      const at = new Date(e.t).getTime() - t0
      if (e.type === 'view') return [{ at, t: e.t, kind: 'view', page: e.page, query: e.query, from: e.from, flags: [], vw: e.vw, vh: e.vh }]
      const flags: Step['flags'] = []
      if (e.rage) flags.push('rage')
      if (e.dead) flags.push('dead')
      else if (e.fx === 'nothing' && e.kind !== 'field') flags.push('idle')
      return [{
        at, t: e.t, kind: 'tap', page: e.page, query: e.query, label: e.label, what: e.kind,
        where: `${e.section} · ${zoneOf(e.x, e.y, e.docH)}`, effect: effectText(e), flags,
        x: e.x, y: e.y, ex: e.ex, ey: e.ey, sel: e.sel, vw: e.vw, vh: e.vh,
      }]
    })
    const pages: string[] = []
    steps.forEach((s) => { if (s.kind === 'view' && pages[pages.length - 1] !== s.page) pages.push(s.page) })
    if (!pages.length && steps.length) pages.push(steps[0].page)
    const last = lastEnd ?? evs[evs.length - 1]
    const session: Session = {
      sid, n: 0, start: evs[0].t, end: last.t, ms: new Date(last.t).getTime() - t0,
      layout: layoutOf(evs[0].vw), vw: evs[0].vw, pages,
      taps: steps.filter((s) => s.kind === 'tap').length,
      problems: steps.filter((s) => s.flags.length).length,
      steps,
      ...(lastEnd?.type === 'end' ? { ended: lastEnd.reason } : {}),
    }
    return session
  }).filter((s): s is Session => s !== null)
  sessions.sort((a, b) => a.start.localeCompare(b.start)).forEach((s, i) => (s.n = i + 1))
  return sessions.reverse()
}

export const clock = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function sessionCsv(s: Session) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = [['time', 'since start', 'event', 'page', 'element', 'kind', 'where', 'result', 'flags']]
  s.steps.forEach((st) => rows.push([
    st.t, clock(st.at), st.kind === 'view' ? 'opened page' : 'tap', st.page,
    st.label ?? '', st.what ?? '', st.where ?? '', st.kind === 'view' ? (st.from ? `from ${st.from}` : 'first page') : st.effect ?? '', st.flags.join(' '),
  ]))
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}

/* ---------- researcher notes per session ---------- */

export interface SessionNote { note: string; tags: string[] }
const NOTES_KEY = `${APP}.insights.notes`
export const TAGS = ['Found it', 'Confused', 'Got lost', 'Slow', 'Bug', 'Worth a follow-up']
export const loadNotes = () => readJSON<Record<string, SessionNote>>(NOTES_KEY, {})
export const saveNote = (sid: string, n: SessionNote) => writeJSON(NOTES_KEY, { ...loadNotes(), [sid]: n })
