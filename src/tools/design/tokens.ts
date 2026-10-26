/**
 * Design token simulation — try another set of tokens (or another UI library's look)
 * on the real app without touching its code.
 *
 * Format: W3C Design Tokens (DTCG) style. A token is any object with "$value"; groups
 * nest freely. The token's own name (the last key) is the CSS variable it sets, so
 * { "color": { "primary": { "$value": "#6750a4" } } } sets --primary.
 * Top-level keys are where the tokens apply:
 *   light → the classic app in light mode · dark → the classic app in dark mode · v2 → the v2 design
 */
import { APP, readJSON, writeJSON } from '../shared'

export interface Token { $value: string; $type?: string; $description?: string }
export interface TokenTree { [key: string]: TokenTree | Token | string | undefined }
export type Scope = 'light' | 'dark' | 'v2'
export type DesignDoc = Partial<Record<Scope, TokenTree>> & { $description?: string }

export interface Design { doc: DesignDoc; preset: string }

export const SCOPES: Scope[] = ['light', 'dark', 'v2']
const KEY = `${APP}.design`
export const DESIGN_EVENT = `${APP}:design`
export const DESIGN_MESSAGE = `${APP}:design`

const isToken = (v: unknown): v is Token => !!v && typeof v === 'object' && '$value' in (v as object)

/** Every token in a tree, as CSS variable → value. */
export function flatten(tree: TokenTree | undefined, out: Record<string, string> = {}): Record<string, string> {
  if (!tree) return out
  for (const [k, v] of Object.entries(tree)) {
    if (k.startsWith('$')) continue
    if (isToken(v)) out[`--${k}`] = String(v.$value)
    else if (v && typeof v === 'object') flatten(v as TokenTree, out)
  }
  return out
}

const typeOf = (name: string, value: string) => {
  if (/shadow/.test(name)) return 'shadow'
  if (/^(font|mono|serif|sans)$/.test(name)) return 'fontFamily'
  if (/^(r|r-sm|r-lg|radius-.*)$/.test(name)) return 'radius'
  if (/^(#|rgb|hsl|color-mix)/.test(value) || /^var\(/.test(value)) return 'color'
  if (/^-?[\d.]+(px|rem|em|%)$/.test(value)) return 'dimension'
  return 'other'
}
const GROUP: Record<string, string> = { color: 'color', shadow: 'shadow', fontFamily: 'font', radius: 'radius', dimension: 'size', other: 'other' }

/** Builds a token tree from CSS variables, grouped by kind. */
export function treeOf(vars: Record<string, string>): TokenTree {
  const tree: Record<string, Record<string, Token>> = {}
  for (const [name, value] of Object.entries(vars)) {
    const n = name.replace(/^--/, '')
    const t = typeOf(n, value)
    ;(tree[GROUP[t]] ??= {})[n] = { $value: value, $type: t }
  }
  return tree
}

/** The app's own tokens, read from its stylesheets: what the JSON starts from. */
export function baseline(): DesignDoc {
  const found: Record<Scope, Record<string, string>> = { light: {}, dark: {}, v2: {} }
  const take = (rule: CSSStyleRule, scope: Scope) => {
    for (let i = 0; i < rule.style.length; i++) {
      const p = rule.style[i]
      if (p.startsWith('--')) found[scope][p] = rule.style.getPropertyValue(p).trim()
    }
  }
  const walk = (rules: CSSRuleList) => {
    for (const r of Array.from(rules)) {
      if (r instanceof CSSStyleRule) {
        const s = r.selectorText.replace(/\s+/g, '')
        if (s === ':root') take(r, 'light')
        else if (s === ":root[data-theme='dark']" || s === ':root[data-theme="dark"]') take(r, 'dark')
        else if (s === '.v2') take(r, 'v2')
      }
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try { walk(sheet.cssRules) } catch { /* another origin's stylesheet */ }
  }
  return { light: treeOf(found.light), dark: treeOf(found.dark), v2: treeOf(found.v2) }
}

/** Overlays one document on another, token by token. */
export function merge(base: DesignDoc, over: DesignDoc): DesignDoc {
  const out: DesignDoc = {}
  for (const s of SCOPES) {
    const vars = { ...flatten(base[s]), ...flatten(over[s]) }
    if (Object.keys(vars).length) out[s] = treeOf(vars)
  }
  return out
}

/** Tokens in `doc` that differ from `base`, per scope. */
export function changes(base: DesignDoc, doc: DesignDoc) {
  const out: { scope: Scope; name: string; from?: string; to: string }[] = []
  for (const s of SCOPES) {
    const a = flatten(base[s]), b = flatten(doc[s])
    for (const [k, v] of Object.entries(b)) if (a[k] !== v) out.push({ scope: s, name: k, from: a[k], to: v })
  }
  return out
}

/** Checks a pasted document; returns the problem in plain words, or null. */
export function validate(text: string): { doc?: DesignDoc; error?: string } {
  let raw: unknown
  try { raw = JSON.parse(text) } catch (e) { return { error: `Not valid JSON: ${(e as Error).message}` } }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: 'The top level must be an object with light, dark and/or v2.' }
  const keys = Object.keys(raw).filter((k) => !k.startsWith('$'))
  const bad = keys.filter((k) => !SCOPES.includes(k as Scope))
  if (bad.length) return { error: `Unknown top-level key${bad.length > 1 ? 's' : ''}: ${bad.join(', ')}. Use light, dark or v2.` }
  for (const s of keys) {
    for (const [name, value] of Object.entries(flatten((raw as DesignDoc)[s as Scope]))) {
      if (!/^--[a-zA-Z0-9-]+$/.test(name)) return { error: `“${name.slice(2)}” can’t be a CSS variable name.` }
      if (/[;{}]/.test(value)) return { error: `The value of ${name} contains ; { or }.` }
    }
  }
  return { doc: raw as DesignDoc }
}

const block = (sel: string, vars: Record<string, string>) =>
  Object.keys(vars).length ? `${sel}{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')}}` : ''

/** CSS that applies the document's tokens on top of the app's own. Light and dark follow the app's theme rules. */
export function toCss(doc: DesignDoc, base: DesignDoc = {}): string {
  const diff = (s: Scope) => {
    const a = flatten(base[s]), b = flatten(doc[s])
    return Object.fromEntries(Object.entries(b).filter(([k, v]) => a[k] !== v))
  }
  const dark = diff('dark'), v2 = diff('v2')
  // A light token that dark mode doesn't redefine (radius, fonts…) applies in both modes.
  const themed = new Set([...Object.keys(flatten(base.dark)), ...Object.keys(flatten(doc.dark))])
  const lightAll = diff('light')
  const both = Object.fromEntries(Object.entries(lightAll).filter(([k]) => !themed.has(k)))
  const light = Object.fromEntries(Object.entries(lightAll).filter(([k]) => themed.has(k)))
  return [
    block('html:root', both),
    block("html:root[data-theme='light']", light),
    Object.keys(light).length ? `@media (prefers-color-scheme: light){${block("html:root:not([data-theme='dark'])", light)}}` : '',
    block("html:root[data-theme='dark']", dark),
    Object.keys(dark).length ? `@media (prefers-color-scheme: dark){${block("html:root:not([data-theme='light'])", dark)}}` : '',
    block('.v2.v2', v2),
  ].join('\n')
}

/* ---------- the variant this browser shows ---------- */

export const loadDesign = (): Design | null => readJSON<Design | null>(KEY, null)
export function saveDesign(d: Design | null) {
  if (d) writeJSON(KEY, d)
  else { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }
  window.dispatchEvent(new Event(DESIGN_EVENT))
}
