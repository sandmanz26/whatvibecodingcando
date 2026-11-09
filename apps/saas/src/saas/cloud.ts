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
import { parseConfig, type Release } from '../core/embed/config'
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
    const host = r.site_url ? new URL(r.site_url).hostname : ''
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
  return { account, projects, current, invites, signedIn: true, onboarded: meta.onboarded ?? projects.length > 0 }
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
    if (fresh.length) await writeFile(p.id, { v: 1, release: fresh[fresh.length - 1] })
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

/** Deletes the whole workspace (owners only; the server checks), and its published files. */
export async function deleteWorkspaceCloud(publicIds: string[]) {
  if (!supabase || !workspaceId) return
  for (const id of publicIds) await writeFile(id, { v: 1, gone: true }).catch(() => { /* best effort */ })
  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId)
  if (error) throw error
  workspaceId = null
  dbIds.clear()
  await supabase.auth.updateUser({ data: { onboarded: false } })
}

/** A short random part for new project ids: they must be unique across every customer. */
export const idSuffix = () => Array.from(crypto.getRandomValues(new Uint8Array(3)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 4)
