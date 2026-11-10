/**
 * The panel's side of widget settings: a project's draft, its published releases, and handing both
 * to the script through the configuration stand-in (core/embed/config.ts). Publishing is what sites
 * see; editing only changes the draft, which shows in previews.
 */
import { DEFAULT_CONFIG, newHandoff, serve, unserve, type Env, type Release, type WidgetConfig } from '../core/embed/config'
import { cloud } from './supabase'
import { createReviewLink } from './cloud'
import type { Project } from './account'

/** The draft: what the builder edits. Older projects start from their snippet options and allowed domains. */
export function draftOf(p: Project): WidgetConfig {
  if (p.config) return p.config
  const envs: Env[] = p.domains.slice(0, 10).map((host, i) => ({ id: `e${i + 1}`, name: i === 0 ? 'Production' : host, host, on: true }))
  return {
    ...DEFAULT_CONFIG,
    modules: { comments: p.products.includes('comments') },
    theme: { ...DEFAULT_CONFIG.theme, accent: p.widget.color },
    launcher: { ...DEFAULT_CONFIG.launcher, position: p.widget.position, shortcut: p.widget.shortcut },
    envs,
  }
}
export const liveOf = (p: Project): Release | null => p.releases?.[p.releases.length - 1] ?? null

/** What a release may contain: a module only when its product is on for the project. */
const releasable = (p: Project, c: WidgetConfig): WidgetConfig => ({ ...c, modules: { comments: c.modules.comments && p.products.includes('comments') } })

export function publish(p: Project, by: string, config = draftOf(p)): Project {
  const live = liveOf(p)
  const release: Release = { version: (live?.version ?? 0) + 1, config: releasable(p, config), at: new Date().toISOString(), by }
  // Keep the last 50 releases: enough to roll back, without growing forever.
  return { ...p, config, releases: [...(p.releases ?? []), release].slice(-50) }
}

/** Hands a project's live settings and draft to the script (the stand-in for the configuration endpoint). */
// On the server the script reads the published file on Storage instead; the stand-in is for the demo only.
export const serveProject = (p: Project) => { if (!cloud) serve(p.id, { live: liveOf(p), draft: draftOf(p) }) }
export const unserveProject = (id: string) => unserve(id)

/** Puts a review token into a page address (#vibe_t=…), keeping the page's own hash route after it. */
function withToken(url: string, token: string) {
  const u = new URL(url)
  const rest = u.hash.replace(/^#/, '')
  u.hash = `vibe_t=${token}${rest ? `&${rest}` : ''}`
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
export async function openAsReviewer(projectId: string, url: string, preview = false): Promise<boolean> {
  const w = window.open('', '_blank')
  if (w) w.opener = null
  const token = await reviewToken(projectId, preview)
  if (!token) { w?.close(); return false }
  if (w) w.location.href = withToken(url, token)
  else window.open(withToken(url, token), '_blank', 'noopener')
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
