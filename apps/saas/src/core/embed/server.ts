/**
 * The script's connection to the server (the project's Supabase), when the build has one.
 *
 * Kept small on purpose: plain fetch, no client library, because it runs on customers' sites.
 *   - Settings: the published file widget-config/<project>.json on Storage (CDN). Page views never
 *     reach the database. Cached in this browser for a few minutes.
 *   - Reviewers: an anonymous Supabase session for this browser, made only when someone opens a
 *     review link (or comments where the widget is open to everyone). Plain visitors never sign in.
 *   - Comments: database functions (supabase/migrations/…_reviewers.sql) that check the site's
 *     origin, the reviewer and rate limits. The script never reads or writes tables directly.
 */
import { NS, type Backend, type Thread } from './store'
import { parseConfig, type Release, type WidgetConfig } from './config'

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? ''
export const hasServer = !!(URL_ && KEY)
export const serverUrl = URL_
export const serverKey = KEY

const ls = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* ignore */ } },
  del: (k: string) => { try { localStorage.removeItem(k) } catch { /* ignore */ } },
}

/* ---------- settings from the CDN ---------- */

export interface ServedFile { live: Release | null; gone: boolean }
const CFG_TTL = 5 * 60_000
const cfgKey = (p: string) => `${NS}cfg:${p}`

/** The project's published settings. From this browser's cache when fresh (fresh: under five minutes). */
export async function fetchSettings(project: string, fresh = false): Promise<ServedFile> {
  if (!fresh) {
    try {
      const c = JSON.parse(ls.get(cfgKey(project)) ?? 'null') as { at: number; body: unknown } | null
      if (c && Date.now() - c.at < CFG_TTL) return readFile(c.body)
    } catch { /* refetch */ }
  }
  try {
    const r = await fetch(`${URL_}/storage/v1/object/public/widget-config/${encodeURIComponent(project)}.json`, { cache: fresh ? 'no-cache' : 'default' })
    if (r.status === 400 || r.status === 404) { ls.set(cfgKey(project), JSON.stringify({ at: Date.now(), body: null })); return { live: null, gone: false } }
    if (!r.ok) throw new Error(String(r.status))
    const body = await r.json()
    ls.set(cfgKey(project), JSON.stringify({ at: Date.now(), body }))
    return readFile(body)
  } catch {
    // The CDN can't be reached: use what this browser had, however old; else show nothing.
    try { return readFile((JSON.parse(ls.get(cfgKey(project)) ?? 'null') as { body: unknown } | null)?.body) } catch { return { live: null, gone: false } }
  }
}
function readFile(body: unknown): ServedFile {
  const b = body as { gone?: boolean; release?: { version?: number; config?: unknown; at?: string; by?: string } } | null
  if (!b) return { live: null, gone: false }
  if (b.gone === true) return { live: null, gone: true }
  const config = parseConfig(b.release?.config)
  if (!config || typeof b.release?.version !== 'number') return { live: null, gone: false }
  return { live: { version: b.release.version, config, at: b.release.at ?? '', by: '' }, gone: false }
}

/* ---------- the reviewer's session ---------- */

/**
 * Where the session lives. Preferably in our session frame (frame.ts, /embed/session.html beside the
 * script): it signs up (with CAPTCHA when that is on), keeps the refresh token on our domain, and
 * gives this page only the short-lived access token. When the frame can't load (a site's
 * Content-Security-Policy without our domain in frame-src, an old browser), this page keeps the
 * session itself, as before.
 */
interface Session { access_token: string; refresh_token?: string; expires_at: number }
const AUTH_KEY = `${NS}auth`
const HINT_KEY = `${NS}auth-frame`
let session: Session | null = (() => { try { return JSON.parse(ls.get(AUTH_KEY) ?? 'null') } catch { return null } })()
let hinted = ls.get(HINT_KEY) === '1'
const saveSession = (s: Session | null) => { session = s; if (s) ls.set(AUTH_KEY, JSON.stringify(s)); else ls.del(AUTH_KEY) }

let frameUrl = ''
/** The session frame sits beside the script: https://<where vibe.js is served>/embed/session.html. */
export function useFrame(scriptSrc: string) { try { frameUrl = new URL('session.html', scriptSrc).href } catch { frameUrl = '' } }

