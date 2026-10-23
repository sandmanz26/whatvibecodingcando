/**
 * Shared plumbing for the two internal tools (click insights, review pins).
 * They live around the product, not in it: each can be switched off with a
 * flag, and neither may change how the app behaves.
 */
import { useEffect, useState } from 'react'

export const APP = 'skillhouse'

/* ---------- flags ---------- */

export type ToolFlag = 'insights' | 'reviewPins'

// Insights: on in dev, off in production builds until the product owner decides on consent.
// Review pins: off until a reviewer switches them on.
const DEFAULTS: Record<ToolFlag, boolean> = {
  insights: import.meta.env.DEV,
  reviewPins: false,
}

const flagKey = (f: ToolFlag) => `${APP}.flags.${f}`
const FLAG_EVENT = `${APP}:flags`

export function getFlag(f: ToolFlag): boolean {
  try {
    const v = localStorage.getItem(flagKey(f))
    if (v === 'on') return true
    if (v === 'off') return false
  } catch { /* storage blocked — use the default */ }
  return DEFAULTS[f]
}

export function setFlag(f: ToolFlag, on: boolean) {
  try { localStorage.setItem(flagKey(f), on ? 'on' : 'off') } catch { /* ignore */ }
  window.dispatchEvent(new Event(FLAG_EVENT))
}

export function useFlag(f: ToolFlag): boolean {
  const [on, setOn] = useState(() => getFlag(f))
  useEffect(() => {
    const sync = () => setOn(getFlag(f))
    window.addEventListener(FLAG_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(FLAG_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [f])
  return on
}

/* ---------- server sync ---------- */

/**
 * Base URL of the tools API (e.g. "/api"). This project ships no backend, so it
 * is normally unset and both tools run local-only. Point it at endpoints that
 * follow the contract — GET/POST answering `{ configured, scope, ... }`, with
 * `configured: false` when their store is missing — and they sync instead.
 */
export const TOOLS_API: string = (import.meta.env.VITE_TOOLS_API ?? '').replace(/\/$/, '')

export const LOCAL_SCOPE = 'This browser only'

/* ---------- routing helpers (the app uses hash routing) ---------- */

export function currentPath(): string {
  const h = window.location.hash.replace(/^#/, '')
  return h.split('?')[0] || '/'
}

export function currentQuery(): URLSearchParams {
  const h = window.location.hash
  const i = h.indexOf('?')
  return new URLSearchParams(i >= 0 ? h.slice(i + 1) : '')
}

export const CONSOLE_PREFIX = '/console'
export const isConsole = (path: string) => path === CONSOLE_PREFIX || path.startsWith(CONSOLE_PREFIX + '/')

/** Elements owned by either tool — never recorded, never reacted to. */
export const TOOL_DOM = '[data-insights-ignore], [data-review-pins]'

export const readJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export const writeJSON = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota or blocked */ }
}
