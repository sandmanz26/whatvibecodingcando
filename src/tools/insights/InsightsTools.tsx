import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { isConsole, useFlag } from '../shared'
import { installTracker, trackView } from './tracker'
import { layoutOf, loadEvents, type ClickEvent } from './store'
import { taskTapsAsClicks } from '../tests/store'
import { fiveSecAsClicks } from '../fivesec/store'
import { loadGaze, type GazePoint } from '../gaze/store'

/** Message the heatmap posts to the console's screen viewer when embedded. */
export interface HeatmapStats { type: 'market:heatmap'; taps: number; missing: number; layout: string; page: string; unit: 'tap' | 'gaze sample' | 'first click' }

/** Installs the tracker while the flag is on and reports route changes to it. */
export function InsightsTracker() {
  const on = useFlag('insights')
  const { pathname } = useLocation()
  useEffect(() => (on ? installTracker() : undefined), [on])
  useEffect(() => { if (on) trackView(pathname) }, [on, pathname])
  return null
}

function firstVisible(sel: string): Element | null {
  try {
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest('[data-insights-ignore]')) continue
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  } catch { /* selector from another version of the app */ }
  return null
}

/** Gaze as soft areas: each sample is a wide blur, because webcam tracking is only good to ~100–200 px. */
function GazeLayer({ points, vw, docH }: { points: GazePoint[]; vw: number; docH: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const h = Math.min(docH, 16000)
  useEffect(() => {
    const c = ref.current
    if (!c || !h) return
    c.width = vw
    c.height = h
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, vw, h)
    const r = 80
    for (const p of points) {
      const x = (p.x / 100) * vw, y = p.y
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(0,0,0,0.09)')
      g.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }
    // Colour by density: blue → green → yellow → red.
    const img = ctx.getImageData(0, 0, vw, h)
    const d = img.data
    let max = 1
    for (let i = 3; i < d.length; i += 4) if (d[i] > max) max = d[i]
    for (let i = 0; i < d.length; i += 4) {
      const a = d[i + 3] / max
      if (a < 0.04) { d[i + 3] = 0; continue }
      const [R, G, B] = a < 0.33 ? [42, 120 + a * 300, 214] : a < 0.66 ? [80 + (a - 0.33) * 520, 200, 80] : [240, 200 - (a - 0.66) * 450, 40]
      d[i] = R; d[i + 1] = G; d[i + 2] = B; d[i + 3] = Math.round(70 + a * 120)
    }
    ctx.putImageData(img, 0, 0)
  }, [points, vw, h])
  return <canvas ref={ref} className="hm-gaze" style={{ width: vw, height: h }} aria-hidden />
}

interface Box { sel: string; label: string; taps: number; nothing: number; rect: DOMRect }

