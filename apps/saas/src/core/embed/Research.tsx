/**
 * What a study's participant sees on the customer's site: the consent screen, then the study
 * (usability tasks, a 5-second test, or a free browse for a heatmap), then a thank-you. See
 * research.ts for what is recorded and what never is.
 */
import { useEffect, useRef, useState } from 'react'
import { Check, Eye, Flag, Timer, X } from 'lucide-react'
import { OneEuro } from '../gaze-analysis'
import { Recorder, pageOf, cleanConfig, finishRun, pageMatches, saveRun, startRun, type Door, type Outcome, type RunState } from './research'

const mmss = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }
const KIND_LABEL = { usability: 'tasks on this site', fivesec: 'a 5-second test', browse: 'a short visit' } as const

export function Participant({ project, initial, accent, doorsOn = false, gazeUrl = '' }: { project: string; initial: RunState; accent: string; doorsOn?: boolean; gazeUrl?: string }) {
  const recRef = useRef<Recorder | null>(null)
  // Hooks first, before any return below: React needs the same hooks in the same order every render.
  const [faceLost, setFaceLost] = useState(false)
  const [st, setSt] = useState<RunState>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [, tick] = useState(0)
  const stRef = useRef(st)
  stRef.current = st
  const update = (next: RunState) => { setSt(next); saveRun(project, next.phase === 'declined' ? null : next) }

  const tasks = st.config?.tasks ?? []
  const task = st.kind === 'usability' ? tasks[st.index] : undefined
  const limitMs = st.kind === 'usability' ? (task?.limitSec ?? 180) * 1000 : st.kind === 'browse' ? (st.config?.minutes ?? 3) * 60_000 : (st.config?.seconds ?? 5) * 1000
  const elapsed = st.taskStart ? Date.now() - st.taskStart : 0

  /* ---- finishing a task, and the run ---- */
  const finishAll = async (s: RunState) => {
    update({ ...s, phase: 'done' })
    stopEyes()
    try { await finishRun(s.run!, { kind: s.kind, tasks: s.results, answers: s.answers }, s.eye?.on ? s.eye.accuracy : undefined) } catch { /* the events are in; the summary is retried below */ }
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
      })
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
            {info?.eye && <li><Eye size={14} /> You’ll also be asked whether to use your camera for eye tracking. Video stays in your browser; only where you look on the page is saved. You can say no.</li>}
            <li><Check size={14} /> Only for this study, in this tab. Close the tab to stop at any time.</li>
          </ul>
          {error && <p className="vc-bad">{error}</p>}
          <div className="vc-row"><span className="vc-grow" />
            <button className="vc-btn" onClick={() => update({ ...st, phase: 'declined' })}>No thanks</button>
            <button className="vc-btn primary" disabled={busy || !!error} onClick={() => void agree()}>{busy ? 'Starting…' : 'I agree, start'}</button>
          </div>
          <p className="vc-where">Run with Vibe Collab for the site’s owner.</p>
        </div>
      </div>
    )
  }
  if (st.phase === 'eyes') return <div className="vc" style={style}><EyeSetup gazeUrl={gazeUrl} onDone={(eye) => update({ ...st, phase: 'intro', eye })} /></div>
  const eyes = recording && st.eye?.on && st.eye.model ? <EyeTracker gazeUrl={gazeUrl} model={st.eye.model} calib={st.eye.calib ?? []} rec={recRef} task={task?.id ?? st.kind} onLost={setFaceLost} onFail={() => update({ ...stRef.current, eye: { ...stRef.current.eye!, on: false } })} /> : null
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
          {eyes && <span className={`vc-clock ${faceLost ? 'vc-lostface' : ''}`} title="Eye tracking is on: video stays in your browser"><Eye size={13} />{faceLost ? ' Face the camera' : ''}</span>}
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
async function camera(g: Gaze, host: HTMLElement): Promise<HTMLVideoElement> {
  if (cam && cam.stream.active) return cam.video
  const video = document.createElement('video')
  video.className = 'vc-cam'
  host.appendChild(video)
  const stream = await g.startCamera(video)
  cam = { stream, video }
  return video
}
function stopEyes() { if (cam) { cam.stream.getTracks().forEach((t) => t.stop()); cam.video.remove(); cam = null } }

