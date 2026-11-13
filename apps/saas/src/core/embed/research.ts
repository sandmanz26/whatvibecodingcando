/**
 * Research on a customer's site, for participants only: someone who opens a study's participant
 * link (#vibe_r=<token>) and presses "I agree". Nobody else is ever recorded.
 *
 * Recorded: where they click (page path without its query or hash, position, the element's selector
 * and a short label of what it shows), the pages they open, how long each task takes and how it
 * ended, and the answers they type into the study's own questions. Never what anyone types into the
 * site: a form field is named by its tag and label only, never its value.
 *
 * A study runs across page loads: its state lives in this tab's sessionStorage, so a site that
 * reloads between pages carries on where it was.
 */
import * as server from './server'
import { NS, selectorFor } from './store'

export type StudyKind = 'usability' | 'fivesec' | 'browse'
export type Rule = { kind: 'page'; page: string } | { kind: 'element'; sel: string; label?: string } | { kind: 'none' }
export interface Task { id: string; prompt: string; startPage: string; success: Rule; limitSec: number }
export interface StudyConfig {
  intro?: string
  tasks?: Task[]
  /** fivesec */ page?: string; seconds?: number; prompt?: string; questions?: string[]
  /** browse */ minutes?: number
}
export type Outcome = 'success' | 'timeout' | 'gave_up' | 'done'
export interface TaskResult { id: string; outcome: Outcome; ms: number; pages: string[]; clicks: number; firstClickHit: boolean | null }
export interface RunState {
  token: string
  phase: 'consent' | 'intro' | 'task' | 'showing' | 'questions' | 'done' | 'declined'
  info?: { name: string; kind: StudyKind; eye: boolean; tasks: number }
  run?: string
  kind?: StudyKind
  name?: string
  config?: StudyConfig
  t0?: number
  index: number
  taskStart?: number
  pages: string[]
  clicks: number
  firstClickHit: boolean | null
  results: TaskResult[]
  answers: string[]
}

const key = (project: string) => `${NS}run:${project}`
export function loadRun(project: string): RunState | null {
  try { const v = JSON.parse(sessionStorage.getItem(key(project)) ?? 'null'); return v && typeof v.token === 'string' ? v : null } catch { return null }
}
export function saveRun(project: string, s: RunState | null) {
  try { if (s) sessionStorage.setItem(key(project), JSON.stringify(s)); else sessionStorage.removeItem(key(project)) } catch { /* this tab only */ }
}

