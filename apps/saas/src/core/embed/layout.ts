/**
 * A page's layout fingerprint: its structure, never its text. Landmarks, sections, headings, lists,
 * media and controls, each as "landmark>tag[role]#stable-id", counted. Two fingerprints are the same
 * layout when their weighted similarity is at least SAME (the server does the same sum in
 * _fp_similarity). Counts are square-rooted so a list growing from 12 to 14 items stays the same
 * layout, while a redesign (other landmarks, other sections) does not.
 */
export type Fingerprint = Record<string, number>
export interface FpNode { tag: string; land: string; id?: string | null; role?: string | null }

export const SAME = 0.8
const LAND = ['header', 'nav', 'main', 'footer', 'aside', 'section', 'article', 'form', 'dialog']
const TAGS = [...LAND, 'h1', 'h2', 'h3', 'ul', 'ol', 'table', 'img', 'picture', 'video', 'iframe', 'button', 'input', 'select', 'textarea', 'a']
export const FP_SELECTOR = TAGS.join(',')
const MAX_NODES = 3000, MAX_KEYS = 300

/** An id worth keeping: words only (no digits: generated ids change on every build or render). */
const stableId = (id?: string | null) => (id && /^[a-z][a-z_-]{1,30}$/i.test(id) ? id.toLowerCase() : '')

export function fingerprintOf(nodes: FpNode[]): Fingerprint {
  const counts = new Map<string, number>()
  for (const n of nodes.slice(0, MAX_NODES)) {
    const role = n.role && /^[a-z]{2,20}$/.test(n.role) ? `[${n.role}]` : ''
    const id = stableId(n.id)
    const k = `${n.land}>${n.tag}${role}${id ? `#${id}` : ''}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const out: Fingerprint = {}
  for (const [k, c] of [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, MAX_KEYS)) out[k.slice(0, 120)] = Math.round(Math.sqrt(c) * 10) / 10
  return out
}

/** Weighted Jaccard: sum of the smaller counts over the sum of the larger. 1 = identical. */
export function similarity(a: Fingerprint, b: Fingerprint): number {
  let lo = 0, hi = 0
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) { const x = a[k] ?? 0, y = b[k] ?? 0; lo += Math.min(x, y); hi += Math.max(x, y) }
  return hi ? lo / hi : 0
}

/** 16 hex characters (two FNV-1a 32-bit hashes) of the fingerprint, keys in order. */
export function hashOf(fp: Fingerprint): string {
  const s = Object.keys(fp).sort().map((k) => `${k}=${fp[k]}`).join('|')
  let h1 = 0x811c9dc5, h2 = 0x01000193 ^ 0x5bd1e995
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193); h2 = Math.imul(h2 ^ c, 0x5bd1e995) ^ (h2 >>> 13) }
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0'))
}

/** The best matching known layout (index), or -1 when none is similar enough. */
export function matchLayout(fp: Fingerprint, known: Fingerprint[]): number {
  let best = -1, score = 0
  known.forEach((k, i) => { const s = similarity(fp, k); if (s > score) { score = s; best = i } })
  return score >= SAME ? best : -1
}

/** This page's fingerprint (the browser): our widget and private parts left out. */
export function pageFingerprint(doc: Document = document): Fingerprint {
  const nodes: FpNode[] = []
  for (const el of Array.from(doc.querySelectorAll(FP_SELECTOR))) {
    if (nodes.length >= MAX_NODES) break
    if (el.closest('vibe-collab, [id^=vibe-collab]')) continue
    const land = el.parentElement?.closest(LAND.join(','))?.tagName.toLowerCase() ?? 'body'
    nodes.push({ tag: el.tagName.toLowerCase(), land, id: el.id, role: el.getAttribute('role') })
  }
  return fingerprintOf(nodes)
}
