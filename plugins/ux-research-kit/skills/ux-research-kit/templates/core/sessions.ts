/**
 * Sessions: click data read the way a researcher reads it — one person, in order.
 */
import type { ClickEvent, EndReason, InsightEvent } from './tracker'

export interface Step {
  /** ms since the session started */ at: number
  t: string
  kind: 'view' | 'tap'
  page: string
  query?: string
  from?: string
  label?: string
  what?: string
  where?: string
  effect?: string
  flags: ('rage' | 'dead' | 'idle')[]
  x?: number
  y?: number
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
  layout: Layout
  vw: number
  pages: string[]
  taps: number
  problems: number
  steps: Step[]
  /** absent while it is still going */
  ended?: EndReason
}

export type Layout = 'mobile' | 'tablet' | 'desktop'
export const layoutOf = (vw: number): Layout => (vw < 640 ? 'mobile' : vw < 1024 ? 'tablet' : 'desktop')

export const ENDED: Record<EndReason, string> = { ended: 'Ended', closed: 'Closed the tab', idle: 'Idle 30 min', stopped: 'Recording stopped' }

export function zoneOf(x: number, y: number, docH: number) {
  const v = y / Math.max(1, docH)
  const row = v < 0.33 ? 'top' : v < 0.66 ? 'middle' : 'bottom'
  const col = x < 33 ? 'left' : x < 66 ? 'center' : 'right'
  return row === 'middle' && col === 'center' ? 'center' : `${row}-${col}`
}

const effectText = (c: ClickEvent) =>
  c.fx === 'navigated' ? `opened ${c.to}` : c.fx === 'changed' ? 'the screen changed' : c.kind === 'field' ? 'focused the field' : 'nothing happened'

export function buildSessions(events: InsightEvent[]): Session[] {
  const bySid = new Map<string, InsightEvent[]>()
  events.forEach((e) => bySid.set(e.sid, [...(bySid.get(e.sid) ?? []), e]))
  const out: Session[] = []
  for (const [sid, all] of bySid) {
    const sorted = [...all].sort((a, b) => a.t.localeCompare(b.t))
    // A 'closed' mark followed by more activity was a reload: the session went on.
    const lastEnd = sorted[sorted.length - 1]?.type === 'end' ? sorted[sorted.length - 1] : undefined
    const evs = sorted.filter((e) => e.type !== 'end')
    if (!evs.length) continue
    const t0 = new Date(evs[0].t).getTime()
    const steps: Step[] = evs.map((e): Step => {
      const at = new Date(e.t).getTime() - t0
      if (e.type === 'view') return { at, t: e.t, kind: 'view', page: e.page, query: e.query, from: e.from, flags: [], vw: e.vw, vh: e.vh }
      const c = e as ClickEvent
      const flags: Step['flags'] = []
      if (c.rage) flags.push('rage')
      if (c.dead) flags.push('dead')
      else if (c.fx === 'nothing' && c.kind !== 'field') flags.push('idle')
      return {
        at, t: c.t, kind: 'tap', page: c.page, query: c.query, label: c.label, what: c.kind,
        where: `${c.section} · ${zoneOf(c.x, c.y, c.docH)}`, effect: effectText(c), flags,
        x: c.x, y: c.y, ex: c.ex, ey: c.ey, sel: c.sel, vw: c.vw, vh: c.vh,
      }
    })
    const pages: string[] = []
    steps.forEach((s) => { if (s.kind === 'view' && pages[pages.length - 1] !== s.page) pages.push(s.page) })
    if (!pages.length) pages.push(steps[0].page)
    const last = lastEnd ?? evs[evs.length - 1]
    out.push({
      sid, n: 0, start: evs[0].t, end: last.t, ms: new Date(last.t).getTime() - t0,
      layout: layoutOf(evs[0].vw), vw: evs[0].vw, pages,
      taps: steps.filter((s) => s.kind === 'tap').length,
      problems: steps.filter((s) => s.flags.length).length,
      steps,
      ...(lastEnd?.type === 'end' ? { ended: lastEnd.reason } : {}),
    })
  }
  out.sort((a, b) => a.start.localeCompare(b.start)).forEach((s, i) => (s.n = i + 1))
  return out.reverse()
}

export const clock = (ms: number) => {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function sessionCsv(s: Session) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const rows = [['time', 'since start', 'event', 'page', 'filters', 'element', 'kind', 'where', 'result', 'flags']]
  s.steps.forEach((st) => rows.push([
    st.t, clock(st.at), st.kind === 'view' ? 'opened page' : 'tap', st.page, st.query ?? '',
    st.label ?? '', st.what ?? '', st.where ?? '', st.kind === 'view' ? (st.from ? `from ${st.from}` : 'first page') : st.effect ?? '', st.flags.join(' '),
  ]))
  return rows.map((r) => r.map(esc).join(',')).join('\n')
}
