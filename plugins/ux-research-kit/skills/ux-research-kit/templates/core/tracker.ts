/**
 * Click tracking — screen views and taps, grouped into sessions.
 *
 * Privacy rules (non-negotiable):
 * - Never record what is typed, field values, names, emails or page content. For a field,
 *   only its placeholder / name / type. Labels are a control's own visible name (max 100 chars).
 * - The screen's query is kept only as short tokens (filters, tabs); free-text keys are dropped.
 * - The session id is random, per tab (sessionStorage), not linked to a person.
 * - Defaults to OFF outside development until the product owner decides on consent.
 *
 * Sessions: counting starts when a main page opens; a session ends when the tab closes
 * (a reload carries on), endSession() is called, it sits idle 30 min, or recording stops.
 */
import { isEmbedded, type ResearchConfig } from './config'
import { readJSON, tab, uid, writeJSON } from './storage'

interface Base { t: string; sid: string; page: string; query?: string; vw: number; vh: number }
export interface ViewEvent extends Base { type: 'view'; from?: string }
export type ClickKind = 'toggle' | 'field' | 'tab' | 'menu item' | 'chip' | 'card' | 'link' | 'button' | 'not a control'
export interface ClickEvent extends Base {
  type: 'click'
  /** % of window width */ x: number
  /** px from page top */ y: number
  docH: number
  label: string
  tag: string
  href?: string
  kind: ClickKind
  section: string
  /** a selector that finds the element again */ sel: string
  /** where on the element (%) */ ex: number
  ey: number
  ew: number
  eh: number
  state?: Record<string, string>
  /** ms since the screen opened */ ms: number
  /** scroll depth % */ sy: number
  rage?: boolean
  dead?: boolean
  fx: 'navigated' | 'changed' | 'nothing'
  to?: string
}
export type EndReason = 'ended' | 'closed' | 'idle' | 'stopped'
export interface EndEvent extends Base { type: 'end'; reason: EndReason }
export type InsightEvent = ViewEvent | ClickEvent | EndEvent

const CONTROL = 'a, button, [role=button], [role=tab], [role=link], [role=switch], [role=checkbox], [role=menuitem], [role=option], input, select, textarea, label, summary'
const FIELD_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])
const STATE_ATTRS = ['aria-pressed', 'aria-expanded', 'aria-checked', 'aria-selected', 'aria-current']
/** query keys the research tools themselves put on URLs */
export const TOOL_PARAMS = ['heatmap', 'el', 'dot', 'fivesec', 'gaze', 'embed']
const FX_WINDOW = 700
const FLUSH_MS = 8000
const IDLE_MS = 30 * 60 * 1000
const LOCAL_MAX = 3000

