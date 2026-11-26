/**
 * The browser-only demo's stand-in for the heatmap's database functions (a build without a server).
 * Same calls and answers as the server (start_reviewer_run, log_events, heatmap_points,
 * default_study_invite, study_info, start_run, finish_run), kept in this site's localStorage, so the
 * widget's code is the same in both modes. Only this browser's own clicks: nothing leaves it.
 */
import { NS } from './store'

interface LRun { id: string; source: 'reviewer' | 'participant'; started: number; vw: number }
interface LEv { r: string; kind: string; page: string; x?: number; y?: number; vw?: number; sel?: string; label?: string; ex?: number; ey?: number; rage?: boolean; dead?: boolean; t: number; version?: string }
interface Store { study: { id: string; name: string; token: string; open: boolean }; runs: LRun[]; events: LEv[] }

const key = (p: string) => `${NS}lheat:${p}`
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')
/** The project id from the page's script (the demo has one project per page). */
const project = () => (window as unknown as { __vibeCollab?: { project?: string } }).__vibeCollab?.project ?? 'local'

function load(p: string): Store {
  try {
    const s = JSON.parse(localStorage.getItem(key(p)) ?? 'null') as Store | null
    if (s?.study?.token) return s
  } catch { /* new */ }
  const s: Store = { study: { id: hex(8), name: 'Site heatmap', token: hex(32), open: true }, runs: [], events: [] }
  save(p, s)
  return s
}
function save(p: string, s: Store) {
  try { localStorage.setItem(key(p), JSON.stringify({ ...s, events: s.events.slice(-20000) })) } catch { /* full: older clicks are lost */ }
}
const err = (m: string) => Object.assign(new Error(m), { name: 'ServerError' })
const device = (vw: number) => (vw < 700 ? 'mobile' : vw < 1100 ? 'tablet' : 'desktop')

export function localRpc(fn: string, a: Record<string, unknown>): unknown {
  const p = typeof a.p_public_id === 'string' ? a.p_public_id : project()
  const s = load(p)
  switch (fn) {
    case 'default_study_invite':
      return { token: s.study.open ? s.study.token : null, open: s.study.open, name: s.study.name, people: s.runs.length }
    case 'start_reviewer_run': {
      const run: LRun = { id: hex(16), source: 'reviewer', started: Date.now(), vw: Number(a.p_vw) || 0 }
      s.runs.push(run); save(p, s)
      return { run: run.id, started: run.started }
    }
    case 'study_info':
      if (a.p_token !== s.study.token) throw err('link_expired')
      if (!s.study.open) throw err('study_closed')
      return { name: s.study.name, kind: 'browse', eye: false, tasks: 1 }
    case 'start_run': {
      if (a.p_token !== s.study.token) throw err('link_expired')
      const run: LRun = { id: hex(16), source: 'participant', started: Date.now(), vw: Number(a.p_vw) || 0 }
      s.runs.push(run); save(p, s)
      return { run: run.id, kind: 'browse', name: s.study.name, config: { minutes: 3, prompt: 'Look around the site as you normally would.' }, eye: false }
    }
    case 'log_events': {
      const all = load(project())
      const run = all.runs.find((r) => r.id === a.p_run)
      if (!run) throw err('no_run')
      const evs = (Array.isArray(a.p_events) ? a.p_events : []).slice(0, 200) as LEv[]
      for (const e of evs) if (e && typeof e.page === 'string' && /^\/(?!\/)/.test(e.page)) all.events.push({ ...e, r: run.id })
      save(project(), all)
      return evs.length
    }
    case 'finish_run': return null
    case 'heatmap_points': {
      const kind = a.p_kind === 'gaze' ? 'gaze' : 'click'
      const ids = new Map(s.runs.map((r, i) => [r.id, { n: i + 1, dev: device(r.vw) }]))
      const points = s.events.filter((e) => e.kind === kind && e.page === a.p_page).map((e) => ({
        x: e.x, y: e.y, vw: e.vw, sel: e.sel ?? null, label: e.label ?? null, ex: e.ex ?? null, ey: e.ey ?? null, rage: !!e.rage, dead: !!e.dead,
        p: ids.get(e.r)?.n ?? 0, t: e.t, dev: ids.get(e.r)?.dev ?? null, acc: null, ver: e.version ?? '',
      }))
      return { studies: [{ id: s.study.id, name: s.study.name }], points, anchors: [] }
    }
    default: throw err('no_server')
  }
}
