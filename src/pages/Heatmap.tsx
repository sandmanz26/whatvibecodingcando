import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, ExternalLink, Info } from 'lucide-react'
import { Switch } from '../components/ui'
import { DEVICES, type Device } from '../tools/insights/ScreenViewer'
import { layoutOf, loadEvents, type ClickEvent } from '../tools/insights/store'
import { endSession, flushNow } from '../tools/insights/tracker'
import { LEGEND, drawHeat, sampleTaps, type HeatPoint } from '../tools/insights/heat'
import { setFlag, useFlag } from '../tools/shared'
import { nameOf } from '../tools/compare/store'

/** Screens that can always be shown, with or without recorded taps. */
const SCREENS = [
  { page: '/', query: '', label: 'Home' },
  { page: '/search', query: 'q=running%20shoes', label: 'Search' },
  { page: '/product/p1', query: '', label: 'Product' },
  { page: '/cart', query: '', label: 'Cart' },
  { page: '/checkout', query: '', label: 'Checkout' },
]
const MAX_H = 9000
type Filter = 'all' | 'rage' | 'dead'
interface Placed extends HeatPoint { key: string; label: string; rect?: DOMRect }

const visibleIn = (doc: Document, sel: string) => {
  try { return Array.from(doc.querySelectorAll(sel)).find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }) ?? null } catch { return null }
}
/**
 * Heatmap: where people tap on one screen, as heat. Unlike Sessions (one person's path, step by
 * step), it adds every tap on a screen together. Taps are placed on the element they hit, on the
 * whole page (not just the first screenful), at one device width.
 */
