/**
 * Click insights tracker — records screen views and taps.
 * See the privacy rules at the top of ./store.ts; they apply to everything here.
 */
import { TOOL_DOM, TOOLS_API, currentPath, currentQuery, isConsole, isEmbedded } from '../shared'
import { appendLocal, type ClickEvent, type ClickKind, type InsightEvent } from './store'

const CONTROL = 'a, button, [role=button], [role=tab], [role=link], [role=switch], [role=checkbox], [role=menuitem], [role=option], input, select, textarea, label, summary'
const FIELD_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA'])
const STATE_ATTRS = ['aria-pressed', 'aria-expanded', 'aria-checked', 'aria-selected', 'aria-current']
const FLUSH_MS = 8000
const BATCH_MAX = 200
const FX_WINDOW = 700

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)
const squash = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
const round1 = (n: number) => Math.round(n * 10) / 10

function sessionId() {
  const key = 'skillhouse.insights.sid'
  try {
    let id = sessionStorage.getItem(key)
    if (!id) { id = Math.random().toString(36).slice(2, 12); sessionStorage.setItem(key, id) }
    return id
  } catch {
    return 'no-session'
  }
}

/** Should taps and views be recorded right now? */
const paused = () => isEmbedded || isConsole(currentPath()) || currentQuery().has('heatmap')

function visible(el: Element) {
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0
}

function firstVisible(sel: string, doc: Document = document): Element | null {
  try {
    for (const el of doc.querySelectorAll(sel)) if (visible(el)) return el
  } catch { /* invalid selector */ }
  return null
}

const cssEscape = (s: string) => CSS.escape(s)

/** A selector that finds this exact element again on the same screen. */
export function selectorFor(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const tries: string[] = []
  if (el.id) tries.push(`#${cssEscape(el.id)}`)
  const aria = el.getAttribute('aria-label')
  if (aria) tries.push(`${tag}[aria-label="${cssEscape(aria)}"]`)
  const href = el.getAttribute('href')
  if (tag === 'a' && href) tries.push(`a[href="${cssEscape(href)}"]`)
  for (const s of tries) if (s.length <= 300 && firstVisible(s, el.ownerDocument) === el) return s

  const parts: string[] = []
  let node: Element | null = el
  while (node && node !== el.ownerDocument.body && parts.length < 10) {
    const t = node.tagName.toLowerCase()
    const parent: Element | null = node.parentElement
    const same = parent ? Array.from(parent.children).filter((c) => c.tagName === node!.tagName) : []
    parts.unshift(same.length > 1 ? `${t}:nth-of-type(${same.indexOf(node) + 1})` : t)
    node = parent
  }
  let path = parts.join(' > ')
  while (path.length > 300 && parts.length > 1) { parts.shift(); path = parts.join(' > ') }
  return path
}

