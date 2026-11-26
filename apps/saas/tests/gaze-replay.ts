// Replays a calibration from a "Download diagnostics" file (eye-tracking setup, team only): refits
// the v2 model and the v3 model on the same recorded frames and prints validation accuracy for both,
// plus the head pose spread. Features and dot positions only: no video, no images.
// Run: node apps/saas/tests/gaze-replay.ts path/to/ourhunch-gaze-diagnostics.json
import { readFileSync } from 'node:fs'
import { fit, validate, type CalSample, type Features } from '../src/core/gaze-model.ts'

export interface Diagnostics {
  v: 1
  screen: { w: number; h: number; clientW?: number; dpr?: number; zoom?: number }
  calibration: { x: number; y: number; frames: Features[] }[]
  validation: { x: number; y: number; frames: Features[] }[]
}

export function replay(d: Diagnostics) {
  const samples: CalSample[] = d.calibration.flatMap((c) => c.frames.map((f) => ({ f, x: c.x, y: c.y })))
  const v2 = fit(samples, { basis: 'poly2', legacy: true })
  const v3 = fit(samples)
  const q2 = validate(v2, d.validation), q3 = validate(v3, d.validation)
  return { v2: q2.accuracy, v3: q3.accuracy, basis: v3.basis, cv: v3.cv, perDot: q3.perDot, pose: v3.pose, spread: v3.spread, frames: samples.length }
}

if (process.argv[1]?.endsWith('gaze-replay.ts') && process.argv[2]) {
  const d = JSON.parse(readFileSync(process.argv[2], 'utf8')) as Diagnostics
  const r = replay(d)
  console.log(`screen ${d.screen.w}×${d.screen.h}${d.screen.clientW != null ? ` (content ${d.screen.clientW})` : ''} · dpr ${d.screen.dpr ?? '?'} · zoom ${d.screen.zoom ?? '?'}`)
  console.log(`${d.calibration.length} calibration dots, ${r.frames} frames; ${d.validation.length} check dots`)
  console.log(`validation accuracy: v2 model ${r.v2} px → v3 model ${r.v3} px (basis ${r.basis}, held-out ${r.cv} px), per dot ${r.perDot.join(', ')}`)
  console.log(`head pose median ${r.pose?.map((x) => x.toFixed(3)).join(' ')} · spread ${r.spread?.map((x) => x.toFixed(4)).join(' ')}`)
}
