import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Clock, Flag, TimerOff, ListChecks } from 'lucide-react'
import { APP, TOOL_DOM, isEmbedded } from '../shared'
import { describeTarget } from '../insights/tracker'
import { loadSessions, loadTests, pageMatches, uid, upsertSession, type Attempt, type Outcome, type TaskTap, type TestSession, type UsabilityTest } from './store'

const RUN_KEY = `${APP}.tests.run`

interface Run {
  sessionId: string
  testId: string
  index: number
  phase: 'intro' | 'ready' | 'doing' | 'result' | 'finished'
  startedAt: number
  taps: TaskTap[]
  pages: string[]
  last?: { outcome: Outcome; ms: number }
}

// The run survives a reload (sessionStorage), so a refresh mid-task doesn't lose it.
const readRun = (): Run | null => {
  try { return JSON.parse(sessionStorage.getItem(RUN_KEY) ?? 'null') } catch { return null }
}
const writeRun = (r: Run | null) => {
  try { r ? sessionStorage.setItem(RUN_KEY, JSON.stringify(r)) : sessionStorage.removeItem(RUN_KEY) } catch { /* ignore */ }
}

function hitsElement(target: Element, sel: string) {
  try { return [...document.querySelectorAll(sel)].some((m) => m.contains(target)) } catch { return false }
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Participant side of a usability test. Starts from any URL with ?test=<id>. */
export function UsabilityRunner() {
  const { pathname, search } = useLocation()
  const nav = useNavigate()
  const [run, setRunState] = useState<Run | null>(readRun)
  const [test, setTest] = useState<UsabilityTest | null>(() => (run ? loadTests().find((t) => t.id === run.testId) ?? null : null))
  const [alias, setAlias] = useState('')
  const [now, setNow] = useState(Date.now())
  const [expanded, setExpanded] = useState(false)
  const runRef = useRef(run)
  runRef.current = run

  const setRun = useCallback((r: Run | null) => { writeRun(r); setRunState(r) }, [])

  // ?test=<id> starts a run, then the parameter is removed from the address.
  useEffect(() => {
    if (isEmbedded) return
    const id = new URLSearchParams(search).get('test')
    if (!id) return
    const t = loadTests().find((x) => x.id === id)
    nav({ pathname, search: '' }, { replace: true })
    if (!t || !t.tasks.length) return
    setTest(t)
    setRun({ sessionId: uid(), testId: t.id, index: 0, phase: 'intro', startedAt: 0, taps: [], pages: [] })
  }, [search, pathname, nav, setRun])

  useEffect(() => {
    if (run) document.documentElement.dataset.utRunning = 'on'
    else delete document.documentElement.dataset.utRunning
  }, [run])

  const task = test && run ? test.tasks[run.index] : undefined

  const finish = useCallback((outcome: Outcome, markLastTapHit = false) => {
    const r = runRef.current
    if (!r || r.phase !== 'doing' || !test) return
    const t = test.tasks[r.index]
    const ms = Math.min(Date.now() - r.startedAt, t.limitSec * 1000)
    const taps = markLastTapHit && r.taps.length ? r.taps.map((x, i) => (i === r.taps.length - 1 ? { ...x, hit: true } : x)) : r.taps
    const first = taps[0]
    const firstTapCorrect = !first ? null
      : t.success.kind === 'element' ? first.hit
        // Page tasks: right if the first move lands on the target or on a page above it (e.g. /skills → /skills/s9).
        : first.hit || (!!r.pages[1] && (pageMatches(t.success.page, r.pages[1]) || t.success.page.startsWith(`${r.pages[1].replace(/\/$/, '')}/`)))
    const attempt: Attempt = { taskId: t.id, outcome, ms, taps, pages: r.pages, firstTapCorrect }
    const session = loadSessions().find((s) => s.id === r.sessionId)
    if (session) {
      const next: TestSession = { ...session, attempts: [...session.attempts.filter((a) => a.taskId !== t.id), attempt] }
      if (r.index === test.tasks.length - 1) next.finishedAt = new Date().toISOString()
      upsertSession(next)
    }
    setRun({ ...r, phase: 'result', taps, last: { outcome, ms } })
  }, [test, setRun])

  // Timer.
  useEffect(() => {
    if (run?.phase !== 'doing' || !task) return
    const t = window.setInterval(() => {
      setNow(Date.now())
      if (Date.now() - run.startedAt >= task.limitSec * 1000) finish('timeout')
    }, 250)
    return () => window.clearInterval(t)
  }, [run?.phase, run?.startedAt, task, finish])

  // Pages visited; a page rule succeeds on arrival.
  useEffect(() => {
    const r = runRef.current
    if (!r || r.phase !== 'doing' || !task) return
    if (r.pages[r.pages.length - 1] !== pathname) {
      const next = { ...r, pages: [...r.pages, pathname] }
      runRef.current = next
      setRun(next)
    }
    if (task.success.kind === 'page' && pageMatches(task.success.page, pathname)) finish('success', true)
  }, [pathname, task, finish, setRun])

  // Taps: position and control name only — never anything typed.
  useEffect(() => {
    if (run?.phase !== 'doing' || !task) return
    const onClick = (e: MouseEvent) => {
      const r = runRef.current
      if (!r || !(e.target instanceof Element) || e.target.closest(TOOL_DOM)) return
      const { sel, label } = describeTarget(e.target)
      const hit = task.success.kind === 'element' && hitsElement(e.target, task.success.sel)
      const tap: TaskTap = {
        t: Date.now() - r.startedAt, page: window.location.hash.replace(/^#/, '').split('?')[0] || '/',
        x: Math.round((e.clientX / window.innerWidth) * 1000) / 10, y: Math.round(e.clientY + window.scrollY),
        docH: document.documentElement.scrollHeight, vw: window.innerWidth, label, sel, hit,
      }
      const next = { ...r, taps: [...r.taps, tap] }
      runRef.current = next
      setRun(next)
      if (hit) finish('success')
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [run?.phase, task, finish, setRun])

  if (isEmbedded || !run || !test || !task) return null

  const begin = () => {
    const session: TestSession = {
      id: run.sessionId, testId: test.id,
      participant: alias.trim().slice(0, 40) || `Participant ${new Set(loadSessions().filter((s) => s.testId === test.id).map((s) => s.id)).size + 1}`,
      startedAt: new Date().toISOString(), vw: window.innerWidth, attempts: [],
    }
    upsertSession(session)
    setRun({ ...run, phase: 'ready' })
  }
  const startTask = () => {
    nav(task.startPage)
    window.scrollTo(0, 0)
    setExpanded(false)
    setRun({ ...run, phase: 'doing', startedAt: Date.now(), taps: [], pages: [task.startPage] })
    setNow(Date.now())
  }
  const next = () => {
    if (run.index + 1 < test.tasks.length) setRun({ ...run, index: run.index + 1, phase: 'ready', taps: [], pages: [] })
    else setRun({ ...run, phase: 'finished' })
  }
  const close = () => setRun(null)

  const step = <span className="ut-step">Task {run.index + 1} of {test.tasks.length}</span>
  const remaining = task.limitSec * 1000 - (now - run.startedAt)

  const card = (body: React.ReactNode) => (
    <>
      <div className="ut-scrim" />
      <div className="ut-card" role="dialog" aria-modal="true" aria-label={test.name}>{body}</div>
    </>
  )

  return createPortal(
    <div data-usability-test>
      {run.phase === 'intro' && card(<>
        <span className="ut-step"><ListChecks size={13} /> Usability test</span>
        <h2>{test.name}</h2>
        <p>{test.intro}</p>
        <ul className="ut-rules">
          <li>{test.tasks.length} task{test.tasks.length === 1 ? '' : 's'}, each with a time limit.</li>
          <li>Think out loud if someone is with you. Skip a task any time with “Give up”.</li>
          <li>We record where you tap and how long it takes — never what you type.</li>
        </ul>
        <label className="ut-field">
          <span>Nickname or code <em>(optional)</em></span>
          <input className="input" value={alias} maxLength={40} onChange={(e) => setAlias(e.target.value)} placeholder="e.g. P4" autoFocus />
        </label>
        <div className="ut-actions">
          <button className="btn ghost" onClick={close}>Not now</button>
          <button className="btn primary" onClick={begin}>Begin</button>
        </div>
      </>)}

      {run.phase === 'ready' && card(<>
        {step}
        <p className="ut-prompt">{task.prompt}</p>
        <p className="ut-limit"><Clock size={14} /> You have {task.limitSec >= 60 ? `${Math.floor(task.limitSec / 60)} min${task.limitSec % 60 ? ` ${task.limitSec % 60} s` : ''}` : `${task.limitSec} seconds`}. The task stays at the bottom of the screen.</p>
        <div className="ut-actions">
          <button className="btn primary" onClick={startTask}>Start task</button>
        </div>
      </>)}

      {run.phase === 'doing' && (
        <div className="ut-bar" role="region" aria-label="Current task">
          <div className="ut-bar-text" onClick={() => setExpanded((x) => !x)} title={expanded ? 'Collapse' : 'Show the whole task'}>
            {step}
            <span className={`ut-bar-prompt ${expanded ? 'open' : ''}`}>{task.prompt}</span>
          </div>
          <span className={`ut-timer ${remaining < 10000 ? 'low' : ''}`} aria-live="off"><Clock size={13} />{clock(remaining)}</span>
          <button className="btn sm ghost" onClick={() => finish('gave_up')}><Flag size={13} /> Give up</button>
        </div>
      )}

      {run.phase === 'result' && run.last && card(<>
        {step}
        {run.last.outcome === 'success' && <div className="ut-outcome good"><CheckCircle2 size={22} /><div><b>Task complete</b><span>in {secs(run.last.ms)} · {run.taps.length} tap{run.taps.length === 1 ? '' : 's'}</span></div></div>}
        {run.last.outcome === 'timeout' && <div className="ut-outcome"><TimerOff size={22} /><div><b>Time’s up</b><span>That’s useful to know — it means the design made this hard.</span></div></div>}
        {run.last.outcome === 'gave_up' && <div className="ut-outcome"><Flag size={22} /><div><b>Skipped</b><span>Thanks — skipping tells us something too.</span></div></div>}
        <div className="ut-actions">
          <button className="btn primary" onClick={next}>{run.index + 1 < test.tasks.length ? 'Next task' : 'Finish'}</button>
        </div>
      </>)}

      {run.phase === 'finished' && card(<>
        <span className="ut-step"><CheckCircle2 size={13} /> All done</span>
        <h2>Thank you!</h2>
        <p>Your answers are saved. You can close this and keep using the app.</p>
        <div className="ut-actions"><button className="btn primary" onClick={close}>Close</button></div>
      </>)}
    </div>,
    document.body,
  )
}
