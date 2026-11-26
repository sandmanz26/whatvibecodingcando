// Webcam eye tracking on synthetic data: features → model → calibration → validation → filtering →
// fixations, v1 (before) against v2 (now). No browser, no camera.
// Run: node apps/saas/tests/gaze.test.ts   (Node 22.18+ runs TypeScript directly)
//
// The simulator makes feature vectors the way the face model does, from a known gaze point:
// iris position inside each eye (non-linear in the gaze angle, vertical weaker and noisier than
// horizontal), eyelid position, eye openness, head pose and distance. It adds landmark noise, blinks
// (openness collapses, irises jump), head movement (turn, shift, nearer/further) and slow drift, and
// eyes that land on a calibration dot a little late. Numbers are printed so the change is measurable.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CALIBRATION, F, N_FEATURES, VALIDATION, calibrationOrder, clickTeaches, fit, headDrift, headWeight, isBlink, predict, pxPerDeg, qualityOf, stableFrames, validate, distanceCm, RunMeter, type CalSample, type Features, type Model } from '../src/core/gaze-model.ts'
import { OneEuro, adaptiveIdt, fixationsOf, idtFor, type Fixation, type Sample } from '../src/core/gaze-analysis.ts'

const W = 1440, H = 900, PX_CM = 96 / 2.54
let seed = 11
const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
const gauss = () => Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand())

interface Head { yaw: number; pitch: number; roll: number; x: number; y: number; dist: number }
const STILL: Head = { yaw: 0, pitch: 0, roll: 0, x: 0, y: 0, dist: 60 }

/** One frame's features for a gaze point (screen px) and head pose. */
function frame(sx: number, sy: number, h: Head, blink = false, noise = 1): Features {
  // Gaze direction from the eye (camera above the screen centre), then eye-in-head = gaze − head turn.
  const ex = (sx - W / 2) / PX_CM - h.x, ey = (sy - H * 0.55) / PX_CM - h.y
  const ax = Math.atan2(ex, h.dist) - h.yaw, ay = Math.atan2(ey, h.dist) - h.pitch
  const n = (s: number) => gauss() * s * noise
  const ix = 0.21 * Math.sin(ax) + 0.04 * Math.sin(ax) * Math.abs(Math.sin(ax)), iy = 0.07 * Math.sin(ay) + 0.03 * Math.sin(ay) ** 2
  const lid = 0.48 + 0.75 * Math.sin(ay)
  const open = blink ? 0.04 : 0.29 - 0.06 * Math.sin(ay)
  const jx = blink ? n(0.08) : 0, jy = blink ? 0.05 + n(0.05) : 0
  const scale = 0.105 * (60 / h.dist)
  return [
    ix + n(0.006) + jx, iy + n(0.006) + jy, ix + n(0.006) + jx, iy + n(0.006) + jy, open + n(0.008),
    Math.sin(h.yaw) + n(0.004), Math.sin(h.pitch) + n(0.004), h.x / h.dist + n(0.002), h.y / h.dist + n(0.002),
    (blink ? 0.9 : lid) + n(0.04), (blink ? 0.9 : lid) + n(0.04), h.roll + n(0.004), scale * (1 + n(0.004)),
    (blink ? 0.04 : open * 1.05) + n(0.008), (blink ? 0.04 : open * 1.05) + n(0.008), 0.017 * (60 / h.dist) * (1 + n(0.02)),
  ]
}
const v1 = (f: Features) => f.slice(0, 9)

/** Frames for looking at one dot after clicking it: eyes land late, sometimes a glance or blink. */
function dotFrames(x: number, y: number, prev: { x: number; y: number }, h: Head, ms: number) {
  const out: { t: number; f: Features }[] = []
  const glance = rand() < 0.2 ? 300 + rand() * 500 : -1
  for (let t = 0; t < ms; t += 33) {
    const k = Math.min(1, t / 220) // still landing for ~220 ms
    let gx = prev.x + (x - prev.x) * (0.6 + 0.4 * k), gy = prev.y + (y - prev.y) * (0.6 + 0.4 * k)
    if (glance >= 0 && t >= glance && t < glance + 130) { gx += 260; gy -= 180 }
    out.push({ t, f: frame(gx, gy, h, rand() < 0.04) })
  }
  return out
}