export const eventsKey = (cfg: ResearchConfig) => `${cfg.app}.insights.clicks`
export const loadEvents = (cfg: ResearchConfig) => readJSON<InsightEvent[]>(eventsKey(cfg), [])
const appendLocal = (cfg: ResearchConfig, evs: InsightEvent[]) => {
  if (evs.length) writeJSON(eventsKey(cfg), [...loadEvents(cfg), ...evs].slice(-LOCAL_MAX))
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const round1 = (n: number) => Math.round(n * 10) / 10

/** The screen's filters and tabs, never free text. */
export function safeQuery(cfg: ResearchConfig): string {
  const out = new URLSearchParams()
  cfg.query().forEach((v, k) => {
    if (TOOL_PARAMS.includes(k) || cfg.freeTextParams.includes(k)) return
    if (/^[\w-]{1,40}$/.test(v)) out.set(k, v)
  })
  return out.toString()
}

function firstVisible(sel: string, doc: Document = document): Element | null {
  try {
    for (const el of doc.querySelectorAll(sel)) { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return el }
  } catch { /* invalid selector */ }
  return null
}

/** A selector that finds this exact element again on the same screen. */
export function selectorFor(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const tries: string[] = []
  if (el.id) tries.push(`#${CSS.escape(el.id)}`)
  const aria = el.getAttribute('aria-label')
  if (aria) tries.push(`${tag}[aria-label="${CSS.escape(aria)}"]`)
  const testId = el.getAttribute('data-testid')
  if (testId) tries.push(`[data-testid="${CSS.escape(testId)}"]`)
  const href = el.getAttribute('href')
  if (tag === 'a' && href) tries.push(`a[href="${CSS.escape(href)}"]`)
  for (const s of tries) if (s.length <= 300 && firstVisible(s, el.ownerDocument) === el) return s
  const parts: string[] = []
  let node: Element | null = el
  while (node && node !== el.ownerDocument.body && parts.length < 10) {
    const parent: Element | null = node.parentElement
    const same = parent ? Array.from(parent.children).filter((c) => c.tagName === node!.tagName) : []
    parts.unshift(same.length > 1 ? `${node.tagName.toLowerCase()}:nth-of-type(${same.indexOf(node) + 1})` : node.tagName.toLowerCase())
    node = parent
  }
  let path = parts.join(' > ')
  while (path.length > 300 && parts.length > 1) { parts.shift(); path = parts.join(' > ') }
  return path
}

/**
 * The control a tap landed on. Real controls first; otherwise the outermost element showing
 * a pointer cursor (a clickable row or card), so those taps aren't logged as dead.
 */
export function controlOf(target: Element): Element | null {
  const real = target.closest(CONTROL)
  if (real) return real
  if (getComputedStyle(target).cursor !== 'pointer') return null
  let node = target
  for (let i = 0; i < 8; i++) {
    const up = node.parentElement
    if (!up || up === document.body || getComputedStyle(up).cursor !== 'pointer') break
    node = up
  }
  return node
}

export function labelFor(el: Element): string {
  const aria = squash(el.getAttribute('aria-label'))
  if (aria) return clip(aria, 100)
  if (FIELD_TAGS.has(el.tagName)) {
    const f = el as HTMLInputElement
    return clip(squash(f.placeholder) || squash(f.name) || `${el.tagName.toLowerCase()}${f.type ? `[${f.type}]` : ''}`, 100)
  }
  const text = squash(((el as HTMLElement).innerText ?? el.textContent ?? '').split('\n').find((l) => l.trim()))
  return clip(text || squash(el.getAttribute('title')) || el.tagName.toLowerCase(), 100)
}

function kindFor(el: Element): ClickKind {
  const role = el.getAttribute('role')
  const type = (el as HTMLInputElement).type
  if (role === 'switch' || role === 'checkbox' || (el.tagName === 'INPUT' && (type === 'checkbox' || type === 'radio'))) return 'toggle'
  if (FIELD_TAGS.has(el.tagName)) return 'field'
  if (role === 'tab') return 'tab'
  if (role === 'menuitem' || role === 'option') return 'menu item'
  if (el.hasAttribute('aria-pressed')) return 'chip'
  const r = el.getBoundingClientRect()
  if (r.width * r.height >= 24000) return 'card'
  if (el.tagName === 'A' || role === 'link') return 'link'
  return 'button'
}

const headingOf = (el: Element) => clip(squash(el.getAttribute('aria-label')) || squash(el.querySelector('h1, h2, h3, h4')?.textContent), 60)

function sectionFor(el: Element): string {
  const dialog = el.closest('[role=dialog], dialog')
  if (dialog) return `Dialog · ${headingOf(dialog) || 'untitled'}`
  const nav = el.closest('nav, aside')
  if (nav) return squash(nav.getAttribute('aria-label')) || (nav.tagName === 'NAV' ? 'Navigation' : 'Sidebar')
  let node: Element | null = el.parentElement
  while (node && node !== document.body) {
    if (node.matches('section, article, form, header, [role=toolbar]')) { const n = headingOf(node); if (n) return n }
    node = node.parentElement
  }
  return 'Page'
}

function stateFor(el: Element) {
  const s: Record<string, string> = {}
  for (const a of STATE_ATTRS) { const v = el.getAttribute(a); if (v !== null) s[a.replace('aria-', '')] = v }
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') s.disabled = 'true'
  return Object.keys(s).length ? s : undefined
}

/** For pickers: what a tap on `target` would be recorded as. */
export function describeTarget(target: Element) {
  const control = controlOf(target)
  const el = control ?? target
  return { el, sel: selectorFor(el), label: control ? labelFor(control) : `(not a control) ${target.tagName.toLowerCase()}` }
}

export interface Tracker {
  /** call on every route change (or use watchRoutes) */
  view(path: string): void
  /** close the current session; the next starts on a main page */
  endSession(reason?: EndReason): void
  state(): 'active' | 'waiting'
  flush(): void
  /** stop listening (does not end the session; call endSession('stopped') first when recording is switched off) */
  uninstall(): void
}

export const SESSION_EVENT = 'research:session'

/**
 * Starts recording. `send` receives every batch; by default batches go to localStorage.
 * Point it at a server to collect from many browsers (see reference/console.md).
 */
export function installTracker(cfg: ResearchConfig, opts: { send?: (batch: InsightEvent[]) => void } = {}): Tracker {
  const SID = `${cfg.app}.insights.sid`, SEEN = `${cfg.app}.insights.seen`, CLOSING = `${cfg.app}.insights.closing`
  const send = opts.send ?? ((b: InsightEvent[]) => appendLocal(cfg, b))
  let sid = tab.get(SID)
  if (tab.get(CLOSING)) tab.del(CLOSING) // a reload, not a close: carry on
  let queue: InsightEvent[] = []
  let lastPath: string | undefined
  let viewStart = performance.now()
  const recentTaps: { t: number; x: number; y: number }[] = []
  const watching: (() => void)[] = []
  const paused = () => isEmbedded || cfg.paused() || document.documentElement.dataset.commenting === 'on' || cfg.query().has('heatmap')
  const notify = () => window.dispatchEvent(new Event(SESSION_EVENT))

  const base = (id: string): Base => {
    const query = safeQuery(cfg)
    return { t: new Date().toISOString(), sid: id, page: cfg.path(), ...(query ? { query } : {}), vw: window.innerWidth, vh: window.innerHeight }
  }
  const flush = () => { if (queue.length) send(queue.splice(0, queue.length)) }
  const end = (reason: EndReason, at?: number) => {
    if (!sid) return
    queue.push({ type: 'end', ...base(sid), ...(at ? { t: new Date(at).toISOString() } : {}), reason })
    sid = null
    tab.del(SID)
    notify()
  }
  const gate = (path: string): string | null => {
    const seen = Number(tab.get(SEEN) ?? 0)
    if (sid && seen && Date.now() - seen > IDLE_MS) end('idle', seen)
    if (!sid && cfg.mainPages.includes(path)) { sid = uid(); tab.set(SID, sid); notify() }
    if (sid) tab.set(SEEN, String(Date.now()))
    return sid
  }

  const onClick = (e: MouseEvent) => {
    if (paused() || !(e.target instanceof Element) || e.target.closest(cfg.ignore)) return
    const id = gate(cfg.path())
    if (!id) return
    watching.splice(0).forEach((f) => f())
    const target = e.target
    const control = controlOf(target)
    const el = control ?? target
    const r = el.getBoundingClientRect()
    const now = performance.now()
    while (recentTaps.length && now - recentTaps[0].t > 1000) recentTaps.shift()
    recentTaps.push({ t: now, x: e.clientX, y: e.clientY })
    const near = recentTaps.filter((p) => Math.hypot(p.x - e.clientX, p.y - e.clientY) <= 40).length
    const docH = document.documentElement.scrollHeight
    const href = control?.tagName === 'A' ? control.getAttribute('href') ?? undefined : undefined
    const ev: ClickEvent = {
      type: 'click', ...base(id),
      x: round1((e.clientX / window.innerWidth) * 100), y: Math.round(e.clientY + window.scrollY), docH,
      label: control ? labelFor(control) : `(not a control) ${target.tagName.toLowerCase()}`,
      tag: el.tagName.toLowerCase(), ...(href ? { href } : {}),
      kind: control ? kindFor(control) : 'not a control', section: sectionFor(el), sel: selectorFor(el),
      ex: round1(r.width ? ((e.clientX - r.left) / r.width) * 100 : 50), ey: round1(r.height ? ((e.clientY - r.top) / r.height) * 100 : 50),
      ew: Math.round(r.width), eh: Math.round(r.height), ...(control ? { state: stateFor(control) } : {}),
      ms: Math.round(now - viewStart), sy: round1(Math.min(100, ((window.scrollY + window.innerHeight) / Math.max(1, docH)) * 100)),
      ...(near >= 3 ? { rage: true } : {}), ...(control ? {} : { dead: true }), fx: 'nothing',
    }
    // Effect: did the screen change within 0.7 s?
    const before = cfg.path()
    let mutated = false
    const mo = new MutationObserver((recs) => {
      if (recs.some((m) => !(m.target instanceof Element ? m.target : m.target.parentElement)?.closest(cfg.ignore))) mutated = true
    })
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      mo.disconnect()
      const after = cfg.path()
      if (after !== before) { ev.fx = 'navigated'; ev.to = after } else if (mutated) ev.fx = 'changed'
      queue.push(ev)
    }
    const timer = window.setTimeout(() => { const i = watching.indexOf(finish); if (i >= 0) watching.splice(i, 1); finish() }, FX_WINDOW)
    watching.push(finish)
  }

  const onLeave = () => {
    if (sid) { const keep = sid; end('closed'); tab.set(SID, keep); sid = keep; tab.set(CLOSING, '1') }
    flush()
  }
  const onHide = () => { if (document.visibilityState === 'hidden') flush() }
  document.addEventListener('click', onClick, true)
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', onLeave)
  const timer = window.setInterval(flush, FLUSH_MS)

  return {
    view(path) {
      if (path === lastPath) return
      const from = lastPath
      lastPath = path
      viewStart = performance.now()
      if (paused()) { flush(); return }
      const id = gate(path)
      if (id) queue.push({ type: 'view', ...base(id), page: path, ...(from ? { from } : {}) })
    },
    endSession(reason = 'ended') { watching.splice(0).forEach((f) => f()); end(reason); flush() },
    state: () => (tab.get(SID) ? 'active' : 'waiting'),
    flush,
    uninstall() {
      watching.splice(0).forEach((f) => f())
      flush()
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onLeave)
      window.clearInterval(timer)
    },
  }
}
