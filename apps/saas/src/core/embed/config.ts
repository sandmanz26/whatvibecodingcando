/**
 * The widget's configuration: what a project's widget shows, to whom, where and how it looks.
 *
 * Customers build it in the panel (Widget), preview it as a draft on a site, and publish it. The
 * snippet on their site never changes: the script reads the published configuration when it starts.
 * A configuration is data only, never code: every field is checked here, anything unknown is
 * dropped, and an invalid configuration is refused as a whole (the widget then stays off).
 *
 * Where it comes from goes through a ConfigSource. Today there is LocalConfigSource, a stand-in for
 * the configuration endpoint: the panel writes to this browser's storage and the script reads it,
 * which works where both run on one origin (the hosted demo site). A server replaces it with the
 * same calls, served from the edge.
 */
import { NS } from './store'

export const CONFIG_VERSION = 1

/** Where the widget may run. `host` is a host name, `*.example.com`, or a pattern like `shop-git-*.vercel.app`. */
export interface Env { id: string; name: string; host: string; on: boolean }
export type Audience = 'reviewers' | 'everyone'
/** The products the script runs, one switch each. Comments is always present; the others only when on. */
export const SCRIPT_MODULES = ['comments', 'inspect', 'dscheck', 'tokens'] as const
export type ModuleId = typeof SCRIPT_MODULES[number]
export type Modules = { comments: boolean } & Partial<Record<Exclude<ModuleId, 'comments'>, true>>
/** Modules in one canonical form (extras listed only when on), so two configurations compare as data. */
export function modulesOf(on: (id: ModuleId) => boolean): Modules {
  const m: Modules = { comments: on('comments') }
  for (const id of SCRIPT_MODULES) if (id !== 'comments' && on(id)) m[id] = true
  return m
}
export const anyModule = (m: Modules) => SCRIPT_MODULES.some((id) => !!m[id])
export interface WidgetConfig {
  v: 1
  /** the project's off switch: false and the widget shows nowhere */
  on: boolean
  modules: Modules
  theme: { accent: string; mode: 'light' | 'dark' }
  launcher: { kind: 'floating' | 'hidden'; position: 'right' | 'left'; label: string; shortcut: boolean }
  /** reviewers: only people opened in through a review link; everyone: every visitor */
  audience: Audience
  envs: Env[]
}
export interface Release { version: number; config: WidgetConfig; at: string; by: string }

export const DEFAULT_CONFIG: WidgetConfig = {
  v: 1, on: true, modules: { comments: true },
  theme: { accent: '#e8590c', mode: 'light' },
  launcher: { kind: 'floating', position: 'right', label: 'Comment', shortcut: true },
  audience: 'reviewers', envs: [],
}

export const MAX_ENVS = 10
export const MAX_LABEL = 24
const HOST_PART = /^(?:\*|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?|[a-z0-9-]*\*[a-z0-9-]*)$/