/** Calibration, the v1 way (frames 150–1050 ms after the click, all kept) and the v2 way. */
function calibrate(h: () => Head, version: 1 | 2) {
  const dots = version === 2 ? calibrationOrder(rand) : CALIBRATION
  const samples: CalSample[] = []
  let prev = { x: W / 2, y: H / 2 }
  for (const d of dots) {
    const x = d.x * W, y = d.y * H
    const fr = dotFrames(x, y, prev, h(), version === 2 ? 1000 : 1050)
    if (version === 1) for (const q of fr) { if (q.t > 150) samples.push({ f: v1(q.f), x, y }) }
    else for (const f of stableFrames(fr, 0)) samples.push({ f, x, y })
    prev = { x, y }
  }
  return version === 1 ? fit(samples, 0.5) : fit(samples)
}

/** A viewing session: fixations at random places with saccades, 30 Hz, with head movement. */
function session(moveHead: boolean, ms = 60_000) {
  const truth: Fixation[] = []
  const frames: { t: number; f: Features; x: number; y: number; blink: boolean }[] = []
  let t = 0
  const h = { ...STILL }
  let x = W / 2, y = H / 2
  while (t < ms) {
    const nx = 80 + rand() * (W - 160), ny = 80 + rand() * (H - 160)
    for (let k = 1; k <= 2; k++) { t += 33; frames.push({ t, f: frame(x + (nx - x) * k / 3, y + (ny - y) * k / 3, h), x: x + (nx - x) * k / 3, y: y + (ny - y) * k / 3, blink: false }) }
    x = nx; y = ny
    const dur = 150 + rand() * 500
    const start = t + 33
    for (let e = 0; e < dur; e += 33) {
      t += 33
      if (moveHead) { h.yaw += gauss() * 0.004; h.pitch += gauss() * 0.003; h.x += gauss() * 0.05; h.dist += gauss() * 0.12; h.yaw *= 0.995; h.pitch *= 0.995; h.x *= 0.995; h.dist = 60 + (h.dist - 60) * 0.995 }
      const blink = rand() < 0.03
      frames.push({ t, f: frame(x, y, h, blink), x, y, blink })
    }
    truth.push({ x, y, start, dur: t - start, n: 0 })
  }
  return { frames, truth }
}

/** Live estimates from a session, the v1 way (One-Euro, v1 blink check) or the v2 way (+ head weight). */
function live(m: Model, s: ReturnType<typeof session>, version: 1 | 2) {
  const fx = new OneEuro(), fy = new OneEuro()
  const out: (Sample & { tx: number; ty: number })[] = []
  for (const q of s.frames) {
    const f = version === 1 ? v1(q.f) : q.f
    if (isBlink(m, f)) continue
    if (version === 2 && headWeight(headDrift(m, f)) === 0) continue
    const p = predict(m, f)
    out.push({ t: q.t, x: fx.filter(p.x, q.t), y: fy.filter(p.y, q.t), tx: q.x, ty: q.y })
  }
  return out
}
const meanErr = (pts: { x: number; y: number; tx: number; ty: number }[]) => pts.reduce((a, p) => a + Math.hypot(p.x - p.tx, p.y - p.ty), 0) / pts.length

/** Fixation precision/recall against the truth: matched when ≥ 50% of the shorter one overlaps and within 1.5× dispersion. */
function pr(found: Fixation[], truth: Fixation[], radius: number) {
  const used = new Set<number>()
  let hit = 0
  for (const f of found) {
    const i = truth.findIndex((g, k) => !used.has(k) && Math.min(f.start + f.dur, g.start + g.dur) - Math.max(f.start, g.start) >= 0.5 * Math.min(f.dur, g.dur) && Math.hypot(f.x - g.x, f.y - g.y) <= radius)
    if (i >= 0) { used.add(i); hit++ }
  }
  return { precision: found.length ? hit / found.length : 0, recall: hit / truth.length }
}

const report: string[] = []
test.after(() => console.log('\n' + report.join('\n')))

test('features: v1 slots unchanged, v2 vector complete', () => {
  const f = frame(W / 2, H / 2, STILL)
  assert.equal(f.length, N_FEATURES)
  assert.ok(Math.abs(f[F.LX]) < 0.05 && f[F.OPEN] > 0.2)
})

