/**
 * Usability tests (task-based) — definitions and results.
 *
 * A participant gets tasks one by one, each with a time limit. A task succeeds
 * when they reach a target page or tap a target element. We record outcome,
 * time on task, taps (position + control name only — never typed text) and
 * the pages visited. The participant name is an optional nickname they type.
 *
 * Frontend only: everything lives in this browser's localStorage.
 */
import { APP, readJSON, writeJSON } from '../shared'
import type { ClickEvent } from '../insights/store'

export type SuccessRule =
  | { kind: 'page'; page: string }
  | { kind: 'element'; sel: string; label: string; page: string }

export interface TestTask {
  id: string
  prompt: string
  startPage: string
  success: SuccessRule
  limitSec: number
}

export interface UsabilityTest {
  id: string
  name: string
  intro: string
  tasks: TestTask[]
  createdAt: string
  updatedAt: string
}

export interface TaskTap {
  /** ms since the task started */
  t: number
  page: string
  x: number
  y: number
  docH: number
  vw: number
  label: string
  sel: string
  hit: boolean
  /** where on the element (%), so the tap is drawn where it landed */
  ex?: number
  ey?: number
}

export type Outcome = 'success' | 'timeout' | 'gave_up'

export interface Attempt {
  taskId: string
  outcome: Outcome
  ms: number
  taps: TaskTap[]
  pages: string[]
  firstTapCorrect: boolean | null
}

export interface TestSession {
  id: string
  testId: string
  participant: string
  startedAt: string
  finishedAt?: string
  vw: number
  attempts: Attempt[]
}

const TESTS_KEY = `${APP}.tests`
const SESSIONS_KEY = `${APP}.tests.sessions`

export const uid = () => Math.random().toString(36).slice(2, 10)

const SEED: UsabilityTest[] = [{
  id: 'basics',
  name: 'Keeping skills tidy',
  intro: 'Imagine you look after the Claude skills your company’s teams use. You’ll get three short tasks. There are no wrong answers — we’re testing the design, not you.',
  createdAt: '2026-10-22T09:00:00.000Z',
  updatedAt: '2026-10-22T09:00:00.000Z',
  tasks: [
    { id: 't1', prompt: 'Find out which projects use the Release notes skill and open its page.', startPage: '/', success: { kind: 'page', page: '/skills/release-notes' }, limitSec: 60 },
    { id: 't2', prompt: 'Two teams wrote skills that do the same job. Find where the app lists duplicates.', startPage: '/', success: { kind: 'page', page: '/health' }, limitSec: 60 },
    { id: 't3', prompt: 'Which skills does the Customer Success team run the most? Open that team’s view.', startPage: '/', success: { kind: 'page', page: '/teams' }, limitSec: 60 },
  ],
}]

export const loadTests = (): UsabilityTest[] => readJSON<UsabilityTest[] | null>(TESTS_KEY, null) ?? SEED
export const saveTests = (tests: UsabilityTest[]) => writeJSON(TESTS_KEY, tests)

export const loadSessions = (): TestSession[] => readJSON<TestSession[]>(SESSIONS_KEY, [])
export const saveSessions = (s: TestSession[]) => writeJSON(SESSIONS_KEY, s)

export function upsertSession(s: TestSession) {
  const all = loadSessions()
  const i = all.findIndex((x) => x.id === s.id)
  if (i >= 0) all[i] = s
  else all.push(s)
  saveSessions(all)
}

/** Task taps in the shape the heatmap overlay draws. */
export function taskTapsAsClicks(testId: string, taskId: string): ClickEvent[] {
  return loadSessions()
    .filter((s) => s.testId === testId)
    .flatMap((s) => s.attempts.filter((a) => a.taskId === taskId).flatMap((a) => a.taps.map((t) => ({ ...t, sid: s.id }))))
    .map((t) => ({
      type: 'click' as const, t: '', sid: t.sid, page: t.page, vw: t.vw, vh: 0,
      x: t.x, y: t.y, docH: t.docH, label: t.label, tag: '', kind: 'button' as const, section: '',
      sel: t.sel, ex: t.ex ?? 50, ey: t.ey ?? 50, ew: 0, eh: 0, ms: t.t, sy: 0,
      // In task maps, "idle" colouring marks taps that missed the target.
      fx: t.hit ? 'changed' as const : 'nothing' as const,
    }))
}

/** Does this page satisfy a page rule? A trailing * matches anything below it. */
export function pageMatches(rule: string, path: string) {
  return rule.endsWith('*') ? path.startsWith(rule.slice(0, -1)) : path === rule
}

export function summarize(test: UsabilityTest, sessions: TestSession[]) {
  const mine = sessions.filter((s) => s.testId === test.id)
  const median = (a: number[]) => {
    if (!a.length) return 0
    const s = [...a].sort((x, y) => x - y)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
  }
  const tasks = test.tasks.map((task) => {
    const at = mine.flatMap((s) => s.attempts.filter((a) => a.taskId === task.id))
    const ok = at.filter((a) => a.outcome === 'success')
    const first = at.filter((a) => a.firstTapCorrect !== null)
    const firstLabels = new Map<string, { n: number; correct: boolean }>()
    at.forEach((a) => {
      const f = a.taps[0]
      if (!f) return
      const e = firstLabels.get(f.label) ?? { n: 0, correct: a.firstTapCorrect ?? f.hit }
      e.n++
      firstLabels.set(f.label, e)
    })
    return {
      task,
      attempts: at.length,
      success: ok.length,
      timeouts: at.filter((a) => a.outcome === 'timeout').length,
      gaveUp: at.filter((a) => a.outcome === 'gave_up').length,
      medianMs: median(ok.map((a) => a.ms)),
      avgTaps: at.length ? at.reduce((n, a) => n + a.taps.length, 0) / at.length : 0,
      firstCorrect: first.filter((a) => a.firstTapCorrect).length,
      firstTotal: first.length,
      // Direct = succeeded without returning to a page they had already left.
      direct: ok.filter((a) => new Set(a.pages).size === a.pages.length).length,
      firstTaps: [...firstLabels.entries()].map(([label, v]) => ({ label, ...v })).sort((a, b) => b.n - a.n),
      pages: [...new Set(at.flatMap((a) => a.taps.map((t) => t.page)))],
    }
  })
  return { sessions: mine, tasks }
}
