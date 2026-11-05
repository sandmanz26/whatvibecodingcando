/**
 * Versions of the marketplace: each release turns on features, so the same shop can be shown
 * as it was at v1.0 and as it is now, and anyone can switch between them from the dock.
 * The point it makes: with vibe coding, shipping or rolling back a feature is a small change.
 *
 * Versions are cumulative, like real releases. The product reads features, never versions.
 */
import { useEffect, useState } from 'react'

export type Feature = 'quickAdd' | 'stickyBuy' | 'recentlyViewed'
export interface Version { id: string; name: string; date: string; adds: { feature: Feature; text: string }[] }

export const VERSIONS: Version[] = [
  { id: '1.0', name: 'Launch', date: 'Sep 2026', adds: [] },
  { id: '1.1', name: 'Faster add to cart', date: 'Oct 2026', adds: [{ feature: 'quickAdd', text: 'An Add button on product cards, so you don’t have to open the product first' }] },
  { id: '1.2', name: 'Sticky buy bar', date: 'Oct 2026', adds: [{ feature: 'stickyBuy', text: 'On a product page, price and Add to cart stay at the bottom while you scroll' }] },
  { id: '2.0', name: 'Pick up where you left off', date: 'Nov 2026', adds: [{ feature: 'recentlyViewed', text: 'Home shows the products you looked at recently' }] },
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
}
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
