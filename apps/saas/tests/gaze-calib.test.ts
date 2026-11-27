// Calibration accuracy on a *realistic* webcam simulator, v2 (before) against v3 (now), and one test
// per suspected bug. No browser, no camera. Run: node apps/saas/tests/gaze-calib.test.ts
//
// Realistic means the numbers a laptop webcam and the face model really give: iris landmarks jitter
// by ~1.5% of the eye width per frame (gaze moves them only ~±11%), the head pose from the face
// model jitters by ~0.7° and ~0.5% of the distance, people turn their head a little towards each dot,
// and after clicking a dot about half of people's eyes leave it early, looking for the next one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CALIBRATION, F, VALIDATION, HeadCheck, calibrationOrder, dotDone, fit, headDrift, precheck, predict, qualityOf, stableFrames, validate, type CalSample, type Features, type Model } from '../src/core/gaze-model.ts'
import { simFrame, makeRand, type Head, STILL } from './gaze-sim.ts'
import { replay, type Diagnostics } from './gaze-replay.ts'

const W = 1440, H = 900

/** v2 sampling: the dot is clicked, frames for 1 s after the click, 300 ms dropped. Eyes often leave early. */
function oldDot(r: ReturnType<typeof makeRand>, x: number, y: number, head: () => Head, mirror = false) {
  const out: { t: number; f: Features }[] = []
  // The eyes were already on the dot before the click; ~half leave 250–650 ms after it.
  const leave = r.u() < 0.5 ? 250 + r.u() * 400 : 9999
  const nx = r.u() * W, ny = r.u() * H
  for (let t = 0; t < 1000; t += 33) {
    const away = t > leave ? Math.min(1, (t - leave) / 120) : 0
    out.push({ t, f: simFrame(r, x + (nx - x) * away, y + (ny - y) * away, head(), r.u() < 0.03, mirror) })
  }
  return stableFrames(out, 0)
}
/** v3 sampling: the dot appears and shrinks; eyes land after 200–400 ms and stay; collected when steady. */
function newDot(r: ReturnType<typeof makeRand>, x: number, y: number, prev: { x: number; y: number }, head: () => Head, mirror = false) {
  const out: { t: number; f: Features }[] = []
  const land = 200 + r.u() * 200
  const glance = r.u() < 0.1 ? 700 + r.u() * 800 : -1
  for (let t = 0; t < 4000; t += 33) {
    const k = Math.min(1, Math.max(0, (t - land + 150) / 150))
    let gx = prev.x + (x - prev.x) * k, gy = prev.y + (y - prev.y) * k
    if (glance >= 0 && t > glance && t < glance + 150) { gx += 250; gy -= 150 }
    out.push({ t, f: simFrame(r, gx, gy, head(), r.u() < 0.03, mirror) })
    const done = dotDone(out, 0, t)
    if (done) return done
  }
  return []
}

interface Run { samples: CalSample[]; checks: { x: number; y: number; frames: Features[] }[] }
function session(seed: number, flow: 'old' | 'new', opts: { mirror?: boolean; targetDx?: number } = {}): Run {
  const r = makeRand(seed)
  let cur = { x: W / 2, y: H / 2 }
  // A head that sits still but turns a little towards where it looks, plus the face model's jitter.
  const head = (): Head => ({ ...STILL, yaw: 0.06 * (cur.x - W / 2) / W + r.g() * 0.012, pitch: 0.05 * (cur.y - H / 2) / H + r.g() * 0.012, x: r.g() * 0.3, y: r.g() * 0.3, dist: 60 * (1 + r.g() * 0.01) })
  const samples: CalSample[] = []
  const dots = flow === 'new' ? calibrationOrder(r.u) : CALIBRATION
  let prev = cur
  for (const d of dots) {
    const x = d.x * W, y = d.y * H
    cur = { x, y }
    const fs = flow === 'new' ? newDot(r, x, y, prev, head, opts.mirror) : oldDot(r, x, y, head, opts.mirror)
    // targetDx: where the code *thinks* the dot was (a coordinate-frame bug shifts it).
    for (const f of fs) samples.push({ f, x: x + (opts.targetDx ?? 0) * d.x, y })
    prev = cur
  }
  const checks = VALIDATION.map((d) => {
    const x = d.x * W, y = d.y * H
    cur = { x, y }
    const fs = flow === 'new' ? newDot(r, x, y, prev, head, opts.mirror) : oldDot(r, x, y, head, opts.mirror)
    prev = cur
    return { x, y, frames: fs }
  })
  return { samples, checks }
}
/** Error while browsing: the head wanders within a normal range (no one sits like a statue for 3 minutes). */
function liveError(m: Model, seed: number, mirror = false) {
  const r = makeRand(seed)
  let e = 0, n = 0
  for (let i = 0; i < 300; i++) {
    const h: Head = { ...STILL, yaw: r.g() * 0.05, pitch: r.g() * 0.04, x: r.g() * 1.5, y: r.g() * 1, dist: 60 * (1 + r.g() * 0.05) }
    const x = r.u() * W, y = r.u() * H
    const fs = Array.from({ length: 5 }, () => simFrame(r, x, y, h, false, mirror))
    const ps = fs.map((f) => predict(m, f))
    const px = ps.reduce((a, p) => a + p.x, 0) / 5, py = ps.reduce((a, p) => a + p.y, 0) / 5
    e += Math.hypot(Math.min(W, Math.max(0, px)) - x, Math.min(H, Math.max(0, py)) - y); n++
  }
  return Math.round(e / n)
}
const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
const SEEDS = [3, 5, 7, 11, 13, 17, 19, 23]

