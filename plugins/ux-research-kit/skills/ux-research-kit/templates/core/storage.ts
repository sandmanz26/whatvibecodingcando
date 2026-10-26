/**
 * Storage and feature flags. Everything lives in this browser's localStorage unless
 * the project adds a server (see reference/console.md, "Collecting from many browsers").
 */
import type { ResearchConfig } from './config'

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

export const removeKey = (key: string) => { try { localStorage.removeItem(key) } catch { /* ignore */ } }

export const uid = () => Math.random().toString(36).slice(2, 12)

/* ---------- flags ---------- */

export type Flag = 'tracking' | 'comments'

/**
 * Click tracking defaults to OFF outside development until the product owner has
 * decided on consent (banner / privacy policy). Do not flip this default silently.
 */
export const FLAG_DEFAULTS: Record<Flag, boolean> = {
  tracking: typeof import.meta !== 'undefined' && !!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV,
  comments: true,
}

export const flagEvent = (cfg: ResearchConfig) => `${cfg.app}:flags`

export function getFlag(cfg: ResearchConfig, f: Flag): boolean {
  try {
    const v = localStorage.getItem(`${cfg.app}.flags.${f}`)
    if (v === 'on') return true
    if (v === 'off') return false
  } catch { /* storage blocked */ }
  return FLAG_DEFAULTS[f]
}

export function setFlag(cfg: ResearchConfig, f: Flag, on: boolean) {
  try { localStorage.setItem(`${cfg.app}.flags.${f}`, on ? 'on' : 'off') } catch { /* ignore */ }
  window.dispatchEvent(new Event(flagEvent(cfg)))
}

/** Per-tab storage for ids that must not outlive the tab. */
export const tab = {
  get: (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* ignore */ } },
  del: (k: string) => { try { sessionStorage.removeItem(k) } catch { /* ignore */ } },
}
