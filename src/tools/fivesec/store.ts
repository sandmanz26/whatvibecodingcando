/**
 * 5-second tests — show a screen for five seconds and record the first click.
 * Recorded: where the first click landed and on which control, and how fast.
 * Never anything typed. Frontend only: everything lives in this browser's localStorage.
 */
import { APP, readJSON, writeJSON } from '../shared'
import type { ClickEvent } from '../insights/store'

export interface FiveSecTest {
  id: string
  name: string
  /** what the participant is asked before the screen appears */
  prompt: string
  page: string
  query?: string
  seconds: number
  /** the element a "right" first click lands on, if the test has one */
  target?: { sel: string; label: string }
  createdAt: string
}

export interface FiveSecResult {
  id: string
  testId: string
  t: string
  vw: number
  vh: number
  /** no click within the time */
  missed?: boolean
  ms?: number
  x?: number
  y?: number
  docH?: number
  ex?: number
  ey?: number
  sel?: string
  label?: string
  hit?: boolean
}

const TESTS_KEY = `${APP}.fivesec`
const RESULTS_KEY = `${APP}.fivesec.results`

const SEED: FiveSecTest[] = [{
  id: 'first-look',
  name: 'Where do people go for AI help?',
  prompt: 'You don’t know exactly what to buy and would like some help choosing. Click where you would go first.',
  page: '/',
  seconds: 5,
  target: { sel: '#ask-ai', label: 'Ask AI' },
  createdAt: '2026-10-26T09:00:00.000Z',
}]

export const uid = () => Math.random().toString(36).slice(2, 10)
export const loadFiveSec = (): FiveSecTest[] => readJSON<FiveSecTest[] | null>(TESTS_KEY, null) ?? SEED
export const saveFiveSec = (t: FiveSecTest[]) => writeJSON(TESTS_KEY, t)
export const loadFiveSecResults = () => readJSON<FiveSecResult[]>(RESULTS_KEY, [])
export const addFiveSecResult = (r: FiveSecResult) => writeJSON(RESULTS_KEY, [...loadFiveSecResults(), r])
export const clearFiveSecResults = (testId: string) => writeJSON(RESULTS_KEY, loadFiveSecResults().filter((r) => r.testId !== testId))

/** First clicks in the shape the heatmap overlay draws. Misses are coloured as idle. */
export function fiveSecAsClicks(testId: string): ClickEvent[] {
  const test = loadFiveSec().find((t) => t.id === testId)
  return loadFiveSecResults().filter((r) => r.testId === testId && !r.missed).map((r) => ({
    type: 'click' as const, t: r.t, sid: r.id, page: test?.page ?? '/', vw: r.vw, vh: r.vh,
    x: r.x ?? 50, y: r.y ?? 0, docH: r.docH ?? 0, label: r.label ?? '', tag: '', kind: 'button' as const, section: '',
    sel: r.sel ?? '', ex: r.ex ?? 50, ey: r.ey ?? 50, ew: 0, eh: 0, ms: r.ms ?? 0, sy: 0,
    fx: test?.target ? (r.hit ? 'changed' as const : 'nothing' as const) : 'changed' as const,
  }))
}

export function summarizeFiveSec(test: FiveSecTest) {
  const rs = loadFiveSecResults().filter((r) => r.testId === test.id)
  const clicked = rs.filter((r) => !r.missed)
  const times = clicked.map((r) => r.ms ?? 0).sort((a, b) => a - b)
  const median = times.length ? (times.length % 2 ? times[(times.length - 1) / 2] : (times[times.length / 2 - 1] + times[times.length / 2]) / 2) : 0
  const by = new Map<string, { n: number; hit: boolean }>()
  clicked.forEach((r) => { const e = by.get(r.label ?? '') ?? { n: 0, hit: !!r.hit }; e.n++; by.set(r.label ?? '', e) })
  return {
    results: rs,
    participants: rs.length,
    clicked: clicked.length,
    hits: clicked.filter((r) => r.hit).length,
    medianMs: median,
    firsts: [...by.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.n - a.n),
  }
}
