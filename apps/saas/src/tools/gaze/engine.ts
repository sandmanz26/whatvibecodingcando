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
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'

const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

export type { Features, Model } from '../../core/gaze-model'
export { startCamera, stopCamera, features, fit, predict, CALIBRATION, VALIDATION, isBlink } from '../../core/gaze-model'

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

