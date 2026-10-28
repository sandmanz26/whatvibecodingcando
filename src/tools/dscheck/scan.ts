/**
 * Design system check — reads the rendered styles of a screen and flags values that
 * aren't design tokens: colours, corner radii, font families, and font sizes off the
 * type scale. It also flags inline styles that set these by hand.
 *
 * It checks what the browser actually renders (computed styles), so a hard-coded
 * colour in any stylesheet shows up, wherever it was written. Research tools' own UI
 * is skipped.
 */
import { baseline, flatten } from '../design/tokens'
import { selectorFor } from '../insights/tracker'

export type Rule = 'color' | 'background' | 'border' | 'radius' | 'font-size' | 'font-family' | 'inline'

export const RULE_LABEL: Record<Rule, string> = {
  color: 'Text colour not a token',
  background: 'Background not a token',
  border: 'Border colour not a token',
  radius: 'Corner radius not a token',
  'font-size': 'Font size off the type scale',
  'font-family': 'Font not a token',
  inline: 'Inline style set by hand',
}

export interface Hit { rule: Rule; value: string; sel: string; label: string; page: string; suggest?: string }
export interface PageResult { page: string; checked: number; flagged: number; hits: Hit[] }

const SKIP = '[data-insights-ignore], [data-review-pins], [data-usability-test], [data-fivesec], [data-gaze], .dock, svg, script, style, noscript, br'
export const DEFAULT_SCALE = [12, 13, 14, 16, 18, 20, 24, 28, 34]

interface Tokens { colors: { name: string; rgb: [number, number, number, number] }[]; radii: { name: string; px: number }[]; fonts: string[] }

const parseRgb = (s: string): [number, number, number, number] | null => {
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
}
const firstFamily = (f: string) => f.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase()

/** The tokens as this document renders them (so var() chains and the current theme are resolved). */
export function readTokens(doc: Document): Tokens {
  const names = [...new Set([...Object.keys(flatten(baseline().light)), ...Object.keys(flatten(baseline().dark))])]
  const probe = doc.createElement('div')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  doc.body.appendChild(probe)
  const win = doc.defaultView!
  const colors: Tokens['colors'] = []
  const radii: Tokens['radii'] = []
  const fonts: string[] = []
  for (const n of names) {
    const raw = win.getComputedStyle(doc.documentElement).getPropertyValue(n).trim()
    if (!raw) continue
    if (/^(r|r-sm|r-lg)$/.test(n.slice(2))) { const px = parseFloat(raw); if (Number.isFinite(px)) radii.push({ name: n, px }); continue }
    if (/^(font|mono)$/.test(n.slice(2))) { fonts.push(firstFamily(raw)); continue }
    probe.style.color = ''
    probe.style.color = `var(${n})`
    const rgb = parseRgb(win.getComputedStyle(probe).color)
    if (rgb && /^(#|rgb|hsl|var)/.test(raw)) colors.push({ name: n, rgb })
  }
  probe.remove()
  return { colors, radii, fonts }
}

const near = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 && Math.abs(a[2] - b[2]) <= 1 && Math.abs(a[3] - b[3]) <= 0.02

function nearestColor(t: Tokens, rgb: number[]) {
  let best = { name: '', d: Infinity }
  for (const c of t.colors) {
    const d = Math.hypot(c.rgb[0] - rgb[0], c.rgb[1] - rgb[1], c.rgb[2] - rgb[2]) + Math.abs(c.rgb[3] - rgb[3]) * 255
    if (d < best.d) best = { name: c.name, d }
  }
  return best.name
}

const labelOf = (el: Element) => {
  const aria = el.getAttribute('aria-label')
  if (aria) return aria.slice(0, 60)
  const text = ((el as HTMLElement).innerText ?? el.textContent ?? '').trim().split('\n')[0]
  return (text ? `${el.tagName.toLowerCase()} “${text.slice(0, 40)}”` : `${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? `.${el.className.split(' ')[0]}` : ''}`)
}

/** Checks every visible element of a rendered document. */
export function scanDocument(doc: Document, page: string, scale: number[], tokens: Tokens): PageResult {
  const win = doc.defaultView!
  const hits: Hit[] = []
  let checked = 0
  const flaggedEls = new Set<Element>()
  const all = doc.body.querySelectorAll('*')
  for (const el of Array.from(all)) {
    if (el.closest(SKIP)) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cs = win.getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    checked++
    const parent = el.parentElement ? win.getComputedStyle(el.parentElement) : null
    const hit = (rule: Rule, value: string, suggest?: string) => { hits.push({ rule, value, sel: selectorFor(el), label: labelOf(el), page, suggest }); flaggedEls.add(el) }
    const checkColor = (rule: Rule, value: string) => {
      const rgb = parseRgb(value)
      if (!rgb || rgb[3] === 0) return
      if (!tokens.colors.some((c) => near(c.rgb, rgb))) hit(rule, value, nearestColor(tokens, rgb))
    }
    // Inherited properties are judged only where they are set, not on every child.
    if (!parent || cs.color !== parent.color) checkColor('color', cs.color)
    checkColor('background', cs.backgroundColor)
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') checkColor('border', cs.borderTopColor)
    const rad = cs.borderTopLeftRadius
    const px = parseFloat(rad)
    if (px > 0 && !rad.endsWith('%') && px < 999 && !tokens.radii.some((t) => Math.abs(t.px - px) < 0.5)) {
      const nearest = [...tokens.radii].sort((a, b) => Math.abs(a.px - px) - Math.abs(b.px - px))[0]
      hit('radius', rad, nearest ? `${nearest.name} (${nearest.px}px)` : undefined)
    }
    if (!parent || cs.fontSize !== parent.fontSize) {
      const fs = parseFloat(cs.fontSize)
      if (el.textContent?.trim() && !scale.some((s) => Math.abs(s - fs) < 0.25)) {
        const nearest = [...scale].sort((a, b) => Math.abs(a - fs) - Math.abs(b - fs))[0]
        hit('font-size', cs.fontSize, `${nearest}px`)
      }
    }
    if (!parent || cs.fontFamily !== parent.fontFamily) {
      const fam = firstFamily(cs.fontFamily)
      if (el.textContent?.trim() && tokens.fonts.length && !tokens.fonts.includes(fam)) hit('font-family', fam, tokens.fonts[0])
    }
    const inline = el.getAttribute('style') ?? ''
    if (/(^|;)\s*(color|background(-color)?|font-size|border-radius|font-family)\s*:/.test(inline)) hit('inline', inline.slice(0, 80))
  }
  return { page, checked, flagged: flaggedEls.size, hits }
}

export interface Group { rule: Rule; value: string; uses: number; pages: string[]; examples: Hit[]; suggest?: string }

export function groupHits(results: PageResult[]): Group[] {
  const m = new Map<string, Group>()
  for (const h of results.flatMap((r) => r.hits)) {
    const key = `${h.rule}|${h.value}`
    const g = m.get(key) ?? { rule: h.rule, value: h.value, uses: 0, pages: [], examples: [], suggest: h.suggest }
    g.uses++
    if (!g.pages.includes(h.page)) g.pages.push(h.page)
    if (g.examples.length < 5 && !g.examples.some((x) => x.sel === h.sel && x.page === h.page)) g.examples.push(h)
    m.set(key, g)
  }
  return [...m.values()].sort((a, b) => b.uses - a.uses)
}