/** Heatmap overlay — active only when the URL carries ?heatmap. */
export function HeatmapOverlay() {
  const { pathname, search } = useLocation()
  const nav = useNavigate()
  const q = new URLSearchParams(search)
  const active = q.has('heatmap') && !isConsole(pathname)
  const mode = q.get('heatmap') === 'elements' ? 'elements' : q.get('heatmap') === 'gaze' ? 'gaze' : 'dots'
  // fivesec=<testId> draws a 5-second test's first clicks.
  const fivesec = q.get('fivesec')
  const focus = q.get('el')
  // Inside the console's screen viewer the console owns the controls, so the bar and notices are hidden.
  const embed = q.has('embed')
  // task=<testId>:<taskId> draws a usability task's taps instead of everyday click data.
  const task = q.get('task')
  // dot=x,y[,ex,ey] draws one tap (a step of a session) instead of every tap on the screen.
  const dot = q.get('dot')?.split(',').map(Number) as [number, number, number?, number?] | undefined

  const [clicks, setClicks] = useState<ClickEvent[] | null>(null)
  const [gaze, setGaze] = useState<GazePoint[]>([])
  const [vw, setVw] = useState(window.innerWidth)
  const [docH, setDocH] = useState(0)
  const [boxes, setBoxes] = useState<Box[]>([])
  // Where each tapped element is now, in the viewport. Taps are drawn on their element, not at old
  // page coordinates: those drift when the layout differs (fixed-width sidebars, renamed menus) or
  // when part of the page doesn't scroll (a sticky sidebar).
  const [rects, setRects] = useState<Map<string, DOMRect>>(new Map())
  const [missing, setMissing] = useState(0)

  useEffect(() => {
    if (!active) return
    let live = true
    if (mode === 'gaze') {
      setGaze(loadGaze())
      setClicks([])
    } else if (fivesec) {
      setClicks(fiveSecAsClicks(fivesec))
    } else if (task) {
      const [testId, taskId] = task.split(':')
      setClicks(taskTapsAsClicks(testId, taskId))
    } else {
      void loadEvents().then((d) => live && setClicks(d.events.filter((e): e is ClickEvent => e.type === 'click')))
    }
    return () => { live = false }
  }, [active, task, fivesec, mode])

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // A phone's taps drawn over a desktop layout are meaningless: same page, same layout bucket only.
  const here = useMemo(() => (clicks ?? []).filter((c) => c.page === pathname && layoutOf(c.vw) === layoutOf(vw)), [clicks, pathname, vw])
  const gazeHere = useMemo(() => gaze.filter((g) => g.page === pathname && layoutOf(g.vw) === layoutOf(vw)), [gaze, pathname, vw])
  const unit: HeatmapStats['unit'] = mode === 'gaze' ? 'gaze sample' : fivesec ? 'first click' : 'tap'
  const count = mode === 'gaze' ? gazeHere.length : here.length

  const groups = useMemo(() => {
    const m = new Map<string, { label: string; taps: number; nothing: number }>()
    here.forEach((c) => {
      const g = m.get(c.sel) ?? { label: c.label, taps: 0, nothing: 0 }
      g.taps++
      if (c.fx === 'nothing' && c.kind !== 'field') g.nothing++
      m.set(c.sel, g)
    })
    return m
  }, [here])

  // Re-measure every second and on any scroll (horizontal shelves move elements too).
  useLayoutEffect(() => {
    if (!active) return
    const measure = () => {
      setDocH(document.documentElement.scrollHeight)
      const found: Box[] = []
      const now = new Map<string, DOMRect>()
      let lost = 0
      groups.forEach((g, sel) => {
        const el = firstVisible(sel)
        if (el) { const rect = el.getBoundingClientRect(); now.set(sel, rect); found.push({ sel, ...g, rect }) }
        else lost++
      })
      if (focus && !groups.has(focus)) {
        const el = firstVisible(focus)
        if (el) { const rect = el.getBoundingClientRect(); now.set(focus, rect); found.push({ sel: focus, label: 'Selected element', taps: 0, nothing: 0, rect }) }
      }
      setRects(now)
      setBoxes(found)
      setMissing(lost)
    }
    measure()
    const t = window.setInterval(measure, 1000)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => { window.clearInterval(t); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure) }
  }, [active, groups, focus])

  useEffect(() => {
    if (!active || !embed || clicks === null || window.parent === window) return
    const msg: HeatmapStats = { type: 'market:heatmap', taps: count, missing, layout: layoutOf(vw), page: pathname, unit }
    window.parent.postMessage(msg, window.location.origin)
  }, [active, embed, clicks, count, missing, vw, pathname, unit])

  useEffect(() => {
    if (!active || !dot || focus) return
    const t = window.setTimeout(() => window.scrollTo({ top: Math.max(0, dot[1] - window.innerHeight / 2), behavior: 'smooth' }), 300)
    return () => window.clearTimeout(t)
  }, [active, dot?.[0], dot?.[1], focus])

  useEffect(() => {
    if (!active || !focus || clicks === null) return
    // scrollTo, not scrollIntoView: inside the console's viewer, scrollIntoView would scroll the console too.
    const t = window.setTimeout(() => {
      const el = firstVisible(focus)
      if (!el) return
      const r = el.getBoundingClientRect()
      window.scrollTo({ top: Math.max(0, window.scrollY + r.top - window.innerHeight / 2 + r.height / 2), behavior: 'smooth' })
    }, 300)
    return () => window.clearTimeout(t)
  }, [active, focus, clicks])

  if (!active) return null

  const setMode = (m: 'dots' | 'elements' | 'gaze') => {
    const rest = new URLSearchParams(search)
    rest.delete('heatmap')
    const tail = rest.toString()
    nav({ pathname, search: `?heatmap${m === 'dots' ? '' : `=${m}`}${tail ? `&${tail}` : ''}` }, { replace: true })
  }
  const close = () => nav({ pathname, search: '' }, { replace: true })
  const tone = (b: Box) => (b.taps === 0 ? 'focus' : b.nothing / b.taps >= 0.5 ? 'bad' : b.nothing / b.taps >= 0.2 ? 'meh' : 'good')

  return createPortal(
    <div data-insights-ignore>
      {mode === 'gaze' && <div className="hm-dots" style={{ height: docH }}><GazeLayer points={gazeHere} vw={vw} docH={docH} /></div>}
      {mode === 'dots' && (() => {
        const onEl = (sel: string | null | undefined, ex = 50, ey = 50) => {
          const r = sel ? rects.get(sel) : undefined
          return r ? { left: r.left + (ex / 100) * r.width, top: r.top + (ey / 100) * r.height } : null
        }
        const one = dot ? onEl(focus, dot[2] ?? 50, dot[3] ?? 50) : null
        return (
          <>
            {/* Taps whose element is on screen: fixed, re-measured on every scroll. */}
            <div className="hm-fixed" aria-hidden>
              {dot ? (one && <i className="one" style={one} />)
                : here.map((c, i) => { const p = onEl(c.sel, c.ex, c.ey); return p ? <i key={i} style={p} /> : null })}
            </div>
            {/* Taps whose element is gone: where they were on the page, as a fallback. */}
            <div className="hm-dots" style={{ height: docH }} aria-hidden>
              {dot ? (!one && <i className="one" style={{ left: `${dot[0]}%`, top: dot[1] }} />)
                : here.map((c, i) => (rects.has(c.sel) ? null : <i key={i} className="stale" style={{ left: `${c.x}%`, top: c.y }} />))}
            </div>
          </>
        )
      })()}
      {boxes.filter((b) => mode === 'elements' || b.sel === focus).map((b) => (
        <div key={b.sel} className={`hm-box ${tone(b)} ${b.sel === focus ? 'focus' : ''}`} aria-hidden
          style={{ left: b.rect.left, top: b.rect.top, width: b.rect.width, height: b.rect.height }}>
          {b.taps > 0 && mode === 'elements' && <span title={b.label}>{b.taps}<em>{b.label.length > 26 ? b.label.slice(0, 25) + '…' : b.label}</em></span>}
        </div>
      ))}
      {!embed && <div className="hm-bar" role="toolbar" aria-label="Heatmap">
        <b className="num">{count}</b>
        <span>{unit}{count === 1 ? '' : 's'} · {layoutOf(vw)}</span>
        <div className="seg" role="group" aria-label="Heatmap mode">
          <button aria-pressed={mode === 'dots'} onClick={() => setMode('dots')}>Dots</button>
          <button aria-pressed={mode === 'elements'} onClick={() => setMode('elements')}>Elements</button>
          <button aria-pressed={mode === 'gaze'} onClick={() => setMode('gaze')}>Gaze</button>
        </div>
        {mode === 'elements' && missing > 0 && <span className="hm-missing">{missing} not on this layout</span>}
        {mode === 'elements' && <span className="hm-legend"><i className="good" />works <i className="meh" />some idle <i className="bad" />mostly idle</span>}
        <button className="btn ghost sm icon" onClick={close} aria-label="Close heatmap"><X size={14} /></button>
      </div>}
      {!embed && clicks !== null && count === 0 && (
        <div className="hm-empty">No {unit}s recorded on {pathname} at {layoutOf(vw)} width.</div>
      )}
    </div>,
    document.body,
  )
}
