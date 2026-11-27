/** What a visitor is told before anything is recorded, per module (one line, no name asked). */
export const VISITOR_ASK: Record<VisitorModule['module'], (m: VisitorModule) => string> = {
  heatmap: () => 'Your clicks on this site will be recorded for the site owner’s heatmap.',
  gaze: () => 'Your camera will estimate where you look on this site, for the site owner’s research. You’ll allow the camera and follow a short calibration first. Video stays in your browser; only where you look is saved.',
  fivesec: () => 'You’ll see this page for 5 seconds, then answer a short question. Your answer goes to the site owner.',
  usability: (m) => `You’ll get ${m.tasks} short task${m.tasks === 1 ? '' : 's'} on this site. Your clicks and the pages you open are recorded for the site owner.`,
}
export const VISITOR_LABEL: Record<VisitorModule['module'], string> = { heatmap: 'Heatmap', gaze: 'Eye tracking', fivesec: '5-second test', usability: 'Usability test' }

/**
 * A visitor (widget open to everyone) opened a research module: one line saying what is recorded,
 * OK or No thanks. Nothing is recorded before OK; then a run starts in the module's default study.
 */
export function VisitorConsent({ project, m, accent, gazeUrl, onStart, onCancel }: { project: string; m: VisitorModule; accent: string; gazeUrl: string; onStart: (s: RunState) => void; onCancel: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const ok = async () => {
    setBusy(true); setError('')
    try {
      const r = await startVisitorRun(project, m.module)
      const browse = r.kind === 'browse'
      const eyes = r.eye && !!gazeUrl
      onStart({ token: '', module: m.module, phase: eyes ? 'eyes' : browse ? 'task' : 'intro', run: r.run, kind: r.kind, name: r.name, config: cleanConfig(r.kind, r.config), t0: Date.now(), index: 0,
        taskStart: !eyes && browse ? Date.now() : undefined, pages: [], clicks: 0, firstClickHit: null, results: [], answers: [] })
    } catch (e) {
      const why = (e as Error).message
      setError(why === 'study_closed' ? 'This is paused right now. Thank you anyway!' : why === 'study_full' || why === 'rate_limited' ? 'Too many people right now. Try again later.' : 'It couldn’t start. Try again in a moment.')
    } finally { setBusy(false) }
  }
  return (
    <div className="vc vc-scrim" style={{ ['--vc-accent' as string]: accent }}>
      <div className="vc-modal" role="dialog" aria-label={VISITOR_LABEL[m.module]} data-vc-consent={m.module}>
        <span className="vc-kicker">{VISITOR_LABEL[m.module]}</span>
        <p>{VISITOR_ASK[m.module](m)}</p>
        {error && <p className="vc-bad">{error}</p>}
        <div className="vc-row"><span className="vc-grow" />
          <button className="vc-btn" onClick={onCancel}>No thanks</button>
          <button className="vc-btn primary" disabled={busy || !!error} onClick={() => void ok()}>{busy ? 'Starting…' : 'OK'}</button>
        </div>
        <p className="vc-where">You won’t see other people’s data. Run with ourhunch for the site’s owner.</p>
      </div>
    </div>
  )
}

/**
 * What a study's participant sees on the customer's site: the consent screen, then the study
 * (usability tasks, a 5-second test, or a free browse for a heatmap), then a thank-you. See
 * research.ts for what is recorded and what never is.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, Eye, Flag, Timer, X } from 'lucide-react'
import { OneEuro } from '../gaze-analysis'
// The pre-check's logic is in the widget itself (tiny, pure), so it never depends on which gaze.js loaded.
import { PrecheckGate, PRECHECK_ROWS, PRECHECK_TEXT, precheck, type PrecheckIssue } from '../gaze-model'
import { Recorder, pageOf, cleanConfig, discardRun, eyeIsRequired, finishRun, pageMatches, saveRun, startRun, startVisitorRun, type Door, type Outcome, type RunState, type VisitorModule } from './research'

const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const KIND_LABEL = { usability: 'tasks on this site', fivesec: 'a 5-second test', browse: 'a short visit' } as const

export function Participant({ project, initial, accent, doorsOn = false, gazeUrl = '', version = '', onEnd }: { project: string; initial: RunState; accent: string; doorsOn?: boolean; gazeUrl?: string; version?: string; onEnd?: () => void }) {
  const recRef = useRef<Recorder | null>(null)
  // Hooks first, before any return below: React needs the same hooks in the same order every render.
  const [faceLost, setFaceLost] = useState(false)
  const [headFar, setHeadFar] = useState(false)
  const [st, setSt] = useState<RunState>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [, tick] = useState(0)
  const stRef = useRef(st)
  stRef.current = st
  useEffect(() => () => stopEyes(), [])
  const update = (next: RunState) => { setSt(next); saveRun(project, next.phase === 'declined' ? null : next); if (next.phase === 'declined') { stopEyes(); onEnd?.() } }

  const tasks = st.config?.tasks ?? []
  const task = st.kind === 'usability' ? tasks[st.index] : undefined
  const limitMs = st.kind === 'usability' ? (task?.limitSec ?? 180) * 1000 : st.kind === 'browse' ? (st.config?.minutes ?? 3) * 60_000 : (st.config?.seconds ?? 5) * 1000
  const elapsed = st.taskStart ? Date.now() - st.taskStart : 0

  /* ---- finishing a task, and the run ---- */
  const finishAll = async (s: RunState) => {
    update({ ...s, phase: 'done' })
    stopEyes()
    // Eye-tracking quality goes with the run's result (validation numbers + data loss and head movement while recording).
    const e = s.eye?.on ? s.eye : null
    const gaze = e ? { accuracy: e.accuracy ?? null, accuracyDeg: e.accuracyDeg ?? null, precision: e.precision ?? null, distance: e.distance ?? null, ...(eyeMeter?.frames ? eyeMeter.summary() : {}) } : undefined
    try { await finishRun(s.run!, { kind: s.kind, tasks: s.results, answers: s.answers, ...(gaze ? { gaze } : {}) }, e ? e.accuracy : undefined) } catch { /* the events are in; the summary is retried below */ }
  }
  const endTask = (outcome: Outcome) => {
    const s = stRef.current
    if (s.phase !== 'task' && s.phase !== 'showing') return
    if (s.kind === 'fivesec') { update({ ...s, phase: 'questions' }); return }
    const result = { id: task?.id ?? 'visit', outcome, ms: Date.now() - (s.taskStart ?? Date.now()), pages: s.pages.slice(0, 30), clicks: s.clicks, firstClickHit: s.firstClickHit }
    const next: RunState = { ...s, results: [...s.results, result], index: s.index + 1, pages: [], clicks: 0, firstClickHit: null, taskStart: undefined }
    if (s.kind === 'usability' && next.index < tasks.length) update({ ...next, phase: 'intro' })
    else void finishAll(next)
  }

  /* ---- recording, while a task or the 5 seconds run ---- */
  const recording = st.phase === 'task' || st.phase === 'showing'
  useEffect(() => {
    if (!recording || !st.run) return
    const s0 = stRef.current
    const rec = new Recorder(st.run, s0.t0 ?? Date.now(),
      ({ el, page }) => {
        const s = stRef.current
        const rule = s.kind === 'usability' ? s.config?.tasks?.[s.index]?.success : undefined
        const hit = rule?.kind === 'element' ? !!el.closest(rule.sel) : null
        const next = { ...s, clicks: s.clicks + 1, firstClickHit: s.clicks === 0 ? hit : s.firstClickHit }
        setSt(next); saveRun(project, next)
        if (rule?.kind === 'element' && hit) window.setTimeout(() => endTask('success'), 150)
        void page
      },
      (page) => {
        const s = stRef.current
        const key = pageOf(page)
        const next = { ...s, pages: s.pages[s.pages.length - 1] === key ? s.pages : [...s.pages, key].slice(-30) }
        setSt(next); saveRun(project, next)
        const rule = s.kind === 'usability' ? s.config?.tasks?.[s.index]?.success : undefined
        if (rule?.kind === 'page' && pageMatches(rule.page, page)) window.setTimeout(() => endTask('success'), 300)
      // Snapshots: participants who came with a study link (told so on the consent screen), never visitors.
      }, version, !!s0.token)
    recRef.current = rec
    rec.start(() => (stRef.current.kind === 'usability' ? stRef.current.config?.tasks?.[stRef.current.index]?.id : stRef.current.kind), (el) => {
      const rule = stRef.current.config?.tasks?.[stRef.current.index]?.success
      return rule?.kind === 'element' ? !!el.closest(rule.sel) : undefined
    })
    return () => { recRef.current = null; void rec.end() }
  }, [recording, st.run, st.index]) // eslint-disable-line react-hooks/exhaustive-deps

  // The clock: time limits, and the 5 seconds.
  useEffect(() => {
    if (!recording) return
    const iv = window.setInterval(() => {
      tick((n) => n + 1)
      const s = stRef.current
      if (s.taskStart && Date.now() - s.taskStart >= limitMs) endTask(s.kind === 'browse' ? 'done' : 'timeout')
    }, 250)
    return () => window.clearInterval(iv)
  }, [recording, limitMs]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- actions ---- */
  const agree = async () => {
    setBusy(true); setError('')
    try {
      const r = await startRun(project, st.token)
      update({ ...st, phase: r.eye && gazeUrl ? 'eyes' : 'intro', run: r.run, kind: r.kind, name: r.name, config: cleanConfig(r.kind, r.config), t0: Date.now(), index: 0, results: [], answers: [] })
    } catch (e) {
      const m = (e as Error).message
      setError(m === 'study_full' ? 'This study has all the participants it needs. Thank you!' : m === 'study_closed' || m === 'link_expired' ? 'This study has ended. Thank you!' : 'The study couldn’t start. Open the link again in a moment.')
    } finally { setBusy(false) }
  }
  const begin = () => {
    const start = st.kind === 'usability' ? task?.startPage : st.config?.page
    const next: RunState = { ...st, phase: st.kind === 'fivesec' ? 'showing' : 'task', taskStart: Date.now(), pages: [], clicks: 0, firstClickHit: null }
    update(next)
    // Each task can start on its own page of the site (same site only).
    if (start && start !== window.location.pathname) window.location.assign(new URL(start, window.location.origin).href)
  }

  /* ---- what shows ---- */
  const style = { ['--vc-accent' as string]: accent }
  if (st.phase === 'declined') return null
  if (st.phase === 'consent') {
    const info = st.info
    return (
      <div className="vc vc-scrim" style={style}>
        <div className="vc-modal" role="dialog" aria-label="Take part in a study">
          <span className="vc-kicker">Study · {info ? KIND_LABEL[info.kind] : ''}</span>
          <h2>{info?.name ?? 'A study'}</h2>
          <p>The people behind this site ask you to try it {info?.kind === 'usability' ? `with ${info.tasks} short task${info.tasks === 1 ? '' : 's'}` : ''} and show how it went.</p>
          <ul className="vc-list">
            <li><Check size={14} /> Recorded: where you click, which pages you open, and how long things take.</li>
            <li><Check size={14} /> Never recorded: what you type into this site, your screen as video, or your camera.</li>
            {info?.eye && <li><Eye size={14} /> You’ll also be asked whether to use your camera for eye tracking. Video stays in your browser; only where you look on the page is saved. {info.kind === 'browse' ? 'This study needs the camera: without it, nothing is recorded.' : 'You can say no and still do the test.'}</li>}
            <li><Check size={14} /> The site may save one picture of a page as it looks (for the team’s heatmap), with every form field emptied and private parts greyed out.</li>
            <li><Check size={14} /> Only for this study, in this tab. Close the tab to stop at any time.</li>
          </ul>
          {error && <p className="vc-bad">{error}</p>}
          <div className="vc-row"><span className="vc-grow" />
            <button className="vc-btn" onClick={() => update({ ...st, phase: 'declined' })}>No thanks</button>
            <button className="vc-btn primary" disabled={busy || !!error} onClick={() => void agree()}>{busy ? 'Starting…' : 'I agree, start'}</button>
          </div>
          <p className="vc-where">Run with ourhunch for the site’s owner.</p>
        </div>
      </div>
    )
  }
  // Eye tracking study (its module is Eye tracking: kind browse with eye tracking): the camera is
  // required, so saying no (or no camera, or calibration abandoned) ends it and the run is discarded.
  // Eye tracking added to a usability or 5-second test is optional: the test goes on without gaze.
  const eyeRequired = eyeIsRequired(st.kind)
  const noCamera = () => { const run = stRef.current.run; stopEyes(); if (run) void discardRun(run).catch(() => {}); recRef.current = null; update({ ...stRef.current, phase: 'nocam', run: undefined, eye: { on: false } }); saveRun(project, null) }
  if (st.phase === 'eyes') return <div className="vc" style={style}><EyeSetup gazeUrl={gazeUrl} required={eyeRequired} onDone={(eye) => (eyeRequired && !eye?.on ? noCamera() : update({ ...st, phase: 'intro', eye }))} /></div>
  if (st.phase === 'nocam') {
    return (
      <div className="vc vc-scrim" style={style}>
        <div className="vc-modal" role="dialog" aria-label="Eye tracking" data-vc-nocam="">
          <span className="vc-kicker">Eye tracking</span>
          <h2>Eye tracking needs your camera. Nothing was recorded.</h2>
          <p>This study is about where people look, so it can’t run without the camera. You can carry on using the site as normal.</p>
          <div className="vc-row"><span className="vc-grow" /><button className="vc-btn primary" onClick={() => update({ ...st, phase: 'declined' })}><X size={13} /> Back to the site</button></div>
        </div>
      </div>
    )
  }
  const eyes = recording && st.eye?.on && st.eye.model ? <EyeTracker gazeUrl={gazeUrl} model={st.eye.model} calib={st.eye.calib ?? []} accuracy={st.eye.accuracy} rec={recRef} onDrift={setHeadFar} task={task?.id ?? st.kind} onLost={setFaceLost} onFail={() => (eyeRequired ? noCamera() : update({ ...stRef.current, eye: { ...stRef.current.eye!, on: false } }))} /> : null
  if (st.phase === 'intro') {
    const prompt = st.kind === 'usability' ? task?.prompt : st.config?.prompt
    return (
      <div className="vc vc-scrim" style={style}>
        <div className="vc-modal" role="dialog" aria-label="Your task">
          <span className="vc-kicker">{st.kind === 'usability' ? `Task ${st.index + 1} of ${tasks.length}` : st.kind === 'fivesec' ? `You’ll see a page for ${st.config?.seconds ?? 5} seconds` : `About ${st.config?.minutes ?? 3} minutes`}</span>
          <h2>{prompt || (st.kind === 'browse' ? 'Use the site as you normally would.' : 'Look at the page.')}</h2>
          {st.index === 0 && st.config?.intro && <p>{st.config.intro}</p>}
          <p className="vc-muted">{st.kind === 'usability' ? `When you’re done, press Done. You have ${mmss((task?.limitSec ?? 180) * 1000)}; there are no wrong answers.` : st.kind === 'fivesec' ? 'Then we’ll ask a question or two about what you remember.' : 'Press Finish when you’re done.'}</p>
          <div className="vc-row"><span className="vc-grow" /><button className="vc-btn primary" onClick={begin}>Start</button></div>
        </div>
      </div>
    )
  }
  const doors = doorsOn && recording && st.config?.doors?.length ? <Doors doors={st.config.doors} rec={recRef} task={task?.id ?? st.kind} /> : null
  if (st.phase === 'task') {
    return (
      <div className="vc" style={style}>
        {doors}{eyes}
        <div className="vc-taskbar" role="status">
          <span className="vc-kicker">{st.kind === 'usability' ? `${st.index + 1}/${tasks.length}` : 'Visit'}</span>
          <span className="vc-taskprompt" title={task?.prompt}>{st.kind === 'usability' ? task?.prompt : (st.config?.prompt || 'Use the site as you normally would')}</span>
          {eyes && <span className={`vc-clock ${faceLost || headFar ? 'vc-lostface' : ''}`} title="Eye tracking is on: video stays in your browser"><Eye size={13} />{faceLost ? ' We can’t see your face' : headFar ? ' Move back to where you sat for calibration' : ''}</span>}
          <span className="vc-clock"><Timer size={13} /> {mmss(limitMs - elapsed)}</span>
          {st.kind === 'usability' && <button className="vc-btn" onClick={() => endTask('gave_up')}><Flag size={13} /> Give up</button>}
          <button className="vc-btn primary" onClick={() => endTask(st.kind === 'browse' ? 'done' : 'done')}><Check size={13} /> {st.kind === 'browse' ? 'Finish' : 'Done'}</button>
        </div>
      </div>
    )
  }
  if (st.phase === 'showing') return <div className="vc" style={style}>{doors}{eyes}<div className="vc-taskbar small" role="status"><Timer size={13} /> {Math.ceil(Math.max(0, limitMs - elapsed) / 1000)}</div></div>
  if (st.phase === 'questions') return <Questions st={st} style={style} onDone={(answers) => void finishAll({ ...st, answers })} />
  if (st.phase === 'done') {
    return (
      <div className="vc vc-scrim" style={style}>
        <div className="vc-modal" role="dialog" aria-label="Thank you">
          <h2>Thank you!</h2>
          <p>That’s all. What you did helps the people behind this site make it better.</p>
          <div className="vc-row"><span className="vc-grow" /><button className="vc-btn primary" onClick={() => { saveRun(project, null); update({ ...st, phase: 'declined' }) }}><X size={13} /> Close</button></div>
        </div>
      </div>
    )
  }
  return null
}

function Questions({ st, style, onDone }: { st: RunState; style: React.CSSProperties; onDone: (answers: string[]) => void }) {
  const qs = st.config?.questions?.length ? st.config.questions : ['What do you remember about the page you saw?']
  const [answers, setAnswers] = useState<string[]>(qs.map(() => ''))
  return (
    <div className="vc vc-cover" style={style}>
      <div className="vc-modal" role="dialog" aria-label="What do you remember?">
        <span className="vc-kicker">Time’s up</span>
        <h2>What do you remember?</h2>
        {qs.map((q, i) => (
          <label key={i} className="vc-q">{q}
            <textarea rows={2} maxLength={300} value={answers[i]} onChange={(e) => setAnswers(answers.map((a, j) => (j === i ? e.target.value : a)))} />
          </label>
        ))}
        <div className="vc-row"><span className="vc-grow" /><button className="vc-btn primary" onClick={() => onDone(answers.map((a) => a.trim().slice(0, 300)))}>Send</button></div>
      </div>
    </div>
  )
}

/**
 * Fake doors: a feature that doesn't exist yet, offered to the study's participants to measure
 * interest. "add": a button of ours beside an element of the page; "existing": an element of the
 * page itself. Seeing one and clicking it are recorded; clicking shows that it is coming soon.
 */
function Doors({ doors, rec, task }: { doors: Door[]; rec: React.MutableRefObject<Recorder | null>; task?: string }) {
  const [, tick] = useState(0)
  const [msg, setMsg] = useState<Door | null>(null)
  const seen = useRef(new Set<string>())
  const here = doors.filter((d) => !d.page || pageMatches(d.page, window.location.pathname))
  const find = (d: Door) => { try { return document.querySelector(d.sel) } catch { return null } }
  useEffect(() => {
    const iv = window.setInterval(() => tick((n) => n + 1), 400)
    const redraw = () => tick((n) => n + 1)
    window.addEventListener('scroll', redraw, true); window.addEventListener('resize', redraw)
    // An existing element as the door: its click is the door's, not the page's.
    const click = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return
      const d = doors.find((x) => x.mode === 'existing' && (!x.page || pageMatches(x.page, window.location.pathname)) && (() => { try { return !!(e.target as Element).closest(x.sel) } catch { return false } })())
      if (!d) return
      e.preventDefault(); e.stopPropagation()
      rec.current?.door(d, true, task); setMsg(d)
    }
    document.addEventListener('click', click, true)
    return () => { window.clearInterval(iv); window.removeEventListener('scroll', redraw, true); window.removeEventListener('resize', redraw); document.removeEventListener('click', click, true) }
  }, [doors, task]) // eslint-disable-line react-hooks/exhaustive-deps
  // Seen: once per page load, when its element is on the page.
  useEffect(() => {
    for (const d of here) {
      const k = `${window.location.pathname}|${d.id}`
      const el = find(d)
      // Only once the recorder is there (it starts in the parent's effect, after this one's first run).
      if (!seen.current.has(k) && rec.current && el && el.getBoundingClientRect().width > 0) { seen.current.add(k); rec.current.door(d, false, task) }
    }
  })
  return (
    <>
      {here.filter((d) => d.mode === 'add').map((d) => {
        const r = find(d)?.getBoundingClientRect()
        if (!r || r.width === 0 || r.bottom < 0 || r.top > window.innerHeight) return null
        const left = Math.min(window.innerWidth - 160, r.right + 8)
        return <button key={d.id} className="vc-door" style={{ left, top: r.top + r.height / 2 - 15 }} onClick={() => { rec.current?.door(d, true, task); setMsg(d) }}>{d.label}<span>new</span></button>
      })}
      {msg && (
        <div className="vc-scrim" onClick={() => setMsg(null)}>
          <div className="vc-modal" role="dialog" aria-label="Coming soon" onClick={(e) => e.stopPropagation()}>
            <span className="vc-kicker">Coming soon</span>
            <h2>{msg.label}</h2>
            <p>{msg.message}</p>
            <div className="vc-row"><span className="vc-grow" /><button className="vc-btn primary" onClick={() => setMsg(null)}>OK</button></div>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------- eye tracking (only after the participant agrees; video never leaves the browser) ---------- */

type Gaze = typeof import('./gaze-entry')
let gazeMod: Promise<Gaze> | null = null
const loadGaze = (url: string) => (gazeMod ??= import(/* @vite-ignore */ url) as Promise<Gaze>)
let cam: { stream: MediaStream; video: HTMLVideoElement } | null = null
/**
 * The hidden <video> lives in one container in the widget's shadow root, not inside a component
 * that unmounts. Every start stops the earlier stream and asks for the camera fresh; a stream is
 * reused only while its track is live and the video has frames.
 */
async function camera(g: Gaze, host: HTMLElement): Promise<HTMLVideoElement> {
  const tr = cam?.stream.getVideoTracks()[0]
  if (cam && tr?.readyState === 'live' && cam.video.isConnected && cam.video.readyState >= 2) return cam.video
  stopEyes()
  const root = host.getRootNode() as ShadowRoot | Document
  let box = (root as ParentNode).querySelector?.('.vc-camhold') as HTMLElement | null
  if (!box) { box = document.createElement('div'); box.className = 'vc-camhold vc-cambox'; box.setAttribute('aria-hidden', 'true'); ((root as ShadowRoot).host ? root : document.body).appendChild(box) }
  const video = document.createElement('video')
  video.className = 'vc-cam'
  box.appendChild(video)
  try { cam = { stream: await g.startCamera(video), video } } catch (e) { video.remove(); throw e }
  return video
}
/** The current run's eye-tracking meter (data loss, head movement, ms per frame). */
let eyeMeter: import('../gaze-model').RunMeter | null = null
function stopEyes() { if (cam) { cam.stream.getTracks().forEach((t) => t.stop()); cam.video.srcObject = null; cam.video.remove(); cam = null } }
// Leaving the page always lets the camera go.
if (typeof window !== 'undefined') { window.addEventListener('pagehide', stopEyes); window.addEventListener('beforeunload', stopEyes) }

/** Team-only, opt-in: `?vibe_gaze_debug=1` on the page shows "Download diagnostics" after calibration. */
const gazeDebug = () => { try { return new URLSearchParams(window.location.search).get('vibe_gaze_debug') === '1' } catch { return false } }

type Dot = { x: number; y: number; frames: number[][] }
/**
 * Asks, starts the camera, then:
 * 1. Pre-check: a small mirrored preview (drawn on a canvas here, never stored or sent) with live
 *    checks: face in the middle, distance, light; hints for glasses and "move only your eyes".
 * 2. Calibration: 13 dots in random order. Each dot appears large and shrinks; frames are read while
 *    it is on screen and the dot moves on by itself once the eyes are steady (clicking is optional).
 *    The target is the dot's own position on screen (getBoundingClientRect), the same frame as clicks
 *    and gaze points, so a scrollbar, zoom or transformed page can't shift it.
 * 3. Validation on 5 other dots, the same way, then the grade (good ≤ 150 px, okay ≤ 250 px) with
 *    what to do next. Poor: one suggestion to calibrate again.
 */
function EyeSetup({ gazeUrl, required = false, onDone }: { gazeUrl: string; required?: boolean; onDone: (eye: RunState['eye']) => void }) {
  const [phase, setPhase] = useState<'ask' | 'loading' | 'precheck' | 'calibrate' | 'validate' | 'result' | 'error'>('ask')
  const [step, setStep] = useState(0)
  const [hint, setHint] = useState('')
  const [q, setQ] = useState<import('../gaze-model').Quality | null>(null)
  const [retried, setRetried] = useState(false)
  const [order, setOrder] = useState<{ x: number; y: number }[]>([])
  const [issues, setIssues] = useState<PrecheckIssue[] | null>(null)
  const [ready, setReady] = useState(false)
  const [unseen, setUnseen] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const dotEl = useRef<HTMLButtonElement>(null)
  const ref = useRef<{ g: Gaze; lm: Awaited<ReturnType<Gaze['loadLandmarker']>>; video: HTMLVideoElement; samples: import('../gaze-model').CalSample[]; model?: import('../gaze-model').Model; cal: Dot[]; checks: Dot[] } | null>(null)
  const clickNow = useRef(false)
  const inARow = useRef(0)
  const ok = useRef(false)
  // Leaving the setup without finishing it lets the camera go.
  useEffect(() => () => { if (!ok.current) stopEyes() }, [])
  const start = async () => {
    setPhase('loading')
    try {
      const g = await loadGaze(gazeUrl)
      const [lm, video] = await Promise.all([g.loadLandmarker(), camera(g, box.current!)])
      ref.current = { g, lm, video, samples: [], cal: [], checks: [] }
      setPhase('precheck')
    } catch (e) {
      stopEyes()
      if (gazeMod) void gazeMod.then((g) => g.resetLandmarker()).catch(() => {})
      setHint(gazeMod ? await gazeMod.then((g) => g.cameraError(e)).catch(() => 'Eye tracking couldn’t start on this device.') : 'Eye tracking couldn’t start on this device.')
      setPhase('error')
    }
  }

  /* ---- 1. pre-check: the preview is drawn here only, mirrored; nothing of it is kept ---- */
  useEffect(() => {
    if (phase !== 'precheck') return
    const r = ref.current!
    const gate = new PrecheckGate()
    setIssues(null); setReady(false)
    const iv = window.setInterval(() => {
      // Never let one bad frame (or a missing function) stop the checks: each part is guarded.
      const now = performance.now()
      let brightness: number | null = null
      try {
        const c = canvas.current
        if (c && r.video.readyState >= 2) {
          const ctx = c.getContext('2d', { willReadFrequently: true })
          if (ctx) {
            ctx.save(); ctx.translate(c.width, 0); ctx.scale(-1, 1); ctx.drawImage(r.video, 0, 0, c.width, c.height); ctx.restore()
            // Brightness of the middle of the picture (where the face is), so a bright window behind doesn't count.
            const px = ctx.getImageData(c.width * 0.25, c.height * 0.15, c.width * 0.5, c.height * 0.7).data
            let sum = 0, n = 0
            for (let i = 0; i < px.length; i += 16) { sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]; n++ }
            brightness = n ? sum / n : null
          }
        }
      } catch { /* no preview this frame */ }
      let d: { f: number[] | null; face: { cx: number; cy: number } | null } = { f: null, face: null }
      try { d = r.g.detect ? r.g.detect(r.lm, r.video, now) : { f: r.g.features(r.lm, r.video, now), face: null } } catch { /* next frame */ }
      // An older face module without detect(): features only, so the face row can't be judged; let it pass.
      const face = d.face ?? (d.f ? { cx: 0.5, cy: 0.5 } : null)
      const st = gate.push(precheck({ face, irisW: d.f ? d.f[15] : null, brightness }), now)
      setIssues(st.issues); setReady(st.ready)
    }, 120)
    return () => window.clearInterval(iv)
  }, [phase])
  const beginCalibration = () => { const r = ref.current!; r.samples = []; r.cal = []; r.checks = []; setUnseen(0); inARow.current = 0; setOrder(r.g.calibrationOrder()); setStep(0); setHint(''); setPhase('calibrate') }

  /* ---- 2–3. dots: collected automatically once the eyes are steady on the shrinking dot ---- */
  const dots = phase === 'validate' ? ref.current?.g.VALIDATION ?? [] : order
  const dot = dots[step]
  useEffect(() => {
    if ((phase !== 'calibrate' && phase !== 'validate') || !dot) return
    const r = ref.current!
    const frames: { t: number; f: number[] }[] = []
    let t0 = performance.now()
    let alive = true, misses = 0, tries = 0
    clickNow.current = false
    const minFrames = r.g.DOT_MIN_FRAMES ?? 3
    const tick = () => {
      if (!alive) return
      const now = performance.now()
      let f: number[] | null = null
      try { f = r.g.features(r.lm, r.video, now) } catch { /* next frame */ }
      if (f) frames.push({ t: now, f }); else misses++
      // Done when steady (judged against this dot's own noise), at the 2.5 s timeout, or on a click.
      let fs: number[][] | null = null
      try { fs = clickNow.current && r.g.dotClicked ? r.g.dotClicked(frames, t0, now) : r.g.dotDone(frames, t0, now) } catch { fs = null }
      if (!fs && now - t0 > 3000) fs = frames.map((x) => x.f)
      if (!fs) { window.setTimeout(tick, 33); return }
      alive = false
      const seen = fs.length >= minFrames
      if (!seen && tries === 0 && !clickNow.current) {
        // Unseen: the same dot once more, with a hint. The second time it moves on regardless.
        tries++
        setHint(misses > frames.length ? 'We can’t see your face. Face the camera, with some light on you.' : 'Keep looking at the dot until it moves on. Move only your eyes, not your head.')
        window.setTimeout(() => { alive = true; frames.length = 0; misses = 0; clickNow.current = false; t0 = performance.now(); tick() }, 300)
        return
      }
      setHint(seen ? '' : 'We can’t see your face well. Face the camera, with some light on you.')
      if (!seen) setUnseen((n) => n + 1)
      // Three dots in a row without a face: stop wasting the person's time; the result says why and offers Try again.
      inARow.current = seen ? 0 : inARow.current + 1
      if (inARow.current >= 3) { inARow.current = 0; r.model = undefined; r.checks = []; setQ(null); setPhase('result'); return }
      const rect = dotEl.current?.getBoundingClientRect()
      const x = rect ? rect.left + rect.width / 2 : dot.x * window.innerWidth
      const y = rect ? rect.top + rect.height / 2 : dot.y * window.innerHeight
      if (phase === 'calibrate') {
        if (seen) { r.cal.push({ x, y, frames: fs }); for (const f2 of fs) r.samples.push({ f: f2, x, y }) }
        if (step + 1 < dots.length) setStep(step + 1)
        else {
          // Too few dots seen to fit a model: straight to the result, which says so and offers a way on.
          let model: typeof r.model
          try { model = r.cal.length >= 6 ? r.g.fit(r.samples) : undefined } catch { model = undefined }
          r.model = model; r.checks = []
          if (!model) { setQ(null); setPhase('result') } else { setStep(0); setPhase('validate') }
        }
      } else {
        if (seen) r.checks.push({ x, y, frames: fs })
        if (step + 1 < r.g.VALIDATION.length) setStep(step + 1)
        else { const v = r.checks.length ? r.g.validate(r.model!, r.checks) : null; setQ(v && Number.isFinite(v.accuracy) ? v : null); setPhase('result') }
      }
    }
    // A short pause between dots, so the eyes have somewhere to go.
    const first = window.setTimeout(tick, step === 0 ? 700 : 150)
    return () => { alive = false; window.clearTimeout(first) }
  }, [phase, step, order]) // eslint-disable-line react-hooks/exhaustive-deps

  const grade = q ? ref.current?.g.qualityOf(q) ?? 'rough' : 'poor'
  const failed = phase === 'result' && !q
  const skip = () => { stopEyes(); onDone({ on: false }) }
  const download = () => {
    const r = ref.current
    if (!r) return
    const round = (fs: number[][]) => fs.map((f) => f.map((v) => Math.round(v * 1e5) / 1e5))
    const d = {
      v: 1, at: new Date().toISOString(),
      screen: { w: window.innerWidth, h: window.innerHeight, clientW: document.documentElement.clientWidth, clientH: document.documentElement.clientHeight, dpr: window.devicePixelRatio, zoom: window.visualViewport?.scale ?? 1 },
      video: { w: r.video.videoWidth, h: r.video.videoHeight },
      calibration: r.cal.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), frames: round(c.frames) })),
      validation: r.checks.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), frames: round(c.frames) })),
      model: r.model ? { basis: r.model.basis, cv: r.model.cv, lx: r.model.lx, ly: r.model.ly, pose: r.model.pose, spread: r.model.spread } : null,
      quality: q,
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(d)], { type: 'application/json' }))
    a.download = 'ourhunch-gaze-diagnostics.json'
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  }
  const rowOf = (k: PrecheckIssue[]) => issues?.find((i) => k.includes(i))
  const continueOn = () => { if (!ref.current?.model) { skip(); return } ok.current = true; onDone({ on: true, model: ref.current!.model, accuracy: q?.accuracy, accuracyDeg: q?.accuracyDeg, precision: q?.precision, distance: q?.distance, calib: ref.current!.samples.map((x) => ({ f: x.f.map((v) => Math.round(v * 1e5) / 1e5), x: Math.round(x.x), y: Math.round(x.y) })) }) }
  return (
    <>
      <div ref={box} className="vc-cambox" aria-hidden />
      {(phase === 'calibrate' || phase === 'validate') && dot ? (
        <div className="vc-calib" data-vc-calib={phase}>
          <div className="vc-taskbar" role="status"><span className="vc-kicker">{phase === 'calibrate' ? 'Calibrating' : 'Checking'} · {step + 1} of {dots.length}</span><span className="vc-taskprompt">Follow the dot with your eyes. Keep your head still. It moves on by itself (or click it).</span><button className="vc-btn" onClick={skip}>{required ? 'Stop' : 'Skip eye tracking'}</button></div>
          {hint && <div className="vc-toast error" role="alert">{hint}</div>}
           <button ref={dotEl} key={`${phase}-${step}`} className="vc-dot auto" data-vc-dot={step} style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%` }} onClick={() => { clickNow.current = true }} aria-label={`Dot ${step + 1} of ${dots.length}`} />
        </div>
      ) : (
        <div className="vc-scrim">
          <div className="vc-modal" role="dialog" aria-label="Eye tracking" data-vc-eye={phase}>
            <span className="vc-kicker">{required ? 'Needed for this study' : 'Optional'}</span>
            {phase === 'precheck' ? <>
              <h2>Get ready</h2>
              <div className="vc-pre"><canvas ref={canvas} width={240} height={180} /><span className={`vc-oval ${ready ? 'ok' : ''}`} /></div>
              <p className="vc-muted">Only you see this preview. It isn’t saved or sent.</p>
              <ul className="vc-checks" data-vc-checks="">
                {PRECHECK_ROWS.map((row) => {
                  // Unknown (first frames) shows "Checking…", never a ✓. Distance and light can't be judged without a face.
                  const bad = rowOf(row.issues)
                  const unknown = !issues || (row.key !== 'face' && issues.includes('noface'))
                  return <li key={row.key} data-vc-check={row.key} className={unknown ? '' : bad ? 'no' : 'yes'}>{unknown ? <>… {row.ok}</> : bad ? PRECHECK_TEXT[bad] : <><Check size={14} /> {row.ok}</>}</li>
                })}
              </ul>
              <p className="vc-muted">Glasses: if the lenses reflect the screen, tilt the screen a little or dim it. During calibration, <b>keep your head still and move only your eyes</b>.</p>
              <div className="vc-row"><button className="vc-btn" onClick={skip}>{required ? 'Stop' : 'Skip eye tracking'}</button><span className="vc-grow" />
                {/* Always there: the checks advise, they never lock anyone out. */}
                <button className="vc-linkbtn" style={{ alignSelf: "center", marginRight: 8 }} onClick={beginCalibration} data-vc-start-anyway="">Start anyway</button>
                <button className="vc-btn primary" disabled={!ready} onClick={beginCalibration} data-vc-start="">Start calibration</button></div>
            </> : phase === 'result' && failed ? <>
              <h2>We couldn’t see your eyes well enough</h2>
              <p data-vc-grade="none">Most dots passed without a clear view of your face, so there’s nothing to measure yet.</p>
              <p className="vc-muted">Sit facing a light (not a window behind you), with your whole face in the camera, and try again.</p>
              <div className="vc-row"><button className="vc-btn" onClick={skip}>{required ? 'Stop' : 'Continue without eye tracking'}</button><span className="vc-grow" />
                <button className="vc-btn primary" onClick={() => { setRetried(true); setPhase('precheck') }} data-vc-retry="">Try again</button></div>
            </> : phase === 'result' ? <>
              {unseen > 0 && <p className="vc-muted">{unseen} dot{unseen === 1 ? '' : 's'} passed without a clear view of your face.</p>}
              <h2>{grade === 'good' ? 'Eye tracking is ready' : grade === 'rough' ? 'Eye tracking is okay' : 'Eye tracking is rough'}</h2>
              <p data-vc-grade={grade}>On dots it hadn’t seen, the estimate was on average <b>{q?.accuracy} px</b>{q ? ` (${q.accuracyDeg}°)` : ''} from the dot: <span className={`vc-grade ${grade}`}>{grade === 'good' ? 'good' : grade === 'rough' ? 'okay' : 'poor'}</span>.</p>
              <p className="vc-muted">{grade === 'good' ? 'Good enough to see which parts of the page you look at.' : grade === 'rough' ? 'Good enough to see which areas of the page you look at, not small details. You can continue.' : retried ? 'Still rough. The results will only show broad areas. You can continue, or stop.' : 'Usually better after another try: sit facing a light (not a window behind you), keep your face in the middle, and keep your head still while your eyes follow the dot.'}</p>
              {gazeDebug() && <p className="vc-muted">Team diagnostics: <button className="vc-btn" onClick={download} data-vc-diag="">Download diagnostics</button> (features and dot positions only, no video or pictures; saved on this computer).</p>}
              <div className="vc-row"><button className="vc-btn" onClick={skip}>{required ? 'Stop' : 'Continue without eye tracking'}</button><span className="vc-grow" />
                {grade === 'poor' && !retried
                  ? <><button className="vc-btn" onClick={continueOn}>Continue anyway</button><button className="vc-btn primary" onClick={() => { setRetried(true); setPhase('precheck') }} data-vc-retry="">Calibrate again</button></>
                  : <><button className="vc-btn" onClick={() => { setRetried(true); setPhase('precheck') }}>Calibrate again</button><button className="vc-btn primary" onClick={continueOn}>Continue</button></>}
              </div>
            </> : <>
              <h2>Use your camera for eye tracking?</h2>
              <p>It estimates where on the page you look. Video stays in your browser and is never saved or sent; only the points you look at are. First a quick check of your position, then follow 18 dots with your eyes. About a minute.</p>
              {required && <p>This study is about where people look: it needs the camera. If you say no, nothing is recorded.</p>}
              {phase === 'error' && <p className="vc-bad">{hint} {required ? '' : 'You can continue the test without it.'}</p>}
              <div className="vc-row"><span className="vc-grow" /><button className="vc-btn" onClick={skip} data-vc-eye-skip="">{required ? 'No thanks' : 'Continue the test without eye tracking'}</button>{phase !== 'error' && <button className="vc-btn primary" disabled={phase === 'loading'} onClick={() => void start()}>{phase === 'loading' ? 'Starting the camera…' : 'Turn on the camera'}</button>}</div>
            </>}
          </div>
        </div>
      )}
    </>
  )
}

/**
 * While a task runs: where the participant looks, five times a second, as gaze points.
 * - Smoothed with a One-Euro filter (steady while the eye rests, quick when it jumps).
 * - Blinks (eye aspect ratio) are dropped, and so are samples taken with the head far from where it
 *   was during calibration; if that lasts, the participant is asked to move back.
 * - Clicks near the estimate refine the model (people look at what they click), at half the weight
 *   of a calibration dot, so it keeps up with small changes without being dragged by odd clicks.
 * - The element under the point is kept, so results can say what was looked at.
 * - No face for three seconds: the participant is told, and nothing is recorded meanwhile.
 */
const DEBUG = typeof window !== 'undefined' && gazeDebug()
function EyeTracker({ gazeUrl, model, calib, accuracy, rec, task, onFail, onLost, onDrift }: { gazeUrl: string; model: import('../gaze-model').Model; calib: { f: number[]; x: number; y: number; w?: number }[]; accuracy?: number; rec: React.MutableRefObject<Recorder | null>; task?: string; onFail: () => void; onLost: (lost: boolean) => void; onDrift?: (far: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let live = true
    let iv = 0
    let off = () => {}
    void (async () => {
      try {
        const g = await loadGaze(gazeUrl)
        const [lm, video] = await Promise.all([g.loadLandmarker(), camera(g, box.current!)])
        if (!live) return
        let m = model
        const clicks: { f: number[]; x: number; y: number; w: number }[] = []
        const fx = new OneEuro(), fy = new OneEuro()
        const head = new g.HeadCheck(m, { enterMs: 2000, exitMs: 600, lostMs: 1500 })
        let shown: string = 'ok', debugAt = 0
        const show = (st: string) => { if (st === shown) return; onLost(st === 'lost'); onDrift?.(st === 'far'); shown = st }
        let last: number[] | null = null
        eyeMeter ??= new g.RunMeter()
        const meter = eyeMeter
        const click = (e: PointerEvent) => {
          if (!last || e.composedPath().some((n) => n instanceof Element && /^vibe-collab/i.test(n.tagName))) return
          if (g.isBlink(m, last) || g.headDrift(m, last) > 1 || !g.clickTeaches(g.predict(m, last), { x: e.clientX, y: e.clientY }, accuracy ?? 150)) return
          clicks.push({ f: last, x: e.clientX, y: e.clientY, w: g.CLICK_WEIGHT })
          if (clicks.length > 20) clicks.shift()
          if (calib.length >= 9) { try { m = g.fit([...calib, ...clicks]); head.setModel(m) } catch { /* keep the model */ } }
        }
        document.addEventListener('pointerdown', click, true)
        off = () => document.removeEventListener('pointerdown', click, true)
        iv = window.setInterval(() => {
          const now = performance.now()
          let f: number[] | null
          try { f = g.features(lm, video, now) } catch { window.clearInterval(iv); g.resetLandmarker(); stopEyes(); if (live) onFail(); return }
          const ms = performance.now() - now
          // Face lost: "We can't see your face" (never "move back"); head beyond its tolerance for 2 s: "move back".
          const was = shown
          show(head.update(f, now))
          if (!f) { meter.frame('lost', ms); return }
          if (was === 'lost') { fx.reset(); fy.reset() }
          last = f
          if (DEBUG && now - debugAt > 5000) { debugAt = now; console.info('[ourhunch gaze] head drift', Math.round(g.headDrift(m, f) * 100) / 100, 'state', shown) }
          if (g.isBlink(m, f)) { meter.frame('blink', ms); return }
          const w = g.headWeight(g.headDrift(m, f))
          if (w === 0) { meter.frame('moved', ms); return }
          meter.frame('ok', ms)
          const p = g.predict(m, f)
          const x = fx.filter(p.x, now), y = fy.filter(p.y, now)
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return
          const el = document.elementFromPoint(x, y)
          rec.current?.gaze(x + window.scrollX, y + window.scrollY, task, el && !/^vibe-collab/i.test(el.tagName) ? el : null)
        }, 200)
      } catch { if (gazeMod) void gazeMod.then((g) => g.resetLandmarker()).catch(() => {}); if (live) onFail() }
    })()
    return () => { live = false; window.clearInterval(iv); off(); stopEyes(); onLost(false); onDrift?.(false) }
  }, [gazeUrl, model, task]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={box} className="vc-cambox" aria-hidden />
}

