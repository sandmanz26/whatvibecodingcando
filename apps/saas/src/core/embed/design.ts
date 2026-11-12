/**
 * The design tools of the installable script (Inspect, Design system check, Design tokens), for
 * reviewers on a customer's site. Everything here runs in the reviewer's own tab and is sent nowhere.
 *
 * - The page's design tokens are its CSS custom properties (on :root, html, body or a theme
 *   selector), read from its own stylesheets; or a token file the reviewer drops in.
 * - Only computed styles are read. What anyone typed into the page's fields is never read: a field
 *   is named by its tag and label only.
 * - Applying a token file sets only custom properties the page already defines, in one <style>
 *   element in the reviewer's tab, removed when they turn it off. Values that could be more than a
 *   value (url(), braces, semicolons, markup) are refused.
 */

export type Kind = 'color' | 'radius' | 'font' | 'size' | 'other'
export interface Tok { name: string; value: string; kind: Kind; rgb?: [number, number, number, number]; px?: number }
export interface Tokens { source: 'page' | 'file'; label: string; list: Tok[]; colors: Tok[]; radii: Tok[]; fonts: string[]; scale: number[] }

export const DEFAULT_SCALE = [12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48]
const MAX_NAMES = 2000
export const MAX_FILE = 2_000_000
export const MAX_TOKENS = 3000
const UNSAFE = /[;{}<>\\]|url\s*\(|expression\s*\(|@import|javascript:/i
/** The widget's own element: never inspected, scanned or changed. */
export const HOST_TAG = 'vibe-collab'

const parseRgb = (s: string): [number, number, number, number] | null => {
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
  if (p.length < 3 || p.some((x) => !Number.isFinite(x))) return null
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]
}
export const firstFamily = (f: string) => f.split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase()
const supports = (prop: string, v: string) => { try { return CSS.supports(prop, v) } catch { return false } }

let probe: HTMLElement | null = null
/** A colour as the browser renders it (any notation → rgb). */
function rgbOfColor(v: string): [number, number, number, number] | null {
  if (!probe || !probe.isConnected) {
    probe = document.createElement('span')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText = 'position:absolute!important;visibility:hidden!important;pointer-events:none!important;width:0;height:0;overflow:hidden'
    document.documentElement.appendChild(probe)
  }
  probe.style.color = ''
  probe.style.color = v
  if (!probe.style.color) return null
  return parseRgb(getComputedStyle(probe).color)
}
export function dropProbe() { probe?.remove(); probe = null }

/** What a token's value is: decided from the value (and, for sizes and fonts, its name). */
function classify(name: string, value: string): Tok {
  const v = value.trim()
  const n = name.toLowerCase()
  if (/^-?[\d.]+(px|rem|em)$/.test(v)) {
    const px = /rem|em$/.test(v) ? parseFloat(v) * 16 : parseFloat(v)
    if (/radius|rounded|(^|-)r(-|$)|corner/.test(n)) return { name, value: v, kind: 'radius', px }
    if (/font|text|type|size|fs(-|$)/.test(n)) return { name, value: v, kind: 'size', px }
    return { name, value: v, kind: 'other', px }
  }
  if (!/^(var|calc)\(/.test(v) && supports('color', v)) {
    const rgb = rgbOfColor(v)
    if (rgb) return { name, value: v, kind: 'color', rgb }
  }
  if (/font|family|typeface|sans|serif|mono/.test(n) && !/size|weight|height|spacing/.test(n) && /^[\w\s"',-]+$/.test(v)) return { name, value: v, kind: 'font' }
  return { name, value: v, kind: 'other' }
}

function build(source: Tokens['source'], label: string, list: Tok[]): Tokens {
  const sizes = [...new Set(list.filter((t) => t.kind === 'size' && t.px! > 6 && t.px! < 120).map((t) => Math.round(t.px! * 4) / 4))].sort((a, b) => a - b)
  return {
    source, label, list,
    colors: list.filter((t) => t.kind === 'color'),
    radii: list.filter((t) => t.kind === 'radius'),
    fonts: [...new Set(list.filter((t) => t.kind === 'font').map((t) => firstFamily(t.value)))],
    scale: sizes.length >= 3 ? sizes : DEFAULT_SCALE,
  }
}

/* ---------- the page's own tokens ---------- */

const THEME_SELECTOR = /(^|,)\s*(:root|html|body|:host|\[data-[\w-]+(=[^\]]*)?\]|\.dark|\.light|\.theme-[\w-]+)\b/
/** The names of the custom properties the page defines at its top (its design tokens). Cross-origin stylesheets can't be read and are skipped. */
export function pageTokenNames(doc: Document = document): string[] {
  const names = new Set<string>()
  const visit = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (names.size >= MAX_NAMES) return
      if (r instanceof CSSStyleRule) {
        if (THEME_SELECTOR.test(r.selectorText)) for (const p of Array.from(r.style)) if (p.startsWith('--')) names.add(p)
      } else if ('cssRules' in r) {
        try { visit((r as CSSGroupingRule).cssRules) } catch { /* not readable */ }
      }
    }
  }
  for (const s of Array.from(doc.styleSheets)) {
    try { if (s.ownerNode instanceof Element && s.ownerNode.closest(HOST_TAG)) continue; visit(s.cssRules) } catch { /* cross-origin */ }
  }
  for (const p of Array.from(doc.documentElement.style)) if (p.startsWith('--')) names.add(p)
  return [...names]
}

export function pageTokens(doc: Document = document): Tokens {
  const cs = getComputedStyle(doc.documentElement)
  const list: Tok[] = []
  for (const n of pageTokenNames(doc)) {
    const v = cs.getPropertyValue(n).trim()
    if (!v || v.length > 200) continue
    list.push(classify(n, v))
  }
  return build('page', 'this page’s CSS variables', list)
}

/* ---------- a token file (W3C design tokens, Tokens Studio, or CSS variables) ---------- */

interface Raw { path: string[]; value: unknown; type?: string }
function walk(node: unknown, path: string[], type: string | undefined, out: Raw[]) {
  if (out.length > MAX_TOKENS + 1 || !node || typeof node !== 'object' || Array.isArray(node)) return
  const o = node as Record<string, unknown>
  const t = typeof o.$type === 'string' ? o.$type : typeof o.type === 'string' && !('value' in o) ? o.type : type
  if ('$value' in o) { out.push({ path, value: o.$value, type: t }); return }
  if ('value' in o && (typeof o.value === 'string' || typeof o.value === 'number')) { out.push({ path, value: o.value, type: typeof o.type === 'string' ? o.type : t }); return }
  for (const [k, v] of Object.entries(o)) if (!k.startsWith('$')) walk(v, [...path, k], t, out)
}
const cssName = (path: string[]) => `--${path.join('-').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`
const DARK = /^(dark|night)$/i

export function parseTokenFile(fileName: string, text: string): { tokens?: Tokens; skipped: number; error?: string } {
  if (text.length > MAX_FILE) return { skipped: 0, error: `${fileName} is larger than 2 MB.` }
  const trimmed = text.trim()
  const pairs: { name: string; value: string }[] = []
  let skipped = 0
  if (/\.css$/i.test(fileName) || (!trimmed.startsWith('{') && /--[\w-]+\s*:/.test(trimmed))) {
    const seen = new Set<string>()
    for (const m of trimmed.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) {
      if (seen.has(m[1])) continue
      seen.add(m[1])
      pairs.push({ name: m[1], value: m[2].trim() })
    }
  } else {
    let json: unknown
    try { json = JSON.parse(trimmed) } catch (e) { return { skipped: 0, error: `${fileName} isn’t valid JSON or CSS: ${(e as Error).message}` } }
    if (!json || typeof json !== 'object' || Array.isArray(json)) return { skipped: 0, error: `${fileName}: the top level must be an object.` }
    const raws: Raw[] = []
    walk(json, [], undefined, raws)
    // Light values only: a "dark" group or set is left out (the page is checked as it is shown).
    const light = raws.filter((r) => !r.path.some((p) => DARK.test(p)))
    const byPath = new Map(light.map((r) => [r.path.join('.'), r]))
    const lookup = new Map<string, string>()
    for (const p of byPath.keys()) { const parts = p.split('.'); for (let i = 0; i < parts.length; i++) if (!lookup.has(parts.slice(i).join('.'))) lookup.set(parts.slice(i).join('.'), p) }
    const resolve = (v: unknown, depth = 0): string | null => {
      if (typeof v === 'number') return String(v)
      if (typeof v !== 'string' || depth > 10) return null
      let ok = true
      const out = v.replace(/\{([^{}]+)\}/g, (_, ref: string) => {
        const target = byPath.get(lookup.get(ref.trim()) ?? '')
        const r = target ? resolve(target.value, depth + 1) : null
        if (r == null) ok = false
        return r ?? ''
      })
      return ok ? out : null
    }
    for (const r of light) {
      const v = resolve(r.value)
      if (v == null) { skipped++; continue }
      const value = r.type === 'dimension' && /^-?[\d.]+$/.test(v) ? `${v}px` : v
      pairs.push({ name: cssName(r.path), value })
    }
  }
  if (pairs.length > MAX_TOKENS) return { skipped, error: `${fileName} has ${pairs.length} tokens; up to ${MAX_TOKENS} are supported.` }
  const list: Tok[] = []
  for (const p of pairs) {
    if (!p.value || p.value.length > 200 || UNSAFE.test(p.value) || !/^--[\w-]{1,120}$/.test(p.name)) { skipped++; continue }
    list.push(classify(p.name, p.value))
  }
  if (!list.length) return { skipped, error: `No usable tokens in ${fileName}. Tokens need a "$value" (or "value"), or be CSS custom properties.` }
  return { tokens: build('file', fileName.slice(0, 80), list), skipped }
}

/* ---------- applying a token file to the page (this tab only) ---------- */

const APPLIED_ID = 'vibe-collab-tokens'
/** Sets the file's values for the custom properties this page defines (matched by full name, then by the name's last part). Returns how many matched. */
export function applyTokens(t: Tokens): number {
  removeTokens()
  const page = pageTokenNames()
  const tail = (n: string) => n.split('-').filter(Boolean).slice(-2).join('-')
  const byName = new Map(t.list.map((x) => [x.name, x.value]))
  const byTail = new Map<string, string>()
  for (const x of t.list) if (!byTail.has(tail(x.name))) byTail.set(tail(x.name), x.value)
  const lines: string[] = []
  for (const n of page) {
    const v = byName.get(n) ?? byTail.get(tail(n))
    if (v && !UNSAFE.test(v)) lines.push(`${n}: ${v} !important;`)
  }
  if (!lines.length) return 0
  const style = document.createElement('style')
  style.id = APPLIED_ID
  style.setAttribute('data-vibe-collab', 'tokens')
  style.textContent = `:root, html, body { ${lines.join(' ')} }`
  document.head.appendChild(style)
  return lines.length
}
export function removeTokens() { document.getElementById(APPLIED_ID)?.remove() }

/* ---------- inspecting one element ---------- */

const near = (a: number[], b: number[]) => Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 && Math.abs(a[2] - b[2]) <= 1 && Math.abs(a[3] - b[3]) <= 0.02
const hexOf = (rgb: number[]) => `#${rgb.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}${rgb[3] < 1 ? ` · ${Math.round(rgb[3] * 100)}%` : ''}`
function nearestColor(t: Tokens, rgb: number[]) {
  let best = { name: '', d: Infinity }
  for (const c of t.colors) { const d = Math.hypot(c.rgb![0] - rgb[0], c.rgb![1] - rgb[1], c.rgb![2] - rgb[2]) + Math.abs(c.rgb![3] - rgb[3]) * 255; if (d < best.d) best = { name: c.name, d } }
  return best.name
}
const isField = (el: Element) => /^(input|textarea|select)$/i.test(el.tagName) || (el as HTMLElement).isContentEditable

/** A short, readable name for an element. A form field is named by its tag and label only, never what is in it. */
export function nameOf(el: Element) {
  const tag = el.tagName.toLowerCase()
  const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0].slice(0, 30)}` : ''
  const aria = el.getAttribute('aria-label')
  if (isField(el) || el.closest('[contenteditable=""], [contenteditable="true"]')) return `${tag}${cls}${aria ? ` “${aria.slice(0, 30)}”` : ''}`
  const text = aria ?? (el.textContent ?? '').trim().split('\n')[0]
  return `${tag}${cls}${text ? ` “${text.slice(0, 30)}”` : ''}`
}

export interface Row { label: string; value: string; swatch?: string; token?: string; off?: string; note?: string }
export interface Info { name: string; size: string; rows: Row[]; offCount: number }

function colorRow(t: Tokens, label: string, value: string, note?: string): Row {
  const rgb = parseRgb(value)
  if (!rgb) return { label, value }
  if (!t.colors.length) return { label, value: hexOf(rgb), swatch: value, note }
  const hit = t.colors.find((c) => near(c.rgb!, rgb))
  if (hit) return { label, value: hexOf(rgb), swatch: value, token: hit.name, note }
  const n = nearestColor(t, rgb)
  return { label, value: hexOf(rgb), swatch: value, off: n ? `nearest ${n}` : 'not a token', note }
}
function seenBackground(el: Element): { value: string; from?: string } {
  let n: Element | null = el
  while (n) {
    const bg = getComputedStyle(n).backgroundColor
    const rgb = parseRgb(bg)
    if (rgb && rgb[3] > 0) return { value: bg, from: n === el ? undefined : 'from a parent' }
    n = n.parentElement
  }
  return { value: 'rgb(255, 255, 255)', from: 'page default' }
}

export function inspect(el: Element, t: Tokens): Info {
  const cs = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  const rows: Row[] = []
  const hasText = !!el.textContent?.trim() || /^(input|textarea|select|button)$/i.test(el.tagName)
  if (hasText) {
    const fam = firstFamily(cs.fontFamily)
    rows.push({ label: 'Font', value: fam, ...(!t.fonts.length ? {} : t.fonts.includes(fam) ? { token: 'font token' } : { off: `use ${t.fonts[0]}` }) })
    const fs = parseFloat(cs.fontSize)
    const nearest = [...t.scale].sort((a, b) => Math.abs(a - fs) - Math.abs(b - fs))[0]
    rows.push({ label: 'Font size', value: cs.fontSize, ...(t.scale.some((s) => Math.abs(s - fs) < 0.25) ? { token: 'type scale' } : { off: `nearest ${nearest}px` }) })
    rows.push({ label: 'Weight · line', value: `${cs.fontWeight} · ${cs.lineHeight}` })
    rows.push(colorRow(t, 'Text colour', cs.color))
  }
  const bg = seenBackground(el)
  rows.push(colorRow(t, 'Background', bg.value, bg.from))
  if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none' && (parseRgb(cs.borderTopColor)?.[3] ?? 1) > 0) rows.push(colorRow(t, `Border ${cs.borderTopWidth}`, cs.borderTopColor))
  const rad = parseFloat(cs.borderTopLeftRadius)
  if (rad > 0) {
    const tok = t.radii.find((x) => Math.abs((x.px ?? -1) - rad) < 0.5)
    const pill = rad >= 999 || cs.borderTopLeftRadius.endsWith('%')
    rows.push({ label: 'Corner radius', value: cs.borderTopLeftRadius, ...(tok || pill ? { token: tok?.name ?? 'pill' } : t.radii.length ? { off: 'not a token' } : {}) })
  }
  const pad = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft]
  if (pad.some((p) => parseFloat(p) > 0)) rows.push({ label: 'Padding', value: pad.every((p) => p === pad[0]) ? pad[0] : pad.join(' ') })
  return { name: nameOf(el), size: `${Math.round(r.width)} × ${Math.round(r.height)}`, rows, offCount: rows.filter((x) => x.off).length }
}

/* ---------- the design system check of a whole page ---------- */

export type Rule = 'color' | 'background' | 'border' | 'radius' | 'font-size' | 'font-family'
export const RULE_LABEL: Record<Rule, string> = {
  color: 'Text colour not a token', background: 'Background not a token', border: 'Border colour not a token',
  radius: 'Corner radius not a token', 'font-size': 'Font size off the type scale', 'font-family': 'Font not a token',
}
export interface Group { rule: Rule; value: string; swatch?: string; suggest?: string; els: Element[] }
export interface Scan { checked: number; groups: Group[]; capped: boolean }
const SKIP = `${HOST_TAG}, script, style, noscript, template, svg *, br, head, meta, link`
const MAX_ELEMENTS = 5000

export function scanPage(t: Tokens, root: Element = document.body): Scan {
  const groups = new Map<string, Group>()
  let checked = 0
  const all = Array.from(root.querySelectorAll('*'))
  const capped = all.length > MAX_ELEMENTS
  for (const el of all.slice(0, MAX_ELEMENTS)) {
    if (el.matches(SKIP) || el.closest(HOST_TAG)) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    checked++
    const parent = el.parentElement ? getComputedStyle(el.parentElement) : null
    const hit = (rule: Rule, value: string, suggest?: string, swatch?: string) => {
      const k = `${rule}|${value}`
      const g = groups.get(k) ?? { rule, value, suggest, swatch, els: [] }
      if (g.els.length < 50) g.els.push(el)
      groups.set(k, g)
    }
    const color = (rule: Rule, v: string) => {
      if (!t.colors.length) return
      const rgb = parseRgb(v)
      if (!rgb || rgb[3] === 0) return
      if (!t.colors.some((c) => near(c.rgb!, rgb))) hit(rule, hexOf(rgb), nearestColor(t, rgb), v)
    }
    const text = !!el.textContent?.trim()
    if (text && (!parent || cs.color !== parent.color)) color('color', cs.color)
    color('background', cs.backgroundColor)
    if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') color('border', cs.borderTopColor)
    const rad = cs.borderTopLeftRadius, px = parseFloat(rad)
    if (t.radii.length && px > 0 && !rad.endsWith('%') && px < 999 && !t.radii.some((x) => Math.abs((x.px ?? -1) - px) < 0.5)) {
      const n = [...t.radii].sort((a, b) => Math.abs(a.px! - px) - Math.abs(b.px! - px))[0]
      hit('radius', rad, n ? `${n.name} (${n.value})` : undefined)
    }
    if (text && (!parent || cs.fontSize !== parent.fontSize)) {
      const fs = parseFloat(cs.fontSize)
      if (!t.scale.some((s) => Math.abs(s - fs) < 0.25)) hit('font-size', cs.fontSize, `${[...t.scale].sort((a, b) => Math.abs(a - fs) - Math.abs(b - fs))[0]}px`)
    }
    if (text && t.fonts.length && (!parent || cs.fontFamily !== parent.fontFamily)) {
      const fam = firstFamily(cs.fontFamily)
      if (!t.fonts.includes(fam)) hit('font-family', fam, t.fonts[0])
    }
  }
  return { checked, capped, groups: [...groups.values()].sort((a, b) => b.els.length - a.els.length) }
}
