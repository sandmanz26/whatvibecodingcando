/**
 * The panel's side of widget settings: a project's draft, its published releases, and handing both
 * to the script through the configuration stand-in (core/embed/config.ts). Publishing is what sites
 * see; editing only changes the draft, which shows in previews.
 */
import { DEFAULT_CONFIG, MAX_ENVS, hostProblem, isLocalHost, modulesOf, newHandoff, serve, unserve, type Env, type Release, type WidgetConfig } from '../core/embed/config'
import { cloud } from './supabase'
import { productOf } from './products'
import { createReviewLink } from './cloud'
import type { Project } from './account'

/** The draft: what the builder edits. Older projects start from their snippet options and allowed domains. */
export function draftOf(p: Project): WidgetConfig {
  if (p.config) return p.config
  const envs: Env[] = p.domains.slice(0, 10).map((host, i) => ({ id: `e${i + 1}`, name: i === 0 ? 'Production' : host, host, on: true }))
  return {
    ...DEFAULT_CONFIG,
    modules: modulesOf((id) => p.products.includes(id)),
    theme: { ...DEFAULT_CONFIG.theme, accent: p.widget.color },
    launcher: { ...DEFAULT_CONFIG.launcher, position: p.widget.position, shortcut: p.widget.shortcut },
    envs,
  }
}
export const liveOf = (p: Project): Release | null => p.releases?.[p.releases.length - 1] ?? null

/**
 * What a release contains: a module only when its product is on for the project (Products). Comments
 * can also be switched off in the builder; the other script products follow Products.
 */
export const releasable = (p: Project, c: WidgetConfig): WidgetConfig => ({
  ...c, modules: modulesOf((id) => (id === 'comments' ? c.modules.comments : true) && p.products.includes(id) && (id === 'comments' || productOf(id)?.soon !== true)),
})

export function publish(p: Project, by: string, config = draftOf(p)): Project {
  const live = liveOf(p)
  const release: Release = { version: (live?.version ?? 0) + 1, config: releasable(p, config), at: new Date().toISOString(), by }
  // Keep the last 50 releases: enough to roll back, without growing forever.
  return { ...p, config, releases: [...(p.releases ?? []), release].slice(-50) }
}

/**
 * Publishes only the Products change: a new release of what is live with the modules that Products
 * now allows. Other unpublished edits in the builder stay in the draft.
 */
export function publishProducts(p: Project, by: string): Project {
  const live = liveOf(p)
  if (!live) return p
  const release: Release = { version: live.version + 1, config: releasable(p, live.config), at: new Date().toISOString(), by }
  return { ...p, releases: [...(p.releases ?? []), release].slice(-50) }
}

/**
 * Switches the widget on or off on every site at once: a new release of what is live, with only
 * the off switch changed. The draft keeps its other unpublished changes.
 */
export function setLiveOn(p: Project, on: boolean, by: string): Project {
  const live = liveOf(p)
  const base = live?.config ?? draftOf(p)
  const draft = draftOf(p)
  return { ...publish(p, by, { ...base, on }), config: { ...draft, on } }
}

/** The address to open for a host: http for a local dev address, https otherwise. */
export const urlOfHost = (host: string) => `${isLocalHost(host) ? 'http' : 'https'}://${host}`

/** The project's places that can be opened (no * patterns), switched on, in the project's order. */
export function siteTargets(p: Project): { host: string; url: string }[] {
  const envs = (liveOf(p)?.config ?? draftOf(p)).envs
  return envs.filter((e) => e.on && !e.host.includes('*')).map((e) => ({ host: e.host, url: urlOfHost(e.host) }))
}

/**
 * Adds an address (a new localhost port, a staging site) and publishes it at once, on top of what is
 * live: other unpublished edits stay in the draft. null: not a valid host, or the list is full.
 */
export function addAddress(p: Project, host: string, by: string): Project | null {
  const h = host.trim().toLowerCase()
  if (hostProblem(h)) return null
  const add = (c: WidgetConfig): WidgetConfig | null => (c.envs.some((e) => e.host === h) ? c
    : c.envs.length >= MAX_ENVS ? null
      : { ...c, envs: [...c.envs, { id: Math.random().toString(36).slice(2, 10), name: isLocalHost(h) ? 'Local dev' : h, host: h, on: true }] })
  const draft = add(draftOf(p))
  const base = add(liveOf(p)?.config ?? draftOf(p))
  if (!draft || !base) return null
  return { ...publish(p, by, base), config: draft, siteUrl: p.siteUrl || urlOfHost(h), domains: p.domains.includes(h) ? p.domains : [...p.domains, h] }
}

/** Hands a project's live settings and draft to the script (the stand-in for the configuration endpoint). */
// On the server the script reads the published file on Storage instead; the stand-in is for the demo only.
export const serveProject = (p: Project) => { if (!cloud) serve(p.id, { live: liveOf(p), draft: draftOf(p) }) }
export const unserveProject = (id: string) => unserve(id)

/** Puts a review token into a page address (#vibe_t=…), keeping the page's own hash route after it. */
function withToken(url: string, token: string, fromPanel = false) {
  const u = new URL(url)
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('not_http')
  const rest = u.hash.replace(/^#/, '')
  u.hash = `vibe_t=${token}${fromPanel ? '&vibe_from=panel' : ''}${rest ? `&${rest}` : ''}`
  return u.href
}
/** A one-time review token: from the server (cloud), or this browser's stand-in (demo). */
async function reviewToken(projectId: string, preview: boolean): Promise<string | null> {
  if (cloud) { try { return await createReviewLink(projectId, { preview }) } catch { return null } }
  return newHandoff(projectId, preview)
}

/**
 * Opens a site as a reviewer of the project, with a one-time token in the address (the script trades
 * it for a reviewer session and removes it). `preview` shows the draft instead of the published settings.
 * The tab opens at once (so pop-up blockers allow it) and goes to the site when the token is ready.
 */
export async function openAsReviewer(projectId: string, url: string, preview = false, fromPanel = false): Promise<boolean> {
  if (!/^https?:\/\//i.test(url)) return false
  const w = window.open('', '_blank')
  if (w) w.opener = null
  const token = await reviewToken(projectId, preview)
  if (!token) { w?.close(); return false }
  const to = withToken(url, token, fromPanel)
  if (w) w.location.href = to
  else window.open(to, '_blank', 'noopener')
  return true
}
/** The same link, for an iframe inside the panel. */
export async function reviewerUrl(projectId: string, url: string, preview = false): Promise<string | null> {
  const token = await reviewToken(projectId, preview)
  return token ? withToken(url, token) : null
}

/** An invite link for a person: the site's address with a token valid for `days` days, on up to five devices. */
export async function inviteLink(projectId: string, siteUrl: string, name: string, days = 7): Promise<string> {
  const token = await createReviewLink(projectId, { name, days })
  return withToken(siteUrl, token)
}
