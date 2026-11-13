/**
 * The project dashboard's numbers and the shared comment list, the same shape whether they come
 * from the server (project_stats / get_share, counted in the database) or from this browser (demo).
 */
import { statusOf, type Thread } from '../core/embed/store'

export interface Stats {
  open: number
  ongoing: number
  completed: number
  replies: number
  reviewers: number
  active_reviewers: number
  last_comment: string | null
  /** comments per day, the last 14 days, oldest first */
  per_day: { day: string; n: number }[]
  /** pages with the most comments */
  pages: { page: string; total: number; open: number }[]
  /** where the script ran */
  sites: { host: string; last_seen: string; version: string; shown: boolean; why: string }[]
}

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The same numbers, counted from comments in this browser (demo mode). */
export function statsOf(threads: Thread[], sites: Stats['sites'] = []): Stats {
  const today = new Date()
  const days: Stats['per_day'] = []
  for (let i = 13; i >= 0; i--) { const d = new Date(today); d.setDate(today.getDate() - i); days.push({ day: dayKey(d), n: 0 }) }
  const byDay = new Map(days.map((d) => [d.day, d]))
  const pages = new Map<string, { page: string; total: number; open: number }>()
  for (const t of threads) {
    const d = byDay.get(dayKey(new Date(t.createdAt)))
    if (d) d.n++
    const p = pages.get(t.page) ?? { page: t.page, total: 0, open: 0 }
    p.total++
    if (!t.resolved) p.open++
    pages.set(t.page, p)
  }
  const authors = new Set(threads.flatMap((t) => [t.author, ...t.replies.map((r) => r.author)]))
  return {
    open: threads.filter((t) => statusOf(t) === 'open').length,
    ongoing: threads.filter((t) => statusOf(t) === 'ongoing').length,
    completed: threads.filter((t) => statusOf(t) === 'completed').length,
    replies: threads.reduce((n, t) => n + t.replies.length, 0),
    reviewers: authors.size, active_reviewers: authors.size,
    last_comment: threads.map((t) => t.createdAt).sort().at(-1) ?? null,
    per_day: days,
    pages: [...pages.values()].sort((a, b) => b.total - a.total || a.page.localeCompare(b.page)).slice(0, 10),
    sites,
  }
}

/* ---------- the shared comment list ---------- */

export interface SharedThread { page: string; kind?: string | null; version?: string | null; author: string; text: string; createdAt: string; editedAt?: string | null; resolved: { by: string; at: string } | null; replies: { author: string; text: string; at: string }[] }
export interface SharedList { project: string; site: string; label: string | null; filter: 'all' | 'open' | 'completed'; created_at: string; expires_at: string | null; threads: SharedThread[] }
export interface ShareRow { id: string; label: string | null; status_filter: 'all' | 'open' | 'completed'; created_at: string; expires_at: string | null; revoked_at: string | null; views: number; last_viewed: string | null }

/** Demo mode has no server to hold a share: the list travels inside the link itself. */
export const LOCAL_SHARE_PREFIX = 'local~'
const MAX_LOCAL = 24_000
export function encodeLocalShare(list: SharedList): string | null {
  const json = JSON.stringify(list)
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return b64.length > MAX_LOCAL ? null : LOCAL_SHARE_PREFIX + b64
}
export function decodeLocalShare(token: string): SharedList | null {
  try {
    const b64 = token.slice(LOCAL_SHARE_PREFIX.length).replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const v = JSON.parse(new TextDecoder().decode(bytes)) as SharedList
    return v && typeof v.project === 'string' && Array.isArray(v.threads) ? v : null
  } catch { return null }
}
export const toShared = (t: Thread): SharedThread => ({ page: t.page, kind: t.kind ?? 'comment', version: t.version ?? null, author: t.author, text: t.text, createdAt: t.createdAt, editedAt: t.editedAt ?? null, resolved: t.resolved ?? null, replies: t.replies.map((r) => ({ author: r.author, text: r.text, at: r.at })) })
export const keepFor = (filter: SharedList['filter']) => (t: { resolved?: unknown }) => filter === 'all' || (filter === 'open' ? !t.resolved : !!t.resolved)

/** The list as CSV (for a spreadsheet). */
export function threadsCsv(rows: SharedThread[]): string {
  // Comments come from reviewers: a cell starting with = + - @ (or a tab/return) would run as a
  // formula in Excel or Sheets, so it gets a leading apostrophe and stays text.
  const esc = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`
  const lines = [['page', 'kind', 'version', 'status', 'author', 'comment', 'created', 'replies'].join(',')]
  for (const t of rows) lines.push([t.page, t.kind ?? 'comment', t.version ?? '', t.resolved ? 'completed' : t.replies.length ? 'ongoing' : 'open', t.author, t.text, t.createdAt, t.replies.map((r) => `${r.author}: ${r.text}`).join(' | ')].map((v) => esc(String(v))).join(','))
  return lines.join('\n')
}
export function download(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  Object.assign(document.createElement('a'), { href: url, download: name }).click()
  URL.revokeObjectURL(url)
}
