/**
 * Component review: two components from the app, side by side, with the reviewer's notes.
 *
 * A review is saved only once both components are chosen; notes are added to a saved
 * review and are saved as they are added. Each component keeps a snapshot of its rendered
 * styles from when it was picked, so the comparison doesn't shift if the app changes later.
 * Only styles, a selector and a short name are kept: never the value of a field.
 */
import { APP, readJSON, safeQuery, writeJSON } from '../shared'
import { readTokens } from '../dscheck/scan'
import { selectorFor } from '../insights/tracker'
import type { Device } from '../insights/ScreenViewer'

export type Side = 'A' | 'B'
export type About = Side | 'both'

export interface StyleRow { key: string; label: string; value: string; token?: string }
export interface Slot {
  page: string
  query?: string
  device: Device
  sel: string
  label: string
  styles: StyleRow[]
  pickedAt: string
}
export interface CNote { id: string; author: string; text: string; about: About; at: string }
/** A reviewer's pin on one of the two components: where (as % of the component's box) and what. */
export interface Annotation { id: string; side: Side; x: number; y: number; text: string; author: string; at: string; round: number }
export type Choice = 'A' | 'B' | 'both' | 'neither'
export const CHOICE_LABEL: Record<Choice, string> = { A: 'Keep A', B: 'Keep B', both: 'Both are fine', neither: 'Both need changes' }
export interface Decision { by: string; at: string; choice: Choice; summary: string; round: number }
export interface Review {
  id: string; title: string; a: Slot; b: Slot; notes: CNote[]; createdAt: string; updatedAt: string
  /** made by the app as an example */
  sample?: boolean
  /** what the person submitting wants decided */
  question?: string
  submittedBy?: string
  /** 'pending' waits for a reviewer; 'done' has a decision. Older reviews without one count as pending. */
  status?: 'pending' | 'done'
  annotations?: Annotation[]
  decision?: Decision
  /** earlier decisions, when the submitter asked for another review */
  history?: Decision[]
  /** 1 for the first review, +1 each time another review is asked for */
  round?: number
}
export const statusOf = (r: Review) => (r.status === 'done' && r.decision ? 'done' : 'pending')
export const COMPARE_CHANGED = `${APP}:compare`
/** Opens the compare panel from anywhere: the list, a new comparison, or one review. */
export const COMPARE_OPEN = `${APP}:compare-open`
export type CompareOpen = { view: 'list' } | { view: 'new' } | { view: 'review'; id: string }
const NAME_KEY = `${APP}.reviewPins.name`
/** The name reviews and annotations are signed with: the same one comments use. */
export const reviewerName = () => readJSON<string>(NAME_KEY, '').trim() || 'Rani'

const KEY = `${APP}.compare`
export const MAX_NOTE = 2000

export const loadReviews = () => readJSON<Review[]>(KEY, [])
export const saveReviews = (list: Review[]) => { writeJSON(KEY, list); window.dispatchEvent(new Event(COMPARE_CHANGED)) }
export const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** Screens to start from. The search screen uses a fixed demo query, never one somebody typed. */
export const SCREENS = [
  { page: '/', label: 'Home' },
  { page: '/search?q=running%20shoes', label: 'Search' },
  { page: '/product/p1', label: 'Product' },
  { page: '/cart', label: 'Cart' },
  { page: '/checkout', label: 'Checkout' },
  { page: '/orders', label: 'Orders' },
]

