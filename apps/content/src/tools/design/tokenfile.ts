/**
 * Uploaded design-token files, kept as named sets that can be simulated on the app and compared.
 *
 * Accepted files:
 * - W3C design tokens (DTCG): any object with "$value"; "$type" may sit on a group. New-style
 *   colour objects ({ hex }) and dimension objects ({ value, unit }) are read too.
 * - Tokens Studio: the same with "value" / "type". Sets named like "dark" apply in dark mode.
 * - This app's own format: top-level "light" and "dark".
 * - CSS: custom properties in :root (light) and in any rule whose selector mentions "dark".
 * Aliases ({color.brand.500}) and var(--x) references inside the file are resolved.
 *
 * A file's token names rarely match the app's. Each set keeps a mapping from the app's
 * tokens to the file's: filled in by exact name on upload, and editable by hand.
 */
import { APP, readJSON } from '../shared'
import { baseline, flatten, merge, type DesignDoc, type Scope } from './tokens'
import { PRESETS, presetOf } from './presets'

export type Kind = 'color' | 'radius' | 'size' | 'font' | 'shadow' | 'other'
export interface FileToken { path: string; short: string; kind: Kind; light?: string; dark?: string }
export interface TokenSet {
  id: string
  name: string
  format: string
  fileName: string
  tokens: FileToken[]
  /** app CSS variable (without --) → path of the file's token */
  map: Record<string, string>
  skipped: string[]
  createdAt: string
}

const KEY = `${APP}.tokenSets`
export const MAX_BYTES = 2_000_000
export const MAX_TOKENS = 3000

export const loadSets = () => readJSON<TokenSet[]>(KEY, [])
/** Saves the sets; false when the browser's storage is full or blocked. */
export function saveSets(sets: TokenSet[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(sets)); return true } catch { return false }
}

/* ---------- kinds ---------- */

