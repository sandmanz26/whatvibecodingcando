import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Square, Video } from 'lucide-react'
import { APP, currentPath, isConsole, isEmbedded } from '../shared'
import { CALIBRATION, VALIDATION, features, fit, isBlink, loadLandmarker, predict, startCamera, stopCamera, type Features, type Model } from './engine'
import { GAZE_ENDED, GAZE_READY, GAZE_START, GAZE_STOP, appendGaze, gazeFrame, saveGazeSession, setGazeClickHook, type GazePoint } from './store'
import { OneEuro } from './analysis'
import { runningTask } from '../tests/store'
import { TOOL_DOM } from '../shared'

type Phase = 'off' | 'consent' | 'loading' | 'calibrate' | 'validate' | 'checked' | 'recording' | 'error'

const RUN_KEY = `${APP}.gaze.run`
interface Saved { sid: string; model: Model; accuracy: number; forTest?: boolean; calib?: { f: Features; x: number; y: number }[] }
const readSaved = (): Saved | null => { try { return JSON.parse(sessionStorage.getItem(RUN_KEY) ?? 'null') } catch { return null } }
const writeSaved = (s: Saved | null) => { try { s ? sessionStorage.setItem(RUN_KEY, JSON.stringify(s)) : sessionStorage.removeItem(RUN_KEY) } catch { /* ignore */ } }

const SAMPLE_MS = 33
const COLLECT_MS = 900

/**
 * Participant side of eye tracking. Starts from any URL with ?gaze, asks before turning
 * the camera on, calibrates, checks accuracy, then records gaze until the participant stops.
 */
