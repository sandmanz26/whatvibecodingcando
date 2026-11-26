/**
 * The browser-only demo's stand-in for the research database functions (a build without a server).
 * Same calls and answers as the server (start_reviewer_run, log_events, heatmap_points,
 * default_study_invite, module_study_invite, visitor_modules, start_visitor_run, study_info,
 * start_run, finish_run), kept in this site's localStorage, so the widget's code is the same in both
 * modes. Only this browser's own clicks: nothing leaves it.
 *
 * Like the server, every research module that is on in the published widget gets one default (★)
 * study here, made the first time it is needed. The demo panel (Research) reads and pauses them.
 */
import { NS } from './store'
import { LocalConfigSource } from './config'

export type LModule = 'heatmap' | 'gaze' | 'fivesec' | 'usability'
export const LMODULES: LModule[] = ['heatmap', 'gaze', 'fivesec', 'usability']
export interface LStudy { id: string; name: string; token: string; open: boolean; module?: LModule }
interface LRun { id: string; source: 'reviewer' | 'participant' | 'visitor'; started: number; vw: number; study?: string }
interface LEv { r: string; kind: string; page: string; x?: number; y?: number; vw?: number; sel?: string; label?: string; ex?: number; ey?: number; rage?: boolean; dead?: boolean; t: number; version?: string }
/** `study` is the heatmap's ★ study (the only one before per-module defaults); `more` the other modules'. */
export interface LStore { study: LStudy; more?: Partial<Record<Exclude<LModule, 'heatmap'>, LStudy>>; runs: LRun[]; events: LEv[] }

const SEED: Record<LModule, { name: string; kind: 'browse' | 'fivesec' | 'usability'; eye: boolean; config: Record<string, unknown> }> = {
  heatmap: { name: 'Site heatmap', kind: 'browse', eye: false, config: { minutes: 30, prompt: 'Look around the site as you normally would.' } },
  gaze: { name: 'Eye tracking', kind: 'browse', eye: true, config: { minutes: 10, prompt: 'Look around the site as you normally would.' } },
  fivesec: { name: 'First impression', kind: 'fivesec', eye: false, config: { page: '', seconds: 5, prompt: '', questions: ['What is this page about?'] } },
  usability: { name: 'Usability test', kind: 'usability', eye: false, config: { tasks: [{ id: 't1', prompt: 'Explore the site and find what you came for', startPage: '', limitSec: 300, success: { kind: 'none' } }] } },
}

export const lheatKey = (p: string) => `${NS}lheat:${p}`
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')
/** The project id from the page's script (the demo has one project per page). */
const project = () => (window as unknown as { __vibeCollab?: { project?: string } }).__vibeCollab?.project ?? 'local'

export function loadLocal(p: string): LStore {
  try {
    const s = JSON.parse(localStorage.getItem(lheatKey(p)) ?? 'null') as LStore | null
    if (s?.study?.token) return s
  } catch { /* new */ }
  const s: LStore = { study: { id: hex(8), name: 'Site heatmap', token: hex(32), open: true, module: 'heatmap' }, runs: [], events: [] }
  saveLocal(p, s)
  return s
}
export function saveLocal(p: string, s: LStore) {
  try { localStorage.setItem(lheatKey(p), JSON.stringify({ ...s, events: s.events.slice(-20000) })) } catch { /* full: older clicks are lost */ }
}
/** A module's ★ study, made the first time it is needed (as the server does when the module is published). */
export function moduleStudy(s: LStore, m: LModule): LStudy {
  if (m === 'heatmap') return s.study
  s.more ??= {}
  return (s.more[m] ??= { id: hex(8), name: SEED[m].name, token: hex(32), open: true, module: m })
}
const studies = (s: LStore) => [s.study, ...Object.values(s.more ?? {})] as LStudy[]
const moduleOf = (s: LStore, st: LStudy): LModule => (st === s.study ? 'heatmap' : (st.module ?? 'heatmap'))
const err = (m: string) => Object.assign(new Error(m), { name: 'ServerError' })
const device = (vw: number) => (vw < 700 ? 'mobile' : vw < 1100 ? 'tablet' : 'desktop')
const live = (p: string) => new LocalConfigSource().get(p).live?.config ?? null
const invite = (s: LStore, st: LStudy) => ({ token: st.open ? st.token : null, open: st.open, name: st.name, people: s.runs.filter((r) => (r.study ?? s.study.id) === st.id).length })

