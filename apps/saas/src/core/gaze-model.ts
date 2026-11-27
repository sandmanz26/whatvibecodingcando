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
  return detect(lm, video, at).f
}
/** One frame → features plus where the face is in the (unmirrored) image, for the pre-check. */
export function detect(lm: FaceLandmarker, video: HTMLVideoElement, at: number): { f: Features | null; face: { cx: number; cy: number } | null } {
  if (video.readyState < 2) return { f: null, face: null }
  const ts = Math.max(Math.round(at), lastTs + 1); lastTs = ts
  const r = lm.detectForVideo(video, ts)
  const pts = r.faceLandmarks[0] as NormalizedLandmark[] | undefined
  const face = pts && pts.length > 263 ? { cx: (pts[33].x + pts[263].x) / 2, cy: (pts[33].y + pts[263].y + 2 * pts[1].y) / 4 } : null
  return { f: featuresOf(pts as NormalizedLandmark[], r.facialTransformationMatrixes?.[0]?.data), face }
}

/* ---------- the model ---------- */

export type Basis = 'poly2' | 'eye1' | 'eye1h' | 'eye2h'
export interface Model {
  mean: number[]; std: number[]; wx: number[]; wy: number[]
  /** the basis the weights are for; absent = v1 (linear in all features) */
  basis?: Basis
  /** lambdas chosen by cross-validation, per axis */
  lx?: number; ly?: number
  /** head pose at calibration: median (v3; mean before), and its spread (1.4826 × MAD) per HEAD slot */
  pose?: number[]; spread?: number[]
  /** eye openness at calibration (blinks) */
  ear?: number
  /** leave-one-dot-out error of the chosen model, px (what a new screen position is likely to be off by) */
  cv?: number
  /** 3 = floors and clipped head terms (models saved before predict as they did) */
  v?: 3
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
/**
 * Smallest spread a feature is standardised by (raw units). Without it a feature that barely moves
 * during calibration (the head, when the participant sits still) is divided by its own landmark
 * noise: that noise becomes a unit-size input the regression can fit, and the head's ordinary
 * movement afterwards becomes 10–50 standard deviations, so predictions fly off the screen.
 * About 2° of turn, 1.5% of the distance sideways, 3% nearer/further.
 */
const STD_FLOOR: Partial<Record<number, number>> = { [F.YAW]: 0.035, [F.PITCH]: 0.035, [F.TX]: 0.015, [F.TY]: 0.015, [F.ROLL]: 0.035 }
const SCALE_FLOOR = 0.03
/** Standardised head terms are clipped here, so a head far from calibration can't throw the estimate off the screen. */
const HEAD_CLIP = 3
const clip = (v: number) => (v > HEAD_CLIP ? HEAD_CLIP : v < -HEAD_CLIP ? -HEAD_CLIP : v)

/** The regression basis for one standardised feature vector z (last term is the intercept). */
function basisOf(z: number[], kind: Model['basis'], clipOn = true): number[] {
  if (!kind || z.length < N_FEATURES) return [...z, 1]
  // Eye-in-head direction: both eyes averaged (less noise), x from corners, y from corners and lids.
  const gx = (z[F.LX] + z[F.RX]) / 2
  const gy = (z[F.LY] + z[F.RY]) / 2
  const gl = (z[F.LLID] + z[F.RLID]) / 2
  const c = clipOn ? clip : (v: number) => v
  const yaw = c(z[F.YAW]), pitch = c(z[F.PITCH]), tx = c(z[F.TX]), ty = c(z[F.TY]), roll = c(z[F.ROLL]), scale = c(z[F.SCALE])
  if (kind === 'eye1') return [gx, gy, gl, z[F.OPEN], 1]
  if (kind === 'eye1h') return [gx, gy, gl, z[F.OPEN], yaw, pitch, tx, ty, scale, 1]
  if (kind === 'eye2h') return [gx, gy, gl, z[F.OPEN], gx * gx, gy * gy, gx * gy, gx * gl, yaw, pitch, tx, ty, scale, 1]
  return [
    gx, gy, gl, z[F.LX] - z[F.RX], z[F.OPEN],
    gx * gx, gy * gy, gl * gl, gx * gy, gx * gl,
    yaw, pitch, tx, ty, roll, scale,
    // Head-pose compensation: the same iris position means a different screen point when the head turns or moves.
    gx * yaw, gy * pitch, gl * pitch, gx * scale, gy * scale,
    1,
  ]
}

function standardise(samples: CalSample[]) {
  const k = samples[0].f.length
  const W = samples.reduce((a, s) => a + (s.w ?? 1), 0) || 1
  const mean = Array.from({ length: k }, (_, j) => samples.reduce((a, s) => a + (s.w ?? 1) * s.f[j], 0) / W)
  const std = Array.from({ length: k }, (_, j) => {
    const sd = Math.sqrt(samples.reduce((a, s) => a + (s.w ?? 1) * (s.f[j] - mean[j]) ** 2, 0) / W)
    const floor = k >= N_FEATURES ? (j === F.SCALE ? Math.abs(mean[j]) * SCALE_FLOOR : STD_FLOOR[j] ?? 0) : 0
    return Math.max(sd, floor) || 1
  })
  return { mean, std }
}

/** Weighted normal equations Σ w·x·xᵀ and Σ w·x·t (both axes) for a set of rows. */
function normal(X: number[][], tx: number[], ty: number[], w: number[], idx: number[]) {
  const n = X[0].length
  const A = Array.from({ length: n }, () => new Array<number>(n).fill(0))
  const bx = new Array<number>(n).fill(0), by = new Array<number>(n).fill(0)
  for (const s of idx) {
    const r = X[s], ws = w[s]
    for (let i = 0; i < n; i++) { const ri = ws * r[i]; bx[i] += ri * tx[s]; by[i] += ri * ty[s]; for (let j = i; j < n; j++) A[i][j] += ri * r[j] }
  }
  for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) A[i][j] = A[j][i]
  return { A, bx, by }
}
/** Ridge solution from normal equations (the intercept, last, is not shrunk). */
function ridgeFrom(A: number[][], b: number[], lambda: number): number[] {
  const n = b.length
  return solve(A.map((row, i) => row.map((v, j) => (i === j && i < n - 1 ? v + lambda : v))), b)
}
function ridge(X: number[][], t: number[], w: number[], lambda: number): number[] {
  const { A, bx } = normal(X, t, t, w, X.map((_, i) => i))
  return ridgeFrom(A, bx, lambda)
}

