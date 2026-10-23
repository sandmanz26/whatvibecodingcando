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
}

export interface GazeSession { sid: string; start: string; vw: number; accuracy: number | null }

const POINTS_KEY = `${APP}.gaze.points`
const SESSIONS_KEY = `${APP}.gaze.sessions`
const MAX = 20000

export const loadGaze = () => readJSON<GazePoint[]>(POINTS_KEY, [])
export const appendGaze = (pts: GazePoint[]) => { if (pts.length) writeJSON(POINTS_KEY, [...loadGaze(), ...pts].slice(-MAX)) }
export const loadGazeSessions = () => readJSON<GazeSession[]>(SESSIONS_KEY, [])
export const saveGazeSession = (s: GazeSession) => writeJSON(SESSIONS_KEY, [...loadGazeSessions().filter((x) => x.sid !== s.sid), s])
export function clearGaze() {
  try { localStorage.removeItem(POINTS_KEY); localStorage.removeItem(SESSIONS_KEY) } catch { /* ignore */ }
}