/** Where the picker's frame is now. A query is kept only when it is one of the preset screens'. */
export function whereIs(win: Window): { page: string; query?: string } {
  const h = win.location.hash.replace(/^#/, '')
  const [page = '/', raw = ''] = h.split('?')
  const own = new URLSearchParams(raw)
  own.delete('embed')
  const rawQ = own.toString()
  const preset = SCREENS.find((s) => { const [p, q = ''] = s.page.split('?'); return p === page && q !== '' && new URLSearchParams(q).toString() === rawQ })
  const query = preset ? rawQ : safeQuery(own)
  return { page: page || '/', ...(query ? { query } : {}) }
}

/** A readable name for a component: its accessible name, a heading in it, or its first words. */
export function nameOf(el: Element): string {
  const tag = el.tagName.toLowerCase()
  const aria = el.getAttribute('aria-label')?.trim()
  if (aria) return `${tag} “${aria.slice(0, 50)}”`
  const heading = el.querySelector('h1, h2, h3, h4')?.textContent?.trim()
  // Skip the words of image placeholders ("Product photo") so the name is the component's own text.
  const imgs = new Set(Array.from(el.querySelectorAll('[role="img"]')).map((i) => i.textContent?.trim()))
  const lines = ((el as HTMLElement).innerText ?? '').split('\n').map((l) => l.trim()).filter(Boolean)
  const text = heading || lines.find((l) => !imgs.has(l)) || lines[0] || ''
  const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : ''
  return text ? `${tag}${cls} “${text.slice(0, 40)}”` : `${tag}${cls}`
}

const PROPS: { key: string; label: string; read: (cs: CSSStyleDeclaration, r: DOMRect) => string; kind?: 'color' | 'radius' }[] = [
  { key: 'size', label: 'Size', read: (_, r) => `${Math.round(r.width)} × ${Math.round(r.height)} px` },
  { key: 'font-size', label: 'Font size', read: (cs) => cs.fontSize },
  { key: 'font-weight', label: 'Font weight', read: (cs) => cs.fontWeight },
  { key: 'line-height', label: 'Line height', read: (cs) => cs.lineHeight },
  { key: 'font-family', label: 'Font', read: (cs) => cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '') },
  { key: 'color', label: 'Text colour', read: (cs) => cs.color, kind: 'color' },
  { key: 'background', label: 'Background', read: (cs) => cs.backgroundColor, kind: 'color' },
  { key: 'border', label: 'Border', read: (cs) => (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' ? `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}` : 'none') },
  { key: 'radius', label: 'Corner radius', read: (cs) => cs.borderTopLeftRadius, kind: 'radius' },
  { key: 'padding', label: 'Padding', read: (cs) => [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' ') },
  { key: 'shadow', label: 'Shadow', read: (cs) => (cs.boxShadow === 'none' ? 'none' : 'yes') },
]

const rgbOf = (s: string) => s.match(/rgba?\(([^)]+)\)/)?.[1].split(/[\s,/]+/).filter(Boolean).map(Number)

/** Reads what the browser renders for the element, and names the design token behind a value when there is one. */
export function snapshot(el: Element, device: Device): Slot {
  const doc = el.ownerDocument
  const win = doc.defaultView!
  const cs = win.getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const tokens = readTokens(doc)
  const styles = PROPS.map((p) => {
    const value = p.read(cs, r)
    let token: string | undefined
    if (p.kind === 'color') {
      const v = rgbOf(value)
      if (v && (v[3] ?? 1) > 0) token = tokens.colors.find((c) => c.rgb.slice(0, 3).every((x, i) => Math.abs(x - v[i]) <= 1) && Math.abs(c.rgb[3] - (v[3] ?? 1)) <= 0.02)?.name
    }
    if (p.kind === 'radius') {
      const px = parseFloat(value)
      if (px > 0) token = tokens.radii.find((t) => Math.abs(t.px - px) < 0.5)?.name
    }
    return { key: p.key, label: p.label, value, ...(token ? { token } : {}) }
  })
  return { ...whereIs(win), device, sel: selectorFor(el), label: nameOf(el), styles, pickedAt: new Date().toISOString() }
}

/** Two values count as the same when they read the same, or are lengths within half a pixel. */
export function same(a: string, b: string) {
  if (a === b) return true
  const na = a.match(/-?[\d.]+/g), nb = b.match(/-?[\d.]+/g)
  if (!na || !nb || na.length !== nb.length) return false
  if (a.replace(/-?[\d.]+/g, '#') !== b.replace(/-?[\d.]+/g, '#')) return false
  return na.every((x, i) => Math.abs(Number(x) - Number(nb[i])) < 0.5)
}

export const sameSpot = (a: Slot, b: Slot) => a.page === b.page && (a.query ?? '') === (b.query ?? '') && a.sel === b.sel && a.device === b.device

export const screenOf = (s: Slot) => `${s.page}${s.query ? `?${s.query}` : ''}`

/** A note written before its component was swapped for another one. */
export const stale = (n: CNote, r: Review) =>
  (n.about !== 'B' && n.at < r.a.pickedAt) || (n.about !== 'A' && n.at < r.b.pickedAt)
