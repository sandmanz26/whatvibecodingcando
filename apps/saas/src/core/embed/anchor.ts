/**
 * Pins that survive redeploys.
 *
 * Every new comment saves a fingerprint of the element it was dropped on (tag, stable attributes,
 * short visible text, a few ancestors, its place among similar siblings, the nearest heading, where
 * it sat on the page). When the page loads again, the stored selector is tried first; if the element
 * it finds no longer agrees, similar elements are scored and the pin ends up in one of three states:
 * - ok: one clear winner, the pin sits on it;
 * - moved: a plausible match, but not a sure one (or two that tie): a dashed "Moved?" pin the
 *   reviewer confirms or re-picks; a pin never jumps silently to a doubtful element;
 * - gone: nothing close: a grey pin at its last known position, with what it was on.
 *
 * The top half is pure (plain objects, no DOM) so it can be tested in Node:
 *   node apps/saas/tests/anchor.test.ts
 * The bottom half reads the page. Privacy: field values are never read; text comes only from
 * plain text nodes outside form fields, editable areas and anything marked private, and emails and
 * long numbers are masked.
 */

/** An element's fingerprint, stored inside the comment's anchor (short keys: it travels with every comment). */
export interface Fp {
  /** tag name, lower case */
  t: string
  /** stable attributes: id (unless generated), name, aria-label, role, data-testid/test/cy, href path, alt, title, type, data-hunch */
  a?: Record<string, string>
  /** short visible text, normalised and masked */
  x?: string
  /** ancestors, nearest first: "section#checkout[role=region].card" */
  p?: string[]
  /** index among siblings with the same tag, and how many there are */
  i?: number
  n?: number
  /** nearest landmark or heading text */
  l?: string
  /** centre of the element as a fraction of the page's width and height */
  px?: number
  py?: number
}
/** The last state the widget saw, with the site version it was first seen in. */
export interface AnchorState { s: 'ok' | 'moved' | 'gone'; v?: string; at?: string }
export type PinState = 'ok' | 'moved' | 'gone' | 'legacy'

export const STABLE_ATTRS = ['data-hunch', 'data-testid', 'data-test', 'data-cy', 'id', 'aria-label', 'name', 'href', 'alt', 'title', 'role', 'type'] as const
const MAX_ATTR = 80
export const MAX_FP_TEXT = 80
const PATH_DEPTH = 4

/** Emails and long numbers (phones, cards, orders) are replaced before anything is stored. */
export const mask = (s: string) => s
  .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]')
  .replace(/\+?\d[\d\s().-]{6,}\d/g, (m) => (m.replace(/\D/g, '').length >= 7 ? '[number]' : m))
export const normText = (s: string, max = MAX_FP_TEXT) => mask(s.replace(/\s+/g, ' ').trim()).slice(0, max)

