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
import { takeHint } from './hints'

export type StudyKind = 'usability' | 'fivesec' | 'browse'
import { RESEARCH_MODULES, type ResearchModule } from './decide'
export { RESEARCH_MODULES, type ResearchModule }
export type Rule = { kind: 'page'; page: string } | { kind: 'element'; sel: string; label?: string } | { kind: 'none' }
export interface Task { id: string; prompt: string; startPage: string; success: Rule; limitSec: number }
export interface Door { id: string; page: string; sel: string; mode: 'add' | 'existing'; label: string; message: string }
export interface StudyConfig {
  intro?: string
  /** fake doors shown to this study's participants */ doors?: Door[]
  tasks?: Task[]
  /** fivesec */ page?: string; seconds?: number; prompt?: string; questions?: string[]
  /** browse */ minutes?: number
}
export type Outcome = 'success' | 'timeout' | 'gave_up' | 'done'
export interface TaskResult { id: string; outcome: Outcome; ms: number; pages: string[]; clicks: number; firstClickHit: boolean | null }
export interface RunState {
  token: string
  /** a visitor's run under "Everyone": the module whose default (★) study it records into (no link) */
  module?: ResearchModule
  phase: 'consent' | 'eyes' | 'intro' | 'task' | 'showing' | 'questions' | 'done' | 'declined'
  /** eye tracking, when the study asks for it and the participant agreed and calibrated */
  eye?: { on: boolean; model?: import('../gaze-model').Model; accuracy?: number; calib?: { f: number[]; x: number; y: number }[] }
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
export const takeStudyToken = (): string | null => takeHint('r', '[0-9a-f]{32,64}')

/* ---------- checking what the study sends (it is data from the server, still checked here) ---------- */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f]/g, ' ').slice(0, max) : '')
const path = (v: unknown) => { const p = str(v, 300).trim(); return /^\/(?!\/)/.test(p) ? p : '/' }
export function cleanConfig(kind: StudyKind, c: unknown): StudyConfig {
  const o = (c && typeof c === 'object' ? c : {}) as Record<string, unknown>
  const out: StudyConfig = { intro: str(o.intro, 600) }
  out.doors = (Array.isArray(o.doors) ? o.doors : []).slice(0, 5).map((d, i): Door | null => {
    const x = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>
    const sel = str(x.sel, 400).trim()
    if (!sel) return null
    return { id: str(x.id, 40) || `d${i + 1}`, page: x.page ? path(x.page) : '', sel, mode: x.mode === 'existing' ? 'existing' : 'add', label: str(x.label, 60) || 'New', message: str(x.message, 300) || 'This is coming soon. Thanks for your interest!' }
  }).filter((d): d is Door => !!d)
  if (kind === 'usability') {
    out.tasks = (Array.isArray(o.tasks) ? o.tasks : []).slice(0, 10).map((t, i): Task => {
      const x = (t && typeof t === 'object' ? t : {}) as Record<string, unknown>
      const s = (x.success && typeof x.success === 'object' ? x.success : {}) as Record<string, unknown>
      const success: Rule = s.kind === 'page' ? { kind: 'page', page: path(s.page) } : s.kind === 'element' && str(s.sel, 400) ? { kind: 'element', sel: str(s.sel, 400), label: str(s.label, 80) } : { kind: 'none' }
      return { id: str(x.id, 40) || `t${i + 1}`, prompt: str(x.prompt, 300) || `Task ${i + 1}`, startPage: x.startPage ? path(x.startPage) : '', success, limitSec: Math.min(1800, Math.max(15, Number(x.limitSec) || 180)) }
    })
  } else if (kind === 'fivesec') {
    // No page: the page the person is on (the default "First impression" study).
    out.page = o.page ? path(o.page) : ''; out.prompt = str(o.prompt, 300)
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

/**
 * A page as studies keep it: its path, with ids folded into ":id" (/product/123 → /product/:id), so
 * pages of one kind share a heatmap and ids (order numbers, user names in addresses) aren't kept.
 */
export function pageOf(path: string): string {
  const out = path.split('/').map((seg) => (/^\d+$/.test(seg) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) || /^[0-9a-f]{12,}$/i.test(seg) || (seg.length >= 16 && /\d/.test(seg) && /^[\w-]+$/.test(seg)) ? ':id' : seg)).join('/')
  return out.slice(0, 300) || '/'
}

/* ---------- the click recorder ---------- */

interface Ev { t: number; task?: string; kind: 'click' | 'page' | 'door' | 'gaze' | 'seen' | 'depth'; version?: string; page: string; x?: number; y?: number; vw?: number; doc_h?: number; sel?: string; label?: string; ex?: number; ey?: number; hit?: boolean; rage?: boolean; dead?: boolean }

const INTERACTIVE = 'a[href], button, input, select, textarea, label, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=checkbox], [onclick], [contenteditable=""], [contenteditable=true]'
/**
 * Personal data that can show in a page's own text (the signed-in person's name in a greeting is
 * beyond a pattern, but email addresses, phone numbers and long numbers such as card, order or
 * account numbers are not): replaced before a label leaves the browser.
 */
export const redact = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
  .replace(/\+?\d[\d\s().-]{6,}\d/g, (m) => (m.replace(/\D/g, '').length >= 7 ? '[number]' : m))
/** Marked private by the site: data-private / data-vibe-private, or a class "private", on it or around it. */
const PRIVATE = '[data-private], [data-vibe-private], .private, [data-sensitive]'
/** A short label of what an element shows. A form field: its tag and its label only, never its value. */
export function labelOf(el: Element) {
  const tag = el.tagName.toLowerCase()
  if (el.closest(PRIVATE)) return `${tag} (private)`
  const aria = el.getAttribute('aria-label')
  if (/^(input|select|textarea)$/i.test(el.tagName) || (el as HTMLElement).isContentEditable) return `${tag}${aria ? ` “${redact(aria).slice(0, 40)}”` : ''}`
  const text = redact((aria ?? el.textContent ?? '').replace(/\s+/g, ' ').trim())
  return `${tag}${text ? ` “${text.slice(0, 40)}”` : ''}`
}

const isDeadClick = (interactive: boolean, changed: boolean) => !interactive && !changed

export class Recorder {
  private queue: Ev[] = []
  private recent: { t: number; x: number; y: number }[] = []
  private timer = 0
  private stop: (() => void) | null = null
  private lastPage = ''
  private exposure: Exposure | null = null
  constructor(private run: string, private t0: number, private onClick: (e: { el: Element; page: string }) => void, private onPage: (page: string) => void, private version = '') {
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
      // Only real people: programmatic clicks (isTrusted false) and our own widget are left out.
      if (!e.isTrusted || ours(e) || !(e.target instanceof Element)) return
      const page = window.location.pathname
      const hitEl = e.target.closest(INTERACTIVE)
      const el = hitEl ?? e.target
      const r = el.getBoundingClientRect()
      const t = now()
      // Rage: 3+ clicks within 1 s and 30 px.
      this.recent = this.recent.filter((c) => t - c.t < 1000 && Math.hypot(c.x - e.clientX, c.y - e.clientY) < 30)
      this.recent.push({ t, x: e.clientX, y: e.clientY })
      const ev: Ev = {
        t, task: task?.(), kind: 'click', page,
        x: Math.round(e.pageX), y: Math.round(e.pageY), vw: window.innerWidth, doc_h: document.documentElement.scrollHeight,
        sel: redact(selectorFor(el)).slice(0, 400), label: labelOf(el).slice(0, 80),
        ex: r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0.5, ey: r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0.5,
        hit: hit?.(el), rage: this.recent.length >= 3, dead: false,
      }
      if (hitEl) this.push(ev)
      else {
        // Dead click: nothing clickable, and nothing on the page (DOM or address) changes within 1 s.
        // Only whether something changed is noted, never what.
        let changed = false
        const before = window.location.href
        const mo = new MutationObserver(() => { changed = true; mo.disconnect() })
        try { mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true }) } catch { changed = true }
        window.setTimeout(() => { mo.disconnect(); ev.dead = isDeadClick(false, changed || window.location.href !== before); this.push(ev) }, 1000)
      }
      this.onClick({ el, page })
    }
    const look = () => {
      const p = window.location.pathname
      if (p === this.lastPage) { this.exposure?.scan(); return }
      if (this.exposure) this.exposure.end()
      this.lastPage = p
      this.push({ t: now(), task: task?.(), kind: 'page', page: p })
      this.exposure = new Exposure((e) => this.push({ t: now(), task: task?.(), page: p, ...e }))
      this.onPage(p)
    }
    // The tab is hidden or closing: send what is queued now. Going to another page of the site: keep it
    // in this tab for the next page to send (a request from a page that is unloading can be dropped).
    const hidden = () => { if (document.visibilityState === 'hidden') { this.exposure?.depthNow(); void this.flush(true) } }
    const leave = () => {
      this.exposure?.end(); this.exposure = null
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
      this.exposure?.end(); this.exposure = null
    }
  }
  end() { this.stop?.(); this.stop = null; return this.flush() }
  /** Where the participant looks (page coordinates), from eye tracking. */
  gaze(x: number, y: number, task?: string, el?: Element | null) {
    this.push({ t: Math.max(0, Math.round(Date.now() - this.t0)), task, kind: 'gaze', page: window.location.pathname, x: Math.round(x), y: Math.round(y), vw: window.innerWidth, doc_h: document.documentElement.scrollHeight,
      // What was looked at: the element under the point (a field by its tag and label only).
      // Also where on that element, so the point follows the element on other screen widths.
      ...(el ? (() => { const r = el.getBoundingClientRect(); const cx = x - window.scrollX, cy = y - window.scrollY
        return { sel: redact(selectorFor(el)).slice(0, 400), label: labelOf(el).slice(0, 80), ex: r.width ? Math.min(1, Math.max(0, (cx - r.left) / r.width)) : 0.5, ey: r.height ? Math.min(1, Math.max(0, (cy - r.top) / r.height)) : 0.5 } })() : {}) })
  }
  /** A fake door seen (hit false) or clicked (hit true). */
  door(d: { page: string; sel: string; label: string }, hit: boolean, task?: string) {
    this.push({ t: Math.max(0, Math.round(Date.now() - this.t0)), task, kind: 'door', page: window.location.pathname, sel: d.sel.slice(0, 400), label: d.label.slice(0, 80), hit })
  }
  private push(e: Ev) { if (this.queue.length < 1000) this.queue.push({ ...e, page: pageOf(e.page), ...(this.version ? { version: this.version } : {}) }) }
  async flush(leaving = false) {
    if (!this.queue.length) return
    if (leaving) { while (this.queue.length) server.rpcOnLeave('log_events', { p_run: this.run, p_events: this.queue.splice(0, 200) }); return }
    const batch = this.queue.splice(0, 200)
    try { await server.rpc('log_events', { p_run: this.run, p_events: batch }) } catch { if (this.queue.length < 800) this.queue.unshift(...batch) }
  }
}

