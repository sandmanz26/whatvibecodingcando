/**
 * Data for the embeddable collaboration widget.
 *
 * Everything goes through a Backend, so the storage can change without touching the UI.
 * Today there is one: LocalBackend, which keeps a project's threads in the visitor's own
 * browser (localStorage). A shared backend (a database behind an API) implements the same
 * five calls; operations are per thread, never "replace everything", so two people editing
 * different threads don't overwrite each other.
 */

export interface Anchor {
  /** CSS selector of the element the comment was dropped on */
  sel: string
  /** where on that element, as a fraction of its width and height */
  rx: number
  ry: number
  /** fallback when the element is gone: document position and the window width it was made at */
  x: number
  y: number
  vw: number
  /** the second element of a comparison (A vs B) */
  b?: Omit<Anchor, 'b' | 'device'>
  /** the reviewer's browser, system and window size when they commented (for bug reports; nothing personal) */
  device?: DeviceInfo
}
export interface DeviceInfo { browser: string; os: string; w: number; h: number; dpr: number }

/** This browser, read from its user agent: names and major versions only. */
export function deviceNow(): DeviceInfo {
  const ua = navigator.userAgent
  const v = (re: RegExp) => ua.match(re)?.[1] ?? ''
  const browser = /Edg\//.test(ua) ? `Edge ${v(/Edg\/(\d+)/)}` : /OPR\//.test(ua) ? `Opera ${v(/OPR\/(\d+)/)}` : /SamsungBrowser/.test(ua) ? `Samsung Internet ${v(/SamsungBrowser\/(\d+)/)}`
    : /Firefox\//.test(ua) ? `Firefox ${v(/Firefox\/(\d+)/)}` : /(Chrome|CriOS)\//.test(ua) ? `Chrome ${v(/(?:Chrome|CriOS)\/(\d+)/)}` : /Safari\//.test(ua) ? `Safari ${v(/Version\/(\d+)/)}` : 'Other'
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? `Android ${v(/Android (\d+)/)}` : /iPad/.test(ua) ? 'iPadOS' : /iPhone|iPod/.test(ua) ? `iOS ${v(/OS (\d+)_/)}`
    : /CrOS/.test(ua) ? 'ChromeOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'Other'
  return { browser: browser.trim(), os: os.trim(), w: window.innerWidth, h: window.innerHeight, dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100 }
}
/** A comment's device, checked (it comes from the server or storage), as one line: "Chrome 131 · macOS · 1280×800". */
export function deviceLine(a: Anchor): string | null {
  const d = a.device
  if (!d || typeof d !== 'object') return null
  const s = (x: unknown) => (typeof x === 'string' ? x.replace(/[^\w .()-]/g, '').slice(0, 40) : '')
  const n = (x: unknown) => (typeof x === 'number' && isFinite(x) ? Math.round(x) : null)
  const parts = [s(d.browser), s(d.os), n(d.w) && n(d.h) ? `${n(d.w)}×${n(d.h)}` : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : null
}
/** `mine`: set by the server (it knows who wrote what); without one, the widget compares names. */
export interface Reply { id: string; author: string; text: string; at: string; mine?: boolean }
export interface Thread {
  id: string
  page: string
  anchor: Anchor
  author: string
  text: string
  createdAt: string
  editedAt?: string
  resolved?: { by: string; at: string }
  replies: Reply[]
  mine?: boolean
  /** comment (default), compare (A vs B), voice (a voice note, its audio on the server) */
  kind?: 'comment' | 'compare' | 'voice'
  /** the site's version it was made on (set by the server from the published settings) */
  version?: string
  /** a voice note's audio, in the project's private bucket */
  audio?: string
}
export type Status = 'open' | 'ongoing' | 'completed'
export const statusOf = (t: Thread): Status => (t.resolved ? 'completed' : t.replies.length ? 'ongoing' : 'open')
export const STATUS_LABEL: Record<Status, string> = { open: 'Open', ongoing: 'Ongoing', completed: 'Completed' }
export const MAX_TEXT = 4000

export interface Backend {
  /** a short, honest description of where the data lives, shown in the widget */
  readonly where: string
  list(): Promise<Thread[]>
  upsert(t: Thread): Promise<void>
  remove(id: string): Promise<void>
  /** calls back when threads change somewhere else (another tab, another person) */
  subscribe(cb: () => void): () => void
  /** the reviewer's display name changed (servers keep it per reviewer) */
  setName?(name: string): void
}

/**
 * This system's own storage namespace. The SaaS script stores under "saas:vibe:", apart from the content
 * site's script ("vibe:"), although both can run on one domain. The SaaS app's storage scope leaves
 * keys that already start with "saas:" alone, so the panel reads exactly what the script writes.
 */
export const NS = 'saas:vibe:'

export class LocalBackend implements Backend {
  readonly where = 'Saved in this browser only'
  private key: string
  constructor(project: string) { this.key = `${NS}${project}:threads` }
  private read(): Thread[] {
    try {
      let v: unknown = JSON.parse(localStorage.getItem(this.key) ?? '[]')
      // Written by an older version while the host had Array.prototype.toJSON (Prototype.js): a JSON string inside.
      if (typeof v === 'string') v = JSON.parse(v)
      return Array.isArray(v) ? v.filter(isThread) : []
    } catch { return [] }
  }
  private write(list: Thread[]) {
    // A full or blocked storage, or a host library that changes how JSON is written, must surface
    // as an error, not as a silent loss: what was written is read back and checked.
    const text = toJson(list)
    localStorage.setItem(this.key, text)
    const back = JSON.parse(localStorage.getItem(this.key) ?? 'null')
    if (!Array.isArray(back) || back.length !== list.length) throw new Error('not saved')
  }
  async list() { return this.read() }
  async upsert(t: Thread) {
    const list = this.read()
    const i = list.findIndex((x) => x.id === t.id)
    if (i >= 0) list[i] = t; else list.push(t)
    this.write(list)
  }
  async remove(id: string) { this.write(this.read().filter((x) => x.id !== id)) }
  subscribe(cb: () => void) {
    const on = (e: StorageEvent) => { if (e.key === this.key) cb() }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }
}

/**
 * JSON.stringify that a host page can't bend. Old libraries (Prototype.js and friends) add
 * Array.prototype.toJSON, which makes arrays come out as strings; it is set aside while writing.
 */
export function toJson(v: unknown): string {
  const own = Object.getOwnPropertyDescriptor(Array.prototype, 'toJSON')
  if (!own) return JSON.stringify(v)
  try {
    delete (Array.prototype as { toJSON?: unknown }).toJSON
    return JSON.stringify(v)
  } finally {
    Object.defineProperty(Array.prototype, 'toJSON', own)
  }
}

/** Longest selector accepted from stored data: pins run their selector many times a second. */
export const MAX_SELECTOR = 400
const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
/**
 * Stored threads come from outside this code (another browser, later a server, or the host page,
 * which can write to the same storage). Anything malformed is left out instead of breaking the widget.
 */
export function isThread(v: unknown): v is Thread {
  const t = v as Thread
  return !!t && typeof t === 'object' && str(t.id, 64) && str(t.page, 2000) && str(t.author, 80) && str(t.text, MAX_TEXT) && str(t.createdAt, 40)
    && !!t.anchor && str(t.anchor.sel, MAX_SELECTOR) && num(t.anchor.rx) && num(t.anchor.ry) && num(t.anchor.x) && num(t.anchor.y) && num(t.anchor.vw)
    && Array.isArray(t.replies) && t.replies.every((r) => !!r && str(r.id, 64) && str(r.author, 80) && str(r.text, MAX_TEXT) && str(r.at, 40))
    && (t.anchor.b === undefined || (!!t.anchor.b && str(t.anchor.b.sel, MAX_SELECTOR) && num(t.anchor.b.rx) && num(t.anchor.b.ry) && num(t.anchor.b.x) && num(t.anchor.b.y) && num(t.anchor.b.vw)))
    && (t.kind === undefined || t.kind === 'comment' || t.kind === 'compare' || t.kind === 'voice')
    && (t.version === undefined || str(t.version, 20)) && (t.audio === undefined || str(t.audio, 120))
}

/**
 * The address of a stored page key on this site, or null. A page key is a path; it is resolved
 * against this site and refused if it would leave it ("//evil.com", "@evil.com/x" glued to the
 * origin would otherwise send people to another site).
 */
export function pageUrl(page: string, origin = window.location.origin): string | null {
  if (typeof page !== 'string' || !page.startsWith('/') || page.startsWith('//') || /[\\\s]/.test(page)) return null
  try {
    const u = new URL(page, origin)
    return u.origin === origin ? u.href : null
  } catch { return null }
}

/** Ids are UUIDs: the server keeps the id the widget gave a comment. */
export const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4))

