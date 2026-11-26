/**
 * Webcam eye tracking, the part without the face model: camera, features of a frame, the mapping
 * from features to the screen, calibration sampling, validation and quality numbers. Shared by the
 * research console (tools/gaze/engine.ts, which loads the face model from this app) and the
 * installable script's eye tracking (core/embed/gaze-entry.ts, which loads it from our domain).
 * Everything below `features()` is pure and tested in Node (tests/gaze.test.ts).
 *
 * Privacy: video frames are turned into face landmarks in this browser and dropped; only the
 * estimated gaze point (and quality numbers) is ever kept.
 *
 * Pipeline (v2):
 * 1. Features: each iris normalised to its eye corners (x) and to its eyelids (y), both eyes; eye
 *    openness (eye aspect ratio, for blinks); head pose (yaw, pitch, roll), head position and
 *    distance (inter-ocular scale) from the face transformation matrix.
 * 2. Model: per-user ridge regression on a degree-2 polynomial of the eye features plus head-pose
 *    terms and eye × head interactions (head-pose compensation); x and y are fitted separately, each
 *    with its own lambda chosen by leave-one-point-out cross-validation.
 * 3. Calibration: 13 dots in random order; for each, the first 300 ms after the click are dropped,
 *    blinks are dropped and only the stable part of the window (near the median) is kept.
 * 4. Validation on 5 other dots: accuracy (px and degrees) and precision (RMS sample-to-sample).
 */
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'

export type Features = number[]

/** Streams this module started and hasn't stopped: every start stops the earlier ones first. */
const live = new Set<MediaStream>()
/** Live camera tracks this page holds (tests check nothing leaks between runs). */
export const liveTracks = () => [...live].reduce((n, s) => n + s.getTracks().filter((t) => t.readyState === 'live').length, 0)
const timeout = <T,>(p: Promise<T>, ms: number, what: string) => new Promise<T>((res, rej) => {
  const t = setTimeout(() => rej(Object.assign(new Error(what), { name: 'TimeoutError' })), ms)
  p.then((v) => { clearTimeout(t); res(v) }, (e) => { clearTimeout(t); rej(e) })
})
/**
 * Starts the camera fresh into `video`: any stream started before is stopped first (a stream is
 * never reused), getUserMedia gives up after 15 s, and a failed play() stops the new stream.
 */
export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  for (const s of live) stopCamera(s)
  const stream = await timeout(navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false }), 15000, 'camera_timeout')
  live.add(stream)
  try {
    video.srcObject = stream
    video.muted = true
    video.playsInline = true
    await timeout(video.play(), 15000, 'camera_timeout')
  } catch (e) { stopCamera(stream); video.srcObject = null; throw e }
  return stream
}

export const stopCamera = (stream: MediaStream | null) => { if (!stream) return; stream.getTracks().forEach((t) => t.stop()); live.delete(stream) }

/** A plain sentence for why the camera didn't start. */
export function cameraError(e: unknown): string {
  const n = String((e as Error)?.name ?? e)
  if (typeof window !== 'undefined' && (!window.isSecureContext || !navigator.mediaDevices)) return 'The camera only works on a secure (https) page.'
  if (/NotAllowed|Permission|Security/i.test(n)) return 'The camera wasn’t allowed.'
  if (/NotFound|Overconstrained/i.test(n)) return 'No camera was found.'
  if (/NotReadable/i.test(n)) return 'Your camera is being used by another app or tab.'
  if (/Abort/i.test(n)) return 'The camera stopped while starting. Try again.'
  if (/Timeout/i.test(n)) return 'The camera took too long to start. Try again.'
  return 'Eye tracking couldn’t start on this device.'
}

/* ---------- features ---------- */

/** Feature slots. 0–8 keep their v1 meaning, so a model saved before v2 still predicts. */
export const F = { LX: 0, LY: 1, RX: 2, RY: 3, OPEN: 4, YAW: 5, PITCH: 6, TX: 7, TY: 8, LLID: 9, RLID: 10, ROLL: 11, SCALE: 12, EARL: 13, EARR: 14, IRIS: 15 } as const
export const N_FEATURES = 16

type P = { x: number; y: number }
const d = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y)