export function localRpc(fn: string, a: Record<string, unknown>): unknown {
  const p = typeof a.p_public_id === 'string' ? a.p_public_id : project()
  const s = loadLocal(p)
  const byToken = () => studies(s).find((x) => x.token === a.p_token)
  switch (fn) {
    case 'default_study_invite':
      return invite(s, s.study)
    case 'module_study_invite': {
      const st = moduleStudy(s, (LMODULES.includes(a.p_module as LModule) ? a.p_module : 'heatmap') as LModule); saveLocal(p, s)
      return invite(s, st)
    }
    case 'start_reviewer_run': {
      if (!s.study.open) throw err('study_closed')
      const run: LRun = { id: hex(16), source: 'reviewer', started: Date.now(), vw: Number(a.p_vw) || 0, study: s.study.id }
      s.runs.push(run); saveLocal(p, s)
      return { run: run.id, started: run.started }
    }
    case 'visitor_modules': {
      const c = live(p)
      if (!c || c.audience !== 'everyone' || !c.on) return []
      const out = LMODULES.filter((m) => c.modules[m]).map((m) => {
        const st = moduleStudy(s, m)
        return { module: m, state: st.open ? 'open' : 'paused', kind: SEED[m].kind, name: st.name, eye: SEED[m].eye, tasks: 1 }
      })
      saveLocal(p, s)
      return out
    }
    case 'start_visitor_run': {
      const m = a.p_module as LModule
      const c = live(p)
      if (!LMODULES.includes(m)) throw err('bad_module')
      if (!c || c.audience !== 'everyone' || !c.on || !c.modules[m]) throw err('not_invited')
      const st = moduleStudy(s, m)
      if (!st.open) throw err('study_closed')
      const run: LRun = { id: hex(16), source: 'visitor', started: Date.now(), vw: Number(a.p_vw) || 0, study: st.id }
      s.runs.push(run); saveLocal(p, s)
      return { run: run.id, kind: SEED[m].kind, name: st.name, config: SEED[m].config, eye: SEED[m].eye && !!c.modules.gaze }
    }
    case 'study_info': {
      const st = byToken()
      if (!st) throw err('link_expired')
      if (!st.open) throw err('study_closed')
      const m = moduleOf(s, st)
      return { name: st.name, kind: SEED[m].kind, eye: SEED[m].eye, tasks: 1 }
    }
    case 'start_run': {
      const st = byToken()
      if (!st) throw err('link_expired')
      const m = moduleOf(s, st)
      const run: LRun = { id: hex(16), source: 'participant', started: Date.now(), vw: Number(a.p_vw) || 0, study: st.id }
      s.runs.push(run); saveLocal(p, s)
      return { run: run.id, kind: SEED[m].kind, name: st.name, config: m === 'heatmap' ? { minutes: 3, prompt: 'Look around the site as you normally would.' } : SEED[m].config, eye: SEED[m].eye }
    }
    case 'log_events': {
      const all = loadLocal(project())
      const run = all.runs.find((r) => r.id === a.p_run)
      if (!run) throw err('no_run')
      const evs = (Array.isArray(a.p_events) ? a.p_events : []).slice(0, 200) as LEv[]
      for (const e of evs) if (e && typeof e.page === 'string' && /^\/(?!\/)/.test(e.page)) all.events.push({ ...e, r: run.id })
      saveLocal(project(), all)
      return evs.length
    }
    case 'finish_run': return null
    case 'heatmap_points': {
      const kind = a.p_kind === 'gaze' ? 'gaze' : 'click'
      const ids = new Map(s.runs.map((r, i) => [r.id, { n: i + 1, dev: device(r.vw), study: r.study ?? s.study.id }]))
      const points = s.events.filter((e) => e.kind === kind && e.page === a.p_page && (!a.p_study || ids.get(e.r)?.study === a.p_study)).map((e) => ({
        x: e.x, y: e.y, vw: e.vw, sel: e.sel ?? null, label: e.label ?? null, ex: e.ex ?? null, ey: e.ey ?? null, rage: !!e.rage, dead: !!e.dead,
        p: ids.get(e.r)?.n ?? 0, t: e.t, dev: ids.get(e.r)?.dev ?? null, acc: null, ver: e.version ?? '',
      }))
      return { studies: studies(s).map((x) => ({ id: x.id, name: x.name })), points, anchors: [] }
    }
    default: throw err('no_server')
  }
}

/** For the demo panel: each research module's ★ study and how many runs it has. */
export function localStudies(p: string, on: (m: LModule) => boolean): { module: LModule; study: LStudy; runs: number; visitors: number }[] {
  const s = loadLocal(p)
  const out = LMODULES.filter(on).map((m) => {
    const st = moduleStudy(s, m)
    const rs = s.runs.filter((r) => (r.study ?? s.study.id) === st.id)
    return { module: m, study: st, runs: rs.length, visitors: rs.filter((r) => r.source === 'visitor').length }
  })
  saveLocal(p, s)
  return out
}
export function setLocalStudyOpen(p: string, m: LModule, open: boolean) {
  const s = loadLocal(p)
  moduleStudy(s, m).open = open
  saveLocal(p, s)
}