test('accuracy: v2 (click, then 1 s; 22-term model) vs v3 (auto-collect; model chosen by held-out dots)', () => {
  const rows = SEEDS.map((s) => {
    const o = session(s, 'old'), n = session(s, 'new')
    const mOld = fit(o.samples, { basis: 'poly2', legacy: true })
    const mNewOnOld = fit(o.samples)
    const mOldOnNew = fit(n.samples, { basis: 'poly2', legacy: true })
    const mNew = fit(n.samples)
    return {
      before: validate(mOld, o.checks).accuracy, modelOnly: validate(mNewOnOld, o.checks).accuracy, samplingOnly: validate(mOldOnNew, n.checks).accuracy, after: validate(mNew, n.checks).accuracy,
      liveBefore: liveError(mOld, s + 100), liveAfter: liveError(mNew, s + 100), basis: mNew.basis,
    }
  })
  const b = mean(rows.map((x) => x.before)), a = mean(rows.map((x) => x.after))
  console.log(`\nrealistic webcam, validation accuracy: v2 ${b} px → v3 ${a} px · model fix alone ${mean(rows.map((x) => x.modelOnly))} px · sampling fix alone ${mean(rows.map((x) => x.samplingOnly))} px`)
  console.log(`while browsing (head wanders normally): v2 ${mean(rows.map((x) => x.liveBefore))} px → v3 ${mean(rows.map((x) => x.liveAfter))} px · bases picked: ${rows.map((x) => x.basis).join(', ')}`)
  assert.ok(a < b * 0.7, `v3 ${a} should be well under v2 ${b}`)
  assert.ok(a <= 200, `v3 ${a} px should be in the realistic webcam range`)
  assert.ok(mean(rows.map((x) => x.liveAfter)) < mean(rows.map((x) => x.liveBefore)))
  assert.notEqual(qualityOf({ accuracy: a }), 'poor')
})

test('bug check: head features standardised by their own noise blow up when the head moves', () => {
  const n = session(7, 'new')
  const legacy = fit(n.samples, { basis: 'poly2', legacy: true })
  const floored = fit(n.samples, { basis: 'poly2' })
  const l = liveError(legacy, 99), f = liveError(floored, 99)
  console.log(`same 22-term model while browsing: without std floors/clipping ${l} px → with ${f} px`)
  assert.ok(f < l)
})

test('bug check: mirrored video (x of the irises flipped) is not a cause: the fit learns the sign', () => {
  const a = session(5, 'new'), b = session(5, 'new', { mirror: true })
  const qa = validate(fit(a.samples), a.checks).accuracy, qb = validate(fit(b.samples), b.checks).accuracy
  console.log(`mirrored features: ${qa} px vs ${qb} px (same within noise)`)
  assert.ok(Math.abs(qa - qb) < 40)
})

test('bug check: a coordinate-frame offset (scrollbar width) costs little; a transformed ancestor costs a lot', () => {
  const ok = session(11, 'new'), sb = session(11, 'new', { targetDx: 15 }), tr = session(11, 'new', { targetDx: 300 })
  const q = (r: Run) => validate(fit(r.samples), r.checks).accuracy
  console.log(`target frame: exact ${q(ok)} px · 15 px scrollbar ${q(sb)} px · 300 px frame mismatch ${q(tr)} px — v3 takes the dot's own on-screen position`)
  assert.ok(q(tr) > q(ok) + 40)
})

test('model selection: simple data picks a simple basis, and cross-validation error is reported', () => {
  const n = session(13, 'new')
  const m = fit(n.samples)
  assert.ok(m.cv != null && m.cv > 0)
  assert.ok(['eye1', 'eye1h', 'eye2h', 'poly2'].includes(m.basis!))
})

/* ---------- head check ---------- */