/**
 * The page a comment belongs to: the path, plus the route of a hash router (#/orders).
 * Query strings and other hashes are left out (they often hold searches or tokens).
 */
export function pageKey(loc: Location = window.location): string {
  const path = loc.pathname.replace(/\/index\.html?$/, '/').replace(/(.)\/$/, '$1') || '/'
  const h = loc.hash
  // "#/" is the same page as no hash at all.
  const route = h.startsWith('#/') ? h.slice(1).split('?')[0].replace(/(.)\/$/, '$1') : '/'
  return route === '/' ? path : `${path}#${route}`
}

/* ---------- anchoring to the host page ---------- */

const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
function firstVisible(sel: string): Element | null {
  if (sel.length > MAX_SELECTOR) return null
  try { for (const el of document.querySelectorAll(sel)) if (visible(el)) return el } catch { /* invalid selector */ }
  return null
}

/** A selector that finds this element again: an id or a few stable attributes, else its path. */
export function selectorFor(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const tries: string[] = []
  if (el.id && !/\d{4,}/.test(el.id)) tries.push(`#${CSS.escape(el.id)}`)
  for (const a of ['data-testid', 'data-test', 'aria-label', 'name']) {
    const v = el.getAttribute(a)
    if (v && v.length < 80) tries.push(`${tag}[${a}="${CSS.escape(v)}"]`)
  }
  const href = el.getAttribute('href')
  if (tag === 'a' && href && href.length < 120) tries.push(`a[href="${CSS.escape(href)}"]`)
  for (const s of tries) if (firstVisible(s) === el) return s
  const parts: string[] = []
  let node: Element | null = el
  while (node && node !== document.body && node !== document.documentElement && parts.length < 12) {
    const t = node.tagName.toLowerCase()
    if (node.id && !/\d{4,}/.test(node.id) && node !== el) { parts.unshift(`#${CSS.escape(node.id)}`); break }
    const parent: Element | null = node.parentElement
    const same = parent ? Array.from(parent.children).filter((c) => c.tagName === node!.tagName) : []
    parts.unshift(same.length > 1 ? `${t}:nth-of-type(${same.indexOf(node) + 1})` : t)
    node = parent
  }
  // Start from body (or an id) so the path can't match the same shape somewhere else first.
  if (!parts[0]?.startsWith('#')) parts.unshift('body')
  // Deep pages can make a long path: keep its start and the steps nearest the element, joined as a descendant.
  let path = parts.join(' > ')
  for (let k = 1; path.length > MAX_SELECTOR && k < parts.length - 1; k++) path = `${parts[0]} ${parts.slice(k + 1).join(' > ')}`
  return path.length > MAX_SELECTOR ? tag : path
}

export function anchorAt(el: Element, clientX: number, clientY: number): Anchor {
  const r = el.getBoundingClientRect()
  const clamp = (v: number) => Math.min(1, Math.max(0, v))
  return {
    sel: selectorFor(el),
    rx: r.width ? clamp((clientX - r.left) / r.width) : 0.5,
    ry: r.height ? clamp((clientY - r.top) / r.height) : 0.5,
    x: clientX + window.scrollX,
    y: clientY + window.scrollY,
    vw: window.innerWidth,
  }
}

/** Where a pin is now, in viewport pixels. `lost` when its element is no longer on the page. */
export function place(a: Anchor): { x: number; y: number; lost: boolean } {
  const el = firstVisible(a.sel)
  if (el) {
    const r = el.getBoundingClientRect()
    return { x: r.left + a.rx * r.width, y: r.top + a.ry * r.height, lost: false }
  }
  return { x: a.x * (window.innerWidth / (a.vw || window.innerWidth)) - window.scrollX, y: a.y - window.scrollY, lost: true }
}