const dot = (a: number[], b: number[]) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * (b[i] ?? 0); return s }
const LAMBDAS = [0.03, 0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000]
/** Candidate models, simplest first: a richer one is only picked when it is clearly better on dots it didn't see. */
export const BASES: Basis[] = ['eye1', 'eye1h', 'eye2h', 'poly2']
const BETTER = 0.97

export interface FitOptions {
  /** 'linear' = the v1 model; a Basis forces it; 'auto' (default) picks by leave-one-dot-out error */
  basis?: 'linear' | 'auto' | Basis
  /** fixed lambda (skips cross-validation) */
  lambda?: number
  /** v2 behaviour, for comparisons: no std floors and mean pose (tests only) */
  legacy?: boolean
}

const medianOf = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0 }

/**
 * Fits the model. With at least 6 calibration dots, every candidate basis and lambda is scored by
 * leave-one-dot-out error (a dot's samples are left out together, so the score reflects new screen
 * positions, not new frames of the same look), and the best is kept. With 16 features and 13 dots a
 * 22-term polynomial can memorise the calibration; the simpler bases usually win on real webcams.
 */
export function fit(samples: CalSample[], opt: FitOptions | number = {}): Model {
  const o: FitOptions = typeof opt === 'number' ? { basis: 'linear', lambda: opt } : opt
  const full = samples[0].f.length >= N_FEATURES
  const want = o.basis ?? 'auto'
  const { mean, std } = o.legacy ? standardiseLegacy(samples) : standardise(samples)
  const w = samples.map((s) => s.w ?? 1)
  const tx = samples.map((s) => s.x), ty = samples.map((s) => s.y)
  const groups = new Map<string, number[]>()
  samples.forEach((s, i) => { if ((s.w ?? 1) >= 1) { const k = `${Math.round(s.x)},${Math.round(s.y)}`; const g = groups.get(k); if (g) g.push(i); else groups.set(k, [i]) } })
  const all = samples.map((_, i) => i)
  const zs = samples.map((s) => s.f.map((v, j) => (v - mean[j]) / std[j]))
  const cands: Model['basis'][] = !full || want === 'linear' ? [undefined] : want === 'auto' ? BASES : [want]
  let best: { basis: Model['basis']; lx: number; ly: number; err: number; X: number[][] } | null = null
  for (const basis of cands) {
    const X = zs.map((z) => basisOf(z, basis, !o.legacy))
    if (o.lambda != null || groups.size < 6) {
      const lam = o.lambda ?? (basis === 'poly2' ? 3 : basis ? 1 : 0.5)
      // Too few dots to compare: the small eye + head model (or the one asked for).
      if (cands.length === 1 || basis === 'eye1h') { best = { basis, lx: lam, ly: lam, err: NaN, X }; break }
      continue
    }
    const tot = normal(X, tx, ty, w, all)
    const folds = [...groups.values()].map((idx) => {
      const g = normal(X, tx, ty, w, idx)
      const xbar = X[0].map((_, j) => idx.reduce((a, i) => a + X[i][j], 0) / idx.length)
      return { A: tot.A.map((row, i) => row.map((v, j) => v - g.A[i][j])), bx: tot.bx.map((v, i) => v - g.bx[i]), by: tot.by.map((v, i) => v - g.by[i]), xbar, x: tx[idx[0]], y: ty[idx[0]] }
    })
    // Per axis: each lambda's held-out errors, per dot.
    const errs = (axis: 'x' | 'y') => LAMBDAS.map((lam) => folds.map((fd) => dot(fd.xbar, ridgeFrom(fd.A, axis === 'x' ? fd.bx : fd.by, lam)) - fd[axis]))
    const ex = errs('x'), ey = errs('y')
    const sse = (e: number[]) => e.reduce((a, v) => a + v * v, 0)
    const ix = ex.map(sse).reduce((bi, v, i, a) => (v < a[bi] ? i : bi), 0)
    const iy = ey.map(sse).reduce((bi, v, i, a) => (v < a[bi] ? i : bi), 0)
    const err = folds.reduce((a, _, k) => a + Math.hypot(ex[ix][k], ey[iy][k]), 0) / folds.length
    if (!best || err < best.err * BETTER) best = { basis, lx: LAMBDAS[ix], ly: LAMBDAS[iy], err, X }
  }
  const b = best!
  const head = samples.filter((s) => (s.w ?? 1) >= 1)
  const pose = full ? HEAD.map((i) => (o.legacy ? mean[i] : medianOf(head.map((s) => s.f[i])))) : undefined
  const spread = full && !o.legacy ? HEAD.map((i, k) => 1.4826 * medianOf(head.map((s) => Math.abs(s.f[i] - pose![k])))) : undefined
  const ear = full ? (mean[F.EARL] + mean[F.EARR]) / 2 : undefined
  return { mean, std, wx: ridge(b.X, tx, w, b.lx), wy: ridge(b.X, ty, w, b.ly), basis: b.basis, lx: b.lx, ly: b.ly, pose, spread, ear, ...(o.legacy ? {} : { v: 3 as const }), ...(Number.isFinite(b.err) ? { cv: Math.round(b.err) } : {}) }
}
/** v2's standardisation (no floors), kept to measure what the floors change. */
function standardiseLegacy(samples: CalSample[]) {
  const k = samples[0].f.length
  const W = samples.reduce((a, s) => a + (s.w ?? 1), 0) || 1
  const mean = Array.from({ length: k }, (_, j) => samples.reduce((a, s) => a + (s.w ?? 1) * s.f[j], 0) / W)
  const std = Array.from({ length: k }, (_, j) => Math.sqrt(samples.reduce((a, s) => a + (s.w ?? 1) * (s.f[j] - mean[j]) ** 2, 0) / W) || 1)
  return { mean, std }
}