export function GazeRunner() {
  const { pathname, search } = useLocation()
  const nav = useNavigate()
  const [phase, setPhase] = useState<Phase>(() => (readSaved() ? 'loading' : 'off'))
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [face, setFace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState('')
  const [accuracy, setAccuracy] = useState<number | null>(() => readSaved()?.accuracy ?? null)
  const [showDot, setShowDot] = useState(false)
  const [dot, setDot] = useState<{ x: number; y: number } | null>(null)

  const video = useRef<HTMLVideoElement | null>(null)
  const preview = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const collector = useRef<((f: Features) => void) | null>(null)
  const samples = useRef<{ f: Features; x: number; y: number }[]>([])
  const checks = useRef<{ px: number; py: number; x: number; y: number }[]>([])
  const model = useRef<Model | null>(readSaved()?.model ?? null)
  if (!samples.current.length && readSaved()?.calib) samples.current = readSaved()!.calib!
  const sid = useRef<string>(readSaved()?.sid ?? '')
  const filt = useRef({ x: new OneEuro(), y: new OneEuro() })
  /** Started by a usability test: it waits for us, and hears when we are ready or stop. */
  const [forTest, setForTest] = useState(() => !!readSaved()?.forTest)
  const forTestRef = useRef(forTest)
  forTestRef.current = forTest
  /** The latest frame's features, and clicks used to keep the calibration accurate while recording. */
  const lastF = useRef<{ f: Features; at: number } | null>(null)
  const clickSamples = useRef<{ f: Features; x: number; y: number }[]>([])
  const buffer = useRef<GazePoint[]>([])

  // ?gaze starts it; the parameter is then removed from the address.
  useEffect(() => {
    if (isEmbedded || isConsole(pathname)) return
    if (!new URLSearchParams(search).has('gaze')) return
    const rest = new URLSearchParams(search)
    rest.delete('gaze')
    nav({ pathname, search: rest.toString() ? `?${rest}` : '' }, { replace: true })
    if (phase === 'off') setPhase('consent')
  }, [search, pathname, nav, phase])

  const shutdown = useCallback((notify = true) => {
    if (notify && forTestRef.current) window.dispatchEvent(new Event(GAZE_ENDED))
    setForTest(false)
    appendGaze(buffer.current.splice(0))
    stopCamera(stream.current)
    stream.current = null
    collector.current = null
    writeSaved(null)
    setPhase('off')
    setDot(null)
  }, [])

  useEffect(() => {
    const start = () => { setForTest(true); setPhase((p) => (p === 'off' ? 'consent' : p)) }
    const stop = () => shutdown(false)
    window.addEventListener(GAZE_START, start)
    window.addEventListener(GAZE_STOP, stop)
    return () => { window.removeEventListener(GAZE_START, start); window.removeEventListener(GAZE_STOP, stop) }
  }, [shutdown])

  const camera = useCallback(async (next: Phase) => {
    setPhase('loading')
    try {
      if (!video.current) video.current = document.createElement('video')
      const [lm, s] = await Promise.all([loadLandmarker(), stream.current ? Promise.resolve(stream.current) : startCamera(video.current)])
      stream.current = s
      if (preview.current) preview.current.srcObject = s
      void lm
      setPhase(next)
    } catch (e) {
      setError(e instanceof DOMException && e.name === 'NotAllowedError' ? 'The camera wasn’t allowed. Eye tracking needs it; nothing else does.' : 'Couldn’t start eye tracking: the camera or the face model didn’t load.')
      setPhase('error')
      stopCamera(stream.current)
      stream.current = null
    }
  }, [])

  // After a reload mid-recording, pick the camera back up with the same calibration.
  useEffect(() => { if (phase === 'loading' && readSaved() && !stream.current) void camera('recording') }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (preview.current && stream.current) preview.current.srcObject = stream.current }, [phase])

  // One loop reads the camera while it is on, and hands each frame to whoever needs it.
  useEffect(() => {
    if (!['calibrate', 'validate', 'checked', 'recording'].includes(phase)) return
    let raf = 0, last = 0, live = true
    void loadLandmarker().then((lm) => {
      const tick = (now: number) => {
        if (!live) return
        if (now - last >= 33 && video.current && video.current.readyState >= 2) {
          last = now
          const f = features(lm, video.current, now)
          setFace(!!f)
          if (f) { lastF.current = { f, at: now }; collector.current?.(f) }
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })
    return () => { live = false; cancelAnimationFrame(raf) }
  }, [phase])

  // Recording: about 30 samples a second, blinks dropped, smoothed with a One-Euro filter (steady
  // while the eye rests, quick when it jumps), written as page coordinates. In a usability test each
  // sample is tagged with the task and the time since it started, so fixations can be read per task.
  useEffect(() => {
    if (phase !== 'recording' || !model.current) return
    let lastSample = 0
    filt.current.x.reset(); filt.current.y.reset()
    collector.current = (f) => {
      const m = model.current!
      if (isBlink(m, f)) return
      const now = performance.now()
      const p = predict(m, f)
      const sx = filt.current.x.filter(p.x, now), sy = filt.current.y.filter(p.y, now)
      const x = Math.min(window.innerWidth, Math.max(0, sx)), y = Math.min(window.innerHeight, Math.max(0, sy))
      setDot({ x, y })
      const fr = gazeFrame()
      // The research console is never studied itself, except through a frame that hosts the app.
      if (now - lastSample < SAMPLE_MS || document.visibilityState !== 'visible' || (!fr && isConsole(currentPath()))) return
      lastSample = now
      const ms = Date.now()
      if (fr) {
        const m = fr.map(x, y)
        if (!m) return
        const c = fr.ctx()
        buffer.current.push({ sid: sid.current, t: new Date(ms).toISOString(), ms, page: m.page, x: Math.round(m.x * 10) / 10, y: Math.round(m.y), vw: m.vw, vh: m.vh, ...(c ?? {}) })
        return
      }
      const ctx = runningTask()
      buffer.current.push({
        sid: sid.current, t: new Date(ms).toISOString(), ms, page: currentPath(),
        x: Math.round((x / window.innerWidth) * 1000) / 10, y: Math.round(y + window.scrollY), vw: window.innerWidth, vh: window.innerHeight,
        ...(ctx ? { test: ctx.session, task: ctx.taskId, tt: ms - ctx.startedAt } : {}),
      })
    }
    // Every click is a free calibration point: people look at what they click. The model is refitted
    // with the calibration plus the latest clicks, so it keeps up when the head moves.
    const learn = (cx: number, cy: number) => {
      const lf = lastF.current
      if (!lf || performance.now() - lf.at > 120 || isBlink(model.current!, lf.f)) return
      clickSamples.current = [...clickSamples.current, { f: lf.f, x: cx, y: cy }].slice(-30)
      const clicks = clickSamples.current.flatMap((c) => [c, c, c])
      model.current = fit([...samples.current, ...clicks])
      writeSaved({ ...(readSaved() as Saved), model: model.current })
    }
    const onClick = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || e.target.closest(`${TOOL_DOM}, [data-gaze]`)) return
      learn(e.clientX, e.clientY)
    }
    setGazeClickHook(learn)
    document.addEventListener('pointerdown', onClick, true)
    const flush = window.setInterval(() => appendGaze(buffer.current.splice(0)), 2000)
    const onHide = () => appendGaze(buffer.current.splice(0))
    window.addEventListener('pagehide', onHide)
    return () => { collector.current = null; setGazeClickHook(null); document.removeEventListener('pointerdown', onClick, true); window.clearInterval(flush); window.removeEventListener('pagehide', onHide); appendGaze(buffer.current.splice(0)) }
  }, [phase])

  // Calibration and checking: look at the dot, click it, keep looking while frames are collected.
  const targets = phase === 'validate' ? VALIDATION : CALIBRATION
  const look = () => {
    if (busy) return
    setBusy(true)
    setHint('')
    const t = targets[step]
    const tx = t.x * window.innerWidth, ty = t.y * window.innerHeight
    const got: Features[] = []
    const startAt = performance.now()
    collector.current = (f) => { if (performance.now() - startAt > 150) got.push(f) }
    window.setTimeout(() => {
      collector.current = null
      setBusy(false)
      if (got.length < 6) { setHint('Couldn’t see your eyes. Face the screen in good light, then click the dot again.'); return }
      if (phase === 'calibrate') {
        got.forEach((f) => samples.current.push({ f, x: tx, y: ty }))
        if (step + 1 < CALIBRATION.length) setStep(step + 1)
        else { model.current = fit(samples.current); setStep(0); setPhase('validate') }
      } else {
        const ps = got.map((f) => predict(model.current!, f))
        checks.current.push({ px: ps.reduce((a, p) => a + p.x, 0) / ps.length, py: ps.reduce((a, p) => a + p.y, 0) / ps.length, x: tx, y: ty })
        if (step + 1 < VALIDATION.length) setStep(step + 1)
        else {
          const err = Math.round(checks.current.reduce((a, c) => a + Math.hypot(c.px - c.x, c.py - c.y), 0) / checks.current.length)
          setAccuracy(err)
          setPhase('checked')
        }
      }
    }, COLLECT_MS)
  }

  const recalibrate = () => { samples.current = []; checks.current = []; setStep(0); setHint(''); setPhase('calibrate') }
  const record = () => {
    sid.current = Math.random().toString(36).slice(2, 10)
    clickSamples.current = []
    writeSaved({ sid: sid.current, model: model.current!, accuracy: accuracy ?? 0, forTest, calib: samples.current })
    saveGazeSession({ sid: sid.current, start: new Date().toISOString(), vw: window.innerWidth, accuracy })
    setPhase('recording')
    if (forTest) window.dispatchEvent(new CustomEvent(GAZE_READY, { detail: { accuracy: accuracy ?? 0 } }))
  }

  if (phase === 'off' || isEmbedded) return null

  const quality = accuracy === null ? '' : accuracy <= 120 ? 'good' : accuracy <= 220 ? 'rough' : 'poor'

  return createPortal(
    <div data-insights-ignore data-gaze>
      {(phase === 'calibrate' || phase === 'validate') && (
        <div className="gz-stage">
          <div className="gz-head">
            <video ref={preview} className="gz-preview" autoPlay muted playsInline />
            <div>
              <b>{phase === 'calibrate' ? `Calibrating · ${step + 1} of ${CALIBRATION.length}` : `Checking accuracy · ${step + 1} of ${VALIDATION.length}`}</b>
              <p>Keep your head still. Look straight at the dot and click it, then keep looking until it moves.</p>
              <p className={face ? 'gz-ok' : 'gz-bad'}>{face ? 'Eyes found' : 'Looking for your face…'}</p>
              {hint && <p className="gz-bad">{hint}</p>}
            </div>
            <button className="btn sm ghost" onClick={() => shutdown()}>Cancel</button>
          </div>
          <button className={`gz-target ${busy ? 'busy' : ''} ${phase === 'validate' ? 'check' : ''}`} style={{ left: `${targets[step].x * 100}%`, top: `${targets[step].y * 100}%` }} onClick={look} aria-label="Calibration dot" />
        </div>
      )}

      {phase !== 'calibrate' && phase !== 'validate' && phase !== 'recording' && (
        <>
          <div className="scrim" />
          <div className="modal gz-card" role="dialog" aria-modal="true" aria-label="Eye tracking">
            <div className="modal-head">
              <h2 className="row" style={{ gap: 8, fontSize: 16 }}><Video size={16} /> Eye tracking</h2>
              {phase === 'consent' && <p>This study can estimate where you look on the screen, using your webcam.</p>}
            </div>
            <div className="modal-body">
              {phase === 'consent' && (
                <ul className="gz-list">
                  <li>The video stays in this browser. No video or pictures are saved or sent anywhere.</li>
                  <li>Only the estimated point you look at on each page is kept.</li>
                  <li>First a short calibration: {CALIBRATION.length} dots, then {VALIDATION.length} to check accuracy. About a minute.</li>
                  {forTest && <li>If you’d rather not, the test goes on without it.</li>}
                  <li>You can stop at any time with the Stop button.</li>
                </ul>
              )}
              {phase === 'loading' && <p className="muted">Starting the camera and loading the face model…</p>}
              {phase === 'error' && <p style={{ color: 'var(--critical-ink)' }}>{error}</p>}
              {phase === 'checked' && (
                <>
                  <p>Calibrated. On average the estimate was <b className="num">{accuracy} px</b> from where you looked.</p>
                  <p className={`gz-quality ${quality}`}>{quality === 'good' ? 'Good enough for a heatmap of areas.' : quality === 'rough' ? 'Rough: fine for large areas, not for single buttons.' : 'Too far off. Calibrate again with your face well lit and your head still.'}</p>
                  <video ref={preview} className="gz-preview" autoPlay muted playsInline style={{ marginTop: 10 }} />
                </>
              )}
            </div>
            <div className="modal-foot">
              {phase === 'consent' && <><button className="btn" onClick={() => shutdown()}>{forTest ? 'No, continue without' : 'Not now'}</button><button className="btn primary" onClick={() => void camera('calibrate')}>Turn on the camera</button></>}
              {phase === 'error' && <button className="btn" onClick={() => shutdown()}>{forTest ? 'Continue without eye tracking' : 'Close'}</button>}
              {phase === 'checked' && <>
                <button className="btn" onClick={recalibrate}>Calibrate again</button>
                {forTest && quality === 'poor' && <button className="btn" onClick={() => shutdown()}>Continue without eye tracking</button>}
                <button className="btn primary" onClick={record} disabled={quality === 'poor'}>{forTest ? 'Continue to the test' : 'Start recording'}</button>
              </>}
            </div>
          </div>
        </>
      )}

      {phase === 'recording' && (
        <>
          {showDot && dot && <i className="gz-dot" style={{ left: dot.x, top: dot.y }} aria-hidden />}
          <div className="gz-pill" role="status">
            <i className={face ? 'on' : ''} /> {face ? 'Eye tracking' : 'Can’t see your eyes'}
            <span className="muted num">±{accuracy} px</span>
            <button className="btn ghost sm icon" onClick={() => setShowDot((v) => !v)} aria-label={showDot ? 'Hide my gaze' : 'Show my gaze'} title={showDot ? 'Hide my gaze' : 'Show my gaze'}>{showDot ? <EyeOff size={14} /> : <Eye size={14} />}</button>
            <button className="btn sm" onClick={() => shutdown()}><Square size={12} /> Stop</button>
          </div>
        </>
      )}
    </div>,
    document.body,
  )
}
