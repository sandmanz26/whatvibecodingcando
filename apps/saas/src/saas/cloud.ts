/**
 * The panel's data on Supabase. The panel keeps working with the same SaasState it uses in the
 * browser-only demo; here that state is loaded from the database after signing in, and every
 * change the panel makes is written back as the difference from the previous state.
 *
 * What lives where (see supabase/migrations):
 *   account         Supabase Auth (name and "onboarded" in the user's metadata)
 *   workspace       workspaces / workspace_members (one per account in this beta)
 *   projects        projects (draft widget settings in projects.draft)
 *   releases        releases, plus the published file widget-config/<project>.json on Storage
 *   invites         invites (no email is sent yet)
 * Row level security on the server decides what is allowed; nothing here is trusted by it.
 */
import { supabase } from './supabase'
import { parseConfig, publicConfig, type Release, type Seen } from '../core/embed/config'
import type { Backend, Thread } from '../core/embed/store'
import type { Stats, SharedList, ShareRow } from './stats'
import type { Invite, Project, SaasState } from './account'

const BUCKET = 'widget-config'
/** The project's database id, by its public id (the snippet's data-project). */
const dbIds = new Map<string, string>()
let workspaceId: string | null = null

const EMPTY: SaasState = { account: null, projects: [], current: null, invites: [] }

/** Everything the panel shows, for the signed-in user. Null when nobody is signed in. */
export async function loadCloud(prevCurrent: string | null): Promise<SaasState | null> {
  if (!supabase) return null
  const { data: u } = await supabase.auth.getUser()
  const user = u.user
  if (!user) { dbIds.clear(); workspaceId = null; return null }
  const meta = (user.user_metadata ?? {}) as { name?: string; onboarded?: boolean }
  const account = { name: (meta.name || user.email?.split('@')[0] || 'You').slice(0, 40), email: user.email ?? '', createdAt: user.created_at }

  const { data: ws, error: wsErr } = await supabase.from('workspaces').select('id').order('created_at').limit(1)
  if (wsErr) throw wsErr
  workspaceId = ws?.[0]?.id ?? null
  if (!workspaceId) return { ...EMPTY, account, signedIn: true, onboarded: false }

  const { data: rows, error } = await supabase.from('projects')
    .select('id, public_id, name, site_url, products, draft, created_at, releases(version, config, created_at, created_by)')
    .eq('workspace_id', workspaceId).is('deleted_at', null).order('created_at')
  if (error) throw error
  dbIds.clear()
  const projects: Project[] = (rows ?? []).map((r) => {
    dbIds.set(r.public_id, r.id)
    const releases: Release[] = ((r.releases as { version: number; config: unknown; created_at: string; created_by: string | null }[] | null) ?? [])
      .map((x) => ({ version: x.version, config: parseConfig(x.config), at: x.created_at, by: x.created_by === user.id ? account.name : 'A teammate' }))
      .filter((x): x is Release => !!x.config)
      .sort((a, b) => a.version - b.version)
    const draft = parseConfig(r.draft)
    const host = r.site_url ? new URL(r.site_url).host : ''
    return {
      id: r.public_id, name: r.name, siteUrl: r.site_url, products: r.products ?? [],
      widget: { position: 'right', shortcut: true, color: '#e8590c' }, domains: host ? [host] : [],
      createdAt: r.created_at, ...(draft ? { config: draft } : {}), ...(releases.length ? { releases } : {}),
      copiedSnippet: readCopied(r.public_id),
    }
  })
  const { data: inv } = await supabase.from('invites').select('email, role, project_id, created_at').in('project_id', [...dbIds.values()])
  const byDb = new Map([...dbIds].map(([pub, id]) => [id, pub]))
  const invites: Invite[] = (inv ?? []).map((i) => ({ email: i.email, role: i.role === 'admin' ? 'admin' : 'member', projectId: byDb.get(i.project_id) ?? '', at: i.created_at }))
  const current = projects.some((p) => p.id === prevCurrent) ? prevCurrent : projects[0]?.id ?? null
  return { account, projects, current, invites, signedIn: true, onboarded: !!meta.onboarded || projects.length > 0 }
}

