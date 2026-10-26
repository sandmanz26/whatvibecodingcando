/**
 * Eye tracking, participant side: consent → 9-dot calibration → 4-dot accuracy check →
 * recording with a Stop button. See the privacy rules in ./gaze-engine.ts — video never
 * leaves the browser and is never stored; only gaze points on the page are kept.
 */
import { RESEARCH_ATTR, isEmbedded, type ResearchConfig } from './config'
import { readJSON, removeKey, uid, writeJSON } from './storage'
import { CALIBRATION, VALIDATION, features, fit, loadLandmarker, predict, startCamera, stopCamera, type Features, type Model } from './gaze-engine'

export interface GazePoint { sid: string; t: string; page: string; /** % of width */ x: number; /** page px */ y: number; vw: number; vh: number }
export interface GazeSession { sid: string; start: string; vw: number; accuracy: number }

const keys = (cfg: ResearchConfig) => ({ points: `${cfg.app}.gaze.points`, sessions: `${cfg.app}.gaze.sessions` })
export const loadGaze = (cfg: ResearchConfig) => readJSON<GazePoint[]>(keys(cfg).points, [])
const appendGaze = (cfg: ResearchConfig, pts: GazePoint[]) => { if (pts.length) writeJSON(keys(cfg).points, [...loadGaze(cfg), ...pts].slice(-20000)) }
export const loadGazeSessions = (cfg: ResearchConfig) => readJSON<GazeSession[]>(keys(cfg).sessions, [])
export function clearGaze(cfg: ResearchConfig) { removeKey(keys(cfg).points); removeKey(keys(cfg).sessions) }

const STYLE = {
  stage: 'position:fixed;inset:0;z-index:2147483600;background:#fafaf8;font:13px/1.5 system-ui,sans-serif;color:#111',
  card: 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 32px));background:#fff;border-radius:12px;padding:20px;box-shadow:0 12px 40px rgba(0,0,0,.2);z-index:2147483601;font:14px/1.5 system-ui,sans-serif;color:#111',
  btn: 'padding:7px 14px;border-radius:8px;border:1px solid #ccc;background:#fff;font:inherit;cursor:pointer',
  primary: 'padding:7px 14px;border-radius:8px;border:0;background:#111;color:#fff;font:inherit;cursor:pointer',
}

