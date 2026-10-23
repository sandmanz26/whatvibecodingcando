import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { isConsole, useFlag } from '../shared'
import { installTracker, trackView } from './tracker'
import { layoutOf, loadEvents, type ClickEvent } from './store'
import { taskTapsAsClicks } from '../tests/store'

/** Message the heatmap posts to the console's screen viewer when embedded. */
export interface HeatmapStats { type: 'skillhouse:heatmap'; taps: number; missing: number; layout: string; page: string }

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

interface Box { sel: string; label: string; taps: number; nothing: number; rect: DOMRect }

/** Heatmap overlay — active only when the URL carries ?heatmap. */
export function HeatmapOverlay() {
  const { pathname, search } = useLocation()
  const nav = useNavigate()
  const q = new URLSearchParams(search)
  const active = q.has('heatmap') && !isConsole(pathname)
  const mode = q.get('heatmap') === 'elements' ? 'elements' : 'dots'
  const focus = q.get('el')
  // Inside the console's screen viewer the console owns the controls, so the bar and notices are hidden.
  const embed = q.has('embed')
  // task=<testId>:<taskId> draws a usability task's taps instead of everyday click data.
  const task = q.get('task')

  const [clicks, setClicks] = useState<ClickEvent[] | null>(null)
  const [vw, setVw] = useState(window.innerWidth)
  const [docH, setDocH] = useState(0)
  const [boxes, setBoxes] = useState<Box[]>([])
  const [missing, setMissing] = useState(0)

  useEffect(() => {
    if (!active) return
    let live = true
    if (task) {
      const [testId, taskId] = task.split(':')
      setClicks(taskTapsAsClicks(testId, taskId))
    } else {
      void loadEvents().then((d) => live && setClicks(d.events.filter((e): e is ClickEvent => e.type === 'click')))
    }
    return () => { live = false }
  }, [active, task])

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // A phone's taps drawn over a desktop layout are meaningless: same page, same layout bucket only.
  const here = useMemo(() => (clicks ?? []).filter((c) => c.page === pathname && layoutOf(c.vw) === layoutOf(vw)), [clicks, pathname, vw])

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
      if (mode !== 'elements' && !focus) return
      const found: Box[] = []
      let lost = 0
      groups.forEach((g, sel) => {
        const el = firstVisible(sel)
        if (el) found.push({ sel, ...g, rect: el.getBoundingClientRect() })
        else lost++
      })
      if (focus && !groups.has(focus)) {
        const el = firstVisible(focus)
        if (el) found.push({ sel: focus, label: 'Selected element', taps: 0, nothing: 0, rect: el.getBoundingClientRect() })
      }
      setBoxes(found)
      setMissing(lost)
    }
    measure()
    const t = window.setInterval(measure, 1000)
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => { window.clearInterval(t); window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure) }
  }, [active, mode, groups, focus])

  useEffect(() => {
    if (!active || !embed || clicks === null || window.parent === window) return
    const msg: HeatmapStats = { type: 'skillhouse:heatmap', taps: here.length, missing, layout: layoutOf(vw), page: pathname }
    window.parent.postMessage(msg, window.location.origin)
  }, [active, embed, clicks, here.length, missing, vw, pathname])

  useEffect(() => {
    if (!active || !focus || clicks === null) return
    const t = window.setTimeout(() => firstVisible(focus)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)
    return () => window.clearTimeout(t)
  }, [active, focus, clicks])

  if (!active) return null

  const setMode = (m: 'dots' | 'elements') => {
    const rest = new URLSearchParams(search)
    rest.delete('heatmap')
    const tail = rest.toString()
    nav({ pathname, search: `?heatmap${m === 'elements' ? '=elements' : ''}${tail ? `&${tail}` : ''}` }, { replace: true })
  }
  const close = () => nav({ pathname, search: '' }, { replace: true })
  const tone = (b: Box) => (b.taps === 0 ? 'focus' : b.nothing / b.taps >= 0.5 ? 'bad' : b.nothing / b.taps >= 0.2 ? 'meh' : 'good')

  return createPortal(
    <div data-insights-ignore>
      {mode === 'dots' && (
        <div className="hm-dots" style={{ height: docH }} aria-hidden>
          {here.map((c, i) => <i key={i} style={{ left: `${c.x}%`, top: c.y }} />)}
        </div>
      )}
      {boxes.filter((b) => mode === 'elements' || b.sel === focus).map((b) => (
        <div key={b.sel} className={`hm-box ${tone(b)} ${b.sel === focus ? 'focus' : ''}`} aria-hidden
          style={{ left: b.rect.left, top: b.rect.top, width: b.rect.width, height: b.rect.height }}>
          {b.taps > 0 && mode === 'elements' && <span title={b.label}>{b.taps}<em>{b.label.length > 26 ? b.label.slice(0, 25) + '…' : b.label}</em></span>}
        </div>
      ))}
      {!embed && <div className="hm-bar" role="toolbar" aria-label="Heatmap">
        <b className="num">{here.length}</b>
        <span>tap{here.length === 1 ? '' : 's'} · {layoutOf(vw)}</span>
        <div className="seg" role="group" aria-label="Heatmap mode">
          <button aria-pressed={mode === 'dots'} onClick={() => setMode('dots')}>Dots</button>
          <button aria-pressed={mode === 'elements'} onClick={() => setMode('elements')}>Elements</button>
        </div>
        {mode === 'elements' && missing > 0 && <span className="hm-missing">{missing} not on this layout</span>}
        {mode === 'elements' && <span className="hm-legend"><i className="good" />works <i className="meh" />some idle <i className="bad" />mostly idle</span>}
        <button className="btn ghost sm icon" onClick={close} aria-label="Close heatmap"><X size={14} /></button>
      </div>}
      {!embed && clicks !== null && here.length === 0 && (
        <div className="hm-empty">No taps recorded on {pathname} at {layoutOf(vw)} width.</div>
      )}
    </div>,
    document.body,
  )
}
