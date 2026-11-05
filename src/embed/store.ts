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
}
export interface Reply { id: string; author: string; text: string; at: string }
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
}

export class LocalBackend implements Backend {
  readonly where = 'Saved in this browser only'
  private key: string
  constructor(project: string) { this.key = `vibe:${project}:threads` }
  private read(): Thread[] {
    try {
      const v = JSON.parse(localStorage.getItem(this.key) ?? '[]')
      return Array.isArray(v) ? v : []
    } catch { return [] }
  }
  private write(list: Thread[]) {
    // A full or blocked storage must surface as an error, not as a silent loss.
    localStorage.setItem(this.key, JSON.stringify(list))
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

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

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
  return parts.join(' > ')
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