export function kindOf(name: string, value: string, type?: string): Kind {
  const t = (type ?? '').toLowerCase()
  if (t === 'color') return 'color'
  if (/radius/.test(t)) return 'radius'
  if (/fontfamil/.test(t)) return 'font'
  if (/shadow/.test(t)) return 'shadow'
  if (/dimension|spacing|sizing|fontsize|borderwidth/.test(t)) return /radius|^r(-|$)/.test(name) ? 'radius' : 'size'
  if (/shadow/.test(name)) return 'shadow'
  if (/^(font|mono|serif|sans)$|font-?famil/.test(name)) return 'font'
  if (/^(#|rgb|hsl|oklch|oklab|lab\(|lch\(|color-mix|color\()/.test(value)) return 'color'
  if (/^-?[\d.]+(px|rem|em|%)?$/.test(value)) return /radius|^r(-|$)|^r-/.test(name) ? 'radius' : 'size'
  return 'other'
}

/** The app's tokens with their kind, light value and dark value. */
export function appTokens() {
  const b = baseline()
  const light = flatten(b.light), dark = flatten(b.dark)
  return Object.keys({ ...light, ...dark }).map((v) => {
    const name = v.slice(2)
    const value = light[v] ?? dark[v]
    return { name, kind: kindOf(name, value), light: light[v], dark: dark[v] }
  })
}

/* ---------- parsing ---------- */

const UNSAFE = /[;{}<>]|\/\*|url\(/i
const cssSafe = (s: string) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
// A whole path segment naming the mode ("dark", "theme-dark", "dark mode"), not a token like "primary-dark".
const isDark = (seg: string) => /^(theme[-_ ]?)?dark([-_ ]?(mode|theme))?$/i.test(seg)
const isLight = (seg: string) => /^(theme[-_ ]?)?light([-_ ]?(mode|theme))?$/i.test(seg)
const darkSelector = (sel: string) => /(^|[^a-z])dark([^a-z]|$)/i.test(sel)

interface Raw { path: string[]; value: unknown; type?: string }

function stringify(v: unknown, type?: string): string | null {
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return /dimension|radius|spacing|sizing|fontsize|borderwidth/i.test(type ?? '') ? `${v}px` : String(v)
  if (Array.isArray(v) && v.every((x) => typeof x === 'string')) return v.map((x) => (/\s/.test(x) && !/^["']/.test(x) ? `'${x}'` : x)).join(', ')
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.hex === 'string') return typeof o.alpha === 'number' && o.alpha < 1 ? hexAlpha(o.hex, o.alpha) : o.hex
    if ((typeof o.value === 'number' || typeof o.value === 'string') && typeof o.unit === 'string') return `${o.value}${o.unit}`
  }
  return null
}
const hexAlpha = (hex: string, a: number) => {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function walkJson(node: unknown, path: string[], type: string | undefined, out: Raw[]) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return
  const o = node as Record<string, unknown>
  const ownType = (o.$type ?? o.type) as string | undefined
  const t = typeof ownType === 'string' ? ownType : type
  if ('$value' in o || ('value' in o && ('type' in o || typeof o.value !== 'object'))) {
    out.push({ path, value: '$value' in o ? o.$value : o.value, type: t })
    return
  }
  for (const [k, v] of Object.entries(o)) if (!k.startsWith('$')) walkJson(v, [...path, k], t, out)
}

function parseCss(text: string): Raw[] {
  const out: Raw[] = []
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const re = /([^{}]+)\{([^{}]*)\}/g
  for (let m = re.exec(clean); m; m = re.exec(clean)) {
    const sel = m[1].trim()
    const scope = darkSelector(sel) ? 'dark' : 'light'
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':')
      const name = d.slice(0, i).trim()
      if (i < 0 || !name.startsWith('--')) continue
      out.push({ path: [scope, name.slice(2)], value: d.slice(i + 1).trim() })
    }
  }
  return out
}

/** Reads a file into a token set, or says what is wrong in plain words. */
export function parseFile(fileName: string, text: string): { set?: TokenSet; error?: string } {
  if (text.length > MAX_BYTES) return { error: `${fileName} is larger than 2 MB.` }
  const trimmed = text.trim()
  let raws: Raw[]
  let format: string
  if (/\.css$/i.test(fileName) || (!trimmed.startsWith('{') && /--[\w-]+\s*:/.test(trimmed))) {
    raws = parseCss(trimmed)
    format = 'CSS variables'
  } else {
    let json: unknown
    try { json = JSON.parse(trimmed) } catch (e) { return { error: `${fileName} is not valid JSON or CSS: ${(e as Error).message}` } }
    if (!json || typeof json !== 'object' || Array.isArray(json)) return { error: `${fileName}: the top level must be an object.` }
    raws = []
    walkJson(json, [], undefined, raws)
    format = Object.keys(json).some((k) => k === '$themes' || k === '$metadata') ? 'Tokens Studio'
      : trimmed.includes('"$value"') ? 'W3C design tokens' : 'Tokens Studio'
  }
  if (!raws.length) return { error: `No tokens found in ${fileName}. Tokens need a "$value" (or "value"), or be CSS custom properties.` }
  if (raws.length > MAX_TOKENS) return { error: `${fileName} has ${raws.length} tokens; up to ${MAX_TOKENS} are supported.` }

  // Scope: a path segment naming dark (a "dark" set or group) makes it a dark value. Light/dark segments
  // are left out of the token's path so the light and dark values of one token meet.
  const skipped: string[] = []
  const byPath = new Map<string, { raw: Raw; scope: Scope }[]>()
  for (const r of raws) {
    const scope: Scope = r.path.some(isDark) ? 'dark' : 'light'
    const rest = r.path.filter((s) => !isDark(s) && !isLight(s))
    const key = (rest.length ? rest : r.path).join('.')
    byPath.set(key, [...(byPath.get(key) ?? []), { raw: r, scope }])
  }
  // Alias lookup by the token's path, with or without a leading set name.
  const lookup = new Map<string, string>()
  for (const p of byPath.keys()) {
    lookup.set(p, p)
    const parts = p.split('.')
    for (let i = 1; i < parts.length; i++) if (!lookup.has(parts.slice(i).join('.'))) lookup.set(parts.slice(i).join('.'), p)
  }
  const cssName = new Map<string, string>()
  for (const p of byPath.keys()) { const short = p.split('.').pop()!; if (!cssName.has(short)) cssName.set(short, p) }

  const resolve = (value: string, scope: Scope, depth = 0): string | null => {
    if (depth > 12) return null
    let ok = true
    const sub = (target: string | undefined) => {
      if (!target) { ok = false; return '' }
      const e = byPath.get(target)!
      const hit = e.find((x) => x.scope === scope) ?? e.find((x) => x.scope === 'light') ?? e[0]
      const v = stringify(hit.raw.value, hit.raw.type)
      const r = v == null ? null : resolve(v, scope, depth + 1)
      if (r == null) { ok = false; return '' }
      return r
    }
    let out = value.replace(/\{([^{}]+)\}/g, (_, ref: string) => sub(lookup.get(ref.trim())))
    // var(--x) pointing at another token of the same file (not at one of the app's).
    out = out.replace(/var\(--([\w-]+)\)/g, (whole, n: string) => (cssName.has(n) ? sub(cssName.get(n)) : whole))
    return ok ? out : null
  }

  const tokens: FileToken[] = []
  const used = new Set<string>()
  for (const [path, entries] of byPath) {
    const t: FileToken = { path, short: cssSafe(path.split('.').pop()!), kind: 'other' }
    for (const { raw, scope } of entries) {
      const v = stringify(raw.value, raw.type)
      if (v == null) { skipped.push(`${path}: a composite value (typography, shadow layers…) isn’t simulated`); continue }
      const r = resolve(v, scope)
      if (r == null) { skipped.push(`${path}: its alias ${v} doesn’t resolve`); continue }
      if (UNSAFE.test(r)) { skipped.push(`${path}: the value can’t be used as CSS`); continue }
      t[scope] = r
      t.kind = kindOf(t.short, r, raw.type)
    }
    if ((t.light ?? t.dark) !== undefined && !used.has(path)) { used.add(path); tokens.push(t) }
  }
  if (!tokens.length) return { error: `None of the ${raws.length} tokens in ${fileName} could be used. ${skipped[0] ?? ''}` }

  const set: TokenSet = {
    id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
    name: fileName.replace(/\.(json|css|tokens)$/i, '').replace(/[-_.]+/g, ' ').trim() || 'Uploaded tokens',
    format, fileName, tokens, map: {}, skipped, createdAt: new Date().toISOString(),
  }
  set.map = autoMap(set)
  return { set }
}

/** Matches the app's tokens to the file's by name: the whole path first, then its last part. Kinds must agree. */
export function autoMap(set: TokenSet): Record<string, string> {
  const map: Record<string, string> = {}
  for (const a of appTokens()) {
    const full = set.tokens.find((t) => cssSafe(t.path.replace(/\./g, '-')) === a.name && t.kind === a.kind)
    const short = set.tokens.filter((t) => t.short === a.name && t.kind === a.kind)
    const hit = full ?? short[0]
    if (hit) map[a.name] = hit.path
  }
  return map
}

/* ---------- simulating and comparing ---------- */

/** A set as the simulator takes it: only the mapped tokens, over the app's own. */
export function docOf(set: TokenSet): DesignDoc {
  const light: Record<string, { $value: string }> = {}
  const dark: Record<string, { $value: string }> = {}
  for (const [app, path] of Object.entries(set.map)) {
    const t = set.tokens.find((x) => x.path === path)
    if (!t) continue
    const lv = t.light ?? t.dark
    if (lv !== undefined) light[app] = { $value: lv }
    if (t.dark !== undefined) dark[app] = { $value: t.dark }
  }
  return { light: { set: light }, ...(Object.keys(dark).length ? { dark: { set: dark } } : {}) }
}

/** Everything that can be compared: the app's own look, the UI-library looks, and uploaded sets. */
export interface Choice { id: string; name: string; kind: 'builtin' | 'upload'; preset: string; doc: DesignDoc }
export function choices(sets: TokenSet[]): Choice[] {
  const base = baseline()
  return [
    ...PRESETS.map((p) => ({ id: `preset:${p.id}`, name: p.id === 'wireframe' ? 'App’s own (wireframe)' : p.name, kind: 'builtin' as const, preset: p.id, doc: merge(base, p.tokens) })),
    ...sets.map((s) => ({ id: `set:${s.id}`, name: s.name, kind: 'upload' as const, preset: 'wireframe', doc: merge(base, docOf(s)) })),
  ]
}
export const presetName = (id: string) => presetOf(id).name

export interface Row { scope: Scope; name: string; kind: Kind; a?: string; b?: string; same: boolean }
/** Token by token, the two looks' values in light and dark mode. */
export function compareDocs(a: DesignDoc, b: DesignDoc): Row[] {
  const rows: Row[] = []
  for (const scope of ['light', 'dark'] as Scope[]) {
    const fa = flatten(a[scope]), fb = flatten(b[scope])
    for (const v of [...new Set([...Object.keys(fa), ...Object.keys(fb)])].sort()) {
      const name = v.slice(2)
      rows.push({ scope, name, kind: kindOf(name, fa[v] ?? fb[v] ?? ''), a: fa[v], b: fb[v], same: (fa[v] ?? '').replace(/\s+/g, '') === (fb[v] ?? '').replace(/\s+/g, '') })
    }
  }
  return rows
}

/* ---------- contrast ---------- */

/** Resolves a look's colours the way the browser would (var() chains, color-mix…) and returns rgb. */
export function resolveColors(doc: DesignDoc, scope: Scope, names: string[]): Record<string, [number, number, number] | null> {
  const vars = { ...flatten(doc.light), ...(scope === 'dark' ? flatten(doc.dark) : {}) }
  const probe = document.createElement('div')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  for (const [k, v] of Object.entries(vars)) probe.style.setProperty(k, v)
  document.body.appendChild(probe)
  const out: Record<string, [number, number, number] | null> = {}
  for (const n of names) {
    probe.style.color = ''
    probe.style.color = `var(--${n})`
    out[n] = toRgb(getComputedStyle(probe).color)
  }
  probe.remove()
  return out
}
function toRgb(s: string): [number, number, number] | null {
  const m = s.match(/rgba?\(([^)]+)\)/)
  if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2]] }
  const c = s.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/)
  if (c) return [Number(c[1]) * 255, Number(c[2]) * 255, Number(c[3]) * 255]
  return null
}
const lum = ([r, g, b]: number[]) => {
  const f = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export const contrast = (fg: number[], bg: number[]) => { const [x, y] = [lum(fg), lum(bg)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

/** Text-on-background pairs worth checking in this app. */
export const PAIRS = [
  { fg: 'ink', bg: 'page', label: 'Text on page' },
  { fg: 'ink-2', bg: 'surface', label: 'Secondary text on cards' },
  { fg: 'ink-3', bg: 'surface', label: 'Muted text on cards' },
  { fg: 'primary-ink', bg: 'primary', label: 'Primary button label' },
]