/* ---------- exposure: what each participant actually saw ---------- */

/** Elements whose exposure is recorded: what people can click, plus headings, images and sections. */
const EXPOSED = `${INTERACTIVE}, h1, h2, h3, img, picture, video, section, [data-vibe-id]`
/** At most this many elements are watched, and this many "seen" events sent, per page visit. */
const MAX_WATCH = 300, MAX_SEEN = 150
/**
 * Exposure for one page visit: an element counts as seen once ≥ 50% of it was visible for ≥ 500 ms
 * (IntersectionObserver), sent once with its selector only, never its content. The deepest point of
 * the page reached (bottom of the viewport) is sent when the visit ends. Elements inside our widget
 * and private parts of the page are left out.
 */
class Exposure {
  private io: IntersectionObserver | null = null
  private watched = new Set<Element>()
  private timers = new Map<Element, number>()
  private sent = 0
  private deepest = 0
  private onScroll = () => { this.deepest = Math.max(this.deepest, window.scrollY + window.innerHeight) }
  private done = false
  constructor(private emit: (e: Omit<Ev, 't' | 'page'>) => void) {
    this.onScroll()
    window.addEventListener('scroll', this.onScroll, { passive: true, capture: true })
    if (typeof IntersectionObserver === 'undefined') return
    this.io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        const el = en.target
        if (en.intersectionRatio >= 0.5) {
          if (!this.timers.has(el)) this.timers.set(el, window.setTimeout(() => this.seen(el), 500))
        } else { window.clearTimeout(this.timers.get(el)); this.timers.delete(el) }
      }
    }, { threshold: [0, 0.5, 1] })
    this.scan()
  }
  /** Watches new elements (the page can add them later), up to MAX_WATCH. */
  scan() {
    if (!this.io || this.done) return
    for (const el of Array.from(document.querySelectorAll(EXPOSED))) {
      if (this.watched.size >= MAX_WATCH) break
      if (this.watched.has(el) || el.closest('vibe-collab, [id^=vibe-collab]') || el.closest(PRIVATE)) continue
      this.watched.add(el); this.io.observe(el)
    }
  }
  private seen(el: Element) {
    this.timers.delete(el); this.io?.unobserve(el)
    if (this.done || this.sent >= MAX_SEEN || !el.isConnected) return
    this.sent++
    this.emit({ kind: 'seen', sel: redact(selectorFor(el)).slice(0, 400), vw: window.innerWidth })
  }
  depthNow() {
    this.onScroll()
    this.emit({ kind: 'depth', y: Math.round(this.deepest), vw: window.innerWidth, doc_h: document.documentElement.scrollHeight })
  }
  end() {
    if (this.done) return
    this.depthNow()
    this.done = true
    this.io?.disconnect()
    for (const t of this.timers.values()) window.clearTimeout(t)
    window.removeEventListener('scroll', this.onScroll, { capture: true })
  }
}