/* "Copied the snippet" is a note for this browser only. */
const copiedKey = (p: string) => `vibe.copied.${p}`
const readCopied = (p: string) => { try { return localStorage.getItem(copiedKey(p)) ?? undefined } catch { return undefined } }
const writeCopied = (p: string, v?: string) => { try { if (v) localStorage.setItem(copiedKey(p), v); else localStorage.removeItem(copiedKey(p)) } catch { /* ignore */ } }

async function ensureWorkspace(name: string): Promise<string> {
  if (workspaceId) return workspaceId
  const { data: u } = await supabase!.auth.getUser()
  const { data, error } = await supabase!.from('workspaces').insert({ name: `${name}’s workspace`.slice(0, 80), created_by: u.user!.id }).select('id').single()
  if (error) throw error
  workspaceId = data.id
  return data.id
}

/** Writes a project's published file (what the script reads), or a "gone" marker for a deleted project. */
async function writeFile(publicId: string, body: unknown) {
  const blob = new Blob([JSON.stringify(body)], { type: 'application/json' })
  const { error } = await supabase!.storage.from(BUCKET).upload(`${publicId}.json`, blob, { upsert: true, cacheControl: '60', contentType: 'application/json' })
  if (error) throw error
}

/**
 * Writes what changed between two states. Throws on the first failure; the caller then reloads
 * from the server, so the panel never shows something the server didn't accept.
 */
export async function pushCloud(prev: SaasState, next: SaasState): Promise<void> {
  if (!supabase || !next.account) return
  const { data: u } = await supabase.auth.getUser()
  const user = u.user
  if (!user) throw new Error('Signed out')

  // projects
  const before = new Map(prev.projects.map((p) => [p.id, p]))
  const after = new Map(next.projects.map((p) => [p.id, p]))
  for (const p of next.projects) {
    const old = before.get(p.id)
    if (old?.copiedSnippet !== p.copiedSnippet) writeCopied(p.id, p.copiedSnippet)
    if (!old) {
      const ws = await ensureWorkspace(next.account.name)
      const { data, error } = await supabase.from('projects').insert({ workspace_id: ws, public_id: p.id, name: p.name, site_url: p.siteUrl, products: p.products, draft: p.config ?? null }).select('id').single()
      if (error) throw error
      dbIds.set(p.id, data.id)
    } else if (old.name !== p.name || old.siteUrl !== p.siteUrl || old.products.join() !== p.products.join() || JSON.stringify(old.config) !== JSON.stringify(p.config)) {
      const { error } = await supabase.from('projects').update({ name: p.name, site_url: p.siteUrl, products: p.products, draft: p.config ?? null }).eq('id', dbIds.get(p.id)!)
      if (error) throw error
    }
    // releases: only ever appended
    const had = old?.releases?.length ?? 0
    const fresh = (p.releases ?? []).filter((r) => r.version > (old?.releases?.[had - 1]?.version ?? 0))
    for (const r of fresh) {
      const { error } = await supabase.from('releases').insert({ project_id: dbIds.get(p.id)!, version: r.version, config: r.config, created_by: user.id })
      if (error) throw error
    }
    // The public file: the settings without site names (hashed) and without who published them.
    if (fresh.length) { const r = fresh[fresh.length - 1]; await writeFile(p.id, { v: 1, release: { version: r.version, at: r.at, config: publicConfig(p.id, r.config) } }) }
  }
  for (const p of prev.projects) {
    if (after.has(p.id) || !dbIds.get(p.id)) continue
    // Kept as deleted (its public id stays taken), and its file tells installed snippets to show nothing.
    const { error } = await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', dbIds.get(p.id)!)
    if (error) throw error
    await writeFile(p.id, { v: 1, gone: true }).catch(() => { /* the project is gone either way */ })
    dbIds.delete(p.id)
  }

  // account (after the projects: "onboarded" must not be saved if the first project wasn't)
  const meta: Record<string, unknown> = {}
  if (prev.account && next.account.name !== prev.account.name) meta.name = next.account.name
  if (next.onboarded !== prev.onboarded && next.onboarded !== undefined) meta.onboarded = next.onboarded
  if (Object.keys(meta).length) { const { error } = await supabase.auth.updateUser({ data: meta }); if (error) throw error }
  if (prev.account && next.account.email.trim().toLowerCase() !== prev.account.email.trim().toLowerCase()) {
    const { error } = await supabase.auth.updateUser({ email: next.account.email.trim() })
    if (error) throw error
  }


  // invites
  const key = (i: Invite) => `${i.projectId}|${i.email.toLowerCase()}`
  const had = new Set(prev.invites.map(key))
  const has = new Set(next.invites.map(key))
  for (const i of next.invites) {
    if (had.has(key(i)) || !dbIds.get(i.projectId)) continue
    const { error } = await supabase.from('invites').insert({ project_id: dbIds.get(i.projectId)!, email: i.email, role: i.role, invited_by: user.id })
    if (error) throw error
  }
  for (const i of prev.invites) {
    if (has.has(key(i)) || !dbIds.get(i.projectId)) continue
    const { error } = await supabase.from('invites').delete().eq('project_id', dbIds.get(i.projectId)!).eq('email', i.email)
    if (error) throw error
  }
}

