/**
 * Webcam eye tracking — where on the screen someone is looking, estimated in this browser.
 *
 * Privacy rules (non-negotiable):
 * - The camera only starts after the participant agrees, and stops when they stop.
 * - Video frames never leave this browser and are never stored: each frame is turned
 *   into face landmarks by MediaPipe (running locally in WebAssembly) and dropped.
 * - What is kept is only the estimated gaze point on the page (x, y), with the page path.
 *
 * How it works: MediaPipe Face Landmarker finds the irises and eye corners in each frame.
 * From them we take where each iris sits inside its eye, how open the eyes are, and the
 * head's direction. A short calibration (look at a dot, click it) fits a ridge regression
 * from those features to screen coordinates. Webcam tracking is coarse — typically
 * 100–200 px — so the result is shown as soft areas, never as single points.
 */
import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'

const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export type Features = number[]

let landmarker: Promise<FaceLandmarker> | null = null

/** Loads the face model once (about 4 MB, then cached by the browser). */
export function loadLandmarker(): Promise<FaceLandmarker> {
  if (!landmarker) {
    landmarker = (async () => {
      const { FaceLandmarker } = await import('@mediapipe/tasks-vision')
      return FaceLandmarker.createFromOptions({ wasmLoaderPath, wasmBinaryPath }, {
        baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
      })
    })()
    landmarker.catch(() => { landmarker = null })
  }
  return landmarker
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  await video.play()
  return stream
}

export const stopCamera = (stream: MediaStream | null) => stream?.getTracks().forEach((t) => t.stop())

const d = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y)

function eye(lm: NormalizedLandmark[], outer: number, inner: number, top: number, bottom: number, iris: number) {
  const w = d(lm[outer], lm[inner]) || 1e-6
  const cx = (lm[outer].x + lm[inner].x) / 2
  const cy = (lm[top].y + lm[bottom].y) / 2
  return { fx: (lm[iris].x - cx) / w, fy: (lm[iris].y - cy) / w, open: (lm[bottom].y - lm[top].y) / w }
}

/** One frame → a feature vector, or null when no face (or no irises) is found. */
export function features(lm: FaceLandmarker, video: HTMLVideoElement, at: number): Features | null {
  const r = lm.detectForVideo(video, at)
  const face = r.faceLandmarks[0]
  if (!face || face.length < 478) return null
  const L = eye(face, 33, 133, 159, 145, 468)
  const R = eye(face, 263, 362, 386, 374, 473)
  // Head direction: the face's forward axis and position, from the transformation matrix.
  const m = r.facialTransformationMatrixes?.[0]?.data
  const head = m && m.length === 16 ? [m[8], m[9], m[12] / Math.abs(m[14] || 1), m[13] / Math.abs(m[14] || 1)] : [0, 0, 0, 0]
  return [L.fx, L.fy, R.fx, R.fy, (L.open + R.open) / 2, ...head]
}

/* ---------- the model: standardised ridge regression, one for x and one for y ---------- */

export interface Model { mean: number[]; std: number[]; wx: number[]; wy: number[] }

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

export function fit(samples: { f: Features; x: number; y: number }[], lambda = 0.5): Model {
  const k = samples[0].f.length
  const mean = Array.from({ length: k }, (_, j) => samples.reduce((a, s) => a + s.f[j], 0) / samples.length)
  const std = Array.from({ length: k }, (_, j) => Math.sqrt(samples.reduce((a, s) => a + (s.f[j] - mean[j]) ** 2, 0) / samples.length) || 1)
  const X = samples.map((s) => [...s.f.map((v, j) => (v - mean[j]) / std[j]), 1])
  const n = k + 1
  const XtX = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => X.reduce((a, r) => a + r[i] * r[j], 0) + (i === j && i < k ? lambda : 0)))
  const Xt = (t: number[]) => Array.from({ length: n }, (_, i) => X.reduce((a, r, s) => a + r[i] * t[s], 0))
  return { mean, std, wx: solve(XtX, Xt(samples.map((s) => s.x))), wy: solve(XtX, Xt(samples.map((s) => s.y))) }
}

export function predict(m: Model, f: Features): { x: number; y: number } {
  const z = [...f.map((v, j) => (v - m.mean[j]) / m.std[j]), 1]
  const dot = (w: number[]) => z.reduce((a, v, i) => a + v * w[i], 0)
  return { x: dot(m.wx), y: dot(m.wy) }
}

/** Calibration dots, as fractions of the window: a 3 × 3 grid, then four to check accuracy. */
export const CALIBRATION = [0.1, 0.5, 0.9].flatMap((y) => [0.1, 0.5, 0.9].map((x) => ({ x, y })))
export const VALIDATION = [{ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.3 }, { x: 0.3, y: 0.7 }, { x: 0.7, y: 0.7 }]
