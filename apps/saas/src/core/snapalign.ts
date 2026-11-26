/**
 * Placing a recorded point (click or gaze) on a page snapshot. Pure, no browser needed.
 * - A point recorded on an element the snapshot also has (same selector in its box map) goes to the
 *   same spot of that element's box (ex, ey: 0..1 across the element).
 * - Otherwise: x scaled by width (the point's viewport width → the snapshot's), y in page pixels
 *   scaled the same way (a layout of one device class reflows little between close widths).
 * Returns snapshot pixels (CSS px of the page at the snapshot's width), or null when off the picture.
 */
export type Box = [number, number, number, number]
export interface SnapMeta { vw: number; height: number; boxes: Record<string, Box> }
export interface Pt { x?: number | null; y?: number | null; vw?: number | null; sel?: string | null; ex?: number | null; ey?: number | null }

export function alignPoint(p: Pt, s: SnapMeta): { x: number; y: number; anchored: boolean } | null {
  const b = p.sel ? s.boxes[p.sel] : undefined
  if (b && p.ex != null && p.ey != null) {
    const x = b[0] + Math.min(1, Math.max(0, p.ex)) * b[2], y = b[1] + Math.min(1, Math.max(0, p.ey)) * b[3]
    return y <= s.height ? { x, y, anchored: true } : null
  }
  if (p.x == null || p.y == null || !p.vw) return null
  const k = s.vw / p.vw
  const x = p.x * k, y = p.y * k
  if (x < 0 || y < 0 || x > s.vw || y > s.height) return null
  return { x, y, anchored: false }
}
