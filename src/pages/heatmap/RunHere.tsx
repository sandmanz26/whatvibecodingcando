import { useCallback, useEffect, useRef, useState } from 'react'
import { Clock, Flag, Square, Eye, X, CheckCircle2, TimerOff } from 'lucide-react'
import { describeTarget } from '../../tools/insights/tracker'
import { appendLocal, type ClickEvent, type InsightEvent } from '../../tools/insights/store'
import { pageMatches, uid, upsertSession, type Attempt, type Outcome, type TaskTap, type TestTask, type UsabilityTest } from '../../tools/tests/store'
import { GAZE_ENDED, GAZE_READY, GAZE_START, GAZE_STOP, noteGazeClick, setGazeFrame } from '../../tools/gaze/store'
import { TOOL_DOM } from '../../tools/shared'

/**
 * Record a run without leaving the Heatmap: the app opens in a frame on this page, the task sits
 * on top, and clicks, pages and (if wanted) eye movement are recorded the same way the participant
 * runner records them. When it ends, the run is saved and the heatmap shows it.
 */
type Phase = 'setup' | 'eyes' | 'doing' | 'done'
const r1 = (n: number) => Math.round(n * 10) / 10
const pathOf = (w: Window | null) => (w?.location.hash.replace(/^#/, '').split('?')[0]) || '/'
const clock = (ms: number) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

export function RunHere({ test, task, startPage, onClose }: {
  /** a usability test task to do; without one, free browsing recorded as everyday clicks */
  test?: UsabilityTest; task?: TestTask; startPage: string
  onClose: (saved: { page: string } | null) => void
}) {
  const frame = useRef<HTMLIFrameElement>(null)
  const [phase, setPhase] = useState<Phase>('setup')
  const [name, setName] = useState('')
  const [eyes, setEyes] = useState(false)
  const [eyesOn, setEyesOn] = useState(false)
  const [accuracy, setAccuracy] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [result, setResult] = useState<{ outcome: Outcome | 'stopped'; ms: number; taps: number; pages: number } | null>(null)
  const run = useRef({ id: uid(), startedAt: 0, taps: [] as TaskTap[], pages: [] as string[], events: [] as InsightEvent[], done: false })
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const src = `${window.location.pathname}${window.location.search}#${startPage}`

  /* ---------- finishing ---------- */
  const finish = useCallback((outcome: Outcome | 'stopped', markLastHit = false) => {
    const r = run.current
    if (r.done || phaseRef.current !== 'doing') return
    r.done = true
    const ms = Date.now() - r.startedAt
    const vw = frame.current?.contentWindow?.innerWidth ?? window.innerWidth
    if (test && task && outcome !== 'stopped') {
      const taps = markLastHit && r.taps.length ? r.taps.map((x, i) => (i === r.taps.length - 1 ? { ...x, hit: true } : x)) : r.taps
      const first = taps[0]
      // Same rule as the participant runner: right if the first move hits the target, or (page tasks) lands on or above it.
      const firstTapCorrect = !first ? null : task.success.kind === 'element' ? first.hit
        : first.hit || (!!r.pages[1] && (pageMatches(task.success.page, r.pages[1]) || task.success.page.startsWith(`${r.pages[1].replace(/\/$/, '')}/`)))
      const attempt: Attempt = { taskId: task.id, outcome, ms: Math.min(ms, task.limitSec * 1000), taps, pages: r.pages, firstTapCorrect }
      upsertSession({ id: r.id, testId: test.id, participant: name.trim().slice(0, 40) || 'You (on Heatmap)', startedAt: new Date(r.startedAt).toISOString(), finishedAt: new Date().toISOString(), vw, attempts: [attempt], ...(eyesOn && accuracy !== null ? { gaze: { accuracy } } : {}) })
    }
    if (!test) appendLocal([...r.events, { type: 'end', t: new Date().toISOString(), sid: r.id, page: pathOf(frame.current?.contentWindow ?? null), vw, vh: frame.current?.contentWindow?.innerHeight ?? 0, reason: 'ended' } as InsightEvent])
    setGazeFrame(null)
    if (eyesOn) window.dispatchEvent(new Event(GAZE_STOP))
    setResult({ outcome, ms, taps: test ? r.taps.length : r.events.filter((e) => e.type === 'click').length, pages: new Set(r.pages).size })
    setPhase('done')
  }, [test, task, name, eyesOn, accuracy])

  /* ---------- starting ---------- */
  const begin = () => {
    if (eyes) { setPhase('eyes'); window.dispatchEvent(new Event(GAZE_START)); return }
    startDoing(false)
  }
  const startDoing = (withEyes: boolean) => {
    const w = frame.current?.contentWindow
    if (w && pathOf(w) !== startPage) w.location.hash = startPage
    w?.scrollTo(0, 0)
    run.current = { id: uid(), startedAt: Date.now(), taps: [], pages: [startPage], events: [], done: false }
    setEyesOn(withEyes)
    setPhase('doing')
  }
  useEffect(() => {
    if (phase !== 'eyes') return
    const ready = (e: Event) => { setAccuracy((e as CustomEvent<{ accuracy: number }>).detail?.accuracy ?? null); startDoing(true) }
    const ended = () => startDoing(false)
    window.addEventListener(GAZE_READY, ready)
    window.addEventListener(GAZE_ENDED, ended)
    return () => { window.removeEventListener(GAZE_READY, ready); window.removeEventListener(GAZE_ENDED, ended) }
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps
  // Eye tracking stopped mid-run: the run goes on without it.
  useEffect(() => {
    const ended = () => setEyesOn(false)
    window.addEventListener(GAZE_ENDED, ended)
    return () => window.removeEventListener(GAZE_ENDED, ended)
  }, [])

  /* ---------- recording inside the frame ---------- */
  useEffect(() => {
    if (phase !== 'doing') return
    const f = frame.current
    const w = f?.contentWindow
    const doc = f?.contentDocument
    if (!f || !w || !doc) return
    const r = run.current
    const view = (page: string) => { if (!test) r.events.push({ type: 'view', t: new Date().toISOString(), sid: r.id, page, vw: w.innerWidth, vh: w.innerHeight }) }
    view(pathOf(w))
    // Gaze on the window becomes a point on the framed page.
    if (eyesOn) setGazeFrame({
      map: (x, y) => {
        const b = f.getBoundingClientRect()
        if (x < b.left || x > b.right || y < b.top || y > b.bottom) return null
        return { page: pathOf(w), x: ((x - b.left) / w.innerWidth) * 100, y: y - b.top + w.scrollY, vw: w.innerWidth, vh: w.innerHeight }
      },
      ctx: () => (test && task && !r.done ? { test: r.id, task: task.id, tt: Date.now() - r.startedAt } : null),
    })
    // Pages visited; a page task succeeds on arrival.
    const pages = window.setInterval(() => {
      const p = pathOf(w)
      if (r.pages[r.pages.length - 1] !== p) { r.pages.push(p); view(p) }
      if (task?.success.kind === 'page' && pageMatches(task.success.page, p)) finish('success', true)
    }, 150)
    // Clicks: where, on what (selector and name) — never anything typed.
    const click = (e: MouseEvent) => {
      // The frame's elements belong to the frame's window, so `instanceof Element` (this window's) would be false.
      const target = e.target as Element | null
      if (!target || target.nodeType !== 1 || target.closest(TOOL_DOM)) return
      const b = f.getBoundingClientRect()
      noteGazeClick(b.left + e.clientX, b.top + e.clientY)
      const { el, sel, label } = describeTarget(target)
      const box = el.getBoundingClientRect()
      const page = pathOf(w)
      const ex = box.width ? r1(((e.clientX - box.left) / box.width) * 100) : 50
      const ey = box.height ? r1(((e.clientY - box.top) / box.height) * 100) : 50
      const x = r1((e.clientX / w.innerWidth) * 100), y = Math.round(e.clientY + w.scrollY), docH = doc.documentElement.scrollHeight
      if (test && task) {
        let hit = false
        if (task.success.kind === 'element') { try { hit = [...doc.querySelectorAll(task.success.sel)].some((m) => m.contains(target)) } catch { /* bad selector */ } }
        r.taps.push({ t: Date.now() - r.startedAt, page, x, y, docH, vw: w.innerWidth, label, sel, hit, ex, ey })
        if (hit) window.setTimeout(() => finish('success'), 0)
        return
      }
      // Everyday browsing: did the click do anything? A page change or a change on screen within 700 ms.
      const ev: ClickEvent = { type: 'click', t: new Date().toISOString(), sid: r.id, page, vw: w.innerWidth, vh: w.innerHeight, x, y, docH, label, tag: el.tagName.toLowerCase(), kind: 'button', section: '', sel, ex, ey, ew: Math.round(box.width), eh: Math.round(box.height), ms: Date.now() - r.startedAt, sy: r1(Math.min(100, ((w.scrollY + w.innerHeight) / Math.max(1, docH)) * 100)), fx: 'nothing' }
      r.events.push(ev)
      let changed = false
      const mo = new MutationObserver(() => { changed = true })
      mo.observe(doc.body, { subtree: true, childList: true, attributes: true, characterData: true })
      window.setTimeout(() => { mo.disconnect(); ev.fx = pathOf(w) !== page ? 'navigated' : changed ? 'changed' : 'nothing' }, 700)
    }
    doc.addEventListener('click', click, true)
    return () => { window.clearInterval(pages); doc.removeEventListener('click', click, true) }
  }, [phase, eyesOn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Timer for a task.
  useEffect(() => {
    if (phase !== 'doing') return
    const t = window.setInterval(() => {
      setNow(Date.now())
      if (task && Date.now() - run.current.startedAt >= task.limitSec * 1000) finish('timeout')
    }, 250)
    return () => window.clearInterval(t)
  }, [phase, task, finish])

  // While recording, the research dock steps aside so it can't be clicked by mistake.
  useEffect(() => { document.documentElement.dataset.recordingRun = 'on'; return () => { delete document.documentElement.dataset.recordingRun } }, [])
  // Leaving mid-run (closing the panel or the page) records nothing and turns the camera off.
  useEffect(() => () => { setGazeFrame(null); if (phaseRef.current === 'doing' || phaseRef.current === 'eyes') window.dispatchEvent(new Event(GAZE_STOP)) }, [])

  const left = task ? task.limitSec * 1000 - (now - run.current.startedAt) : now - run.current.startedAt

  return (
    <div className="rh" role="dialog" aria-modal="true" aria-label={task ? 'Record a task run' : 'Record browsing'}>
      <div className="rh-bar">
        {phase === 'doing' ? (
          <>
            <span className="rh-rec"><i /> Recording{eyesOn ? <> · <Eye size={13} /> eyes</> : ''}</span>
            <span className="rh-prompt">{task ? task.prompt : 'Browse the shop as a visitor would. Your clicks are recorded.'}</span>
            <span className={`rh-time ${task && left < 10000 ? 'low' : ''}`}><Clock size={13} /> {clock(task ? left : now - run.current.startedAt)}</span>
            {task ? <button className="btn sm" onClick={() => finish('gave_up')}><Flag size={13} /> Give up</button> : <button className="btn sm primary" onClick={() => finish('stopped')}><Square size={12} /> Stop</button>}
          </>
        ) : (
          <>
            <b className="rh-title">{task ? 'Record a run of this task' : 'Record browsing'}</b>
            <span className="rh-prompt muted">{phase === 'eyes' ? 'Setting up eye tracking…' : phase === 'done' ? 'Saved.' : 'Do it here, in the shop below.'}</span>
            <button className="btn sm ghost icon" onClick={() => onClose(phase === 'done' ? { page: startPage } : null)} aria-label="Close"><X size={15} /></button>
          </>
        )}
      </div>
      <div className="rh-stage">
        <iframe ref={frame} src={src} title="The shop, for recording" />
        {phase === 'setup' && (
          <div className="rh-over">
            <div className="rh-card">
              {task ? <><span className="muted" style={{ fontSize: 12 }}>Task · {test?.name}</span><p className="rh-task">{task.prompt}</p><p className="muted" style={{ fontSize: 13 }}>Starts on <span className="mono">{task.startPage}</span> · {task.limitSec} s. It ends when you reach the goal, give up, or time runs out.</p></>
                : <p className="rh-task">Browse the shop below. Every click is recorded (where and on what, never what you type) until you press Stop.</p>}
              {task && <label className="field"><span className="label">Name or code (optional)</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. P5" /></label>}
              <label className="row" style={{ gap: 8, fontSize: 13.5 }}><input type="checkbox" checked={eyes} onChange={(e) => setEyes(e.target.checked)} /> Also record where I look (webcam eye tracking, about a minute to calibrate)</label>
              <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => onClose(null)}>Cancel</button>
                <button className="btn primary" onClick={begin}>{task ? 'Start the task' : 'Start recording'}</button>
              </div>
            </div>
          </div>
        )}
        {phase === 'done' && result && (
          <div className="rh-over">
            <div className="rh-card">
              {result.outcome === 'success' ? <p className="rh-out good"><CheckCircle2 size={20} /> Task complete</p> : result.outcome === 'timeout' ? <p className="rh-out"><TimerOff size={20} /> Time’s up</p> : result.outcome === 'gave_up' ? <p className="rh-out"><Flag size={20} /> Gave up</p> : <p className="rh-out"><Square size={18} /> Recording stopped</p>}
              <p className="muted" style={{ fontSize: 13 }}>{(result.ms / 1000).toFixed(1)} s · {result.taps} click{result.taps === 1 ? '' : 's'} · {result.pages} page{result.pages === 1 ? '' : 's'}{eyesOn || accuracy !== null ? ' · with eye tracking' : ''}. Saved; the heatmap now includes it.</p>
              <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}><button className="btn primary" onClick={() => onClose({ page: startPage })}>See the heatmap</button></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