/** A short random part for new project ids: they must be unique across every customer. */
export const idSuffix = () => Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 4)

/* ---------- comments, reviewers and the installation check (panel side) ---------- */


/** The project's database id, by its public id (null when it isn't on the server). */
export const projectDbId = (publicId: string) => dbIds.get(publicId) ?? null

interface ThreadRow {
  id: string; page: string; anchor: Thread['anchor']; author_name: string; text: string; created_at: string; edited_at: string | null
  resolved_at: string | null; resolved_by: string | null; replies: { id: string; author_name: string; text: string; created_at: string }[] | null
  kind?: Thread['kind']; version?: string | null; audio?: string | null
}
const rowToThread = (r: ThreadRow): Thread => ({
  id: r.id, page: r.page, anchor: r.anchor, author: r.author_name, text: r.text, createdAt: r.created_at,
  ...(r.edited_at ? { editedAt: r.edited_at } : {}),
  ...(r.resolved_at ? { resolved: { by: r.resolved_by ?? '', at: r.resolved_at } } : {}),
  replies: [...(r.replies ?? [])].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((x) => ({ id: x.id, author: x.author_name, text: x.text, at: x.created_at })),
  ...(r.kind && r.kind !== 'comment' ? { kind: r.kind } : {}), ...(r.version ? { version: r.version } : {}), ...(r.audio ? { audio: r.audio } : {}),
})