/** What's wrong with an environment's host pattern, or ''. A bare "*" or "*.vercel.app"-wide patterns are refused. */
export function hostProblem(host: string): string {
  const h = host.trim().toLowerCase()
  if (!h) return 'Enter a host name.'
  if (/^https?:\/\//.test(h) || h.includes('/')) return 'Just the host name, without https:// or a path.'
  if (h === 'localhost' || /^localhost:\d{2,5}$/.test(h)) return ''
  const parts = h.split('.')
  if (parts.length < 2 || !parts.every((p) => HOST_PART.test(p))) return 'That isn’t a host name like staging.example.com.'
  if (parts.filter((p) => p.includes('*')).length > 1) return 'Use at most one *.'
  const fixed = parts.filter((p) => !p.includes('*'))
  // "*.com", "*.vercel.app", "*.netlify.app" would cover other people's sites too.
  const shared = ['vercel.app', 'netlify.app', 'pages.dev', 'github.io', 'web.app', 'onrender.com', 'herokuapp.com', 'fly.dev', 'lovable.app']
  if (fixed.length < 2 || (parts[0] === '*' && shared.includes(fixed.join('.')))) return 'Too wide: it would match other people’s sites. Add your project’s own part, like shop-git-*.vercel.app.'
  return ''
}

/** Does a page's host match an environment's pattern? `*` stands for any run of letters, digits and dashes within one label. */
export function hostMatches(pattern: string, host: string): boolean {
  const p = pattern.trim().toLowerCase(), h = host.toLowerCase()
  if (!p.includes('*')) return p === h
  const re = new RegExp(`^${p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9-]*')}$`)
  // "*.example.com" also covers the bare example.com.
  return re.test(h) || (p.startsWith('*.') && h === p.slice(2))
}

export const envFor = (c: WidgetConfig, host: string) => c.envs.find((e) => hostMatches(e.host, host)) ?? null

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
/** A configuration from storage or the network, checked field by field. Null when it can't be trusted. */
export function parseConfig(v: unknown): WidgetConfig | null {
  if (!isObj(v) || v.v !== CONFIG_VERSION) return null
  const { modules, theme, launcher, envs } = v
  if (!isObj(modules) || !isObj(theme) || !isObj(launcher) || !Array.isArray(envs) || envs.length > MAX_ENVS) return null
  const accent = typeof theme.accent === 'string' && /^#[0-9a-f]{6}$/i.test(theme.accent) ? theme.accent : null
  const label = typeof launcher.label === 'string' ? launcher.label.replace(/[\u0000-\u001f]/g, '').trim().slice(0, MAX_LABEL) : null
  if (!accent || label === null) return null
  const outEnvs: Env[] = []
  for (const e of envs) {
    if (!isObj(e) || typeof e.id !== 'string' || typeof e.name !== 'string' || typeof e.host !== 'string' || typeof e.on !== 'boolean') return null
    if (hostProblem(e.host)) return null
    outEnvs.push({ id: e.id.slice(0, 32), name: e.name.slice(0, 40), host: e.host.trim().toLowerCase(), on: e.on })
  }
  if (typeof v.on !== 'boolean' || typeof modules.comments !== 'boolean') return null
  return {
    v: 1, on: v.on, modules: modulesOf((id) => modules[id] === true),
    theme: { accent, mode: theme.mode === 'dark' ? 'dark' : 'light' },
    launcher: { kind: launcher.kind === 'hidden' ? 'hidden' : 'floating', position: launcher.position === 'left' ? 'left' : 'right', label: label || 'Comment', shortcut: launcher.shortcut !== false },
    audience: v.audience === 'everyone' ? 'everyone' : 'reviewers',
    envs: outEnvs,
  }
}

export const sameConfig = (a: WidgetConfig | null | undefined, b: WidgetConfig | null | undefined) => JSON.stringify(a) === JSON.stringify(b)

/* ---------- where the script gets it: the stand-in for the configuration endpoint ---------- */

/** `gone`: the project was deleted; its snippet, if still on a site, shows nothing. */
export interface Served { live: Release | null; draft: WidgetConfig | null; gone?: boolean }
export interface ReviewerSession { project: string; exp: number; preview: boolean }

export interface ConfigSource {
  get(project: string): Served
  subscribe(project: string, cb: () => void): () => void
  /** Trades a one-time review token (from a review link) for a reviewer session, or null. */
  redeem(project: string, token: string): ReviewerSession | null
}

const configKey = (p: string) => `${NS}config:${p}`
const handoffKey = (t: string) => `${NS}handoff:${t}`
const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); return true } catch { return false } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}
const parseRelease = (v: unknown): Release | null => {
  if (!isObj(v) || typeof v.version !== 'number' || typeof v.at !== 'string') return null
  const config = parseConfig(v.config)
  return config ? { version: v.version, config, at: v.at, by: typeof v.by === 'string' ? v.by.slice(0, 80) : '' } : null
}

export class LocalConfigSource implements ConfigSource {
  get(project: string): Served {
    try {
      const raw = JSON.parse(ls.get(configKey(project)) ?? 'null')
      if (!isObj(raw)) return { live: null, draft: null }
      if (raw.gone === true) return { live: null, draft: null, gone: true }
      return { live: parseRelease(raw.live), draft: parseConfig(raw.draft) }
    } catch { return { live: null, draft: null } }
  }
  subscribe(project: string, cb: () => void) {
    const on = (e: StorageEvent) => { if (e.key === configKey(project)) cb() }
    window.addEventListener('storage', on)
    return () => window.removeEventListener('storage', on)
  }
  redeem(project: string, token: string): ReviewerSession | null {
    if (!/^[0-9a-f]{32,64}$/.test(token)) return null
    const key = handoffKey(token)
    let h: unknown = null
    try { h = JSON.parse(ls.get(key) ?? 'null') } catch { /* ignore */ }
    ls.del(key) // one use, whatever happens
    if (!isObj(h) || h.project !== project || typeof h.exp !== 'number' || h.exp < Date.now()) return null
    return { project, exp: Date.now() + REVIEW_HOURS * 3600_000, preview: h.preview === true }
  }
}

export const REVIEW_HOURS = 8
export const HANDOFF_SECONDS = 120

/* ---------- the panel's side of the stand-in (what the server will do) ---------- */

export function serve(project: string, s: Served): boolean {
  return ls.set(configKey(project), JSON.stringify({ live: s.live, draft: s.draft }))
}
/** The project was deleted: its snippet, wherever it still is, shows nothing from now on. */
export function unserve(project: string) { ls.set(configKey(project), JSON.stringify({ gone: true })) }
/** A one-time review token for a project, valid for two minutes: the panel puts it in the review link. */
export function newHandoff(project: string, preview = false): string | null {
  const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')
  return ls.set(handoffKey(token), JSON.stringify({ project, exp: Date.now() + HANDOFF_SECONDS * 1000, preview })) ? token : null
}

/* ---------- what the script reports about itself (the stand-in for the install check) ---------- */

export interface Seen { at: string; host: string; page: string; version: string; shown: boolean; why: string }
const seenKey = (p: string) => `${NS}seen:${p}`
export function reportSeen(project: string, s: Seen) { ls.set(seenKey(project), JSON.stringify(s)) }
export function lastSeen(project: string): Seen | null {
  try {
    const v = JSON.parse(ls.get(seenKey(project)) ?? 'null')
    return isObj(v) && typeof v.at === 'string' && typeof v.host === 'string' ? (v as unknown as Seen) : null
  } catch { return null }
}