export function predict(m: Model, f: Features): { x: number; y: number } {
  // A v1 model uses only the first slots, so it keeps working with v2 features.
  const z = m.mean.map((mu, j) => ((f[j] ?? mu) - mu) / m.std[j])
  const b = basisOf(z, m.basis, m.v === 3)
  return { x: dot(b, m.wx), y: dot(b, m.wy) }
}

/* ---------- blinks, head movement ---------- */

/** A blink: eye openness (EAR when known) well below its calibration average. */
export const isBlink = (m: Model, f: Features) =>
  m.ear != null && f.length >= N_FEATURES ? Math.min(f[F.EARL], f[F.EARR]) < m.ear * 0.6 : f[F.OPEN] < m.mean[F.OPEN] * 0.55

/**
 * Head limits: how far from the calibration pose the model still copes (it has head terms):
 * yaw and pitch ≈ 15°, a shift of ≈ 12% of the distance (≈ 7 cm at 60 cm), 20% nearer/further.
 */
export const HEAD_LIMITS = { yaw: 0.26, pitch: 0.26, shift: 0.12, scale: 0.2 }
/** Tolerance is never tighter than this many times the head's own spread during calibration. */
export const SPREAD_K = 2.5

/**
 * How far the head is from where it was during calibration, as a multiple of the tolerance:
 * < 1 fine, ≥ 1 too far. The tolerance per axis is the larger of the head limit and 2.5× the
 * spread measured during calibration (so a face model that is jittery on this camera doesn't warn).
 */
