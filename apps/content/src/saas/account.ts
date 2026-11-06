/**
 * The user panel's account and projects.
 *
 * There is no backend yet, so this is a demo account kept in this browser (localStorage).
 * The UI says so wherever it matters: invites aren't sent, allowed domains aren't enforced,
 * and only comments made on this domain reach the inbox. When a backend arrives, these
 * functions are what it replaces.
 */
import { useEffect, useState } from 'react'
import type { SnippetOptions } from './snippet'

export interface Project {
  /** the data-project value: fixed once created, because comments are stored under it */
  id: string
  name: string
  siteUrl: string
  /** products turned on; those not in the script yet count as early-access requests */
  products: string[]
  widget: Omit<SnippetOptions, 'project'>
  domains: string[]
  /** the snippet as last copied, to tell when it has changed since */
  copiedSnippet?: string
  createdAt: string
}
export interface Invite { email: string; role: 'admin' | 'member'; projectId: string; at: string }
export interface Account { name: string; email: string; createdAt: string }
export interface SaasState { account: Account | null; projects: Project[]; current: string | null; invites: Invite[] }

const KEY = 'vibe.saas'
const EVENT = 'vibe:saas'
const EMPTY: SaasState = { account: null, projects: [], current: null, invites: [] }

export function loadSaas(): SaasState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    return v && typeof v === 'object' ? { ...EMPTY, ...v } : EMPTY
  } catch { return EMPTY }
}
/** Saves; false when storage is full or blocked. */
export function saveSaas(s: SaasState): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { return false }
  window.dispatchEvent(new Event(EVENT))
  return true
}
export function useSaas(): [SaasState, (fn: (s: SaasState) => SaasState) => boolean] {
  const [s, setS] = useState(loadSaas)
  useEffect(() => {
    const sync = () => setS(loadSaas())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  const update = (fn: (s: SaasState) => SaasState) => saveSaas(fn(loadSaas()))
  return [s, update]
}

export const slug = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 48)
export const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
/** A site address as typed (example.com, https://example.com/app) → its origin, or null. */
export function originOf(s: string): string | null {
  const t = s.trim()
  if (!t) return null
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`)
    return u.hostname.includes('.') || u.hostname === 'localhost' ? u.origin : null
  } catch { return null }
}
/** A project id that isn't taken yet: "shop", "shop-2", … */
export function freeId(base: string, taken: string[]) {
  const b = slug(base) || 'project'
  if (!taken.includes(b)) return b
  for (let i = 2; ; i++) if (!taken.includes(`${b}-${i}`)) return `${b}-${i}`
}

export function newProject(name: string, siteUrl: string, products: string[], taken: string[]): Project {
  const origin = originOf(siteUrl)
  return {
    id: freeId(name, taken), name: name.trim(), siteUrl: origin ?? '', products,
    widget: { position: 'right', shortcut: true, color: '#e8590c' },
    domains: origin ? [new URL(origin).hostname] : [], createdAt: new Date().toISOString(),
  }
}