export default function Heatmap() {
  const recording = useFlag('insights')
  const [clicks, setClicks] = useState<ClickEvent[] | null>(null)
  const [screen, setScreen] = useState(SCREENS[0])
  const [device, setDevice] = useState<Device>('desktop')
  const [source, setSource] = useState<'recorded' | 'sample' | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [radius, setRadius] = useState(28)
  const [opacity, setOpacity] = useState(0.8)
  const [frameH, setFrameH] = useState(0)
  const [ready, setReady] = useState(0)
  const [placed, setPlaced] = useState<Placed[]>([])
  const [hover, setHover] = useState<string | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [avail, setAvail] = useState(900)
  const d = DEVICES[device]

  const refresh = useCallback(async () => { flushNow(); const r = await loadEvents(); setClicks(r.events.filter((e): e is ClickEvent => e.type === 'click')) }, [])
  useEffect(() => { void refresh() }, [refresh])
  useLayoutEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  // Recorded screens join the fixed list, so any screen people actually used can be shown.
  const screens = useMemo(() => {
    const extra = new Map<string, string>()
    for (const c of clicks ?? []) if (!SCREENS.some((s) => s.page === c.page) && !extra.has(c.page)) extra.set(c.page, c.query ?? '')
    return [...SCREENS, ...[...extra].map(([page, query]) => ({ page, query, label: page }))]
  }, [clicks])
  const recorded = useMemo(() => (clicks ?? []).filter((c) => c.page === screen.page && layoutOf(c.vw) === device), [clicks, screen.page, device])
  // Real taps when there are any for this screen and width; otherwise the labelled sample.
  const src = source ?? (recorded.length ? 'recorded' : 'sample')
  const filtered = recorded.filter((c) => filter === 'all' || (filter === 'rage' ? c.rage : c.dead || c.fx === 'nothing'))

  // Load the screen at the device width, then grow the frame to the page's full height.
  const src0 = `${window.location.pathname}${window.location.search}#${screen.page}?${[screen.query, 'embed'].filter(Boolean).join('&')}`
  useEffect(() => { setFrameH(0); setPlaced([]) }, [src0, device])
  useEffect(() => {
    const f = frame.current
    if (!f) return
    let t = 0, last = -1, stable = 0
    const measure = () => {
      const doc = f.contentDocument
      const h = doc ? Math.min(MAX_H, Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0)) : 0
      if (h && h === last) stable++; else stable = 0
      last = h
      if (h) setFrameH(h)
      if (stable >= 3) { setReady((n) => n + 1); return }
      t = window.setTimeout(measure, 150)
    }
    const onLoad = () => { stable = 0; last = -1; measure() }
    f.addEventListener('load', onLoad)
    return () => { f.removeEventListener('load', onLoad); clearTimeout(t) }
  }, [src0, device])

  // Where each tap lands on this rendering of the screen.
  useEffect(() => {
    const doc = frame.current?.contentDocument
    if (!doc || !ready) return
    if (src === 'sample') {
      setPlaced(sampleTaps(doc, `${screen.page}|${device}`, d.h).filter((s) => filter !== 'rage' && (filter === 'all' || s.dead))
        .map((s) => ({ x: s.x, y: s.y, key: nameOf(s.sel), label: nameOf(s.sel), rect: s.sel.getBoundingClientRect() })))
      return
    }
    setPlaced(filtered.map((c) => {
      const el = visibleIn(doc, c.sel)
      if (el) { const r = el.getBoundingClientRect(); return { x: r.left + (c.ex / 100) * r.width, y: r.top + (c.ey / 100) * r.height, key: c.sel, label: c.label, rect: r } }
      // The element isn't on this rendering: fall back to where the tap was on the page.
      return { x: (c.x / 100) * d.w, y: c.y, key: c.sel, label: c.label }
    }))
  }, [ready, src, filter, clicks, screen.page, device]) // eslint-disable-line react-hooks/exhaustive-deps

  const scale = Math.min(1, avail / d.w)
  useEffect(() => { if (canvas.current) drawHeat(canvas.current, placed, scale, radius, opacity) }, [placed, scale, radius, opacity, frameH])

  const ranking = useMemo(() => {
    const m = new Map<string, { label: string; n: number; rect?: DOMRect }>()
    for (const p of placed) { const g = m.get(p.key) ?? { label: p.label, n: 0, rect: p.rect }; g.n++; m.set(p.key, g) }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10)
  }, [placed])
  const hovered = ranking.find(([k]) => k === hover)?.[1].rect
  const sessions = new Set(filtered.map((c) => c.sid)).size
  const openHref = `${window.location.pathname}${window.location.search}#${screen.page}${screen.query ? `?${screen.query}` : ''}`

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Heatmap</h1>
          <p>Where people tap on a screen, added up across every visit and drawn as heat: blue where a few tapped, red where most did. It covers the whole page, not just the first screenful. For one person’s path through the app, step by step, see <Link to="/console/sessions">Sessions</Link>.</p>
        </div>
        <div className="actions">
          <label className="row" style={{ gap: 8, fontSize: 13 }}><Switch checked={recording} onChange={() => { if (recording) endSession('stopped'); setFlag('insights', !recording) }} label="Record taps" /> Recording {recording ? 'on' : 'off'}</label>
          <button className="btn" onClick={() => void refresh()}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      <section className="card hm-controls">
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="Screen">{screens.map((s) => <button key={s.page} aria-pressed={screen.page === s.page} onClick={() => setScreen(s)}>{s.label}</button>)}</div>
          <div className="seg" role="group" aria-label="Device">{(Object.keys(DEVICES) as Device[]).map((x) => <button key={x} aria-pressed={device === x} onClick={() => setDevice(x)}>{x[0].toUpperCase() + x.slice(1)}</button>)}</div>
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="Data">
            <button aria-pressed={src === 'recorded'} onClick={() => setSource('recorded')}>Recorded · {recorded.length}</button>
            <button aria-pressed={src === 'sample'} onClick={() => setSource('sample')}>Sample data</button>
          </div>
          <div className="seg" role="group" aria-label="Taps">
            <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All taps</button>
            <button aria-pressed={filter === 'rage'} onClick={() => setFilter('rage')} disabled={src === 'sample'} title={src === 'sample' ? 'Rage taps come from recorded data only' : 'Several fast taps in one spot'}>Rage taps</button>
            <button aria-pressed={filter === 'dead'} onClick={() => setFilter('dead')}>Did nothing</button>
          </div>
          <label className="hm-slider">Spread <input type="range" min={12} max={60} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Heat spread" /></label>
          <label className="hm-slider">Opacity <input type="range" min={20} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} aria-label="Heat opacity" /></label>
        </div>
      </section>

      {src === 'sample' && (
        <p className="hm-sample"><Info size={14} /> Sample data: {placed.length} made-up taps built from this screen’s real buttons and links, to show how the heatmap reads. They are not real visitors. {recording ? 'Use the shop in another tab, then Refresh, to see recorded taps.' : 'Switch recording on and use the shop to see real taps.'}</p>
      )}
      {src === 'recorded' && recorded.length === 0 && <p className="hm-sample"><Info size={14} /> No recorded taps on {screen.label} at {device} width yet.</p>}

      <div className="hm-grid">
        <section className="card hm-stage-card">
          <div className="hm-meta">
            <span><b className="num">{placed.length}</b> tap{placed.length === 1 ? '' : 's'}{src === 'recorded' ? <> · <b className="num">{sessions}</b> session{sessions === 1 ? '' : 's'}</> : ' (sample)'} · {screen.page} · {d.label}</span>
            <span className="hm-legend"><span>Fewer</span><i style={{ background: LEGEND }} /><span>More taps</span></span>
            <a className="btn sm ghost" href={openHref} target="_blank" rel="noopener">Open <ExternalLink size={12} /></a>
          </div>
          <div className="hm-stage" ref={wrap}>
            <div className="hm-page" style={{ width: d.w * scale, height: (frameH || d.h) * scale }}>
              <iframe key={src0 + device} ref={frame} src={src0} title={`${screen.label} at ${d.label}`} tabIndex={-1}
                style={{ width: d.w, height: frameH || d.h, transform: `scale(${scale})` }} />
              <canvas ref={canvas} className="hm-canvas" aria-label={`Heatmap of ${placed.length} taps`} />
              <div className="hm-fold" style={{ top: d.h * scale }}><span>Fold · {d.h}px</span></div>
              {hovered && <div className="hm-hl" style={{ left: hovered.left * scale, top: hovered.top * scale, width: hovered.width * scale, height: hovered.height * scale }} />}
              {!ready && <div className="hm-loading">Loading the screen…</div>}
            </div>
          </div>
        </section>
        <aside className="card card-body hm-side">
          <h3>Most tapped</h3>
          {ranking.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No taps here.</p>}
          <ol className="hm-rank">
            {ranking.map(([k, g]) => (
              <li key={k} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(k)} onBlur={() => setHover(null)} tabIndex={0}>
                <span className="hm-rank-label">{g.label}</span>
                <span className="hm-bar"><i style={{ width: `${(g.n / ranking[0][1].n) * 100}%` }} /></span>
                <span className="num muted">{g.n} · {Math.round((g.n / placed.length) * 100)}%</span>
              </li>
            ))}
          </ol>
          <p className="muted" style={{ fontSize: 12 }}>Hover a row to see the element on the page.</p>
        </aside>
      </div>
    </main>
  )
}