export function headDrift(m: Model, f: Features): number {
  if (!m.pose || f.length < N_FEATURES) return 0
  const [yaw, pitch, tx, ty, , scale] = m.pose
  const sp = m.spread ?? [0, 0, 0, 0, 0, 0]
  const tol = (lim: number, s: number) => Math.max(lim, SPREAD_K * s)
  const sc = Math.max(1e-6, scale)
  return Math.max(
    Math.abs(f[F.YAW] - yaw) / tol(HEAD_LIMITS.yaw, sp[0]), Math.abs(f[F.PITCH] - pitch) / tol(HEAD_LIMITS.pitch, sp[1]),
    Math.abs(f[F.TX] - tx) / tol(HEAD_LIMITS.shift, sp[2]), Math.abs(f[F.TY] - ty) / tol(HEAD_LIMITS.shift, sp[3]),
    Math.abs(Math.log(Math.max(1e-6, f[F.SCALE]) / sc)) / tol(HEAD_LIMITS.scale, sp[5] / sc),
  )
}
/** Weight of a sample given head drift: 1 near the calibration pose, falling to 0 at twice the limit. */
export const headWeight = (drift: number) => (drift <= 1 ? 1 : Math.max(0, 2 - drift))

export type HeadState = 'ok' | 'far' | 'lost'
/**
 * What the participant is told about their head, with hysteresis so noise never flickers it:
 * - 'far' only after the head has been beyond the tolerance for `enterMs` (2 s) without a break
 *   longer than a moment, and back to 'ok' once it has been well inside (drift < 0.8) for `exitMs`;
 * - 'lost' when no face has been seen for `lostMs`: the head warning is dropped meanwhile (we can't
 *   know where the head is), and "We can't see your face" is shown instead.
 */
export class HeadCheck {
  state: HeadState = 'ok'
  private farSince: number | null = null
  private inSince: number | null = null
  private lastFace: number | null = null
  private model: Model
  private opt: { enterMs: number; exitMs: number; lostMs: number }
  constructor(model: Model, opt = { enterMs: 2000, exitMs: 600, lostMs: 1000 }) { this.model = model; this.opt = opt }
  setModel(m: Model) { this.model = m }
  update(f: Features | null, now: number): HeadState {
    if (!f) {
      if (this.lastFace == null) this.lastFace = now
      if (now - this.lastFace >= this.opt.lostMs) { this.state = 'lost'; this.farSince = null; this.inSince = null }
      return this.state
    }
    this.lastFace = now
    if (this.state === 'lost') this.state = 'ok'
    const d = headDrift(this.model, f)
    if (this.state === 'ok') {
      if (d > 1) { this.farSince ??= now; if (now - this.farSince >= this.opt.enterMs) { this.state = 'far'; this.inSince = null } }
      else if (d < 0.9) this.farSince = null
    } else if (d < 0.8) { this.inSince ??= now; if (now - this.inSince >= this.opt.exitMs) { this.state = 'ok'; this.farSince = null } }
    else this.inSince = null
    return this.state
  }
}

