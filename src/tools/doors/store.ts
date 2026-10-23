/**
 * Fake doors — a button for something that isn't built yet, to measure who wants it.
 * Recorded per anonymous tab: the door was seen, and the door was clicked. Nothing else.
 * Frontend only: everything lives in this browser's localStorage.
 */
import { APP, readJSON, writeJSON } from '../shared'

export interface FakeDoor {
  id: string
  name: string
  page: string
  /** the element the door is, or sits next to */
  sel: string
  anchorLabel: string
  /** 'existing': that element becomes the door · 'new': a new button is added after it */
  mode: 'existing' | 'new'
  /** text of the new button */
  label: string
  /** what someone sees after clicking */
  message: string
  live: boolean
  createdAt: string
}

export interface DoorEvent { door: string; sid: string; type: 'seen' | 'click'; t: string; vw: number }

const DOORS_KEY = `${APP}.doors`
const EVENTS_KEY = `${APP}.doors.events`
const SID_KEY = `${APP}.doors.sid`
export const DOORS_EVENT = `${APP}:doors`

export const DEFAULT_MESSAGE = 'This isn’t available yet. Thanks for trying it — it tells us whether to build it next.'

const SEED: FakeDoor[] = [{
  id: 'export-csv',
  name: 'Export the skill list',
  page: '/skills',
  sel: 'select[aria-label="Sort"]',
  anchorLabel: 'Sort menu',
  mode: 'new',
  label: 'Export CSV',
  message: DEFAULT_MESSAGE,
  live: false,
  createdAt: '2026-10-22T09:00:00.000Z',
}]

export const uid = () => Math.random().toString(36).slice(2, 10)
export const loadDoors = (): FakeDoor[] => readJSON<FakeDoor[] | null>(DOORS_KEY, null) ?? SEED
export function saveDoors(d: FakeDoor[]) {
  writeJSON(DOORS_KEY, d)
  window.dispatchEvent(new Event(DOORS_EVENT))
}
export const loadDoorEvents = () => readJSON<DoorEvent[]>(EVENTS_KEY, [])
export const addDoorEvent = (e: DoorEvent) => writeJSON(EVENTS_KEY, [...loadDoorEvents(), e].slice(-20000))
export const clearDoorEvents = (door: string) => writeJSON(EVENTS_KEY, loadDoorEvents().filter((e) => e.door !== door))

export function doorSid() {
  try {
    let id = sessionStorage.getItem(SID_KEY)
    if (!id) { id = uid(); sessionStorage.setItem(SID_KEY, id) }
    return id
  } catch { return 'no-session' }
}

export function doorStats(door: string) {
  const ev = loadDoorEvents().filter((e) => e.door === door)
  const seen = new Set(ev.filter((e) => e.type === 'seen').map((e) => e.sid))
  const clickedBy = new Set(ev.filter((e) => e.type === 'click').map((e) => e.sid))
  clickedBy.forEach((s) => seen.add(s))
  return {
    seen: seen.size,
    clickedBy: clickedBy.size,
    clicks: ev.filter((e) => e.type === 'click').length,
    rate: seen.size ? clickedBy.size / seen.size : 0,
    last: ev.filter((e) => e.type === 'click').at(-1)?.t,
  }
}
