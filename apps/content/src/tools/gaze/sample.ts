/**
 * Sample gaze, for showing how the Eyes view reads before anyone has done a test with the camera.
 * It is generated as raw webcam-like samples (about 30 a second, with noise), not as ready-made
 * fixations, so the real I-DT algorithm finds the fixations in it, as it would in real data.
 *
 * How people look at a screen, roughly: the top-left first, then along the top (heading, search,
 * navigation), then down the left and across in shorter sweeps (an F-shape); in a task, the eyes
 * keep coming back to whatever looks like the way forward. Every page shows it labelled as sample.
 */
import { rng } from '../../core/heat'
import type { Rect, Sample } from '../../core/gaze-analysis'

export interface SamplePerson { id: string; start: number; samples: Sample[] }

const gauss = (r: () => number) => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) }

export function sampleGaze(regions: { rect: Rect; weight: number; target?: boolean }[], seed: string, people = 8, noise = 38): SamplePerson[] {
  const out: SamplePerson[] = []
  if (!regions.length) return out
  for (let p = 0; p < people; p++) {
    const r = rng(`${seed}|${p}`)
    const start = 1_700_000_000_000 + p * 600_000
    const samples: Sample[] = []
    let t = start + 250 + r() * 300
    // Reading order: top to bottom, left to right, with a pull toward heavier regions (the target).
    const order = [...regions].sort((a, b) => (a.rect.y - b.rect.y) * 2 + (a.rect.x - b.rect.x) * 0.5 - (b.weight - a.weight) * 120 * r())
    const visits = 7 + Math.floor(r() * 7)
    let last: { x: number; y: number } | null = null
    for (let v = 0; v < visits; v++) {
      // Mostly the next region in reading order, sometimes back to a heavy one (a revisit).
      const reg = v < order.length && r() < 0.75 ? order[v] : order[Math.floor(Math.pow(r(), 2) * Math.min(order.length, 4))]
      const fx = reg.rect.x + reg.rect.w * (0.15 + r() * 0.7)
      const fy = reg.rect.y + reg.rect.h * (0.2 + r() * 0.6)
      // The saccade: two quick in-between samples.
      if (last) for (const k of [0.35, 0.7]) { samples.push({ t, x: last.x + (fx - last.x) * k, y: last.y + (fy - last.y) * k }); t += 33 }
      // The fixation: 150–600 ms, longer on the target and on text.
      const dur = (150 + r() * 300) * (reg.target ? 1.5 : 1)
      for (let e = 0; e < dur; e += 33) { samples.push({ t, x: fx + gauss(r) * noise * 0.3, y: fy + gauss(r) * noise * 0.3 }); t += 33 }
      last = { x: fx, y: fy }
    }
    out.push({ id: `sample-${p + 1}`, start, samples })
  }
  return out
}
