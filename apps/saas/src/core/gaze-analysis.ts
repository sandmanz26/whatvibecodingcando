/**
 * Reading eye movement from gaze samples, the way eye-tracking research does.
 *
 * The eye doesn't glide over a screen: it stops (a fixation, roughly 100–600 ms, when we
 * actually take something in) and jumps (a saccade, 20–80 ms, when we see almost nothing).
 * Everything an eye-tracking study reports is built from those two:
 *
 * - Fixations, found with I-DT (Dispersion-Threshold Identification, Salvucci & Goldberg 2000):
 *   a run of samples that stays within a small area for at least a minimum duration is one
 *   fixation, at the run's centre. I-DT suits a webcam better than a velocity threshold (I-VT),
 *   because webcam samples are noisy and too slow (~30 Hz) to measure eye speed well.
 * - Saccades: the jumps between consecutive fixations (amplitude, duration, direction).
 * - The scanpath: fixations in order, the path the eyes took.
 * - Areas of interest (AOIs): for each part of the screen, time to first fixation, how many
 *   fixations, total dwell time, how often people came back, and how many people looked at all.
 */

export interface Sample { t: number; x: number; y: number }
export interface Fixation { x: number; y: number; start: number; dur: number; n: number }
export interface Saccade { from: number; to: number; amp: number; dur: number; angle: number }

export interface IdtOptions {
  /** maximum spread of one fixation, px: (max x − min x) + (max y − min y) */
  dispersion: number
  /** minimum fixation duration, ms */
  minDur: number
  /** a gap longer than this (blink, face lost) ends a fixation, ms */
  maxGap: number
}

/** Dispersion threshold scaled to tracking quality: a noisy webcam needs a wider window. */
export const idtFor = (accuracyPx: number | null): IdtOptions => ({
  dispersion: Math.round(Math.min(220, Math.max(60, (accuracyPx ?? 110) * 0.9))),
  minDur: 100,
  maxGap: 150,
})

const spread = (s: Sample[], a: number, b: number) => {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (let i = a; i <= b; i++) { const p = s[i]; if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x; if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y }
  return (maxX - minX) + (maxY - minY)
}

/** I-DT. Samples must be in time order; returns fixations in time order. */
export function fixationsOf(samples: Sample[], o: IdtOptions): Fixation[] {
  const s = [...samples].sort((a, b) => a.t - b.t)
  const out: Fixation[] = []
  let i = 0
  let lastEnd = -1
  while (i < s.length) {
    // The smallest window covering the minimum duration, without a gap inside it.
    let j = i
    while (j + 1 < s.length && s[j].t - s[i].t < o.minDur && s[j + 1].t - s[j].t <= o.maxGap) j++
    if (s[j].t - s[i].t < o.minDur) { i = j + 1; continue }
    if (spread(s, i, j) > o.dispersion) { i++; continue }
    // Grow it while the points stay together, forwards, then back over samples skipped while the
    // window was settling (the start of the look, just after the saccade's landing).
    while (j + 1 < s.length && s[j + 1].t - s[j].t <= o.maxGap && spread(s, i, j + 1) <= o.dispersion) j++
    while (i - 1 > lastEnd && s[i].t - s[i - 1].t <= o.maxGap && spread(s, i - 1, j) <= o.dispersion) i--
    let sx = 0, sy = 0
    for (let k = i; k <= j; k++) { sx += s[k].x; sy += s[k].y }
    const n = j - i + 1
    out.push({ x: sx / n, y: sy / n, start: s[i].t, dur: s[j].t - s[i].t, n })
    lastEnd = j
    i = j + 1
  }
  return mergeAdjacent(out, o)
}

/**
 * The samples of a saccade's landing can start a window that then breaks off early, splitting
 * one long look into two at the same spot. As eye-tracking filters do, two fixations close in
 * time (gap ≤ 75 ms) and in place (≤ half the dispersion) are merged into one.
 */
function mergeAdjacent(f: Fixation[], o: IdtOptions): Fixation[] {
  const out: Fixation[] = []
  for (const x of f) {
    const p = out[out.length - 1]
    if (p && x.start - (p.start + p.dur) <= 75 && Math.hypot(x.x - p.x, x.y - p.y) <= o.dispersion / 2) {
      const n = p.n + x.n
      out[out.length - 1] = { x: (p.x * p.n + x.x * x.n) / n, y: (p.y * p.n + x.y * x.n) / n, start: p.start, dur: x.start + x.dur - p.start, n }
    } else out.push(x)
  }
  return out
}

export function saccadesOf(f: Fixation[]): Saccade[] {
  const out: Saccade[] = []
  for (let i = 1; i < f.length; i++) {
    const a = f[i - 1], b = f[i]
    out.push({ from: i - 1, to: i, amp: Math.hypot(b.x - a.x, b.y - a.y), dur: Math.max(0, b.start - (a.start + a.dur)), angle: Math.atan2(b.y - a.y, b.x - a.x) })
  }
  return out
}

/* ---------- areas of interest ---------- */

export interface Rect { x: number; y: number; w: number; h: number }
export interface Aoi { id: string; label: string; rect: Rect; target?: boolean }
export interface AoiStat { aoi: Aoi; viewers: number; people: number; ttff: number | null; fixations: number; dwell: number; revisits: number }

const inside = (r: Rect, x: number, y: number, pad = 0) => x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad


/**
 * Metrics per AOI over several people. `start` is when each person's task began (ms), so time
 * to first fixation is measured from the moment they could start looking.
 */
export function aoiStats(aois: Aoi[], people: { id: string; start: number; fixations: Fixation[] }[], pad = 0): AoiStat[] {
  return aois.map((aoi) => {
    let viewers = 0, fixations = 0, dwell = 0, revisits = 0
    const firsts: number[] = []
    for (const p of people) {
      let seen = false, inPrev = false, visits = 0
      for (const f of p.fixations) {
        // AOIs may overlap (a button inside its section): a fixation counts for every AOI it is in.
        const hit = inside(aoi.rect, f.x, f.y, pad)
        if (hit) {
          fixations++; dwell += f.dur
          if (!seen) { seen = true; firsts.push(f.start - p.start) }
          if (!inPrev) visits++
        }
        inPrev = hit
      }
      if (seen) { viewers++; revisits += Math.max(0, visits - 1) }
    }
    firsts.sort((a, b) => a - b)
    const ttff = firsts.length ? firsts[Math.floor(firsts.length / 2)] : null
    return { aoi, viewers, people: people.length, ttff, fixations, dwell, revisits }
  })
}

/* ---------- filtering live samples ---------- */

/**
 * One-Euro filter (Casiez, Roussel & Vogel 2012): smooths hard while the eye rests and follows
 * quickly when it jumps, so fixations are steady without saccades being smeared.
 */
export class OneEuro {
  private x: number | null = null
  private dx = 0
  private t = 0
  constructor(private minCutoff = 0.8, private beta = 0.012, private dCutoff = 1) {}
  private alpha(cutoff: number, dt: number) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt) }
  filter(v: number, tMs: number) {
    if (this.x === null) { this.x = v; this.t = tMs; return v }
    const dt = Math.max(1e-3, (tMs - this.t) / 1000)
    this.t = tMs
    const d = (v - this.x) / dt
    this.dx += this.alpha(this.dCutoff, dt) * (d - this.dx)
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx)
    this.x += this.alpha(cutoff, dt) * (v - this.x)
    return this.x
  }
  reset() { this.x = null; this.dx = 0 }
}