function eye(lm: P[], outer: number, inner: number, top: number, bottom: number, iris: number, up2: number, lo2: number) {
  const w = d(lm[outer], lm[inner]) || 1e-6
  const cx = (lm[outer].x + lm[inner].x) / 2
  const cy = (lm[top].y + lm[bottom].y) / 2
  const lidH = Math.max(1e-6, lm[bottom].y - lm[top].y)
  return {
    fx: (lm[iris].x - cx) / w,
    fy: (lm[iris].y - cy) / w,
    // Vertical position between the eyelids (0 = top lid, 1 = bottom lid): moves more with gaze than fy.
    lid: (lm[iris].y - lm[top].y) / lidH,
    open: (lm[bottom].y - lm[top].y) / w,
    // Eye aspect ratio (Soukupová & Čech 2016) with two lid pairs: drops sharply in a blink.
    ear: (d(lm[top], lm[bottom]) + d(lm[up2], lm[lo2])) / (2 * w),
  }
}

/** Face landmarks (478, with irises) and the 4×4 transformation matrix → a feature vector. Pure. */
export function featuresOf(face: P[], m?: ArrayLike<number> | null): Features | null {
  if (!face || face.length < 478) return null
  const L = eye(face, 33, 133, 159, 145, 468, 158, 153)
  const R = eye(face, 263, 362, 386, 374, 473, 385, 380)
  const ok = !!m && m.length === 16
  const z = ok ? Math.abs(m![14] || 1) : 1
  // Head direction and position (v1 slots), then roll from the matrix's x axis.
  const head = ok ? [m![8], m![9], m![12] / z, m![13] / z] : [0, 0, 0, 0]
  const roll = ok ? Math.atan2(m![1], m![0]) : Math.atan2(face[263].y - face[33].y, face[263].x - face[33].x)
  // Distance proxy: inter-ocular distance in the image (bigger = closer).
  const scale = d(face[33], face[263])
  const irisW = (d(face[469], face[471]) + d(face[474], face[476])) / 2
  return [L.fx, L.fy, R.fx, R.fy, (L.open + R.open) / 2, ...head, L.lid, R.lid, roll, scale, L.ear, R.ear, irisW]
}

/** One frame → a feature vector, or null when no face (or no irises) is found. */
/** MediaPipe throws when a frame's timestamp isn't later than the last one (across runs too). */
let lastTs = 0
export function features(lm: FaceLandmarker, video: HTMLVideoElement, at: number): Features | null {
  if (video.readyState < 2) return null
  const ts = Math.max(Math.round(at), lastTs + 1); lastTs = ts
  const r = lm.detectForVideo(video, ts)
  return featuresOf(r.faceLandmarks[0] as NormalizedLandmark[], r.facialTransformationMatrixes?.[0]?.data)
}

/* ---------- the model ---------- */

export interface Model {
  mean: number[]; std: number[]; wx: number[]; wy: number[]
  /** v2: the basis the weights are for; absent = v1 (linear in all features) */
  basis?: 'poly2'
  /** lambdas chosen by cross-validation, per axis */
  lx?: number; ly?: number
  /** head pose and eye openness at calibration (for drift and blink checks) */
  pose?: number[]; ear?: number
}

export interface CalSample { f: Features; x: number; y: number; /** weight (default 1); clicks use less */ w?: number }

function solve(A: number[][], b: number[]): number[] {
  // Gaussian elimination with partial pivoting; A is small and square.
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r
    ;[M[c], M[p]] = [M[p], M[c]]
    const piv = M[c][c] || 1e-12
    for (let r = 0; r < n; r++) {
      if (r === c) continue
      const f = M[r][c] / piv
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]
    }
  }
  return M.map((row, i) => row[n] / (row[i] || 1e-12))
}

const HEAD = [F.YAW, F.PITCH, F.TX, F.TY, F.ROLL, F.SCALE]

/** The regression basis for one standardised feature vector z (last term is the intercept). */
function basisOf(z: number[], kind: Model['basis']): number[] {
  if (kind !== 'poly2' || z.length < N_FEATURES) return [...z, 1]
  // Eye-in-head direction: both eyes averaged (less noise), x from corners, y from corners and lids.
  const gx = (z[F.LX] + z[F.RX]) / 2
  const gy = (z[F.LY] + z[F.RY]) / 2
  const gl = (z[F.LLID] + z[F.RLID]) / 2
  const h = HEAD.map((i) => z[i])
  return [
    gx, gy, gl, z[F.LX] - z[F.RX], z[F.OPEN],
    gx * gx, gy * gy, gl * gl, gx * gy, gx * gl,
    ...h,
    // Head-pose compensation: the same iris position means a different screen point when the head turns or moves.
    gx * z[F.YAW], gy * z[F.PITCH], gl * z[F.PITCH], gx * z[F.SCALE], gy * z[F.SCALE],
    1,
  ]
}

