/**
 * The script's eye tracking, loaded only for a study participant who agreed to it:
 * https://<our domain>/embed/gaze.js, a module beside vibe.js. It brings the face model (MediaPipe,
 * running in WebAssembly in the participant's browser); its files sit next to it in mediapipe/.
 * Video never leaves the browser: each frame becomes face landmarks and is dropped.
 */
import type { FaceLandmarker } from '@mediapipe/tasks-vision'
export { startCamera, stopCamera, features, fit, predict, CALIBRATION, VALIDATION, isBlink } from '../gaze-model'
export type { Features, Model } from '../gaze-model'

const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
let landmarker: Promise<FaceLandmarker> | null = null
export function loadLandmarker(): Promise<FaceLandmarker> {
  landmarker ??= (async () => {
    const { FaceLandmarker } = await import('@mediapipe/tasks-vision')
    return FaceLandmarker.createFromOptions({
      wasmLoaderPath: new URL('mediapipe/vision_wasm_internal.js', import.meta.url).href,
      wasmBinaryPath: new URL('mediapipe/vision_wasm_internal.wasm', import.meta.url).href,
    }, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true })
  })()
  landmarker.catch(() => { landmarker = null })
  return landmarker
}