/** A project's comments for the panel's inbox: read and changed under the members' row level security. */
export class PanelBackend implements Backend {
  readonly where = 'Saved on the server'
  private last = new Map<string, Thread>()
  constructor(private publicId: string, private me: string) {}
  private get id() { const id = dbIds.get(this.publicId); if (!id) throw new Error('This project isn’t on the server.'); return id }
  async list() {
    const cols = 'id, page, anchor, author_name, text, created_at, edited_at, resolved_at, resolved_by, replies(id, author_name, text, created_at)'
    const first = await supabase!.from('threads').select(`${cols}, kind, version, audio`).eq('project_id', this.id).order('created_at')
    // A server without the review kinds yet (migration not run): the comments without them.
    const res = first.error?.code === '42703' ? await supabase!.from('threads').select(cols).eq('project_id', this.id).order('created_at') : first
    const { data, error } = res as unknown as { data: ThreadRow[] | null; error: typeof first.error }
    if (error) throw error
    const list = (data as ThreadRow[]).map(rowToThread)
    this.last = new Map(list.map((t) => [t.id, t]))
    return list
  }
  async upsert(t: Thread) {
    const before = this.last.get(t.id)
    if (!before) throw new Error('Comments are made on the site, not in the panel.')
    if (!!t.resolved !== !!before.resolved) {
      const { error } = await supabase!.from('threads').update({ resolved_at: t.resolved ? new Date().toISOString() : null, resolved_by: t.resolved ? this.me : null }).eq('id', t.id)
      if (error) throw error
    }
    const had = new Set(before.replies.map((r) => r.id))
    const { data: u } = await supabase!.auth.getUser()
    for (const r of t.replies) {
      if (had.has(r.id)) continue
      const { error } = await supabase!.from('replies').insert({ thread_id: t.id, author_name: this.me, author_id: u.user?.id, text: r.text })
      if (error) throw error
    }
    this.last.set(t.id, t)
  }
  async remove(id: string) {
    const audio = this.last.get(id)?.audio
    const { error } = await supabase!.from('threads').delete().eq('id', id)
    if (error) throw error
    if (audio) await supabase!.storage.from('narrations').remove([audio]).catch(() => { /* cleared later */ })
    this.last.delete(id)
  }
  subscribe(cb: () => void) {
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') cb() }, 10_000)
    return () => window.clearInterval(t)
  }
}

/**
 * A review link token from the server. Without days: one use, valid two minutes (to open the site
 * yourself). With days: an invite for a person, valid that many days, on up to five devices.
 */
export async function createReviewLink(publicId: string, o: { preview?: boolean; name?: string; days?: number } = {}): Promise<string> {
  const id = dbIds.get(publicId)
  if (!id) throw new Error('This project isn’t on the server.')
  const { data, error } = await supabase!.rpc('create_review_link', { p_project: id, p_preview: !!o.preview, p_name: o.name ?? null, p_days: o.days ?? null })
  if (error) throw error
  return data as string
}

export interface ReviewerRow { id: string; name: string; created_at: string; last_seen: string }
export async function listReviewers(publicId: string): Promise<ReviewerRow[]> {
  const id = dbIds.get(publicId)
  if (!id) return []
  const { data, error } = await supabase!.from('reviewers').select('id, name, created_at, last_seen').eq('project_id', id).order('last_seen', { ascending: false })
  if (error) throw error
  return data as ReviewerRow[]
}
export async function removeReviewer(id: string) {
  const { error } = await supabase!.from('reviewers').delete().eq('id', id)
  if (error) throw error
}

/** The most recent report from the script, on any site of the project. */
export async function latestInstall(publicId: string): Promise<Seen | null> {
  const id = dbIds.get(publicId)
  if (!id) return null
  const { data } = await supabase!.from('installs').select('host, last_seen, version, shown, why').eq('project_id', id).order('last_seen', { ascending: false }).limit(1)
  const r = data?.[0]
  return r ? { at: r.last_seen, host: r.host, page: '', version: r.version, shown: r.shown, why: r.why } : null
}

/** Deletes the account: its workspaces, projects and comments, and the login itself. */
export async function deleteAccountCloud(publicIds: string[]) {
  for (const id of publicIds) await writeFile(id, { v: 1, gone: true }).catch(() => { /* best effort */ })
  const { error } = await supabase!.rpc('delete_my_account')
  if (error) throw error
  dbIds.clear()
  workspaceId = null
  await supabase!.auth.signOut()
}

/* ---------- dashboard, clearing data, share links ---------- */


export async function projectStats(publicId: string): Promise<Stats | null> {
  const id = dbIds.get(publicId)
  if (!id) return null
  const { data, error } = await supabase!.rpc('project_stats', { p_project: id })
  if (error) throw error
  return data as Stats
}