function standardise(samples: CalSample[]) {
  const k = samples[0].f.length
  const W = samples.reduce((a, s) => a + (s.w ?? 1), 0) || 1
  const mean = Array.from({ length: k }, (_, j) => samples.reduce((a, s) => a + (s.w ?? 1) * s.f[j], 0) / W)
  const std = Array.from({ length: k }, (_, j) => Math.sqrt(samples.reduce((a, s) => a + (s.w ?? 1) * (s.f[j] - mean[j]) ** 2, 0) / W) || 1)
  return { mean, std }
}

function ridge(X: number[][], t: number[], w: number[], lambda: number): number[] {
  const n = X[0].length
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const b = new Array<number>(n).fill(0)
  for (let s = 0; s < X.length; s++) {
    const r = X[s], ws = w[s]
    for (let i = 0; i < n; i++) { b[i] += ws * r[i] * t[s]; const ri = ws * r[i]; for (let j = i; j < n; j++) A[i][j] += ri * r[j] }
  }
  for (let i = 0; i < n; i++) { for (let j = 0; j < i; j++) A[i][j] = A[j][i]; if (i < n - 1) A[i][i] += lambda }
  return solve(A, b)
}

const dot = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * (b[i] ?? 0); return s }
const LAMBDAS = [0.03, 0.1, 0.3, 1, 3, 10, 30, 100]

export interface FitOptions { /** 'linear' = the v1 model (all features, linear) */ basis?: 'linear' | 'poly2'; /** fixed lambda (skips cross-validation) */ lambda?: number }

/**
 * Fits the model. With the v2 basis and at least 6 calibration dots, each axis gets the lambda with
 * the lowest leave-one-dot-out error (a dot's samples are left out together, so the choice reflects
 * new screen positions, not new frames of the same look).
 */
export function fit(samples: CalSample[], opt: FitOptions | number = {}): Model {
  const o: FitOptions = typeof opt === 'number' ? { basis: 'linear', lambda: opt } : opt
  const poly = (o.basis ?? 'poly2') === 'poly2' && samples[0].f.length >= N_FEATURES
  const basis: Model['basis'] = poly ? 'poly2' : undefined
  const { mean, std } = standardise(samples)
  const X = samples.map((s) => basisOf(s.f.map((v, j) => (v - mean[j]) / std[j]), basis))
  const w = samples.map((s) => s.w ?? 1)
  const tx = samples.map((s) => s.x), ty = samples.map((s) => s.y)
  const groups = new Map<string, number[]>()
  samples.forEach((s, i) => { if ((s.w ?? 1) >= 1) { const k = `${Math.round(s.x)},${Math.round(s.y)}`; const g = groups.get(k); if (g) g.push(i); else groups.set(k, [i]) } })
  const pick = (t: number[]): number => {
    if (o.lambda != null) return o.lambda
    if (!poly || groups.size < 6) return poly ? 3 : 0.5
    let best = LAMBDAS[0], bestErr = Infinity
    for (const lam of LAMBDAS) {
      let err = 0, cnt = 0
      for (const idx of groups.values()) {
        const out = new Set(idx)
        const keep = X.map((_, i) => i).filter((i) => !out.has(i))
        const wt = ridge(keep.map((i) => X[i]), keep.map((i) => t[i]), keep.map((i) => w[i]), lam)
        // The dot's mean prediction vs its target: what validation measures.
        let p = 0
        for (const i of idx) p += dot(X[i], wt)
        err += (p / idx.length - t[idx[0]]) ** 2; cnt++
      }
      if (err / cnt < bestErr) { bestErr = err / cnt; best = lam }
    }
    return best
  }
  const lx = pick(tx), ly = pick(ty)
  const full = samples[0].f.length >= N_FEATURES
  const pose = full ? HEAD.map((i) => mean[i]) : undefined
  const ear = full ? (mean[F.EARL] + mean[F.EARR]) / 2 : undefined
  return { mean, std, wx: ridge(X, tx, w, lx), wy: ridge(X, ty, w, ly), basis, lx, ly, pose, ear }
}

export function predict(m: Model, f: Features): { x: number; y: number } {
  // A v1 model uses only the first slots, so it keeps working with v2 features.
  const z = m.mean.map((mu, j) => ((f[j] ?? mu) - mu) / m.std[j])
  const b = basisOf(z, m.basis)
  return { x: dot(b, m.wx), y: dot(b, m.wy) }
}

/* ---------- blinks, head movement ---------- */