function labelFor(el: Element): string {
  const aria = squash(el.getAttribute('aria-label'))
  if (aria) return clip(aria, 100)
  if (FIELD_TAGS.has(el.tagName)) {
    // Fields: never the value — only how the field describes itself.
    const f = el as HTMLInputElement
    return clip(squash(f.placeholder) || squash(f.name) || `${el.tagName.toLowerCase()}${f.type ? `[${f.type}]` : ''}`, 100)
  }
  // First line only: a card's name, not the content inside it.
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

function headingOf(el: Element) {
  return clip(squash(el.getAttribute('aria-label')) || squash(el.querySelector('h1, h2, h3, h4')?.textContent), 60)
}

function sectionFor(el: Element): string {
  const dialog = el.closest('[role=dialog], dialog')
  if (dialog) return `Dialog · ${headingOf(dialog) || 'untitled'}`
  const nav = el.closest('nav, aside')
  if (nav) return squash(nav.getAttribute('aria-label')) || (nav.tagName === 'NAV' ? 'Navigation' : 'Sidebar')
  let node: Element | null = el.parentElement
  while (node && node !== document.body) {
    if (node.matches('section, article, form, header, [role=toolbar]')) {
      const name = headingOf(node)
      if (name) return name
    }
    node = node.parentElement
  }
  return 'Page'
}

function stateFor(el: Element) {
  const s: Record<string, string> = {}
  for (const a of STATE_ATTRS) {
    const v = el.getAttribute(a)
    if (v !== null) s[a.replace('aria-', '')] = v
  }
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') s.disabled = 'true'
  return Object.keys(s).length ? s : undefined
}

/** For pickers: the control a tap on `target` would be recorded as, with its selector and name. */
export function describeTarget(target: Element) {
  const control = target.closest(CONTROL)
  const el = control ?? target
  return { el, sel: selectorFor(el), label: control ? labelFor(control) : `(not a control) ${target.tagName.toLowerCase()}` }
}

let installed: (() => void) | null = null
let viewHook: ((path: string) => void) | null = null
let flushHook: (() => void) | null = null

/** Record a screen view. Called by the router integration on every route change. */
export const trackView = (path: string) => viewHook?.(path)
/** Push whatever is queued (used before reviewing data in this browser). */
export const flushNow = () => flushHook?.()

/** Installs once; returns an uninstall function. */
export function installTracker(): () => void {
  if (installed) return installed

  const sid = sessionId()
  let queue: InsightEvent[] = []
  let serverOff = !TOOLS_API
  let active = true
  let lastPath: string | undefined
  let viewStart = performance.now()
  const recent: { t: number; x: number; y: number }[] = []
  // Taps still being watched for an effect; a new tap closes them so effects aren't misattributed.
  const watching: (() => void)[] = []

  const base = () => ({ t: new Date().toISOString(), sid, page: currentPath(), vw: window.innerWidth, vh: window.innerHeight })

  const send = async (batch: InsightEvent[]) => {
    if (serverOff) return appendLocal(batch)
    try {
      const r = await fetch(`${TOOLS_API}/clicks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: batch }) })
      const j = await r.json()
      if (!j.configured) { serverOff = true; appendLocal(batch) }
    } catch {
      appendLocal(batch)
    }
  }

  const flush = () => {
    while (queue.length) void send(queue.splice(0, BATCH_MAX))
  }

  const beacon = () => {
    if (!queue.length) return
    const batch = queue.splice(0, queue.length)
    if (serverOff) return appendLocal(batch)
    for (let i = 0; i < batch.length; i += BATCH_MAX) {
      const ok = navigator.sendBeacon?.(`${TOOLS_API}/clicks`, new Blob([JSON.stringify({ events: batch.slice(i, i + BATCH_MAX) })], { type: 'application/json' }))
      if (!ok) appendLocal(batch.slice(i, i + BATCH_MAX))
    }
  }

  viewHook = (path) => {
    if (path === lastPath) return
    const from = lastPath
    lastPath = path
    viewStart = performance.now()
    if (paused()) { flush(); return }
    queue.push({ type: 'view', ...base(), page: path, ...(from ? { from } : {}) })
  }
  flushHook = flush

  const onClick = (e: MouseEvent) => {
    if (paused() || !(e.target instanceof Element)) return
    const target = e.target
    if (target.closest(TOOL_DOM)) return
    watching.splice(0).forEach((finish) => finish())

    const control = target.closest(CONTROL)
    const el = control ?? target
    const r = el.getBoundingClientRect()
    const now = performance.now()

    // Rage: the 3rd+ tap within 1 s and 40 px.
    while (recent.length && now - recent[0].t > 1000) recent.shift()
    recent.push({ t: now, x: e.clientX, y: e.clientY })
    const near = recent.filter((p) => Math.hypot(p.x - e.clientX, p.y - e.clientY) <= 40).length

    const docH = document.documentElement.scrollHeight
    const href = control?.tagName === 'A' ? control.getAttribute('href') ?? undefined : undefined
    const ev: ClickEvent = {
      type: 'click',
      ...base(),
      x: round1((e.clientX / window.innerWidth) * 100),
      y: Math.round(e.clientY + window.scrollY),
      docH,
      label: control ? labelFor(control) : `(not a control) ${target.tagName.toLowerCase()}`,
      tag: el.tagName.toLowerCase(),
      ...(href ? { href } : {}),
      kind: control ? kindFor(control) : 'not a control',
      section: sectionFor(el),
      sel: selectorFor(el),
      ex: round1(r.width ? ((e.clientX - r.left) / r.width) * 100 : 50),
      ey: round1(r.height ? ((e.clientY - r.top) / r.height) * 100 : 50),
      ew: Math.round(r.width),
      eh: Math.round(r.height),
      ...(control ? { state: stateFor(control) } : {}),
      ms: Math.round(now - viewStart),
      sy: round1(Math.min(100, ((window.scrollY + window.innerHeight) / Math.max(1, docH)) * 100)),
      ...(near >= 3 ? { rage: true } : {}),
      ...(control ? {} : { dead: true }),
      fx: 'nothing',
    }

    // Effect: watch for 700 ms — did the screen change, or did nothing happen?
    const before = currentPath()
    let mutated = false
    const mo = new MutationObserver((records) => {
      if (records.some((m) => !(m.target instanceof Element ? m.target : m.target.parentElement)?.closest(TOOL_DOM))) mutated = true
    })
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true })
    let done = false
    const finish = () => {
      if (done) return
      done = true
      window.clearTimeout(timer)
      mo.disconnect()
      const after = currentPath()
      if (after !== before) { ev.fx = 'navigated'; ev.to = after }
      else if (mutated) ev.fx = 'changed'
      queue.push(ev)
      if (!active) flush()
    }
    const timer = window.setTimeout(() => {
      const i = watching.indexOf(finish)
      if (i >= 0) watching.splice(i, 1)
      finish()
    }, FX_WINDOW)
    watching.push(finish)
  }

  const onHide = () => { if (document.visibilityState === 'hidden') beacon() }
  document.addEventListener('click', onClick, true)
  document.addEventListener('visibilitychange', onHide)
  window.addEventListener('pagehide', beacon)
  const timer = window.setInterval(flush, FLUSH_MS)

  installed = () => {
    active = false
    watching.splice(0).forEach((finish) => finish())
    flush()
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('visibilitychange', onHide)
    window.removeEventListener('pagehide', beacon)
    window.clearInterval(timer)
    installed = null
    viewHook = null
    flushHook = null
  }
  return installed
}
