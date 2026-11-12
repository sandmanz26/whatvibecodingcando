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

/* ---------- the published file: no site names in public ---------- */

/** SHA-256 of a string, as hex. Synchronous (it runs while the script decides whether to show), and small. */
export function sha256Hex(text: string): string {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2])
  const bytes = new TextEncoder().encode(text)
  const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6
  const m = new Uint8Array(total); m.set(bytes); m[len] = 0x80
  const bits = len * 8
  m[total - 4] = (bits >>> 24) & 255; m[total - 3] = (bits >>> 16) & 255; m[total - 2] = (bits >>> 8) & 255; m[total - 1] = bits & 255
  m[total - 5] = Math.floor(bits / 2 ** 32) & 255
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19])
  const W = new Uint32Array(64)
  const r = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = (m[o + i * 4] << 24) | (m[o + i * 4 + 1] << 16) | (m[o + i * 4 + 2] << 8) | m[o + i * 4 + 3]
    for (let i = 16; i < 64; i++) {
      const a = W[i - 15], b = W[i - 2]
      W[i] = (W[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + W[i - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0
      const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h
  }
  return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('')
}
/** A site's name as the public file carries it: a hash, keyed by the project so one name gives a different hash in every project. */
export const hostKey = (project: string, host: string) => `#${sha256Hex(`vibe-collab:${project}:${host.trim().toLowerCase()}`)}`
const HASHED = /^#[0-9a-f]{64}$/

/**
 * The settings as the public file on the CDN carries them: exact site names become hashes and
 * environment names are left out, so the file doesn't list a project's sites (staging and preview
 * hosts included). A pattern with * stays as it is: the script has to match it, and a pattern names
 * no single site. The database keeps the full settings for the panel and the server's checks.
 */
export function publicConfig(project: string, c: WidgetConfig): WidgetConfig {
  return { ...c, envs: c.envs.map((e, i) => ({ id: `e${i + 1}`, name: '', on: e.on, host: e.host.includes('*') || HASHED.test(e.host) ? e.host : hostKey(project, e.host) })) }
}

export const envFor = (c: WidgetConfig, host: string, project = '') => c.envs.find((e) => (HASHED.test(e.host) ? !!project && e.host === hostKey(project, host) : hostMatches(e.host, host))) ?? null

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
    if (!HASHED.test(e.host) && hostProblem(e.host)) return null
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