/** Clears one kind of data for a project (members only; the server checks). */
export async function clearCloud(publicId: string, what: 'comments' | 'reviewers' | 'reports' | 'links' | 'research') {
  const id = dbIds.get(publicId)
  if (!id) throw new Error('This project isn’t on the server.')
  if (what === 'links') { const { error } = await supabase!.rpc('revoke_review_links', { p_project: id }); if (error) throw error; return }
  // Participants' runs: their clicks, gaze, answers and results go with them; the studies stay.
  if (what === 'research') { const { error } = await supabase!.from('runs').delete().eq('project_id', id); if (error) throw error; return }
  // Voice notes' audio goes with the comments (a server without voice notes has no such column).
  if (what === 'comments') {
    const { data } = await supabase!.from('threads').select('audio').eq('project_id', id).not('audio', 'is', null)
    const files = ((data ?? []) as { audio: string | null }[]).map((r) => r.audio).filter((a): a is string => !!a)
    for (let i = 0; i < files.length; i += 100) await supabase!.storage.from('narrations').remove(files.slice(i, i + 100)).catch(() => { /* the rows go anyway */ })
  }
  const table = what === 'comments' ? 'threads' : what === 'reviewers' ? 'reviewers' : 'installs'
  const { error } = await supabase!.from(table).delete().eq('project_id', id)
  if (error) throw error
  // Removed reviewers must not come back with a link they still hold.
  if (what === 'reviewers') await supabase!.rpc('revoke_review_links', { p_project: id })
}

