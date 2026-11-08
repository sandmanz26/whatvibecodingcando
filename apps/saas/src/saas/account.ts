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
/** A password as stored: PBKDF2-SHA-256 of the password with a random salt; never the password itself. */
export interface PasswordHash { salt: string; hash: string; iter: number }
export interface Account { name: string; email: string; createdAt: string; password?: PasswordHash }
export interface SaasState {
  account: Account | null
  projects: Project[]
  current: string | null
  invites: Invite[]
  /** false after logging out; absent on workspaces from before login existed (they were signed in) */
  signedIn?: boolean
  /** false between registering and finishing onboarding; absent on older workspaces (already set up) */
  onboarded?: boolean
  /** a password-reset link not used yet: single use, short-lived */
  reset?: { token: string; expires: number }
  /** failed logins in a row, and until when logging in is paused */
  lock?: { fails: number; until: number }
}

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

/* ---------- signing in (no server yet: all of this happens in this browser) ---------- */

export const isSignedIn = (s: SaasState) => !!s.account && s.signedIn !== false
export const isOnboarded = (s: SaasState) => s.onboarded !== false
export const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

export const PASSWORD_MIN = 8
const COMMON = ['password', 'password1', '12345678', '123456789', 'qwerty123', 'iloveyou', 'admin123', 'letmein1', '11111111', 'abcd1234']
/** What's wrong with a new password, or '' when it is acceptable. */
export function passwordProblem(pw: string, email = ''): string {
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (pw.length > 200) return 'That’s too long.'
  if (COMMON.includes(pw.toLowerCase())) return 'That password is too common. Pick another.'
  if (email && sameEmail(pw, email)) return 'Don’t use your email as the password.'
  return ''
}
/** 0–4, for the strength meter: length and the kinds of characters used. */
export function passwordScore(pw: string): number {
  if (!pw) return 0
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/].filter((r) => r.test(pw)).length
  let n = pw.length >= PASSWORD_MIN ? 1 : 0
  if (pw.length >= 12) n++
  if (kinds >= 3) n++
  if (pw.length >= 16 || (kinds === 4 && pw.length >= 12)) n++
  return passwordProblem(pw) ? Math.min(n, 1) : Math.max(1, n)
}

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const ITER = 120_000
async function derive(pw: string, salt: Uint8Array, iter: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: iter }, key, 256)
  return b64(new Uint8Array(bits))
}
/** Hashes a new password. Needs a secure page (https or localhost), where crypto.subtle exists. */
export async function hashPassword(pw: string): Promise<PasswordHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt: b64(salt), hash: await derive(pw, salt, ITER), iter: ITER }
}
export async function checkPassword(pw: string, h: PasswordHash): Promise<boolean> {
  const got = await derive(pw, unb64(h.salt), h.iter)
  // Compared in full, not stopping at the first difference.
  let diff = got.length ^ h.hash.length
  for (let i = 0; i < Math.max(got.length, h.hash.length); i++) diff |= (got.charCodeAt(i) || 0) ^ (h.hash.charCodeAt(i) || 0)
  return diff === 0
}
export const canHash = () => typeof crypto !== 'undefined' && !!crypto.subtle

/** After 5 wrong passwords in a row, logging in pauses: 30 s, doubling each further miss, up to 15 min. */
export const LOCK_AFTER = 5
export function lockAfterFail(lock: SaasState['lock']): NonNullable<SaasState['lock']> {
  const fails = (lock?.fails ?? 0) + 1
  const pause = fails >= LOCK_AFTER ? Math.min(15 * 60_000, 30_000 * 2 ** (fails - LOCK_AFTER)) : 0
  return { fails, until: pause ? Date.now() + pause : 0 }
}

export const RESET_MINUTES = 30
export const newResetToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')
/** Whether a reset link's token is the current one and still valid. */
export const resetValid = (s: SaasState, token: string | null) => !!token && !!s.reset && s.reset.token === token && s.reset.expires > Date.now() && !!s.account