/* ---------- calibration sampling ---------- */

/** Dropped after each click: the eyes are still landing on the dot. */
export const SETTLE_MS = 300
/** How long frames are collected for each dot, after the settle time. */
export const COLLECT_MS = 700

/**
 * The fixation-stable part of one dot's frames: drops the first SETTLE_MS, blinks (when a model
 * exists to compare with, or by the window's own openness), and frames whose eye features are far
 * from the window's median (glances away, landmark jitter). Returns [] when too little is left.
 */
export function stableFrames(frames: { t: number; f: Features }[], t0: number, minKeep = 5, settle = SETTLE_MS): Features[] {
  let fs = frames.filter((x) => x.t - t0 >= settle).map((x) => x.f)
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

/**
 * Automatic collection (v3): the dot appears and shrinks; frames are read from the moment it shows.
 * The first AUTO_SETTLE_MS are dropped (the eyes need ~200 ms to start moving and land), then the dot
 * is done as soon as at least AUTO_MIN_FRAMES steady frames are in (≥ 75% of the window steady), or
 * at AUTO_MAX_MS with whatever steady frames there are. No click needed: reading frames *after* a
 * click (v2) caught eyes already leaving for the next dot.
 */
export const AUTO_SETTLE_MS = 450
export const AUTO_MIN_MS = 1100
/** A dot never waits longer than this: at the timeout it keeps whatever frames it has. */
export const AUTO_MAX_MS = 2500
export const AUTO_MIN_FRAMES = 15
/** Fewer usable frames than this and the dot counts as unseen (it is retried once, then skipped). */
export const DOT_MIN_FRAMES = 3
/**
 * Is this dot done? Steadiness is judged against the window's own measured noise (stableFrames keeps
 * frames within 3 × the median deviation of this dot's frames), so a jittery webcam is not held to a
 * steadier one's standard. Done early when enough steady frames are in; at AUTO_MAX_MS it always
 * returns: the steady frames, or else every frame after the settle time (possibly none: unseen).
 */
export function dotDone(frames: { t: number; f: Features }[], t0: number, now: number): Features[] | null {
  const post = frames.filter((x) => x.t - t0 >= AUTO_SETTLE_MS)
  if (now - t0 < AUTO_MIN_MS) return null
  const kept = stableFrames(frames, t0, DOT_MIN_FRAMES, AUTO_SETTLE_MS)
  if (kept.length >= AUTO_MIN_FRAMES && kept.length >= 0.75 * post.length) return kept
  if (now - t0 >= AUTO_MAX_MS) return kept.length ? kept : post.map((x) => x.f)
  return null
}
/** The same, when the participant clicks the dot: done at once (after a short settle), with what is there. */
export function dotClicked(frames: { t: number; f: Features }[], t0: number, now: number): Features[] | null {
  if (now - t0 < SETTLE_MS) return null
  const kept = stableFrames(frames, t0, DOT_MIN_FRAMES, SETTLE_MS)
  return kept.length ? kept : frames.filter((x) => x.t - t0 >= SETTLE_MS).map((x) => x.f)
}

/* ---------- the pre-check (camera preview, before calibration) ---------- */

export type PrecheckIssue = 'noface' | 'left' | 'right' | 'up' | 'down' | 'close' | 'far' | 'dark' | 'bright'
/**
 * What to fix before calibrating, most important first. `face` is the face's centre in the raw
 * (unmirrored) camera image, 0–1; the preview is shown mirrored, so "move left" means the person's
 * own left. `brightness` is the mean luma of the frame, 0–255.
 */
export function precheck(p: { face: { cx: number; cy: number } | null; irisW?: number | null; brightness?: number | null }): PrecheckIssue[] {
  if (!p.face) return ['noface']
  const out: PrecheckIssue[] = []
  // Tolerant on purpose (owner's laptop test): a face a little off-centre, a laptop's usual 40–80 cm
  // (the iris estimate reads far on wide-angle webcams, so only the extremes count), and backlight from
  // a window behind the person (the frame's mean is bright while the face is fine) all pass.
  const mx = 1 - p.face.cx
  if (mx > 0.72) out.push('left'); else if (mx < 0.28) out.push('right')
  if (p.face.cy < 0.18) out.push('down'); else if (p.face.cy > 0.8) out.push('up')
  // Close is judged as a 60° camera sees it, far as a wide 78° laptop camera does: either way only real extremes.
  if (p.irisW) { if (distanceCm(p.irisW, 60) <= 35) out.push('close'); else if (distanceCm(p.irisW, 78) >= 90) out.push('far') }
  if (p.brightness != null) { if (p.brightness < 30) out.push('dark'); else if (p.brightness > 248) out.push('bright') }
  return out
}
/** The three rows the pre-check screen shows, and which issues each one covers. */
export const PRECHECK_ROWS: { key: 'face' | 'distance' | 'light'; ok: string; issues: PrecheckIssue[] }[] = [
  { key: 'face', ok: 'Face in the middle', issues: ['noface', 'left', 'right', 'up', 'down'] },
  { key: 'distance', ok: 'About an arm’s length away', issues: ['close', 'far'] },
  { key: 'light', ok: 'Enough light on your face', issues: ['dark', 'bright'] },
]
/** How long the shown checks must stay green before "Start calibration" turns on (well under 1 s). */
export const PRECHECK_READY_MS = 300
/**
 * The pre-check's state over time: what to show, and whether Start is on. The rows and the button
 * read the SAME smoothed list, so the screen can never show three ✓ with the button off. An issue is
 * shown only when it is in at least 3 of the last 5 frames (one noisy frame neither shows a warning nor
 * resets the timer); `ready` once nothing has been shown for PRECHECK_READY_MS.
 */
export class PrecheckGate {
  private hist: PrecheckIssue[][] = []
  private okSince: number | null = null
  issues: PrecheckIssue[] | null = null
  ready = false
  push(list: PrecheckIssue[], now: number): { issues: PrecheckIssue[] | null; ready: boolean } {
    this.hist.push(list); if (this.hist.length > 5) this.hist.shift()
    // The first frames: nothing judged yet ("Checking…" on screen, Start off).
    if (this.hist.length < 3) { this.issues = null; this.ready = false; return { issues: null, ready: false } }
    const all = [...new Set(this.hist.flat())]
    let issues = all.filter((i) => this.hist.filter((h) => h.includes(i)).length >= 3)
    // No face hides the other rows' warnings (they can't be measured), never the other way round.
    if (issues.includes('noface')) issues = ['noface']
    if (issues.length) this.okSince = null; else this.okSince ??= now
    this.issues = issues
    this.ready = this.okSince != null && now - this.okSince >= PRECHECK_READY_MS
    return { issues, ready: this.ready }
  }
}
export const PRECHECK_TEXT: Record<PrecheckIssue, string> = {
  noface: 'We can’t see your face. Sit in front of the camera.',
  left: 'Move a little to your left, so your face is in the middle.',
  right: 'Move a little to your right, so your face is in the middle.',
  up: 'Raise the screen or sit up a little: your face is low in the picture.',
  down: 'Lower the screen a little: your face is high in the picture.',
  close: 'Sit a little further back (about an arm’s length).',
  far: 'Come a little closer (about an arm’s length).',
  dark: 'It’s too dark. Turn on a light in front of you.',
  bright: 'Too much light behind or on the camera. Face the light, not a window behind you.',
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
/**
 * Realistic for a laptop webcam at arm's length: good ≤ 150 px (about the size of a button group),
 * okay ≤ 250 px (areas of the page), poor above. In pixels, the unit people see on the page; degrees
 * are shown beside them (the distance estimate behind degrees is coarse).
 */
export const GOOD_PX = 150
export const POOR_PX = 250
/** The same limits in degrees at 60 cm (kept for reports that only have degrees). */
export const GOOD_DEG = 3.5
export const POOR_DEG = 6
export const qualityOf = (q: { accuracy: number; accuracyDeg?: number | null }): 'good' | 'rough' | 'poor' => {
  if (Number.isFinite(q.accuracy)) return q.accuracy <= GOOD_PX ? 'good' : q.accuracy <= POOR_PX ? 'rough' : 'poor'
  const deg = q.accuracyDeg
  return deg != null && Number.isFinite(deg) ? (deg <= GOOD_DEG ? 'good' : deg <= POOR_DEG ? 'rough' : 'poor') : 'poor'
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