/** Asks, starts the camera, calibrates (13 dots) and checks accuracy (5 dots). */
function EyeSetup({ gazeUrl, onDone }: { gazeUrl: string; onDone: (eye: RunState['eye']) => void }) {
  const [phase, setPhase] = useState<'ask' | 'loading' | 'calibrate' | 'validate' | 'result' | 'error'>('ask')
  const [step, setStep] = useState(0)
  const [hint, setHint] = useState('')
  const [accuracy, setAccuracy] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const ref = useRef<{ g: Gaze; lm: Awaited<ReturnType<Gaze['loadLandmarker']>>; video: HTMLVideoElement; samples: { f: number[]; x: number; y: number }[]; model?: import('../gaze-model').Model; errs: number[] } | null>(null)
  const start = async () => {
    setPhase('loading')
    try {
      const g = await loadGaze(gazeUrl)
      const [lm, video] = await Promise.all([g.loadLandmarker(), camera(g, box.current!)])
      ref.current = { g, lm, video, samples: [], errs: [] }
      setStep(0); setPhase('calibrate')
    } catch (e) {
      stopEyes()
      setHint(!window.isSecureContext || !navigator.mediaDevices ? 'The camera only works on a secure (https) page.' : /Permission|NotAllowed/i.test(String((e as Error).name ?? e)) ? 'The camera wasn’t allowed.' : /NotFound|Overconstrained/i.test(String((e as Error).name ?? e)) ? 'No camera was found.' : 'Eye tracking couldn’t start on this device.')
      setPhase('error')
    }
  }
  /** The features of a few frames, averaged; null when no face is seen. */
  const read = async () => {
    const r = ref.current!
    const got: number[][] = []
    for (let i = 0; i < 6; i++) { const f = r.g.features(r.lm, r.video, performance.now()); if (f) got.push(f); await new Promise((res) => setTimeout(res, 50)) }
    return got.length ? got[0].map((_, j) => got.reduce((a, f) => a + f[j], 0) / got.length) : null
  }
  const dots = phase === 'validate' ? ref.current?.g.VALIDATION ?? [] : ref.current?.g.CALIBRATION ?? []
  const dot = dots[step]
  const reading = useRef(false)
  const hit = async () => {
    const r = ref.current
    // One reading at a time: a quick second click doesn't count twice or skip a dot.
    if (!r || !dot || reading.current) return
    reading.current = true
    const f = await read().finally(() => { reading.current = false })
    if (!f) { setHint('We can’t see your face. Face the camera, with some light on you.'); return }
    setHint('')
    const x = dot.x * window.innerWidth, y = dot.y * window.innerHeight
    if (phase === 'calibrate') {
      r.samples.push({ f, x, y })
      if (step + 1 < r.g.CALIBRATION.length) setStep(step + 1)
      else { r.model = r.g.fit(r.samples); setStep(0); setPhase('validate') }
    } else {
      const p = r.g.predict(r.model!, f)
      r.errs.push(Math.hypot(p.x - x, p.y - y))
      if (step + 1 < r.g.VALIDATION.length) setStep(step + 1)
      else { setAccuracy(Math.round(r.errs.reduce((a, b) => a + b, 0) / r.errs.length)); setPhase('result') }
    }
  }
  const skip = () => { stopEyes(); onDone({ on: false }) }
  return (
    <>
      <div ref={box} className="vc-cambox" aria-hidden />
      {(phase === 'calibrate' || phase === 'validate') && dot ? (
        <div className="vc-calib">
          <div className="vc-taskbar" role="status"><span className="vc-kicker">{phase === 'calibrate' ? 'Calibrating' : 'Checking'} · {step + 1} of {dots.length}</span><span className="vc-taskprompt">Look at the dot, then click it.</span><button className="vc-btn" onClick={skip}>Skip eye tracking</button></div>
          {hint && <div className="vc-toast error" role="alert">{hint}</div>}
          <button className="vc-dot" style={{ left: `${dot.x * 100}%`, top: `${dot.y * 100}%` }} onClick={() => void hit()} aria-label={`Calibration dot ${step + 1}`} />
        </div>
      ) : (
        <div className="vc-scrim">
          <div className="vc-modal" role="dialog" aria-label="Eye tracking">
            <span className="vc-kicker">Optional</span>
            {phase === 'result' ? <>
              <h2>Eye tracking is ready</h2>
              <p>On average the estimate was <b>{accuracy} px</b> from where you looked ({accuracy <= 120 ? 'good' : accuracy <= 220 ? 'rough, still useful' : 'poor: try again with more light, or go on without'}).</p>
              <div className="vc-row"><button className="vc-btn" onClick={skip}>Go on without</button><span className="vc-grow" /><button className="vc-btn" onClick={() => { ref.current!.samples = []; ref.current!.errs = []; setStep(0); setPhase('calibrate') }}>Calibrate again</button><button className="vc-btn primary" onClick={() => onDone({ on: true, model: ref.current!.model, accuracy, calib: ref.current!.samples.map((x) => ({ f: x.f.map((v) => Math.round(v * 1e5) / 1e5), x: Math.round(x.x), y: Math.round(x.y) })) })}>Continue</button></div>
            </> : <>
              <h2>Use your camera for eye tracking?</h2>
              <p>It estimates where on the page you look. Video stays in your browser and is never saved or sent; only the points you look at are. First a short calibration: look at {13} dots and click each, about a minute.</p>
              {phase === 'error' && <p className="vc-bad">{hint} You can go on without it.</p>}
              <div className="vc-row"><span className="vc-grow" /><button className="vc-btn" onClick={skip}>No, go on without</button>{phase !== 'error' && <button className="vc-btn primary" disabled={phase === 'loading'} onClick={() => void start()}>{phase === 'loading' ? 'Starting the camera…' : 'Turn on the camera'}</button>}</div>
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
 * - Every click is a free calibration point (people look at what they click): the model is
 *   refitted with the calibration plus the latest clicks, so it keeps up when the head moves.
 * - The element under the point is kept, so results can say what was looked at.
 * - No face for three seconds: the participant is told, and nothing is recorded meanwhile.
 */
function EyeTracker({ gazeUrl, model, calib, rec, task, onFail, onLost }: { gazeUrl: string; model: import('../gaze-model').Model; calib: { f: number[]; x: number; y: number }[]; rec: React.MutableRefObject<Recorder | null>; task?: string; onFail: () => void; onLost: (lost: boolean) => void }) {
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
        const clicks: { f: number[]; x: number; y: number }[] = []
        const fx = new OneEuro(), fy = new OneEuro()
        let misses = 0, lost = false
        let last: number[] | null = null
        const click = (e: PointerEvent) => {
          if (!last || e.composedPath().some((n) => n instanceof Element && /^vibe-collab/i.test(n.tagName))) return
          clicks.push({ f: last, x: e.clientX, y: e.clientY })
          if (clicks.length > 20) clicks.shift()
          if (calib.length >= 9) { try { m = g.fit([...calib, ...clicks]) } catch { /* keep the model */ } }
        }
        document.addEventListener('pointerdown', click, true)
        off = () => document.removeEventListener('pointerdown', click, true)
        iv = window.setInterval(() => {
          const now = performance.now()
          const f = g.features(lm, video, now)
          if (!f) { misses++; if (misses >= 15 && !lost) { lost = true; onLost(true) }; return }
          if (lost) { lost = false; onLost(false); fx.reset(); fy.reset() }
          misses = 0
          last = f
          if (g.isBlink(m, f)) return
          const p = g.predict(m, f)
          const x = fx.filter(p.x, now), y = fy.filter(p.y, now)
          if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return
          const el = document.elementFromPoint(x, y)
          rec.current?.gaze(x + window.scrollX, y + window.scrollY, task, el && !/^vibe-collab/i.test(el.tagName) ? el : null)
        }, 200)
      } catch { if (live) onFail() }
    })()
    return () => { live = false; window.clearInterval(iv); off(); onLost(false) }
  }, [gazeUrl, model, task]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={box} className="vc-cambox" aria-hidden />
}

