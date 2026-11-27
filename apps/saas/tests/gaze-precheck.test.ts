// The pre-check gate and the auto-advancing dots, on noisy synthetic data (owner's laptop test: all three
// checks showed ✓ and "Start calibration" stayed off). No browser, no camera.
// Run: node apps/saas/tests/gaze-precheck.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PrecheckGate, PRECHECK_READY_MS, AUTO_MAX_MS, DOT_MIN_FRAMES, dotClicked, dotDone, precheck, type Features } from '../src/core/gaze-model.ts'
import { simFrame, makeRand, STILL } from './gaze-sim.ts'

const r = makeRand(5)
const gauss = () => { let s = 0; for (let i = 0; i < 6; i++) s += r.u(); return (s - 3) / 1.2 }
/** A real-ish laptop webcam: face a little off-centre and jittering, ~55 cm, a window behind (bright edges, OK face). */
const laptop = (dropRate = 0.15) => ({ face: r.u() < dropRate ? null : { cx: 0.42 + gauss() * 0.04, cy: 0.5 + gauss() * 0.04 }, irisW: 0.013 * (1 + gauss() * 0.08), brightness: 95 + gauss() * 15 })

test('tolerant: off-centre face, laptop distance, backlight all pass', () => {
  assert.deepEqual(precheck({ face: { cx: 0.35, cy: 0.6 }, irisW: 0.0105, brightness: 100 }), [])   // ~70 cm, a bit off
  assert.deepEqual(precheck({ face: { cx: 0.62, cy: 0.35 }, irisW: 0.018, brightness: 200 }), [])   // ~40 cm
  assert.deepEqual(precheck({ face: { cx: 0.5, cy: 0.5 }, irisW: 0.0085, brightness: 240 }), [])    // ~80 cm, bright
  assert.ok(precheck({ face: { cx: 0.1, cy: 0.5 } }).includes('left'))
  assert.ok(precheck({ face: { cx: 0.5, cy: 0.5 }, brightness: 10 }).includes('dark'))
})

test('gate: Start turns on within 1.5 s of the camera even when 15% of frames lose the face', () => {
  for (let run = 0; run < 50; run++) {
    const g = new PrecheckGate()
    let at = -1
    for (let t = 0; t < 3000 && at < 0; t += 120) { if (g.push(precheck(laptop(0.15)), t).ready) at = t }
    assert.ok(at >= 0 && at <= 1500, `run ${run}: ready at ${at} ms`)
  }
})

test('gate: the rows and the button read the same list (never ✓✓✓ with the button off for long)', () => {
  const g = new PrecheckGate()
  let allOkSince: number | null = null
  for (let t = 0; t < 10_000; t += 120) {
    const s = g.push(precheck(laptop(0.2)), t)
    if (s.issues && s.issues.length === 0) { allOkSince ??= t; if (t - allOkSince >= PRECHECK_READY_MS) assert.ok(s.ready, `shown ok since ${allOkSince}, still off at ${t}`) } else { allOkSince = null; assert.ok(!s.ready) }
  }
})

test('gate: a single bad frame neither shows a warning nor resets the timer', () => {
  const g = new PrecheckGate()
  for (let t = 0; t <= 480; t += 120) g.push([], t)
  assert.equal(new PrecheckGate().push([], 0).issues, null)   // first frames: Checking…, not ✓
  const s = g.push(['noface'], 600)
  assert.deepEqual(s.issues, []); assert.ok(s.ready)
  // a lasting problem does show
  g.push(['far'], 720); g.push(['far'], 840); const s2 = g.push(['far'], 960)
  assert.deepEqual(s2.issues, ['far']); assert.ok(!s2.ready)
})

const frames = (opts: { ms: number; noise: number; drop?: number }) => {
  const out: { t: number; f: Features }[] = []
  for (let t = 0; t <= opts.ms; t += 33) {
    if (r.u() < (opts.drop ?? 0)) continue
    const f = simFrame(r, 700 + gauss() * opts.noise, 400 + gauss() * opts.noise, STILL, false)
    out.push({ t, f })
  }
  return out
}
const finish = (fs: { t: number; f: Features }[]) => { for (let t = 0; t <= 4000; t += 33) { const d = dotDone(fs.filter((x) => x.t <= t), 0, t); if (d) return { t, d } } return null }

test('dots: steady eyes finish early; a noisy webcam still finishes by the timeout with frames', () => {
  const steady = finish(frames({ ms: 4000, noise: 5 }))!
  assert.ok(steady && steady.t < AUTO_MAX_MS && steady.d.length >= 15, `steady at ${steady?.t}`)
  const noisy = finish(frames({ ms: 4000, noise: 120, drop: 0.3 }))!
  assert.ok(noisy && noisy.t <= AUTO_MAX_MS + 33 && noisy.d.length >= DOT_MIN_FRAMES, `noisy at ${noisy?.t} with ${noisy?.d.length}`)
})

test('dots: no face at all still ends at the timeout (empty: retried once, then skipped), never hangs', () => {
  const none = finish([])
  assert.ok(none && none.t <= AUTO_MAX_MS + 33 && none.d.length === 0)
})

test('dots: a click finishes at once with what is there', () => {
  const fs = frames({ ms: 600, noise: 30 })
  assert.equal(dotClicked(fs, 0, 200), null)
  assert.ok((dotClicked(fs, 0, 600) ?? []).length >= DOT_MIN_FRAMES)
})