/** A blink: eye openness (EAR when known) well below its calibration average. */
export const isBlink = (m: Model, f: Features) =>
  m.ear != null && f.length >= N_FEATURES ? Math.min(f[F.EARL], f[F.EARR]) < m.ear * 0.6 : f[F.OPEN] < m.mean[F.OPEN] * 0.55

/**
 * How far the head is from where it was during calibration, as a multiple of what the model can
 * absorb: < 1 fine, ≥ 1 too far (≈ 10° of turn, or 15% nearer/further, or a shift of ~4 cm).
 */
export function headDrift(m: Model, f: Features): number {
  if (!m.pose || f.length < N_FEATURES) return 0
  const [yaw, pitch, tx, ty, , scale] = m.pose
  return Math.max(
    Math.abs(f[F.YAW] - yaw) / 0.17, Math.abs(f[F.PITCH] - pitch) / 0.17,
    Math.abs(f[F.TX] - tx) / 0.09, Math.abs(f[F.TY] - ty) / 0.09,
    Math.abs(Math.log(Math.max(1e-6, f[F.SCALE]) / Math.max(1e-6, scale))) / 0.15,
  )
}
/** Weight of a sample given head drift: 1 near the calibration pose, falling to 0 at twice the limit. */
export const headWeight = (drift: number) => (drift <= 1 ? 1 : Math.max(0, 2 - drift))

/* ---------- calibration sampling ---------- */

/** Dropped after each click: the eyes are still landing on the dot. */
export const SETTLE_MS = 300
/** How long frames are collected for each dot, after the settle time. */
export const COLLECT_MS = 700

const medianOf = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0 }

/**
 * The fixation-stable part of one dot's frames: drops the first SETTLE_MS, blinks (when a model
 * exists to compare with, or by the window's own openness), and frames whose eye features are far
 * from the window's median (glances away, landmark jitter). Returns [] when too little is left.
 */
export function stableFrames(frames: { t: number; f: Features }[], t0: number, minKeep = 5): Features[] {
  let fs = frames.filter((x) => x.t - t0 >= SETTLE_MS).map((x) => x.f)
  if (fs.length < minKeep) return []
  const open = medianOf(fs.map((f) => f[F.OPEN]))
  fs = fs.filter((f) => f[F.OPEN] >= open * 0.6)
  const eyeSlots = [F.LX, F.LY, F.RX, F.RY]
  const med = eyeSlots.map((j) => medianOf(fs.map((f) => f[j])))
  const dist = fs.map((f) => Math.hypot(...eyeSlots.map((j, k) => f[j] - med[k])))
  const mad = medianOf(dist) || 1e-6
  const kept = fs.filter((_, i) => dist[i] <= 3 * mad + 1e-4)
  return kept.length >= minKeep ? kept : []
}

/** Calibration dots, as fractions of the window: a 3 × 3 grid plus four between them (13). */
export const CALIBRATION = [
  ...[0.1, 0.5, 0.9].flatMap((y) => [0.1, 0.5, 0.9].map((x) => ({ x, y }))),
  { x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.3, y: 0.7 }, { x: 0.7, y: 0.7 },
  // Default order is spread out (5 and 13 share no factor); calibrationOrder() randomises it per run.
].map((_, i, a) => a[(i * 5) % a.length])
/** Five dots the model never saw, to measure accuracy honestly. */
export const VALIDATION = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.2, y: 0.8 }, { x: 0.8, y: 0.8 }]
/** A quick recalibration: five dots added to the existing calibration. */
export const QUICK = [{ x: 0.5, y: 0.1 }, { x: 0.1, y: 0.5 }, { x: 0.9, y: 0.5 }, { x: 0.5, y: 0.9 }, { x: 0.5, y: 0.5 }]