test('calibration order is random but always the same 13 dots', () => {
  const a = calibrationOrder(rand), b = calibrationOrder(rand)
  assert.equal(a.length, 13)
  const key = (p: { x: number; y: number }) => `${p.x},${p.y}`
  assert.deepEqual(new Set(a.map(key)), new Set(CALIBRATION.map(key)))
  assert.notDeepEqual(a.map(key), b.map(key))
})

test('stable sampling drops the landing, blinks and glances', () => {
  const fr = dotFrames(300, 300, { x: 1200, y: 800 }, STILL, 1000)
  const kept = stableFrames(fr, 0)
  assert.ok(kept.length >= 10, String(kept.length))
  assert.ok(kept.every((f) => f[F.OPEN] > 0.15))
  assert.deepEqual(stableFrames(fr.slice(0, 8), 0), [])
})

test('validation: px, degrees and precision are computed correctly', () => {
  // An identity-like model: features are the screen point itself, so errors are known exactly.
  const m: Model = { mean: [0, 0], std: [1, 1], wx: [1, 0, 0], wy: [0, 1, 0] }
  const q = validate(m, [
    { x: 100, y: 100, frames: [[130, 140], [130, 140]] }, // 50 px off, no jitter
    { x: 500, y: 500, frames: [[500, 500], [503, 504], [500, 500]] }, // centre exact, 5 px steps
  ], 60)
  assert.equal(q.perDot[0], 50)
  assert.equal(q.accuracy, Math.round((50 + Math.hypot(1, 4 / 3)) / 2))
  assert.equal(q.precision, Math.round(Math.sqrt((0 + 25 + 25) / 3)))
  assert.ok(Math.abs(pxPerDeg(60) - 39.6) < 0.2)
  assert.equal(q.accuracyDeg, Math.round((q.accuracy / pxPerDeg(60)) * 10) / 10)
  assert.equal(qualityOf({ accuracy: 100, accuracyDeg: 2.5 }), 'good')
  assert.equal(qualityOf({ accuracy: 300 }), 'poor')
  assert.ok(Math.abs(distanceCm(0.017) - 57) < 3, String(distanceCm(0.017)))
  assert.equal(distanceCm(null), 60)
})

test('accuracy: v2 beats v1 on the same synthetic participants (still head, moving head)', () => {
  for (const moving of [false, true]) {
    const e1: number[] = [], e2: number[] = [], vacc: number[] = [], truthAcc: number[] = []
    for (let p = 0; p < 8; p++) {
      const s0 = seed
      const head = () => (moving ? { ...STILL, yaw: gauss() * 0.02, x: gauss() * 0.4, dist: 60 + gauss() * 1.5 } : STILL)
      const m1 = calibrate(head, 1)
      seed = s0
      const m2 = calibrate(head, 2)
      const s = session(moving, 30_000)
      e1.push(meanErr(live(m1, s, 1)))
      const l2 = live(m2, s, 2)
      e2.push(meanErr(l2))
      // Validation on 5 new dots should predict the live error (same order of magnitude).
      const q = validate(m2, VALIDATION.map((d) => ({ x: d.x * W, y: d.y * H, frames: stableFrames(dotFrames(d.x * W, d.y * H, { x: W / 2, y: H / 2 }, STILL, 1000), 0) })))
      vacc.push(q.accuracy); truthAcc.push(e2[e2.length - 1])
    }
    const a1 = e1.reduce((a, b) => a + b) / e1.length, a2 = e2.reduce((a, b) => a + b) / e2.length
    const va = vacc.reduce((a, b) => a + b) / vacc.length, ta = truthAcc.reduce((a, b) => a + b) / truthAcc.length
    report.push(`gaze accuracy (${moving ? 'moving head' : 'still head'}): v1 ${a1.toFixed(0)} px → v2 ${a2.toFixed(0)} px (${((1 - a2 / a1) * 100).toFixed(0)}% lower); validation said ${va.toFixed(0)} px, live error ${ta.toFixed(0)} px`)
    assert.ok(a2 < a1, `v2 ${a2} < v1 ${a1}`)
    assert.ok(va < ta * 2.5 && va > ta / 4, `validation ${va} tracks live ${ta}`)
  }
})

