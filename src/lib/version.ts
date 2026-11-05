/**
 * Versions of the marketplace: each release turns on features, so the same shop can be shown
 * as it was at v1.0 and as it is now, and anyone can switch between them from the dock.
 * The point it makes: with vibe coding, shipping or rolling back a feature is a small change.
 *
 * Versions are cumulative, like real releases. The product reads features, never versions.
 */
import { useEffect, useState } from 'react'

export type Feature = 'quickAdd' | 'stickyBuy' | 'dealTimer' | 'newHero' | 'recentlyViewed'
export interface Version { id: string; name: string; date: string; adds: { feature: Feature; text: string }[] }

export const VERSIONS: Version[] = [
  { id: '1.0', name: 'Launch', date: 'Sep 2026', adds: [] },
  { id: '1.1', name: 'Faster add to cart', date: 'Oct 2026', adds: [{ feature: 'quickAdd', text: 'An Add to cart button on every product card' }] },
  { id: '1.2', name: 'Deals and a sticky buy bar', date: 'Oct 2026', adds: [
    { feature: 'dealTimer', text: 'A countdown on Home: today’s deals end at midnight' },
    { feature: 'stickyBuy', text: 'On a product page, price and Add to cart stay at the bottom while you scroll' },
  ] },
  { id: '2.0', name: 'New Home', date: 'Nov 2026', adds: [
    { feature: 'newHero', text: 'A redesigned Home: one big AI search with ready-made requests' },
    { feature: 'recentlyViewed', text: 'Home shows the products you looked at recently' },
  ] },
]
export const LATEST = VERSIONS[VERSIONS.length - 1].id

const KEY = 'market.version'
const EVENT = 'market:version'
const RECENT_KEY = 'market.recent'

export function getVersion(): string {
  try { const v = localStorage.getItem(KEY); if (v && VERSIONS.some((x) => x.id === v)) return v } catch { /* ignore */ }
  return LATEST
}
export function setVersion(id: string) {
  try { localStorage.setItem(KEY, id) } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT))
  flashChanges()
}

/* ---------- showing what changed ---------- */

const SHOW_KEY = 'market.version.show'
const SHOW_EVENT = 'market:version-show'
let flashTimer = 0
/** Outlines every feature of the current version for a few seconds, right after a switch. */
export function flashChanges() {
  document.documentElement.dataset.flashChanges = 'on'
  window.clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => { delete document.documentElement.dataset.flashChanges }, 6000)
}
export const showingChanges = () => { try { return sessionStorage.getItem(SHOW_KEY) === 'on' } catch { return false } }
export function setShowingChanges(on: boolean) {
  try { if (on) sessionStorage.setItem(SHOW_KEY, 'on'); else sessionStorage.removeItem(SHOW_KEY) } catch { /* ignore */ }
  if (on) document.documentElement.dataset.showChanges = 'on'
  else delete document.documentElement.dataset.showChanges
  window.dispatchEvent(new Event(SHOW_EVENT))
}
export function useShowingChanges(): boolean {
  const [v, setV] = useState(showingChanges)
  useEffect(() => {
    if (showingChanges()) document.documentElement.dataset.showChanges = 'on'
    const sync = () => setV(showingChanges())
    window.addEventListener(SHOW_EVENT, sync)
    return () => window.removeEventListener(SHOW_EVENT, sync)
  }, [])
  return v
}
/** The version a feature arrived in, for the "New in" labels. */
export const versionOfFeature = (f: Feature) => VERSIONS.find((v) => v.adds.some((a) => a.feature === f))?.id ?? ''
/** Props that mark an element as belonging to a feature, so "show what changed" can outline it. */
export const featureMark = (f: Feature) => ({ 'data-feature': f, 'data-feature-label': `New in v${versionOfFeature(f)}` })

export const versionOf = (id: string) => VERSIONS.find((v) => v.id === id) ?? VERSIONS[VERSIONS.length - 1]
/** Features on in a version: everything added up to and including it. */
export function featuresOf(id: string): Set<Feature> {
  const out = new Set<Feature>()
  for (const v of VERSIONS) { v.adds.forEach((a) => out.add(a.feature)); if (v.id === id) break }
  return out
}

export function useVersion(): string {
  const [v, setV] = useState(getVersion)
  useEffect(() => {
    const sync = () => setV(getVersion())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])
  return v
}
export const useFeature = (f: Feature) => featuresOf(useVersion()).has(f)

/* ---------- comments per version ---------- */

/** Comments made before versions existed belong to the shop as it was then. */
export const LEGACY_VERSION = '2.0'
export const COMMENT_COUNTS_EVENT = 'market:comment-counts'
export type CommentCounts = Record<string, { total: number; unresolved: number }>
let lastCounts: CommentCounts = {}
export const commentCounts = () => lastCounts
export function publishCommentCounts(c: CommentCounts) {
  lastCounts = c
  window.dispatchEvent(new Event(COMMENT_COUNTS_EVENT))
}
export function useCommentCounts(): CommentCounts {
  const [c, setC] = useState(commentCounts)
  useEffect(() => {
    const sync = () => setC(commentCounts())
    sync()
    window.addEventListener(COMMENT_COUNTS_EVENT, sync)
    return () => window.removeEventListener(COMMENT_COUNTS_EVENT, sync)
  }, [])
  return c
}

/* ---------- recently viewed (kept in every version, shown from 2.0) ---------- */

export function rememberViewed(productId: string) {
  try {
    const list: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    localStorage.setItem(RECENT_KEY, JSON.stringify([productId, ...list.filter((x) => x !== productId)].slice(0, 10)))
  } catch { /* ignore */ }
}
export function recentlyViewed(): string[] {
  try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v : [] } catch { return [] }
}
