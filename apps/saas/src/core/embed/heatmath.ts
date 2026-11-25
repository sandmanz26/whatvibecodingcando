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
 * 4. Clicks: repeats (same person, same spot, < 80 ms) are dropped and each person counts at most
 *    MAX_PER_PERSON clicks per page, so one person can't dominate.
 * 4b. Versions are never mixed: points carry the site's version label, and one version is shown.
 * 4c. Gaze (v4): samples off the page are dropped, the rest smoothed (One-Euro); then each run's drift
 *    is corrected with that person's own clicks (gaze just before a click should be on it), when there
 *    are at least 5 such pairs, and the run is drawn with its own measured error as bandwidth.
 * 5. The bandwidth never goes below the accuracy of the eye tracking shown; the density is an adaptive
 *    KDE and the colour scale tops out at the 99th percentile (core/density.ts).
 */
import { fixationsOf, type Sample } from '../gaze-analysis'
import { capPerPerson, dedupe, rankElements, sampleNote, type Ranked } from '../density'
import { cleanGaze, driftOf, pairsOf, smoothGaze } from '../heatstats'

export interface RawPt { x: number; y: number; label?: string | null; vw: number | null; sel: string | null; ex: number | null; ey: number | null; rage: boolean | null; dead: boolean | null; p?: number; t?: number; dev?: string | null; acc?: number | null; ver?: string | null }
export interface Anchor { p: number; t: number; x: number; y: number }
export type Device = 'all' | 'desktop' | 'tablet' | 'mobile'
export interface HeatOpts { kind: 'click' | 'gaze'; device: Device; equal: boolean; maxAcc: number | null; /** the version shown ('' = points without a version); null = all (only when there is one) */ version?: string | null; anchors?: Anchor[] }
export interface RunDrift { p: number; applied: boolean; residual: number; before: number; pairs: number; h: number }
export interface Prepared { /** gaze: each run's points with its own bandwidth (page px) */ groups: { p: number; h: number; pts: (RawPt & { w: number })[] }[]; drift: RunDrift[]; pts: (RawPt & { w: number })[]; people: number; hidden: number; radius: number; units: number; capped: number; ranking: Ranked[]; note: string | null }
/** Clicks one person can add to one page's map. */
export const MAX_PER_PERSON = 60

export const deviceOf = (w: number): Exclude<Device, 'all'> => (w < 700 ? 'mobile' : w < 1100 ? 'tablet' : 'desktop')
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] }

export function prepare(points: RawPt[], o: HeatOpts): Prepared {
  let onDevice = points.filter((p) => (o.device === 'all' || !p.dev || p.dev === o.device) && (o.version == null || (p.ver ?? '') === o.version))
  let capped = 0
  let ranking: Ranked[] = []
  if (o.kind === 'click') {
    const ev = onDevice.map((p, i) => ({ ...p, p: p.p ?? 0, t: p.t ?? i }))
    const c = capPerPerson(dedupe(ev), MAX_PER_PERSON)
    capped = onDevice.length - c.kept.length
    onDevice = c.kept
    ranking = rankElements(c.kept, 8)
  }
  const byPerson = new Map<number, RawPt[]>()
  for (const p of onDevice) { const k = p.p ?? 0; const l = byPerson.get(k); if (l) l.push(p); else byPerson.set(k, [p]) }
  const out: (RawPt & { w: number })[] = []
  let hidden = 0
  const accs: number[] = []
  const groups: Prepared['groups'] = []
  const drift: RunDrift[] = []
  for (const [pid, raw] of byPerson) {
    let list = raw
    let mine: (RawPt & { w: number })[]
    if (o.kind === 'gaze') {
      const acc = list[0].acc ?? null
      if (o.maxAcc != null && acc != null && acc > o.maxAcc) { hidden++; continue }
      // Clean (off the page, blinks), smooth (One-Euro), then correct drift with this person's clicks.
      const vw = list[0].vw || 1280
      const timed = list.map((p, i) => ({ ...p, t: p.t ?? i * 200 }))
      const kept = smoothGaze(cleanGaze(timed, vw, 50_000))
      const d = driftOf(pairsOf(kept, (o.anchors ?? []).filter((a) => a.p === pid)))
      list = kept.map((p) => (d.applied ? { ...p, x: p.x + d.dx, y: p.y + d.dy, sel: null, ex: null, ey: null } : p))
      if (!list.length) { hidden++; continue }
      // The run's own error: the residual after correction, else its calibration accuracy.
      const err = d.applied ? d.residual : (acc ?? 120)
      if (acc != null) accs.push(err)
      const h = Math.round(Math.min(90, Math.max(20, err * 0.45)))
      drift.push({ p: pid, applied: d.applied, residual: Math.round(d.residual), before: Math.round(d.before), pairs: d.n, h })
      // Fixations from this person's samples (5 a second, so a fixation needs at least ~2 of them).
      const samples: (Sample & { i: number })[] = list.map((p, i) => ({ t: p.t ?? i * 200, x: p.x, y: p.y, i })).sort((a, b) => a.t - b.t)
      const fx = fixationsOf(samples, { dispersion: Math.round(Math.min(220, Math.max(60, err * 0.9))), minDur: 300, maxGap: 450 })
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
    if (o.kind === 'gaze') groups.push({ p: pid, h: drift[drift.length - 1].h, pts: mine })
    out.push(...mine)
  }
  // Weights stay in real units (clicks, or one share per person; ms for gaze): drawHeat scales colour itself.
  const acc = median(accs)
  const people = byPerson.size - hidden
  return { groups, drift, capped, ranking, note: out.length ? sampleNote(people) : null, pts: out, people, hidden, radius: o.kind === 'gaze' ? Math.round(Math.min(90, Math.max(28, (acc ?? 120) * 0.45))) : 26, units: out.length }
}