/* ---------- server calls ---------- */

export const studyInfo = (project: string, token: string) =>
  server.rpc<{ name: string; kind: StudyKind; eye: boolean; tasks: number }>('study_info', { p_public_id: project, p_token: token }, { anon: true })
export const startRun = (project: string, token: string) =>
  server.rpc<{ run: string; kind: StudyKind; name: string; config: unknown; eye: boolean }>('start_run', { p_public_id: project, p_token: token, p_vw: window.innerWidth, p_vh: window.innerHeight }, { signIn: true })
export const finishRun = (run: string, result: Record<string, unknown>, gaze?: number) => server.rpc('finish_run', { p_run: run, p_result: result, p_gaze: gaze ?? null })

/* ---------- reviewers' and the team's clicks (the default "Site heatmap" study) ---------- */

/**
 * People the owner already let in (a review link, or "Open my site") record their clicks into the
 * project's default study, with the same recorder and rules as participants (real clicks only, no
 * field values, no typed text, the same caps). Each reviewer can turn it off for themselves.
 */
const offKey = (p: string) => `${NS}heat-off:${p}`
const noteKey = (p: string) => `${NS}heat-note:${p}`
const lsGet = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v) } catch { /* this page only */ } }
export const reviewerClicksOff = (p: string) => lsGet(offKey(p)) === '1'
export const setReviewerClicksOff = (p: string, off: boolean) => { lsSet(offKey(p), off ? '1' : null); window.dispatchEvent(new Event('vibe-collab:heat-pref')) }
export const heatNoteSeen = (p: string) => lsGet(noteKey(p)) === '1'
export const markHeatNoteSeen = (p: string) => lsSet(noteKey(p), '1')