/** A participant link's token, taken off the address at once (it isn't left in history or shared on). */
export function takeStudyToken(): string | null {
  const h = window.location.hash
  const m = /(?:^#|&)vibe_r=([0-9a-f]{32,64})/.exec(h)
  if (!m) return null
  const rest = h.replace(/^#/, '').split('&').filter((x) => !x.startsWith('vibe_r=')).join('&')
  try { history.replaceState(history.state, '', `${window.location.pathname}${window.location.search}${rest ? `#${rest}` : ''}`) } catch { /* ignore */ }
  return m[1]
}

/* ---------- checking what the study sends (it is data from the server, still checked here) ---------- */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : '')
const path = (v: unknown) => { const p = str(v, 300).trim(); return /^\/(?!\/)/.test(p) ? p : '/' }
export function cleanConfig(kind: StudyKind, c: unknown): StudyConfig {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
  const out: StudyConfig = { intro: str(o.intro, 600) }
  if (kind === 'usability') {
    out.tasks = (Array.isArray(o.tasks) ? o.tasks : []).slice(0, 10).map((t, i): Task => {
      const x = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>
      const s = (x.success && typeof x.success === 'object' ? x.success : {}) as Record<string, unknown>
      const success: Rule = s.kind === 'page' ? { kind: 'page', page: path(s.page) } : s.kind === 'element' && str(s.sel, 400) ? { kind: 'element', sel: str(s.sel, 400), label: str(s.label, 80) } : { kind: 'none' }
      return { id: str(x.id, 40) || `t${i + 1}`, prompt: str(x.prompt, 300) || `Task ${i + 1}`, startPage: x.startPage ? path(x.startPage) : '', success, limitSec: Math.min(1800, Math.max(15, Number(x.limitSec) || 180)) }
    })
  } else if (kind === 'fivesec') {
    out.page = path(o.page); out.prompt = str(o.prompt, 300)
    out.seconds = Math.min(30, Math.max(3, Number(o.seconds) || 5))
    out.questions = (Array.isArray(o.questions) ? o.questions : []).slice(0, 3).map((q) => str(q, 200)).filter(Boolean)
  } else {
    out.page = o.page ? path(o.page) : ''; out.prompt = str(o.prompt, 300)
    out.minutes = Math.min(30, Math.max(1, Number(o.minutes) || 3))
  }
  return out
}

/** Does the page (path) meet a rule's page? "/thanks" is that page; "/order/*" any page below /order/. */
export const pageMatches = (rule: string, p: string) => (rule.endsWith('*') ? p.startsWith(rule.slice(0, -1)) : p.replace(/\/$/, '') === rule.replace(/\/$/, '') || (rule === '/' && p === '/'))

/* ---------- the click recorder ---------- */

interface Ev { t: number; task?: string; kind: 'click' | 'page'; page: string; x?: number; y?: number; vw?: number; doc_h?: number; sel?: string; label?: string; ex?: number; ey?: number; hit?: boolean; rage?: boolean; dead?: boolean }

const INTERACTIVE = 'a[href], button, input, select, textarea, label, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [onclick], [contenteditable=""], [contenteditable=true]'
/** A short label of what an element shows. A form field: its tag and its label only, never its value. */
function labelOf(el: Element) {
  const aria = el.getAttribute('aria-label')
  if (/^(input|select|textarea)$/i.test(el.tagName) || (el as HTMLElement).isContentEditable) return `${el.tagName.toLowerCase()}${aria ? ` “${aria.slice(0, 40)}”` : ''}`
  const text = (aria ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
  return `${el.tagName.toLowerCase()}${text ? ` “${text.slice(0, 40)}”` : ''}`
}

export class Recorder {
  private queue: Ev[] = []
  private recent: { t: number; x: number; y: number }[] = []
  private timer = 0
  private stop: (() => void) | null = null
  private lastPage = ''
  constructor(private run: string, private t0: number, private onClick: (e: { el: Element; page: string }) => void, private onPage: (page: string) => void) {
    // Clicks the previous page of this tab couldn't send before it closed.
    try {
      const kept = JSON.parse(sessionStorage.getItem(this.backlogKey) ?? '[]')
      sessionStorage.removeItem(this.backlogKey)
      if (Array.isArray(kept)) this.queue.push(...kept.slice(0, 1000))
    } catch { /* none */ }
  }
  private get backlogKey() { return `${NS}runq:${this.run}` }

  start(task?: () => string | undefined, hit?: (el: Element) => boolean | undefined) {
    if (this.stop) return
    const now = () => Math.max(0, Math.round(Date.now() - this.t0))
    const ours = (e: Event) => e.composedPath().some((n) => n instanceof Element && /^vibe-collab/i.test(n.tagName))
    const down = (e: PointerEvent) => {
      if (ours(e) || !(e.target instanceof Element)) return
      const page = window.location.pathname
      const el = e.target.closest(INTERACTIVE) ?? e.target
      const r = el.getBoundingClientRect()
      const t = now()
      this.recent = this.recent.filter((c) => t - c.t < 700 && Math.hypot(c.x - e.clientX, c.y - e.clientY) < 30)
      this.recent.push({ t, x: e.clientX, y: e.clientY })
      this.push({
        t, task: task?.(), kind: 'click', page,
        x: Math.round(e.pageX), y: Math.round(e.pageY), vw: window.innerWidth, doc_h: document.documentElement.scrollHeight,
        sel: selectorFor(el).slice(0, 400), label: labelOf(el).slice(0, 80),
        ex: r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0.5, ey: r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0.5,
        hit: hit?.(el), rage: this.recent.length >= 3, dead: !e.target.closest(INTERACTIVE),
      })
      this.onClick({ el, page })
    }
    const look = () => {
      const p = window.location.pathname
      if (p === this.lastPage) return
      this.lastPage = p
      this.push({ t: now(), task: task?.(), kind: 'page', page: p })
      this.onPage(p)
    }
    // The tab is hidden or closing: send what is queued now. Going to another page of the site: keep it
    // in this tab for the next page to send (a request from a page that is unloading can be dropped).
    const hidden = () => { if (document.visibilityState === 'hidden') void this.flush(true) }
    const leave = () => {
      if (!this.queue.length) return
      try { sessionStorage.setItem(this.backlogKey, JSON.stringify(this.queue.splice(0))) } catch { void this.flush(true) }
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('visibilitychange', hidden)
    window.addEventListener('pagehide', leave)
    const iv = window.setInterval(look, 400)
    look()
    this.timer = window.setInterval(() => void this.flush(), 4000)
    this.stop = () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('visibilitychange', hidden)
      window.removeEventListener('pagehide', leave)
      window.clearInterval(iv); window.clearInterval(this.timer)
    }
  }
  end() { this.stop?.(); this.stop = null; return this.flush() }
  private push(e: Ev) { if (this.queue.length < 1000) this.queue.push(e) }
  async flush(leaving = false) {
    if (!this.queue.length) return
    if (leaving) { while (this.queue.length) server.rpcOnLeave('log_events', { p_run: this.run, p_events: this.queue.splice(0, 200) }); return }
    const batch = this.queue.splice(0, 200)
    try { await server.rpc('log_events', { p_run: this.run, p_events: batch }) } catch { if (this.queue.length < 800) this.queue.unshift(...batch) }
  }
}

/* ---------- server calls ---------- */

export const studyInfo = (project: string, token: string) =>
  server.rpc<{ name: string; kind: StudyKind; eye: boolean; tasks: number }>('study_info', { p_public_id: project, p_token: token }, { anon: true })
export const startRun = (project: string, token: string) =>
  server.rpc<{ run: string; kind: StudyKind; name: string; config: unknown; eye: boolean }>('start_run', { p_public_id: project, p_token: token, p_vw: window.innerWidth, p_vh: window.innerHeight }, { signIn: true })
export const finishRun = (run: string, result: Record<string, unknown>) => server.rpc('finish_run', { p_run: run, p_result: result })
