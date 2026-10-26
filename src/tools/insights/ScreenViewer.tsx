import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ExternalLink, MousePointer2, Hand } from 'lucide-react'
import { describeTarget } from './tracker'
import type { HeatmapStats } from './InsightsTools'
import { DESIGN_MESSAGE, type Design } from '../design/tokens'

export type Device = 'mobile' | 'tablet' | 'desktop'
export const DEVICES: Record<Device, { w: number; h: number; label: string }> = {
  mobile: { w: 390, h: 844, label: 'Mobile · 390' },
  tablet: { w: 820, h: 1000, label: 'Tablet · 820' },
  desktop: { w: 1280, h: 800, label: 'Desktop · 1280' },
}

export interface Picked { sel: string; label: string; page: string }

interface Props {
  page: string
  device: Device
  /** 'dots' / 'elements' draw a heatmap; 'pick' lets the designer choose an element. */
  mode: 'dots' | 'elements' | 'gaze' | 'pick' | 'live'
  focus?: string | null
  /** draw a single tap (x % of width, y page px) instead of every tap */
  dot?: { x: number; y: number; ex?: number; ey?: number }
  /** testId:taskId — draw a usability task's taps instead of everyday clicks */
  task?: string
  onPick?: (p: Picked) => void
  /** viewer height cap in px; the frame scales down to fit */
  maxHeight?: number
  /** the screen's filters and tabs, so the same rows are on screen */
  query?: string
  /** exact window size to render at (a replay uses the participant's own) */
  size?: { w: number; h: number }
  /** first clicks of a 5-second test instead of everyday clicks */
  fivesec?: string
  /** a design to preview on the screen (undefined: the screen as this browser shows it) */
  design?: Design | null
}

const appUrl = (hash: string) => `${window.location.pathname}${window.location.search}#${hash}`

/** The real app in an iframe at a device width, scaled to fit, with a heatmap or a picker on top. */
export function ScreenViewer({ page, device, mode, focus, dot, task, onPick, maxHeight = 620, query, size, fivesec, design }: Props) {
  const wrap = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [width, setWidth] = useState(800)
  const [stats, setStats] = useState<HeatmapStats | null>(null)
  const [pickNav, setPickNav] = useState(false)
  const d = size ? { ...size, label: `${size.w} px` } : DEVICES[device]

  useLayoutEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  const heat = mode === 'pick' || mode === 'live' ? [] : [
    `heatmap${mode === 'dots' ? '' : `=${mode}`}`,
    focus ? `el=${encodeURIComponent(focus)}` : '', task ? `task=${encodeURIComponent(task)}` : '', fivesec ? `fivesec=${encodeURIComponent(fivesec)}` : '',
    dot ? `dot=${[dot.x, dot.y, ...(dot.ex !== undefined ? [dot.ex, dot.ey ?? 50] : [])].join(',')}` : '',
  ].filter(Boolean)
  const hash = `${page}?${[query, ...heat, 'embed'].filter(Boolean).join('&')}`
  const openHash = `${page}${[query, ...heat].filter(Boolean).length ? `?${[query, ...heat].filter(Boolean).join('&')}` : ''}`

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return
      if (e.data?.type === 'market:heatmap') setStats(e.data as HeatmapStats)
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [])
  useEffect(() => setStats(null), [hash, device])

  // Preview a design: sent to the frame now, and again whenever it (re)loads and says it is ready.
  useEffect(() => {
    if (design === undefined) return
    const send = () => frame.current?.contentWindow?.postMessage({ type: DESIGN_MESSAGE, design }, window.location.origin)
    send()
    const on = (e: MessageEvent) => { if (e.source === frame.current?.contentWindow && e.data?.type === `${DESIGN_MESSAGE}:ready`) send() }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [design])

  // Same-origin iframe: a hash change navigates inside it without a reload.
  useEffect(() => {
    const w = frame.current?.contentWindow
    if (w && w.location.href !== 'about:blank') w.location.hash = hash
  }, [hash])

  // Picker: hover outlines, a click chooses (unless "Navigate" is on, to reach other screens).
  useEffect(() => {
    if (mode !== 'pick' || pickNav) return
    const f = frame.current
    let cleanup = () => {}
    const attach = () => {
      cleanup()
      const doc = f?.contentDocument
      if (!doc) return
      let hovered: HTMLElement | null = null
      const over = (e: Event) => {
        const t = e.target as Element
        if (!t || !('closest' in t)) return
        const el = describeTarget(t).el as HTMLElement
        if (hovered === el) return
        if (hovered) hovered.style.outline = ''
        hovered = el
        el.style.outline = '2px solid #2a78d6'
        el.style.outlineOffset = '2px'
      }
      const click = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        const t = e.target as Element
        if (!t || !('closest' in t)) return
        const { sel, label } = describeTarget(t)
        const path = (f?.contentWindow?.location.hash.replace(/^#/, '').split('?')[0]) || '/'
        onPick?.({ sel, label, page: path })
      }
      doc.addEventListener('mouseover', over, true)
      doc.addEventListener('click', click, true)
      cleanup = () => {
        if (hovered) hovered.style.outline = ''
        doc.removeEventListener('mouseover', over, true)
        doc.removeEventListener('click', click, true)
      }
    }
    attach()
    f?.addEventListener('load', attach)
    return () => { f?.removeEventListener('load', attach); cleanup() }
  }, [mode, pickNav, onPick])

  const scale = Math.min(1, width / d.w, maxHeight / d.h)
  // The initial src is fixed; later changes go through location.hash above.
  const [src] = useState(() => appUrl(hash))

  return (
    <div className="sv">
      <div className="sv-meta">
        {mode === 'pick' ? (
          <>
            <div className="seg" role="group" aria-label="Picker mode">
              <button aria-pressed={!pickNav} onClick={() => setPickNav(false)}><MousePointer2 size={13} /> Pick element</button>
              <button aria-pressed={pickNav} onClick={() => setPickNav(true)}><Hand size={13} /> Navigate</button>
            </div>
            <span className="muted">{pickNav ? 'Use the app normally to reach the right screen, then switch back to Pick.' : 'Hover to outline, click to choose.'}</span>
          </>
        ) : mode === 'live' ? (
          <span className="muted">The real app — click around to reach other screens.</span>
        ) : (
          <span className="muted">
            {stats ? <><b className="num" style={{ color: 'var(--ink)' }}>{stats.taps}</b> {stats.unit ?? 'tap'}{stats.taps === 1 ? '' : 's'} on <span className="mono">{stats.page}</span> at {stats.layout} width{mode === 'elements' && stats.missing > 0 ? ` · ${stats.missing} element${stats.missing === 1 ? '' : 's'} not on this layout` : ''}</> : 'Loading screen…'}
          </span>
        )}
        <span className="muted num" style={{ marginLeft: 'auto' }}>{Math.round(scale * 100)}%</span>
        <a className="btn sm ghost" href={appUrl(openHash)} target="_blank" rel="noopener">Open <ExternalLink size={12} /></a>
      </div>
      <div className="sv-stage" ref={wrap} style={{ height: d.h * scale }}>
        <div className={`sv-device ${size ? 'exact' : device}`} style={{ width: d.w * scale, height: d.h * scale }}>
          <iframe
            ref={frame}
            title={`App screen ${page} at ${d.label}`}
            src={src}
            style={{ width: d.w, height: d.h, transform: `scale(${scale})` }}
          />
        </div>
      </div>
    </div>
  )
}
