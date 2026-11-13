/**
 * Turning study points into a heatmap that reads true (used by the script's Heatmap tool).
 *
 * 1. One device at a time: a phone layout and a desktop layout put the same button in different
 *    places, so mixing them smears both.
 * 2. Each person counts the same (optional, on by default): someone who clicked 200 times, or looked
 *    for ten minutes, doesn't outweigh nine people who didn't.
 * 3. Gaze becomes fixations (I-DT, the standard dispersion-threshold method, sized to each person's
 *    calibration accuracy), each weighted by how long it lasted: an attention map, not a cloud of
 *    noisy samples. Eye tracking calibrated worse than a threshold is left out by default.
 * 4. The blob size follows the accuracy of the eye tracking shown; the colour scale uses the 95th
 *    percentile (core/heat.ts), so one extreme spot doesn't wash out the rest.
 */
import { fixationsOf, type Sample } from '../gaze-analysis'

export interface RawPt { x: number; y: number; vw: number | null; sel: string | null; ex: number | null; ey: number | null; rage: boolean | null; dead: boolean | null; p?: number; t?: number; dev?: string | null; acc?: number | null }
export type Device = 'all' | 'desktop' | 'tablet' | 'mobile'
export interface HeatOpts { kind: 'click' | 'gaze'; device: Device; equal: boolean; maxAcc: number | null }
export interface Prepared { pts: (RawPt & { w: number })[]; people: number; hidden: number; radius: number; units: number }

export const deviceOf = (w: number): Exclude<Device, 'all'> => (w < 700 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop')
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

export function prepare(points: RawPt[], o: HeatOpts): Prepared {
  const onDevice = points.filter((p) => o.device === 'all' || !p.dev || p.dev === o.device)
  const byPerson = new Map<number, RawPt[]>()
  for (const p of onDevice) { const k = p.p ?? 0; const l = byPerson.get(k); if (l) l.push(p); else byPerson.set(k, [p]) }
  const out: (RawPt & { w: number })[] = []
  let hidden = 0
  const accs: number[] = []
  for (const list of byPerson.values()) {
    let mine: (RawPt & { w: number })[]
    if (o.kind === 'gaze') {
      const acc = list[0].acc ?? null
      if (o.maxAcc != null && acc != null && acc > o.maxAcc) { hidden++; continue }
      if (acc != null) accs.push(acc)
      // Fixations from this person's samples (5 a second, so a fixation needs at least ~2 of them).
      const samples: (Sample & { i: number })[] = list.map((p, i) => ({ t: p.t ?? i * 200, x: p.x, y: p.y, i })).sort((a, b) => a.t - b.t)
      const fx = fixationsOf(samples, { dispersion: Math.round(Math.min(220, Math.max(60, (acc ?? 120) * 0.9))), minDur: 300, maxGap: 450 })
      if (fx.length) {
        mine = fx.map((f) => {
          // The element of the sample nearest the fixation's centre, so it follows the layout.
          let best = list[0], d = Infinity
          for (const p of list) { const dd = Math.hypot(p.x - f.x, p.y - f.y); if (dd < d) { d = dd; best = p } }
          return { ...best, x: f.x, y: f.y, ex: best.sel && d < 40 ? best.ex : null, ey: best.sel && d < 40 ? best.ey : null, sel: d < 40 ? best.sel : null, w: f.dur }
        })
      } else mine = list.map((p) => ({ ...p, w: 200 }))
    } else mine = list.map((p) => ({ ...p, w: 1 }))
    if (o.equal) { const sum = mine.reduce((a, p) => a + p.w, 0) || 1; for (const p of mine) p.w /= sum }
    out.push(...mine)
  }
  // Scale weights so the busiest person-share stays around 1 (drawHeat reads relative weights).
  const max = out.reduce((a, p) => Math.max(a, p.w), 0) || 1
  for (const p of out) p.w = p.w / max
  const acc = median(accs)
  return { pts: out, people: byPerson.size - hidden, hidden, radius: o.kind === 'gaze' ? Math.round(Math.min(90, Math.max(28, (acc ?? 120) * 0.45))) : 26, units: out.length }
}