type FrameReply = { id: number; ok: boolean; access_token?: string; expires_at?: number; refresh_token?: string; error?: string }
let frame: Promise<{ win: Window; origin: string } | null> | null = null
const pending = new Map<number, (d: FrameReply) => void>()
let seq = 0
function openFrame() {
  if (!frameUrl) return Promise.resolve(null)
  frame ??= new Promise((resolve) => {
    const origin = new URL(frameUrl).origin
    const holder = document.createElement('vibe-collab-session')
    holder.style.setProperty('all', 'initial', 'important')
    const root = holder.attachShadow({ mode: 'closed' })
    const style = document.createElement('style')
    style.textContent = `iframe{position:fixed;width:1px;height:1px;opacity:0;border:0;pointer-events:none;left:0;top:0}
      iframe.show{opacity:1;pointer-events:auto;width:340px;height:150px;left:50%;top:50%;transform:translate(-50%,-50%);z-index:2147483647;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.3);background:#fff}`
    const f = document.createElement('iframe')
    f.src = frameUrl
    f.title = 'Vibe Collab sign-in'
    f.setAttribute('aria-hidden', 'true')
    f.setAttribute('tabindex', '-1')
    const fail = window.setTimeout(() => resolve(null), 6000)
    window.addEventListener('message', (e) => {
      if (e.source !== f.contentWindow || e.origin !== origin || !e.data || e.data.vc !== 1) return
      const d = e.data as FrameReply & { op?: string }
      if (d.op === 'ready') { window.clearTimeout(fail); resolve({ win: f.contentWindow!, origin }) }
      else if (d.op === 'show') { f.classList.add('show'); f.removeAttribute('aria-hidden'); f.removeAttribute('tabindex') }
      else if (d.op === 'hide') { f.classList.remove('show'); f.setAttribute('aria-hidden', 'true'); f.setAttribute('tabindex', '-1') }
      else if (typeof d.id === 'number') pending.get(d.id)?.(d)
    })
    root.append(style, f)
    document.documentElement.appendChild(holder)
  })
  return frame
}
/** The session from the frame: a session, null (none, and none made), or 'none' when there is no frame. */
async function fromFrame(create: boolean): Promise<Session | null | 'none'> {
  const fr = await openFrame()
  if (!fr) return 'none'
  const id = ++seq
  const d = await new Promise<FrameReply>((res) => {
    pending.set(id, res)
    // A session this page kept before moves into the frame, and leaves this page.
    fr.win.postMessage({ vc: 1, op: 'session', id, create, migrate: session?.refresh_token }, fr.origin)
    window.setTimeout(() => res({ id, ok: false, error: 'timeout' }), create ? 150_000 : 20_000)
  })
  pending.delete(id)
  if (!d.ok) throw new ServerError(d.error ?? 'sign_in_failed')
  if (!d.access_token) return null
  return { access_token: d.access_token, expires_at: d.expires_at ?? Math.floor(Date.now() / 1000) + 3600, refresh_token: d.refresh_token }
}

async function auth(path: string, body: unknown): Promise<Session> {
  const r = await fetch(`${URL_}/auth/v1/${path}`, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) {
    const msg = String(j.msg ?? j.message ?? j.error_description ?? r.status)
    throw new ServerError(/anonymous/i.test(msg) ? 'anonymous_disabled' : /captcha/i.test(msg) ? 'captcha_blocked' : msg)
  }
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: j.expires_at ?? Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600) }
}
/** A session for this browser: the saved one (refreshed when near expiry), or a new anonymous one. */
async function ensureSession(create: boolean): Promise<Session | null> {
  if (session && session.expires_at * 1000 - Date.now() > 60_000) return session
  if (!create && !session && !hinted) return null
  const got = await fromFrame(create)
  if (got !== 'none') {
    session = got
    hinted = !!got
    if (got) ls.set(HINT_KEY, '1'); else ls.del(HINT_KEY)
    // Kept by this page only when the frame can't keep it (no storage there).
    if (got?.refresh_token) ls.set(AUTH_KEY, JSON.stringify(got)); else ls.del(AUTH_KEY)
    return session
  }
  // No frame: this page keeps the session.
  if (session?.refresh_token) {
    try { saveSession(await auth('token?grant_type=refresh_token', { refresh_token: session.refresh_token })); return session } catch { saveSession(null) }
  }
  if (!create) return null
  saveSession(await auth('signup', { data: {} }))
  return session
}
export const hasSession = () => !!session || hinted

