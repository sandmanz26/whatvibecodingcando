/**
 * Gaze points — where on a page someone was looking. See the privacy rules in ./engine.ts.
 * Frontend only: points live in this browser's localStorage.
 */
import { APP, readJSON, writeJSON } from '../shared'

export interface GazePoint {
  /** gaze session (one calibration, one tab) */
  sid: string
  t: string
  page: string
  /** % of the window width */
  x: number
  /** px from the top of the page */
  y: number
  vw: number
  vh: number
  /** epoch ms, for fixation timing (older points only have t) */
  ms?: number
  /** usability test: the participant's session, the task, and ms since that task started */
  test?: string
  task?: string
  tt?: number
}

/** A usability test asks for eye tracking, and hears back when it is ready or ended. */
export const GAZE_START = 'market:gaze-start'
export const GAZE_READY = 'market:gaze-ready'
export const GAZE_ENDED = 'market:gaze-ended'
export const GAZE_STOP = 'market:gaze-stop'
export const timeOf = (p: GazePoint) => p.ms ?? Date.parse(p.t)

export interface GazeSession { sid: string; start: string; vw: number; accuracy: number | null }

const POINTS_KEY = `${APP}.gaze.points`
const SESSIONS_KEY = `${APP}.gaze.sessions`
const MAX = 40000

export const loadGaze = () => readJSON<GazePoint[]>(POINTS_KEY, [])
export const appendGaze = (pts: GazePoint[]) => { if (pts.length) writeJSON(POINTS_KEY, [...loadGaze(), ...pts].slice(-MAX)) }
export const loadGazeSessions = () => readJSON<GazeSession[]>(SESSIONS_KEY, [])
export const saveGazeSession = (s: GazeSession) => writeJSON(SESSIONS_KEY, [...loadGazeSessions().filter((x) => x.sid !== s.sid), s])
export function clearGaze() {
  try { localStorage.removeItem(POINTS_KEY); localStorage.removeItem(SESSIONS_KEY) } catch { /* ignore */ }
}

/* ---------- recording inside a frame (a run recorded on the Heatmap page) ---------- */

/**
 * When the app being studied runs in a frame on the page (Heatmap → Record a run here), gaze is
 * measured on the whole window and must be turned into a point on the framed page. The page that
 * hosts the frame registers how; with none registered, gaze is the window's own page.
 */
export interface GazeFrame {
  /** window coordinates → the framed page's point, or null when the gaze is outside the frame */
  map(x: number, y: number): { page: string; x: number; y: number; vw: number; vh: number } | null
  /** the test run and task the samples belong to, if any */
  ctx(): { test: string; task: string; tt: number } | null
}
let frame: GazeFrame | null = null
export const setGazeFrame = (f: GazeFrame | null) => { frame = f }
export const gazeFrame = () => frame

/** Clicks inside a frame don't reach the window: the frame's host forwards them for calibration. */
let clickHook: ((x: number, y: number) => void) | null = null
export const setGazeClickHook = (h: typeof clickHook) => { clickHook = h }
export const noteGazeClick = (x: number, y: number) => clickHook?.(x, y)

/** Removes the gaze points that match (e.g. one usability run's task). */
export function removeGaze(match: (p: GazePoint) => boolean) {
  const all = loadGaze()
  const keep = all.filter((p) => !match(p))
  if (keep.length !== all.length) writeJSON(POINTS_KEY, keep)
}