test('head movement far from the calibration pose is flagged; a click far off is not learned', () => {
  const m = calibrate(() => STILL, 2)
  assert.ok(headDrift(m, frame(700, 400, STILL)) < 1)
  assert.ok(headDrift(m, frame(700, 400, { ...STILL, yaw: 0.3 })) > 1)
  assert.ok(headDrift(m, frame(700, 400, { ...STILL, dist: 45 })) > 1)
  assert.equal(headWeight(0.5), 1); assert.equal(headWeight(2.5), 0)
  assert.ok(clickTeaches({ x: 100, y: 100 }, { x: 180, y: 140 }, 100))
  assert.ok(!clickTeaches({ x: 100, y: 100 }, { x: 700, y: 600 }, 100))
})

test('blinks: v2 catches blinks by eye aspect ratio', () => {
  const m = calibrate(() => STILL, 2)
  let caught = 0, false_ = 0
  for (let i = 0; i < 300; i++) { if (isBlink(m, frame(600, 400, STILL, true))) caught++; if (isBlink(m, frame(rand() * W, rand() * H, STILL))) false_++ }
  report.push(`blinks: ${caught}/300 caught, ${false_}/300 open-eye frames dropped by mistake`)
  assert.ok(caught >= 290 && false_ <= 6)
})

test('fixations: hybrid I-VT/I-DT with adaptive thresholds vs v1 I-DT', () => {
  const r1: { precision: number; recall: number }[] = [], r2: typeof r1 = []
  for (let p = 0; p < 6; p++) {
    const s = session(false, 30_000)
    // Webcam-like samples: truth + noise (precision ~25 px) + a per-run offset (accuracy ~90 px).
    const ox = gauss() * 60, oy = gauss() * 60
    const fxf = new OneEuro(), fyf = new OneEuro()
    const smp: Sample[] = s.frames.filter((q) => !q.blink).map((q) => ({ t: q.t, x: fxf.filter(q.x + ox + gauss() * 25, q.t), y: fyf.filter(q.y + oy + gauss() * 25, q.t) }))
    const truth = s.truth.map((f) => ({ ...f, x: f.x + ox, y: f.y + oy }))
    const o1 = idtFor(90), o2 = adaptiveIdt(90, 25)
    r1.push(pr(fixationsOf(smp, o1), truth, 1.5 * o1.dispersion))
    r2.push(pr(fixationsOf(smp, o2), truth, 1.5 * o1.dispersion))
  }
  const avg = (r: typeof r1, k: 'precision' | 'recall') => r.reduce((a, b) => a + b[k], 0) / r.length
  report.push(`fixations: v1 precision ${avg(r1, 'precision').toFixed(2)} recall ${avg(r1, 'recall').toFixed(2)} → v2 precision ${avg(r2, 'precision').toFixed(2)} recall ${avg(r2, 'recall').toFixed(2)}`)
  assert.ok(avg(r2, 'recall') + avg(r2, 'precision') >= avg(r1, 'recall') + avg(r1, 'precision'))
  assert.ok(avg(r2, 'precision') > 0.7 && avg(r2, 'recall') > 0.7)
})

test('old saved models (v1, 9 features) still predict with v2 features', () => {
  const samples: CalSample[] = CALIBRATION.flatMap((d) => Array.from({ length: 10 }, () => ({ f: v1(frame(d.x * W, d.y * H, STILL)), x: d.x * W, y: d.y * H })))
  const m = fit(samples, 0.5)
  const p = predict(m, frame(W / 2, H / 2, STILL))
  assert.ok(Number.isFinite(p.x) && Math.hypot(p.x - W / 2, p.y - H / 2) < 300)
})

test('performance: feature → prediction stays far inside a 33 ms frame', () => {
  const m = calibrate(() => STILL, 2)
  const fs = Array.from({ length: 5000 }, () => frame(rand() * W, rand() * H, STILL))
  const meter = new RunMeter()
  const t0 = performance.now()
  for (const f of fs) { const a = performance.now(); isBlink(m, f); headDrift(m, f); predict(m, f); meter.frame('ok', performance.now() - a) }
  const per = (performance.now() - t0) / fs.length
  const t1 = performance.now(); calibrate(() => STILL, 2); const fitMs = performance.now() - t1
  report.push(`performance: ${(per * 1000).toFixed(1)} µs per frame for blink + head + prediction; a full calibration fit with cross-validation ${fitMs.toFixed(0)} ms`)
  assert.ok(per < 0.5 && fitMs < 1500)
  assert.equal(meter.summary().loss, 0)
})