/** The calibration dots in a random order (so the participant can't anticipate the next one). */
export function calibrationOrder(rand: () => number = Math.random) {
  const a = [...CALIBRATION]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

/* ---------- validation and quality ---------- */

/** Usual viewing distance from a laptop or desktop screen, cm, when it can't be estimated. */
export const DEFAULT_DISTANCE_CM = 60
/** Human iris diameter, about the same for every adult (cm). */
const IRIS_CM = 1.17
/**
 * Screen distance from the iris size in the image (a typical webcam sees about 60° across). Coarse:
 * cameras differ; clamped to 35–90 cm. The iris width is a fraction of the video width.
 */
export function distanceCm(irisW: number | null | undefined, hfovDeg = 60): number {
  if (!irisW || !(irisW > 0)) return DEFAULT_DISTANCE_CM
  const cm = IRIS_CM / (irisW * 2 * Math.tan((hfovDeg * Math.PI) / 360))
  return Math.min(90, Math.max(35, cm))
}
/** CSS pixels per degree of visual angle at a distance (CSS px are 1/96 in). */
export const pxPerDeg = (cm = DEFAULT_DISTANCE_CM) => (2 * cm * Math.tan(Math.PI / 360)) / 2.54 * 96

export interface Quality {
  /** mean distance between the estimate and the dot on the validation dots, CSS px */
  accuracy: number
  /** the same in degrees of visual angle (with the distance estimate) */
  accuracyDeg: number
  /** RMS sample-to-sample distance while looking at one dot, px (lower = steadier) */
  precision: number
  /** estimated distance from the screen, cm */
  distance: number
  /** per validation dot: error px */
  perDot: number[]
}

/**
 * Validation: for each dot, its frames' predictions. Accuracy is the mean distance between each
 * dot's mean prediction and the dot; precision is RMS-S2S over consecutive predictions.
 */
export function validate(model: Model, dots: { x: number; y: number; frames: Features[] }[], distance?: number): Quality {
  const perDot: number[] = []
  let s2s = 0, n2 = 0
  const irises: number[] = []
  for (const dt of dots) {
    if (!dt.frames.length) continue
    const ps = dt.frames.map((f) => predict(model, f))
    const mx = ps.reduce((a, p) => a + p.x, 0) / ps.length, my = ps.reduce((a, p) => a + p.y, 0) / ps.length
    perDot.push(Math.hypot(mx - dt.x, my - dt.y))
    for (let i = 1; i < ps.length; i++) { s2s += (ps[i].x - ps[i - 1].x) ** 2 + (ps[i].y - ps[i - 1].y) ** 2; n2++ }
    for (const f of dt.frames) if (f.length >= N_FEATURES) irises.push(f[F.IRIS])
  }
  const accuracy = perDot.length ? perDot.reduce((a, b) => a + b, 0) / perDot.length : Infinity
  const dist = distance ?? distanceCm(irises.length ? medianOf(irises) : null)
  return { accuracy: Math.round(accuracy), accuracyDeg: Math.round((accuracy / pxPerDeg(dist)) * 10) / 10, precision: Math.round(n2 ? Math.sqrt(s2s / n2) : 0), distance: Math.round(dist), perDot: perDot.map(Math.round) }
}

/** Accuracy labels shown to the participant, and the limit beyond which a quick recalibration is offered. */
export const GOOD_PX = 120
export const POOR_PX = 220
/** Same limits in degrees (about 3° and 5.5° at 60 cm). */
export const GOOD_DEG = 3
export const POOR_DEG = 5.5
export const qualityOf = (q: { accuracy: number; accuracyDeg?: number | null }): 'good' | 'rough' | 'poor' => {
  const deg = q.accuracyDeg
  if (deg != null && Number.isFinite(deg)) return deg <= GOOD_DEG ? 'good' : deg <= POOR_DEG ? 'rough' : 'poor'
  return q.accuracy <= GOOD_PX ? 'good' : q.accuracy <= POOR_PX ? 'rough' : 'poor'
}

/** Per-run quality after recording: data loss and head movement, as shares of the frames. */
export class RunMeter {
  frames = 0
  lost = 0
  blinks = 0
  moved = 0
  /** processing time per frame, ms (moving average) */
  ms = 0
  frame(r: 'ok' | 'lost' | 'blink' | 'moved', ms?: number) {
    this.frames++
    if (r === 'lost') this.lost++
    else if (r === 'blink') this.blinks++
    else if (r === 'moved') this.moved++
    if (ms != null) this.ms = this.ms ? this.ms * 0.95 + ms * 0.05 : ms
  }
  /** % of frames with no usable gaze (no face, blink), % with the head too far from the calibration pose. */
  summary() {
    const n = Math.max(1, this.frames)
    return { loss: Math.round(((this.lost + this.blinks) / n) * 100), head: Math.round((this.moved / n) * 100), msPerFrame: Math.round(this.ms * 10) / 10 }
  }
}

/**
 * Whether a click can teach the model (implicit recalibration): the gaze estimate must already be
 * near it (people look at what they click, but not always), so wild pairs don't drag the model.
 */
export const clickTeaches = (pred: { x: number; y: number }, click: { x: number; y: number }, accuracyPx: number) =>
  Math.hypot(pred.x - click.x, pred.y - click.y) <= Math.max(150, 2.5 * accuracyPx)
/** Weight of one click sample relative to a calibration sample. */
export const CLICK_WEIGHT = 0.5
