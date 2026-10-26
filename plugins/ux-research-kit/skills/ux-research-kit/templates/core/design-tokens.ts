/**
 * Design token simulation — try another set of tokens (or another UI library's look)
 * on the real app without touching its code.
 *
 * Format: W3C Design Tokens (DTCG) style. A token is any object with "$value"; groups
 * nest freely. The token's own name (the last key) is the CSS variable it sets, so
 * { "color": { "primary": { "$value": "#6750a4" } } } sets --primary.
 * Top-level keys are where the tokens apply. Configure SCOPES for the project, e.g.
 *   light → :root in light mode · dark → :root in dark mode · plus any themed area by selector.
 */
import type { ResearchConfig } from './config'
import { readJSON, removeKey, writeJSON } from './storage'

export interface Token { $value: string; $type?: string; $description?: string }
export interface TokenTree { [key: string]: TokenTree | Token | string | undefined }
/**
 * Where tokens apply. 'light' and 'dark' follow the project's theme switch; adjust THEME_ATTR to
 * how the project marks dark mode (e.g. data-theme="dark" or class="dark"). Extra scopes map to
 * a selector whose element redefines variables (e.g. a second design living under ".v2").
 */
export type Scope = string
export const THEME_ATTR = { name: 'data-theme', light: 'light', dark: 'dark' }
export const EXTRA_SCOPES: Record<string, string> = {}
export const SCOPES: Scope[] = ['light', 'dark', ...Object.keys(EXTRA_SCOPES)]
export type DesignDoc = Partial<Record<Scope, TokenTree>> & { $description?: string }

export interface Design { doc: DesignDoc; preset: string }

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
  const found: Record<Scope, Record<string, string>> = Object.fromEntries(SCOPES.map((s) => [s, {}]))
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
        else if (s === `:root[${THEME_ATTR.name}='${THEME_ATTR.dark}']` || s === `:root[${THEME_ATTR.name}="${THEME_ATTR.dark}"]` || s === '.dark' || s === ':root.dark') take(r, 'dark')
        else for (const [scope, sel] of Object.entries(EXTRA_SCOPES)) if (s === sel) take(r, scope)
      }
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try { walk(sheet.cssRules) } catch { /* another origin's stylesheet */ }
  }
  return Object.fromEntries(SCOPES.map((s) => [s, treeOf(found[s])]))
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
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { error: `The top level must be an object with ${SCOPES.join(', ')}.` }
  const keys = Object.keys(raw).filter((k) => !k.startsWith('$'))
  const bad = keys.filter((k) => !SCOPES.includes(k as Scope))
  if (bad.length) return { error: `Unknown top-level key${bad.length > 1 ? 's' : ''}: ${bad.join(', ')}. Use ${SCOPES.join(', ')}.` }
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
  const dark = diff('dark')
  // A light token that dark mode doesn't redefine (radius, fonts…) applies in both modes.
  const themed = new Set([...Object.keys(flatten(base.dark)), ...Object.keys(flatten(doc.dark))])
  const lightAll = diff('light')
  const both = Object.fromEntries(Object.entries(lightAll).filter(([k]) => !themed.has(k)))
  const light = Object.fromEntries(Object.entries(lightAll).filter(([k]) => themed.has(k)))
  const A = THEME_ATTR
  return [
    block('html:root', both),
    block(`html:root[${A.name}='${A.light}']`, light),
    Object.keys(light).length ? `@media (prefers-color-scheme: light){${block(`html:root:not([${A.name}='${A.dark}'])`, light)}}` : '',
    block(`html:root[${A.name}='${A.dark}'], html:root.dark`, dark),
    Object.keys(dark).length ? `@media (prefers-color-scheme: dark){${block(`html:root:not([${A.name}='${A.light}'])`, dark)}}` : '',
    ...Object.entries(EXTRA_SCOPES).map(([scope, sel]) => block(`${sel}${sel}`, diff(scope))),
  ].join('\n')
}

/* ---------- the variant this browser shows ---------- */

const key = (cfg: ResearchConfig) => `${cfg.app}.design`
export const designEvent = (cfg: ResearchConfig) => `${cfg.app}:design`
/** postMessage type a research console uses to preview a design inside an iframe of the app */
export const designMessage = (cfg: ResearchConfig) => `${cfg.app}:design`

export const loadDesign = (cfg: ResearchConfig): Design | null => readJSON<Design | null>(key(cfg), null)
export function saveDesign(cfg: ResearchConfig, d: Design | null) {
  if (d) writeJSON(key(cfg), d); else removeKey(key(cfg))
  window.dispatchEvent(new Event(designEvent(cfg)))
}

/**
 * Applies the saved design (and in an iframe, whatever the parent previews). `presetCss(id)`
 * returns the component rules for a UI-library look (see reference/ui-presets.md).
 */
export function installDesignLayer(cfg: ResearchConfig, presetCss: (id: string) => string = () => '') {
  let base: DesignDoc | null = null
  let current = loadDesign(cfg)
  const apply = () => {
    let el = document.getElementById('research-design') as HTMLStyleElement | null
    if (!current) { el?.remove(); delete document.documentElement.dataset.uilib; return }
    base ??= baseline()
    if (!el) { el = document.createElement('style'); el.id = 'research-design'; document.head.appendChild(el) }
    el.textContent = `${toCss(current.doc, base)}\n${presetCss(current.preset)}`
    if (current.preset && current.preset !== 'default') document.documentElement.dataset.uilib = current.preset
    else delete document.documentElement.dataset.uilib
  }
  const sync = () => { current = loadDesign(cfg); apply() }
  const onMsg = (e: MessageEvent) => {
    if (e.origin !== window.location.origin || e.source !== window.parent || e.data?.type !== designMessage(cfg)) return
    current = e.data.design ?? null
    apply()
  }
  window.addEventListener(designEvent(cfg), sync)
  window.addEventListener('storage', sync)
  window.addEventListener('message', onMsg)
  if (window.self !== window.top) window.parent.postMessage({ type: `${designMessage(cfg)}:ready` }, window.location.origin)
  apply()
  return () => { window.removeEventListener(designEvent(cfg), sync); window.removeEventListener('storage', sync); window.removeEventListener('message', onMsg) }
}