/** Starts the participant flow. Returns a stop function. */
export function startGaze(cfg: ResearchConfig): () => void {
  if (isEmbedded) return () => {}
  const root = document.createElement('div')
  root.setAttribute(RESEARCH_ATTR, '')
  document.body.appendChild(root)
  const video = document.createElement('video')
  let stream: MediaStream | null = null
  let collector: ((f: Features) => void) | null = null
  let raf = 0
  let face = false
  let model: Model | null = null
  let flushTimer = 0
  const buffer: GazePoint[] = []

  const stop = () => {
    cancelAnimationFrame(raf)
    window.clearInterval(flushTimer)
    appendGaze(cfg, buffer.splice(0))
    stopCamera(stream)
    root.remove()
  }

  const card = (html: string, actions: [string, string, () => void][]) => {
    root.innerHTML = `<div style="position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2147483600"></div><div role="dialog" aria-modal="true" style="${STYLE.card}">${html}<div data-actions style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"></div></div>`
    const bar = root.querySelector('[data-actions]')!
    for (const [label, style, fn] of actions) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = style; b.onclick = fn; bar.appendChild(b) }
  }

  const loop = async () => {
    const lm = await loadLandmarker()
    let last = 0
    const tick = (now: number) => {
      if (now - last >= 33 && video.readyState >= 2) {
        last = now
        const f = features(lm, video, now)
        face = !!f
        const s = root.querySelector('[data-face]')
        if (s) { s.textContent = face ? 'Eyes found' : 'Looking for your face…'; (s as HTMLElement).style.color = face ? '#006300' : '#b42323' }
        if (f) collector?.(f)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
  }

  const dots = (targets: { x: number; y: number }[], title: string, done: (got: { f: Features[]; x: number; y: number }[]) => void) => {
    const got: { f: Features[]; x: number; y: number }[] = []
    let step = 0
    const draw = (hint = '') => {
      const t = targets[step]
      root.innerHTML = `<div style="${STYLE.stage}"><div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);max-width:520px;background:#fff;padding:14px;border-radius:12px;box-shadow:0 0 0 1px rgba(0,0,0,.08)"><b>${title} · ${step + 1} of ${targets.length}</b><p style="margin:2px 0;color:#52514e">Keep your head still. Look straight at the dot and click it, then keep looking until it moves.</p><p data-face style="margin:0;font-weight:600"></p>${hint ? `<p style="margin:0;color:#b42323;font-weight:600">${hint}</p>` : ''}</div><button data-dot aria-label="Calibration dot" style="position:absolute;left:${t.x * 100}%;top:${t.y * 100}%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;border:3px solid #fff;background:#d03b3b;box-shadow:0 0 0 2px #d03b3b;cursor:pointer;padding:0"></button><button data-cancel style="position:absolute;top:16px;right:16px;${STYLE.btn}">Cancel</button></div>`
      root.querySelector<HTMLButtonElement>('[data-cancel]')!.onclick = stop
      const dot = root.querySelector<HTMLButtonElement>('[data-dot]')!
      dot.onclick = () => {
        dot.disabled = true
        dot.style.transition = 'transform .9s linear'
        dot.style.transform = 'scale(.45)'
        const f: Features[] = []
        const started = performance.now()
        collector = (x) => { if (performance.now() - started > 150) f.push(x) }
        window.setTimeout(() => {
          collector = null
          if (f.length < 6) { draw('Couldn’t see your eyes. Face the screen in good light, then click the dot again.'); return }
          got.push({ f, x: t.x * window.innerWidth, y: t.y * window.innerHeight })
          if (++step < targets.length) draw(); else done(got)
        }, 900)
      }
    }
    draw()
  }

  const record = (accuracy: number) => {
    const sid = uid()
    writeJSON(keys(cfg).sessions, [...loadGazeSessions(cfg), { sid, start: new Date().toISOString(), vw: window.innerWidth, accuracy }])
    root.innerHTML = `<div role="status" style="position:fixed;right:16px;bottom:16px;z-index:2147483500;display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;border-radius:999px;background:#fff;box-shadow:0 6px 24px rgba(0,0,0,.18);font:13px system-ui,sans-serif;color:#111"><span data-face></span><span style="color:#777">±${accuracy} px</span></div>`
    const b = document.createElement('button'); b.textContent = 'Stop'; b.style.cssText = STYLE.btn; b.onclick = stop
    root.firstElementChild!.appendChild(b)
    let smooth: { x: number; y: number } | null = null
    let lastSample = 0
    collector = (f) => {
      const p = predict(model!, f)
      smooth = smooth ? { x: smooth.x * 0.7 + p.x * 0.3, y: smooth.y * 0.7 + p.y * 0.3 } : p
      const now = performance.now()
      if (now - lastSample < 66 || document.visibilityState !== 'visible' || cfg.paused()) return
      lastSample = now
      const x = Math.min(window.innerWidth, Math.max(0, smooth.x)), y = Math.min(window.innerHeight, Math.max(0, smooth.y))
      buffer.push({ sid, t: new Date().toISOString(), page: cfg.path(), x: Math.round((x / window.innerWidth) * 1000) / 10, y: Math.round(y + window.scrollY), vw: window.innerWidth, vh: window.innerHeight })
    }
    flushTimer = window.setInterval(() => appendGaze(cfg, buffer.splice(0)), 2000)
    window.addEventListener('pagehide', () => appendGaze(cfg, buffer.splice(0)), { once: true })
  }

  const calibrate = () => dots(CALIBRATION, 'Calibrating', (cal) => {
    model = fit(cal.flatMap((c) => c.f.map((f) => ({ f, x: c.x, y: c.y }))))
    dots(VALIDATION, 'Checking accuracy', (val) => {
      const err = Math.round(val.reduce((a, c) => {
        const ps = c.f.map((f) => predict(model!, f))
        return a + Math.hypot(ps.reduce((s, p) => s + p.x, 0) / ps.length - c.x, ps.reduce((s, p) => s + p.y, 0) / ps.length - c.y)
      }, 0) / val.length)
      const verdict = err <= 120 ? 'Good enough for a heatmap of areas.' : err <= 220 ? 'Rough: fine for large areas, not for single buttons.' : 'Too far off. Calibrate again with your face well lit and your head still.'
      card(`<b style="font-size:16px">Calibrated</b><p>On average the estimate was <b>${err} px</b> from where you looked. ${verdict}</p>`, [
        ['Calibrate again', STYLE.btn, calibrate],
        ...(err <= 220 ? [['Start recording', STYLE.primary, () => record(err)] as [string, string, () => void]] : []),
      ])
    })
  })

  card(`<b style="font-size:16px">Eye tracking</b><p>This study can estimate where you look on the screen, using your webcam.</p><ul style="padding-left:18px;margin:0">
<li>The video stays in this browser. No video or pictures are saved or sent anywhere.</li>
<li>Only the estimated point you look at on each page is kept.</li>
<li>First a short calibration: 9 dots, then 4 to check accuracy.</li>
<li>You can stop at any time.</li></ul>`, [
    ['Not now', STYLE.btn, stop],
    ['Turn on the camera', STYLE.primary, async () => {
      card('<p>Starting the camera and loading the face model…</p>', [])
      try {
        ;[, stream] = await Promise.all([loadLandmarker(), startCamera(video)])
        void loop()
        calibrate()
      } catch (e) {
        card(`<p style="color:#b42323">${e instanceof DOMException && e.name === 'NotAllowedError' ? 'The camera wasn’t allowed.' : 'Couldn’t start eye tracking: the camera or the face model didn’t load.'}</p>`, [['Close', STYLE.btn, stop]])
      }
    }],
  ])
  return stop
}