export async function createShareCloud(publicId: string, o: { label?: string; status: 'all' | 'open' | 'completed'; days: number | null }): Promise<string> {
  const id = dbIds.get(publicId)
  if (!id) throw new Error('This project isn’t on the server.')
  const { data, error } = await supabase!.rpc('create_share', { p_project: id, p_label: o.label || null, p_status: o.status, p_days: o.days })
  if (error) throw error
  return data as string
}
export async function listSharesCloud(publicId: string): Promise<ShareRow[]> {
  const id = dbIds.get(publicId)
  if (!id) return []
  const { data, error } = await supabase!.from('shares').select('id, label, status_filter, created_at, expires_at, revoked_at, views, last_viewed').eq('project_id', id).order('created_at', { ascending: false })
  if (error) throw error
  return data as ShareRow[]
}
export async function revokeShareCloud(id: string) {
  const { error } = await supabase!.from('shares').update({ revoked_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
/** What a share link shows; needs no account. */
export async function getShareCloud(token: string): Promise<SharedList | null> {
  const { data, error } = await supabase!.rpc('get_share', { p_token: token })
  if (error) return null
  return data as SharedList
}

/* ---------- research: studies, participant links, results ---------- */

export type StudyKind = 'usability' | 'fivesec' | 'browse'
export interface StudyRow { id: string; kind: StudyKind; name: string; config: Record<string, unknown>; status: 'open' | 'closed'; eye_tracking: boolean; max_runs: number; link_expires: string | null; has_link: boolean; created_at: string; runs: number }
export interface RunRow { id: string; started_at: string; finished_at: string | null; device: string | null; vw: number | null; gaze_accuracy: number | null; result: { tasks?: { id: string; outcome: string; ms: number; pages?: string[]; clicks?: number; firstClickHit?: boolean | null }[]; answers?: string[] }; events: number }
export interface EventRow { run_id: string; t: number; task: string | null; kind: 'click' | 'page' | 'gaze' | 'door'; page: string; label: string | null; sel: string | null; rage: boolean | null; dead: boolean | null; hit: boolean | null }

export async function listStudies(publicId: string): Promise<StudyRow[]> {
  const id = dbIds.get(publicId)
  if (!id) return []
  const { data, error } = await supabase!.from('studies').select('id, kind, name, config, status, eye_tracking, max_runs, link_expires, link_hash, created_at, runs(count)').eq('project_id', id).order('created_at', { ascending: false })
  if (error) throw error
  return (data as (Omit<StudyRow, 'has_link' | 'runs'> & { link_hash: string | null; runs: { count: number }[] })[]).map(({ link_hash, runs, ...s }) => ({ ...s, has_link: !!link_hash, runs: runs?.[0]?.count ?? 0 }))
}
export async function saveStudy(publicId: string, s: { id?: string; kind: StudyKind; name: string; config: Record<string, unknown>; status?: 'open' | 'closed'; eye_tracking?: boolean; max_runs?: number }): Promise<string> {
  const pid = dbIds.get(publicId)
  if (!pid) throw new Error('This project isn’t on the server.')
  const row = { name: s.name.trim().slice(0, 80), config: s.config, status: s.status ?? 'open', eye_tracking: !!s.eye_tracking, max_runs: s.max_runs ?? 200 }
  if (s.id) { const { error } = await supabase!.from('studies').update(row).eq('id', s.id); if (error) throw error; return s.id }
  const { data, error } = await supabase!.from('studies').insert({ ...row, project_id: pid, kind: s.kind }).select('id').single()
  if (error) throw error
  return data.id as string
}
export async function deleteStudy(id: string) { const { error } = await supabase!.from('studies').delete().eq('id', id); if (error) throw error }
export async function studyLink(id: string, days = 30): Promise<string> {
  const { data, error } = await supabase!.rpc('create_study_link', { p_study: id, p_days: days })
  if (error) throw error
  return data as string
}
export async function revokeStudyLink(id: string) { const { error } = await supabase!.rpc('revoke_study_link', { p_study: id }); if (error) throw error }
/** A study's runs, and their events (the latest 20,000). */
export async function studyResults(id: string): Promise<{ runs: RunRow[]; events: EventRow[] }> {
  const { data: runs, error } = await supabase!.from('runs').select('id, started_at, finished_at, device, vw, gaze_accuracy, result, events').eq('study_id', id).order('started_at', { ascending: false }).limit(1000)
  if (error) throw error
  const ids = (runs ?? []).map((r) => r.id as string)
  const events: EventRow[] = []
  for (let i = 0; i < ids.length && events.length < 20000; i += 100) {
    const { data, error: e } = await supabase!.from('run_events').select('run_id, t, task, kind, page, label, sel, rage, dead, hit').in('run_id', ids.slice(i, i + 100)).order('t').limit(20000 - events.length)
    if (e) throw e
    events.push(...(data as EventRow[]))
  }
  return { runs: runs as RunRow[], events }
}
export async function deleteRun(id: string) { const { error } = await supabase!.from('runs').delete().eq('id', id); if (error) throw error }

/** Every participant's run in the project (the latest 300), with their events (the latest 20,000): session insights. */
export async function projectSessions(publicId: string): Promise<{ runs: (RunRow & { study_id: string })[]; events: EventRow[] }> {
  const pid = dbIds.get(publicId)
  if (!pid) return { runs: [], events: [] }
  const { data: runs, error } = await supabase!.from('runs').select('id, study_id, started_at, finished_at, device, vw, gaze_accuracy, result, events').eq('project_id', pid).order('started_at', { ascending: false }).limit(300)
  if (error) throw error
  const ids = (runs ?? []).map((r) => r.id as string)
  const events: EventRow[] = []
  for (let i = 0; i < ids.length && events.length < 20000; i += 100) {
    const { data, error: e } = await supabase!.from('run_events').select('run_id, t, task, kind, page, label, sel, rage, dead, hit').in('run_id', ids.slice(i, i + 100)).order('t').limit(20000 - events.length)
    if (e) throw e
    events.push(...(data as EventRow[]))
  }
  return { runs: runs as (RunRow & { study_id: string })[], events }
}

/** A link to listen to a voice note, for ten minutes (the bucket is private). */
export async function voiceUrl(path: string): Promise<string> {
  const { data, error } = await supabase!.storage.from('narrations').createSignedUrl(path, 600)
  if (error) throw error
  return data.signedUrl
}

