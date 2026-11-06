/**
 * Narrations — a spoken walkthrough recorded live while moving through the app.
 * The recording is one audio clip; each screen visited becomes a chapter, so the
 * explanation for any screen can be played on its own.
 */
import { APP, readJSON, writeJSON } from '../shared'
import { deleteClip } from './audio'

export interface Chapter { page: string; query?: string; /** ms into the recording */ at: number }
export interface Narration { id: string; title: string; startedAt: string; ms: number; chapters: Chapter[]; type: string }
export interface Clip { narration: Narration; page: string; query?: string; from: number; to: number }

const KEY = `${APP}.narrations`
/** dispatch with detail 'start' | 'stop' to control the recorder from anywhere */
export const NARRATE_EVENT = `${APP}:narrate`
/** fired when recording starts/stops or the list of narrations changes */
export const NARRATION_CHANGED = `${APP}:narrations`
export const audioId = (n: Pick<Narration, 'id'>) => `narration-${n.id}`

export const loadNarrations = () => readJSON<Narration[]>(KEY, [])
export function saveNarrations(list: Narration[]) {
  writeJSON(KEY, list)
  window.dispatchEvent(new Event(NARRATION_CHANGED))
}
export async function removeNarration(id: string) {
  await deleteClip(`narration-${id}`)
  saveNarrations(loadNarrations().filter((n) => n.id !== id))
}

/** Each chapter as a time range. */
export const clipsOf = (n: Narration): Clip[] =>
  n.chapters.map((c, i) => ({ narration: n, page: c.page, query: c.query, from: c.at, to: n.chapters[i + 1]?.at ?? n.ms }))

/** Everything said about one screen, newest narration first; very short passes are skipped. */
export const clipsFor = (page: string, list = loadNarrations()) =>
  [...list].reverse().flatMap(clipsOf).filter((c) => c.page === page && c.to - c.from >= 1500)

/** Screens and how much was said about each, across all narrations. */
export function byScreen(list = loadNarrations()) {
  const m = new Map<string, Clip[]>()
  for (const c of list.flatMap(clipsOf)) if (c.to - c.from >= 1500) m.set(c.page, [...(m.get(c.page) ?? []), c])
  return [...m.entries()].map(([page, clips]) => ({ page, clips, ms: clips.reduce((a, c) => a + c.to - c.from, 0) })).sort((a, b) => a.page.localeCompare(b.page))
}