/** Ids made by frameworks or builds (React useId, numbers, hashes) change between deploys. */
export function generatedId(v: string): boolean {
  if (!v || v.length > 60) return true
  if (/^[:«].*[:»]$/.test(v) || /^(radix|headlessui|mui|react-aria|rc-|ember|ext-gen)/i.test(v)) return true
  if (/\d{4,}/.test(v)) return true
  if (/^[a-f0-9-]{8,}$/i.test(v) && /\d/.test(v)) return true
  // a token of 5+ characters mixing letters and digits: a hash ("x7k2p9")
  return v.split(/[-_:.]/).some((p) => p.length >= 5 && /\d/.test(p) && /[a-z]/i.test(p))
}
/** Class names from CSS-in-JS, CSS modules or utility arbitrary values: not stable across builds. */
export function generatedClass(c: string): boolean {
  if (!c || c.length > 40) return true
  if (/^(css|sc|jsx|emotion|svelte|astro|tw)-/.test(c) || /^e[0-9a-z]{5,}$/.test(c)) return true
  if (/[[\]:/!@#]/.test(c)) return true // Tailwind arbitrary values and variants: w-[37px], md:flex
  if (/__[\w-]{4,}$|_[a-z0-9]{5,}$/i.test(c) && /\d/.test(c)) return true // CSS modules: Button_root__x7k2p
  return generatedId(c)
}

/** One ancestor step: tag plus its stable id/role/test id/hunch and its first stable class. */
export function segment(tag: string, attrs: Record<string, string | null | undefined>, classes: string[] = []): string {
  let s = tag
  const id = attrs.id
  if (id && !generatedId(id)) s += `#${id.slice(0, 40)}`
  for (const k of ['data-hunch', 'data-testid', 'role'] as const) { const v = attrs[k]; if (v) s += `[${k === 'data-hunch' ? 'h' : k === 'role' ? 'role' : 'tid'}=${v.slice(0, 30)}]` }
  const c = classes.find((x) => !generatedClass(x))
  if (c) s += `.${c}`
  return s
}

/** Keeps the stable attributes worth matching on, short and masked. */
export function stableAttrs(tag: string, get: (name: string) => string | null, hrefPath?: (h: string) => string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of STABLE_ATTRS) {
    let v = get(k)
    if (v == null || v === '') continue
    if (k === 'id' && generatedId(v)) continue
    if (k === 'href') { if (tag !== 'a' && tag !== 'area') continue; v = hrefPath ? hrefPath(v) : v.split(/[?#]/)[0] }
    if (k === 'type' && !/^(input|button)$/.test(tag)) continue
    v = mask(v.trim()).slice(0, MAX_ATTR)
    if (v) out[k] = v
  }
  return out
}

/* ---------- scoring ---------- */

/** How much each kind of agreement counts. data-hunch decides on its own (see score()). */
export const WEIGHTS = { 'data-testid': 6, 'data-test': 6, 'data-cy': 6, id: 5, 'aria-label': 4, name: 4, x: 4, href: 3, alt: 2, title: 1.5, role: 1, type: 1, p: 3, i: 1.5, l: 1.5, pos: 2.5, sel: 1, uniq: 3 } as const
/** At or above: the pin sits on it. Between: "Moved?". Below: gone. */
export const HIGH = 0.72
export const MED = 0.42
/** Two candidates closer than this are a tie: never a confident pick. */
export const TIE = 0.06

const textSim = (a: string, b: string) => {
  if (a === b) return 1
  const x = a.toLowerCase(), y = b.toLowerCase()
  if (x === y) return 0.95
  if (x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x))) return 0.6
  // a few words changed ("Start free trial" → "Start a free trial"): word overlap
  const wa = new Set(x.split(/\W+/).filter(Boolean)), wb = new Set(y.split(/\W+/).filter(Boolean))
  if (!wa.size || !wb.size) return 0
  let same = 0
  for (const w of wa) if (wb.has(w)) same++
  const j = same / (wa.size + wb.size - same)
  return j >= 0.5 ? 0.6 * j : 0
}
const segSim = (a: string, b: string) => {
  if (a === b) return 1
  const tag = (s: string) => s.match(/^[a-z0-9-]+/)?.[0] ?? ''
  if (tag(a) !== tag(b)) return 0
  const parts = (s: string) => new Set(s.slice(tag(s).length).match(/[#.][^#.[]+|\[[^\]]+\]/g) ?? [])
  const pa = parts(a), pb = parts(b)
  if (!pa.size && !pb.size) return 1
  let same = 0
  for (const p of pa) if (pb.has(p)) same++
  return 0.4 + 0.6 * (same / Math.max(pa.size, pb.size))
}

/**
 * How well a candidate's fingerprint agrees with the stored one, from 0 to 1: the share of the
 * stored features (by weight) the candidate matches. An attribute the candidate no longer has
 * counts half as much against it as one with another value (builds drop ids more often than they
 * reuse them). Bonuses that never count against: `selHit` (the stored selector finds it) and
 * `uniq` (it is the only element of its tag with exactly the stored text).
 */
export function score(fp: Fp, c: Fp, selHit = false, uniq = false): number {
  if (fp.t !== c.t) return 0
  const fa = fp.a ?? {}, ca = c.a ?? {}
  const hunch = fa['data-hunch']
  if (hunch) {
    if (ca['data-hunch'] === hunch) return 1
    if (ca['data-hunch']) return 0
  }
  let total = 0, got = 0
  const add = (w: number, sim: number) => { total += w; got += w * sim }
  for (const [k, w] of Object.entries(WEIGHTS)) {
    if (k === 'x' || k === 'p' || k === 'i' || k === 'l' || k === 'pos' || k === 'sel' || k === 'uniq') continue
    const v = fa[k]
    if (v === undefined) continue
    if (ca[k] === undefined) { add(w / 2, 0); continue }
    add(w, k === 'aria-label' || k === 'title' || k === 'alt' ? textSim(v, ca[k]) : ca[k] === v ? 1 : 0)
  }
  if (fp.x) add(WEIGHTS.x, c.x ? textSim(fp.x, c.x) : 0)
  if (fp.p?.length) {
    const cp = c.p ?? []
    let s = 0
    fp.p.forEach((seg, k) => { s += cp[k] ? segSim(seg, cp[k]) : 0 })
    add(WEIGHTS.p, s / fp.p.length)
  }
  if (fp.i !== undefined) add(WEIGHTS.i, c.i === undefined ? 0 : c.i === fp.i ? (c.n === fp.n ? 1 : 0.7) : Math.abs(c.i - fp.i) === 1 ? 0.3 : 0)
  if (fp.l) add(WEIGHTS.l, c.l ? textSim(fp.l, c.l) : 0)
  if (fp.px !== undefined && fp.py !== undefined && c.px !== undefined && c.py !== undefined) {
    const d = Math.hypot(fp.px - c.px, fp.py - c.py)
    add(WEIGHTS.pos, Math.max(0, 1 - d * 5))
  }
  if (selHit) add(WEIGHTS.sel, 1)
  if (uniq && fp.x && c.x === fp.x) add(WEIGHTS.uniq, 1)
  return total ? got / total : 0
}

export interface Pick { state: 'ok' | 'moved' | 'gone'; index: number; score: number }
/**
 * The verdict over scored candidates: ok only for a clear winner above HIGH; a tie or a middling
 * best is "moved" (the reviewer decides); nothing above MED is "gone".
 */
export function decide(scores: number[]): Pick {
  let best = -1, second = -1
  scores.forEach((s, k) => { if (best < 0 || s > scores[best]) { second = best; best = k } else if (second < 0 || s > scores[second]) second = k })
  if (best < 0) return { state: 'gone', index: -1, score: 0 }
  const s1 = scores[best], s2 = second >= 0 ? scores[second] : 0
  if (s1 >= HIGH && s1 - s2 >= TIE) return { state: 'ok', index: best, score: s1 }
  if (s1 >= MED) return { state: 'moved', index: best, score: s1 }
  return { state: 'gone', index: -1, score: s1 }
}

/** A short description for people: button “Buy now”. */
export function describe(fp: unknown): string {
  if (!fp || typeof fp !== 'object') return ''
  const f = fp as Fp
  const clean = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').slice(0, n) : '')
  const tag = clean(f.t, 20) || 'element'
  const a = f.a && typeof f.a === 'object' ? f.a : {}
  const label = clean(a['data-hunch'], 40) || clean(f.x, 40) || clean(a['aria-label'], 40) || clean(a.alt, 40) || clean(a.title, 40) || clean(a.name, 40) || clean(a.id, 40)
  return label ? `${tag} “${label}”` : tag
}
export const isFp = (v: unknown): v is Fp => !!v && typeof v === 'object' && typeof (v as Fp).t === 'string' && (v as Fp).t.length <= 20
export const stateOf = (v: unknown): AnchorState | null => {
  const s = v as AnchorState
  return s && typeof s === 'object' && (s.s === 'ok' || s.s === 'moved' || s.s === 'gone') ? { s: s.s, v: typeof s.v === 'string' ? s.v.slice(0, 20) : undefined, at: typeof s.at === 'string' ? s.at.slice(0, 40) : undefined } : null
}

/* ---------- reading the page ---------- */

/** Marked private by the site, on the element or around it. */
const PRIVATE = '[data-private], [data-vibe-private], .private, [data-sensitive]'
const SKIP_TEXT = /^(INPUT|TEXTAREA|SELECT|OPTION|SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG)$/
const LANDMARK = 'main, nav, aside, header, footer, section, article, form, dialog, [role=region], [role=dialog], [role=navigation], [role=main]'

/** Visible text from plain text nodes only: never a field's value, an editable area or anything private. */
export function textOf(el: Element, max = MAX_FP_TEXT): string {
  if (SKIP_TEXT.test(el.tagName) || (el as HTMLElement).isContentEditable || el.closest(PRIVATE)) return ''
  let out = ''
  const walk = (n: Node, depth: number) => {
    if (out.length > max * 2 || depth > 6) return
    for (const c of Array.from(n.childNodes)) {
      if (c.nodeType === 3) out += ` ${c.nodeValue ?? ''}`
      else if (c.nodeType === 1) {
        const e = c as HTMLElement
        if (SKIP_TEXT.test(e.tagName.toUpperCase()) || e.isContentEditable || e.matches(PRIVATE)) continue
        walk(e, depth + 1)
      }
      if (out.length > max * 2) return
    }
  }
  walk(el, 0)
  return normText(out, max)
}
const hrefPath = (h: string) => { try { const u = new URL(h, window.location.href); return u.origin === window.location.origin ? u.pathname : `${u.host}${u.pathname}` } catch { return h.split(/[?#]/)[0] } }
const classesOf = (el: Element) => (typeof el.className === 'string' ? el.className.split(/\s+/).filter(Boolean) : [])
const segOf = (el: Element) => segment(el.tagName.toLowerCase(), { id: el.id, 'data-hunch': el.getAttribute('data-hunch'), 'data-testid': el.getAttribute('data-testid'), role: el.getAttribute('role') }, classesOf(el))

function landmarkOf(el: Element): string {
  const lm = el.parentElement?.closest(LANDMARK)
  const scope = lm ?? document.body
  const name = lm?.getAttribute('aria-label')
  const h = name ? null : scope.querySelector('h1, h2, h3, h4, h5, h6, legend')
  const text = name ? normText(name, 50) : h && h !== el ? textOf(h, 50) : ''
  return text ? `${lm ? lm.tagName.toLowerCase() : 'body'}:${text}` : ''
}

/** The fingerprint of an element as it is now. `withPos`: also its place on the page. */
export function fingerprint(el: Element, withPos = true): Fp {
  const tag = el.tagName.toLowerCase()
  const fp: Fp = { t: tag }
  const a = stableAttrs(tag, (n) => el.getAttribute(n), hrefPath)
  if (Object.keys(a).length) fp.a = a
  const x = textOf(el)
  if (x) fp.x = x
  const p: string[] = []
  for (let n = el.parentElement; n && n !== document.body && n !== document.documentElement && p.length < PATH_DEPTH; n = n.parentElement) p.push(segOf(n))
  if (p.length) fp.p = p
  const parent = el.parentElement
  if (parent) {
    const same = Array.from(parent.children).filter((c) => c.tagName === el.tagName)
    if (same.length > 1) { fp.i = same.indexOf(el); fp.n = same.length }
  }
  const l = landmarkOf(el)
  if (l) fp.l = l
  if (withPos) {
    const r = el.getBoundingClientRect()
    const W = Math.max(document.documentElement.scrollWidth, window.innerWidth) || 1
    const H = Math.max(document.documentElement.scrollHeight, window.innerHeight) || 1
    fp.px = Math.round(((r.left + r.width / 2 + window.scrollX) / W) * 1000) / 1000
    fp.py = Math.round(((r.top + r.height / 2 + window.scrollY) / H) * 1000) / 1000
  }
  return fp
}

const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
/** At most this many same-tag elements are scored per tag and run. */
export const MAX_CANDIDATES = 400

export interface Found { state: 'ok' | 'moved' | 'gone'; el: Element | null; score: number }
interface Target { fp: Fp; sel: string }

/**
 * Finds every target on the page in one pass: candidates are read once per tag, so many pins on a
 * long page cost one scan per tag, capped at MAX_CANDIDATES.
 */
export function findAll(targets: Target[], skip?: Element | null): Found[] {
  const byTag = new Map<string, { el: Element; fp: Fp }[]>()
  const pool = (tag: string) => {
    let list = byTag.get(tag)
    if (!list) {
      list = []
      if (/^[a-z][a-z0-9-]*$/.test(tag)) {
        for (const el of Array.from(document.getElementsByTagName(tag))) {
          if (list.length >= MAX_CANDIDATES) break
          if (skip && (el === skip || skip.contains(el))) continue
          if (visible(el)) list.push({ el, fp: fingerprint(el) })
        }
      }
      byTag.set(tag, list)
    }
    return list
  }
  return targets.map(({ fp, sel }) => {
    let hit: Element | null = null
    try { hit = sel && sel.length <= 400 ? document.querySelector(sel) : null } catch { /* invalid */ }
    const hunch = fp.a?.['data-hunch']
    if (hunch) {
      try {
        const named = Array.from(document.querySelectorAll(`[data-hunch="${CSS.escape(hunch)}"]`)).filter(visible)
        if (named.length === 1) return { state: 'ok' as const, el: named[0], score: 1 }
      } catch { /* fall through */ }
    }
    const list = pool(fp.t)
    const same = fp.x ? list.filter((c) => c.fp.x === fp.x).length : 0
    const scores = list.map((c) => score(fp, c.fp, c.el === hit, same === 1))
    const d = decide(scores)
    return { state: d.state, el: d.index >= 0 ? list[d.index].el : null, score: d.score }
  })
}