export class ServerError extends Error {}
/** Calls a database function as this browser's reviewer (or anonymously, for the installation check). */
export async function rpc<T>(fn: string, args: Record<string, unknown>, opts: { signIn?: boolean; anon?: boolean } = {}): Promise<T> {
  const s = opts.anon ? null : await ensureSession(!!opts.signIn)
  if (!opts.anon && !s) throw new ServerError('not_invited')
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${s?.access_token ?? KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (r.status === 204) return undefined as T
  const j = await r.json().catch(() => null)
  if (!r.ok) throw new ServerError(String((j as { message?: string } | null)?.message ?? r.status))
  return j as T
}

/**
 * The last call of a page that is closing (events not sent yet): sent with keepalive so it survives
 * the navigation, with the session this page already has (nothing can be awaited any more).
 */
export function rpcOnLeave(fn: string, args: Record<string, unknown>) {
  if (!session) return
  try {
    void fetch(`${URL_}/rest/v1/rpc/${fn}`, {
      method: 'POST', keepalive: true,
      headers: { apikey: KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    }).catch(() => { /* lost: at most a few clicks */ })
  } catch { /* ignore */ }
}

/* ---------- reviewer state ---------- */

export interface ReviewStart { name: string; preview: boolean; draft: unknown }
const rvKey = (p: string) => `${NS}reviewer:${p}`
/** Does this browser review the project? (Checked against the server when the widget starts.) */
export const isReviewer = (project: string) => (!!session || hinted) && ls.get(rvKey(project)) !== null
export const reviewerName = (project: string) => ls.get(rvKey(project)) ?? ''

/** Becomes a reviewer: with a review link's token, or without one to check that this browser still is. */
/** Why the last review link didn't work (shown to that reviewer), or null. */
let linkError: string | null = null
export const reviewLinkError = () => linkError

export async function startReview(project: string, token: string | null, name?: string, signIn = false): Promise<ReviewStart | null> {
  try {
    const r = await rpc<ReviewStart>('start_review', { p_public_id: project, p_token: token, p_name: name ?? null }, { signIn: signIn || !!token })
    ls.set(rvKey(project), r.name)
    if (token) linkError = null
    return r
  } catch (e) {
    const m = (e as Error).message
    if (token) linkError = m
    if (m === 'not_invited' || m === 'link_expired' || m === 'no_project') ls.del(rvKey(project))
    if (m === 'anonymous_disabled') console.warn('[Vibe Collab] the project’s server doesn’t allow reviewer sessions yet (Supabase → Authentication → Sign In / Providers → allow anonymous sign-ins).')
    else if (token) console.warn(`[Vibe Collab] the review link didn’t work: ${m}.`)
    return null
  }
}

export const getDraft = async (project: string): Promise<WidgetConfig | null> => {
  try { return parseConfig(await rpc<unknown>('get_draft', { p_public_id: project })) } catch { return null }
}

/** The installation check: sampled, so plain page views barely reach the server. */
export function reportSeen(project: string, version: string, shown: boolean, why: string) {
  const key = `${NS}seen-at:${project}`
  const last = Number(ls.get(key) ?? 0)
  const every = shown ? 3600_000 : 86_400_000
  if (Date.now() - last < every) return
  if (!shown && Math.random() > 0.05) { ls.set(key, String(Date.now())); return }
  ls.set(key, String(Date.now()))
  void rpc('report_seen', { p_public_id: project, p_version: version, p_shown: shown, p_why: why.slice(0, 200) }, { anon: true }).catch(() => { /* best effort */ })
}

/* ---------- comments ---------- */

interface ServerThread extends Omit<Thread, 'resolved' | 'replies'> {
  mine: boolean
  resolved: { by: string; at: string } | null
  replies: { id: string; author: string; text: string; at: string; mine: boolean }[]
}
const toThread = (t: ServerThread): Thread => ({
  id: t.id, page: t.page, anchor: t.anchor, author: t.author, text: t.text, createdAt: t.createdAt,
  ...(t.editedAt ? { editedAt: t.editedAt } : {}), ...(t.resolved ? { resolved: t.resolved } : {}),
  replies: t.replies.map((r) => ({ id: r.id, author: r.author, text: r.text, at: r.at, mine: r.mine })),
  mine: t.mine,
})
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Comments on the server, behind the same Backend interface the widget always used. */
export class ServerBackend implements Backend {
  readonly where = 'Saved on Vibe Collab'
  private last = new Map<string, Thread>()
  constructor(private project: string) {}
  async list() {
    const rows = await rpc<ServerThread[]>('list_threads', { p_public_id: this.project })
    const list = rows.map(toThread)
    this.last = new Map(list.map((t) => [t.id, t]))
    return list
  }
  /** The widget hands over the whole thread; what changed since the last list is sent. */
  async upsert(t: Thread) {
    const before = this.last.get(t.id)
    let now: ServerThread | null = null
    if (!before) {
      now = await rpc<ServerThread>('post_thread', { p_public_id: this.project, p_page: t.page, p_anchor: t.anchor, p_text: t.text, p_id: UUID.test(t.id) ? t.id : null })
    } else {
      if (t.text !== before.text) now = await rpc('edit_thread', { p_thread: t.id, p_text: t.text })
      if (!!t.resolved !== !!before.resolved) now = await rpc('set_resolved', { p_thread: t.id, p_resolved: !!t.resolved })
      const had = new Set(before.replies.map((r) => r.id))
      for (const r of t.replies) if (!had.has(r.id)) now = await rpc('post_reply', { p_thread: t.id, p_text: r.text, p_id: UUID.test(r.id) ? r.id : null })
      const has = new Set(t.replies.map((r) => r.id))
      for (const r of before.replies) if (!has.has(r.id)) now = await rpc('delete_reply', { p_reply: r.id })
    }
    if (now) this.last.set(now.id, toThread(now))
  }
  async remove(id: string) {
    await rpc('delete_thread', { p_thread: id })
    this.last.delete(id)
  }
  /** Others' changes: checked every 15 s while the tab is in view (a reviewer's tab only). */
  subscribe(cb: () => void) {
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') cb() }, 15_000)
    const vis = () => { if (document.visibilityState === 'visible') cb() }
    document.addEventListener('visibilitychange', vis)
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', vis) }
  }
  setName(name: string) { void rpc('set_reviewer_name', { p_public_id: this.project, p_name: name }).catch(() => { /* keeps the old name */ }) }
}
