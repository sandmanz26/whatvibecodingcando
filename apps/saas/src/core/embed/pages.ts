/**
 * A page's key in results: its path with ids replaced by ':id', so /product/123 and /product/456 are
 * one page. Pure (the panel's reports group with the same rule).
 * - Below the first segment: digits, UUIDs, long hex, and long slugs with a digit become ':id'.
 * - The first segment is a section of the site (/2026, /pricing, /launch-week-2026), so it stays,
 *   unless it is a UUID, long hex or a number of 5+ digits: a top-level page is never turned into '/:id' by a slug rule.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const HEX = /^(?=.*\d)[0-9a-f]{12,}$/i
export function pageOf(path: string): string {
  const parts = path.split('/')
  const out = parts.map((seg, i) => {
    if (!seg) return seg
    if (UUID.test(seg) || HEX.test(seg)) return ':id'
    // A long number at the top is still an id (an order or user number never stays in a page key).
    if (i <= 1) return /^\d{5,}$/.test(seg) ? ':id' : seg
    return /^\d+$/.test(seg) || (seg.length >= 16 && /\d/.test(seg) && /^[\w-]+$/.test(seg)) ? ':id' : seg
  }).join('/')
  return out.slice(0, 300) || '/'
}