/** Starts recording this reviewer's clicks; returns a stop function. Fails quietly (nothing recorded). */
export function startReviewerClicks(project: string, version: string): () => void {
  let rec: Recorder | null = null
  let stopped = false
  const k = `${NS}rrun:${project}`
  void (async () => {
    let kept: { run: string; started: number } | null = null
    try { kept = JSON.parse(sessionStorage.getItem(k) ?? 'null') } catch { kept = null }
    if (!kept || Date.now() - kept.started > 11 * 3600_000) {
      try { kept = await server.rpc<{ run: string; started: number }>('start_reviewer_run', { p_public_id: project, p_vw: window.innerWidth, p_vh: window.innerHeight }) } catch { return }
      try { sessionStorage.setItem(k, JSON.stringify(kept)) } catch { /* new run next page */ }
    }
    if (stopped || !kept) return
    rec = new Recorder(kept.run, kept.started, () => {}, () => {}, version)
    rec.start()
  })()
  return () => { stopped = true; void rec?.end() }
}

export interface Invite { token: string | null; open: boolean; people: number; name?: string }
export const defaultInvite = (project: string) => server.rpc<Invite>('default_study_invite', { p_public_id: project })
/** The participant link: this page's address with the study token in the hash. */
export const inviteUrl = (token: string) => `${window.location.origin}${window.location.pathname}#vibe_r=${token}`

/* ---------- visitors under "Everyone" (no link): the module's default (★) study, after they press OK ---------- */

export interface VisitorModule { module: ResearchModule; state: 'open' | 'paused' | 'none'; kind?: StudyKind; name?: string; eye: boolean; tasks: number }
const vmKey = (p: string) => `${NS}vmods:${p}`
/** Which research modules are open to visitors (cached in this tab for 5 minutes). Never results. */
export async function visitorModules(project: string): Promise<VisitorModule[]> {
  try { const c = JSON.parse(sessionStorage.getItem(vmKey(project)) ?? 'null') as { at: number; list: VisitorModule[] } | null; if (c && Date.now() - c.at < 300_000) return c.list } catch { /* ask */ }
  const list = (await server.rpc<VisitorModule[]>('visitor_modules', { p_public_id: project }, { anon: true })) ?? []
  try { sessionStorage.setItem(vmKey(project), JSON.stringify({ at: Date.now(), list })) } catch { /* ask again next page */ }
  return list
}
export const startVisitorRun = (project: string, module: ResearchModule) =>
  server.rpc<{ run: string; kind: StudyKind; name: string; config: unknown; eye: boolean }>('start_visitor_run', { p_public_id: project, p_module: module, p_vw: window.innerWidth, p_vh: window.innerHeight }, { signIn: true })
/** The invite link of a module's ★ study, for the team and reviewers. */
export const moduleInvite = (project: string, module: ResearchModule) => server.rpc<Invite>('module_study_invite', { p_public_id: project, p_module: module })