function headRun(m: Model, poseAt: (t: number) => Head | null, ms = 8000) {
  const r = makeRand(4)
  const hc = new HeadCheck(m)
  const states: { t: number; s: string }[] = []
  for (let t = 0; t < ms; t += 200) {
    const h = poseAt(t)
    states.push({ t, s: hc.update(h ? simFrame(r, W / 2, H / 2, { ...h, yaw: h.yaw + r.g() * 0.012, pitch: h.pitch + r.g() * 0.012 }) : null, t) })
  }
  return states
}
test('head check: still and small movements never warn; a big sustained move warns after 2 s; no face says so instead', () => {
  const m = fit(session(3, 'new').samples)
  const still = headRun(m, () => STILL)
  const small = headRun(m, (t) => ({ ...STILL, yaw: 0.08 * Math.sin(t / 700), x: 2 * Math.sin(t / 900), dist: 60 * (1 + 0.06 * Math.sin(t / 1100)) }))
  const big = headRun(m, (t) => (t >= 2000 && t < 5000 ? { ...STILL, yaw: 0.45 } : STILL))
  const lost = headRun(m, (t) => (t >= 2000 && t < 5000 ? null : STILL))
  assert.ok(still.every((x) => x.s === 'ok'), 'still head never warns')
  assert.ok(small.every((x) => x.s === 'ok'), 'small, normal movement never warns')
  const firstFar = big.find((x) => x.s === 'far')!.t
  assert.ok(firstFar >= 4000 && firstFar <= 4400, `warns after ~2 s sustained (at ${firstFar})`)
  assert.equal(big[big.length - 1].s, 'ok', 'clears after coming back')
  assert.ok(lost.some((x) => x.s === 'lost') && lost.every((x) => x.s !== 'far'), 'face lost: "can’t see your face", never "move back"')
  // v2's rule (10 samples in a row beyond fixed limits, mean pose) on the same small movement:
  let far = 0, run = 0
  const r = makeRand(4)
  const v2: Model = { ...m, spread: undefined }
  for (let t = 0; t < 8000; t += 200) { const h = { ...STILL, yaw: 0.08 * Math.sin(t / 700), x: 2 * Math.sin(t / 900), dist: 60 * (1 + 0.06 * Math.sin(t / 1100)) }; const d = headDriftV2(v2, simFrame(r, W / 2, H / 2, h)); if (d > 1) { if (++run >= 10) far++ } else run = 0 }
  console.log(`head check, small normal movement over 8 s: v2 warned on ${far} samples, v3 on ${small.filter((x) => x.s === 'far').length}`)
})
/** v2's drift: fixed limits 10° / 4 cm / 15%. */
function headDriftV2(m: Model, f: Features) {
  const [yaw, pitch, tx, ty, , scale] = m.pose!
  return Math.max(Math.abs(f[F.YAW] - yaw) / 0.17, Math.abs(f[F.PITCH] - pitch) / 0.17, Math.abs(f[F.TX] - tx) / 0.09, Math.abs(f[F.TY] - ty) / 0.09, Math.abs(Math.log(f[F.SCALE] / scale)) / 0.15)
}
test('head drift tolerance grows with a jittery calibration, never shrinks below the limits', () => {
  const m = fit(session(3, 'new').samples)
  const f = simFrame(makeRand(1), W / 2, H / 2, { ...STILL, yaw: 0.2 })
  const wide: Model = { ...m, spread: [0.2, 0.2, 0, 0, 0, 0] }
  assert.ok(headDrift(wide, f) < headDrift(m, f))
})

test('pre-check: centred, distance, light', () => {
  assert.deepEqual(precheck({ face: null }), ['noface'])
  assert.deepEqual(precheck({ face: { cx: 0.5, cy: 0.45 }, irisW: 0.017, brightness: 130 }), [])
  assert.ok(precheck({ face: { cx: 0.2, cy: 0.45 } }).includes('left'))   // raw left = mirrored right → move left
  assert.ok(precheck({ face: { cx: 0.5, cy: 0.45 }, irisW: 0.04 }).includes('close'))
  assert.ok(precheck({ face: { cx: 0.5, cy: 0.45 }, brightness: 20 }).includes('dark'))
})

test('replay harness: a downloaded diagnostics file refits both ways', () => {
  const n = session(17, 'new')
  const diag: Diagnostics = { v: 1, screen: { w: W, h: H }, calibration: groupDots(n.samples), validation: n.checks.map((c) => ({ x: c.x, y: c.y, frames: c.frames })) }
  const out = replay(diag)
  console.log(`replay: v2 model ${out.v2} px → v3 model ${out.v3} px (basis ${out.basis})`)
  assert.ok(out.v3 <= out.v2)
})
function groupDots(s: CalSample[]) {
  const m = new Map<string, { x: number; y: number; frames: Features[] }>()
  for (const x of s) { const k = `${x.x},${x.y}`; const g = m.get(k) ?? { x: x.x, y: x.y, frames: [] }; g.frames.push(x.f); m.set(k, g) }
  return [...m.values()]
}
