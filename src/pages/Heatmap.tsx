import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw, ExternalLink, Info, Check, X, Target } from 'lucide-react'
import { Switch } from '../components/ui'
import { DEVICES, type Device } from '../tools/insights/ScreenViewer'
import { layoutOf, loadEvents, type ClickEvent } from '../tools/insights/store'
import { endSession, flushNow } from '../tools/insights/tracker'
import { LEGEND, drawHeat, rng, sampleTaps, type HeatPoint } from '../tools/insights/heat'
import { setFlag, useFlag } from '../tools/shared'
import { nameOf } from '../tools/compare/store'
import { loadSessions, loadTests, summarize, type UsabilityTest } from '../tools/tests/store'

/** Screens for everyday browsing, with or without recorded taps. */
const SCREENS = ['/', '/search', '/product/p1', '/cart', '/checkout']
const QUERY: Record<string, string> = { '/search': 'q=running%20shoes' }
const MAX_H = 9000
const SAMPLE_PEOPLE = 12

/** One tap, from a usability test or from everyday browsing, before it is placed on the screen. */
interface Tap { pid: string; page: string; vw: number; sel: string; ex: number; ey: number; x: number; y: number; label: string; first: boolean; hit?: boolean; ok?: boolean; rage?: boolean; dead?: boolean }
interface Placed extends HeatPoint { key: string; label: string; rect?: DOMRect; hit?: boolean }

const visibleIn = (doc: Document, sel: string) => {
  try { return Array.from(doc.querySelectorAll(sel)).find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }) ?? null } catch { return null }
}
/** The width most of these taps were made at; desktop when there are none. */
const busiest = (ws: number[]): Device => {
  const n: Record<Device, number> = { mobile: 0, tablet: 0, desktop: 0 }
  ws.forEach((w) => n[layoutOf(w)]++)
  return ws.length ? (Object.keys(n) as Device[]).reduce((a, b) => (n[b] > n[a] ? b : a), 'desktop') : 'desktop'
}
const secs = (ms: number) => (ms ? `${(ms / 1000).toFixed(1)} s` : '—')
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : '—')
const short = (s: string, n = 70) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

/**
 * Heatmap for usability testing: where participants clicked while doing one task, added up and
 * drawn as heat over the screen, with the task's target marked. First clicks are the main view:
 * a first click on the right path predicts success. Everyday browsing is a second source.
 */
export default function Heatmap() {
  const [params, setParams] = useSearchParams()
  const recording = useFlag('insights')
  const tests = useMemo(() => loadTests(), [])
  const [ver, setVer] = useState(0)
  const sessions = useMemo(() => (ver >= 0 ? loadSessions() : []), [ver])
  const [clicks, setClicks] = useState<ClickEvent[]>([])

  // ut / utask, not test / task: ?test= is how a participant's link starts a usability test run.
  const source = params.get('source') === 'browsing' ? 'browsing' : 'test'
  const test: UsabilityTest | undefined = tests.find((t) => t.id === params.get('ut')) ?? tests[0]
  const task = test?.tasks.find((t) => t.id === params.get('utask')) ?? test?.tasks[0]
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) { if (v === null) next.delete(k); else next.set(k, v) }
    setParams(next, { replace: true })
  }

  const [mode, setMode] = useState<'first' | 'all'>('first')
  const [who, setWho] = useState<'all' | 'ok' | 'failed'>('all')
  const [radius, setRadius] = useState(30)
  const [opacity, setOpacity] = useState(0.8)
  const [hover, setHover] = useState<string | null>(null)

  const refresh = useCallback(async () => { flushNow(); setVer((v) => v + 1); const r = await loadEvents(); setClicks(r.events.filter((e): e is ClickEvent => e.type === 'click')) }, [])
  useEffect(() => { void refresh() }, [refresh])

  /* ---------- the taps of the chosen source ---------- */
  const taps: Tap[] = useMemo(() => {
    if (source === 'test') {
      if (!test || !task) return []
      return sessions.filter((s) => s.testId === test.id).flatMap((s) => s.attempts.filter((a) => a.taskId === task.id).flatMap((a) =>
        a.taps.map((t, i) => ({ pid: s.id, page: t.page, vw: t.vw, sel: t.sel, ex: t.ex ?? 50, ey: t.ey ?? 50, x: t.x, y: t.y, label: t.label, first: i === 0, hit: t.hit, ok: a.outcome === 'success' }))))
    }
    const seen = new Set<string>()
    return clicks.map((c) => {
      const k = `${c.sid}|${c.page}`
      const first = !seen.has(k)
      seen.add(k)
      return { pid: c.sid, page: c.page, vw: c.vw, sel: c.sel, ex: c.ex, ey: c.ey, x: c.x, y: c.y, label: c.label, first, rage: c.rage, dead: c.dead || c.fx === 'nothing' }
    })
  }, [source, test, task, sessions, clicks])

  const pages = useMemo(() => {
    const base = source === 'test' ? [task?.startPage ?? '/'] : SCREENS
    return [...new Set([...base, ...taps.map((t) => t.page)])]
  }, [source, task, taps])
  const page = pages.includes(params.get('page') ?? '') ? params.get('page')! : pages[0]
  const device: Device = (['mobile', 'tablet', 'desktop'] as Device[]).includes(params.get('device') as Device) ? params.get('device') as Device : busiest(taps.filter((t) => t.page === page).map((t) => t.vw))
  const d = DEVICES[device]
  const onPage = taps.filter((t) => t.page === page && layoutOf(t.vw) === device)
  const sample = onPage.length === 0
  // Who succeeded only means something in a usability test.
  const whoNow = source === 'test' ? who : 'all'
  const chosen = onPage.filter((t) => (mode === 'all' || t.first) && (whoNow === 'all' || (whoNow === 'ok' ? t.ok : t.ok === false)))
  const people = new Set(onPage.map((t) => t.pid)).size
  const stats = source === 'test' && test && task ? summarize(test, sessions).tasks.find((x) => x.task.id === task.id) : undefined
  const targetSel = source === 'test' && task?.success.kind === 'element' && task.success.page === page ? task.success.sel : null

  /* ---------- the screen, full height, and the taps on it ---------- */
  const wrap = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [avail, setAvail] = useState(900)
  const [frameH, setFrameH] = useState(0)
  const [ready, setReady] = useState(0)
  const [placed, setPlaced] = useState<Placed[]>([])
  const [target, setTarget] = useState<DOMRect | null>(null)
  useLayoutEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])
  const src = `${window.location.pathname}${window.location.search}#${page}?${[QUERY[page], 'embed'].filter(Boolean).join('&')}`
  useEffect(() => { setFrameH(0); setPlaced([]); setReady(0) }, [src, device])
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
  }, [src, device])

  useEffect(() => {
    const doc = frame.current?.contentDocument
    if (!doc || !ready) return
    const tEl = targetSel ? visibleIn(doc, targetSel) : null
    setTarget(tEl ? tEl.getBoundingClientRect() : null)
    if (!sample) {
      setPlaced(chosen.map((c) => {
        const el = visibleIn(doc, c.sel)
        if (el) { const r = el.getBoundingClientRect(); return { x: r.left + (c.ex / 100) * r.width, y: r.top + (c.ey / 100) * r.height, key: c.sel, label: c.label, rect: r, hit: c.hit } }
        return { x: (c.x / 100) * d.w, y: c.y, key: c.sel, label: c.label, hit: c.hit }
      }))
      return
    }
    // Sample participants: made-up, built from this screen's real controls. In a task, the target
    // (or links toward the task's goal) draw more clicks than the rest, as they would in a real test.
    const goal = task?.success.kind === 'page' ? task.success.page : null
    const boost = source === 'test' ? (el: Element) => (tEl && (el === tEl || el.contains(tEl)) ? 14 : goal && el.getAttribute('href')?.includes(goal) ? 6 : 1) : undefined
    const seed = `${source}|${test?.id}|${task?.id}|${page}|${device}`
    const pool = sampleTaps(doc, seed, d.h, SAMPLE_PEOPLE * 6, boost)
    const rand = rng(`${seed}|people`)
    const out: Placed[] = []
    for (let p = 0; p < SAMPLE_PEOPLE; p++) {
      const own = pool.slice(p * 6, p * 6 + 1 + Math.floor(rand() * 4))
      const hitAny = own.some((s) => tEl && (s.sel === tEl || s.sel.contains(tEl)))
      const ok = tEl ? hitAny : rand() < 0.6
      own.forEach((s, i) => {
        if (mode === 'first' && i > 0) return
        if (whoNow !== 'all' && (whoNow === 'ok') !== ok) return
        out.push({ x: s.x, y: s.y, key: nameOf(s.sel), label: nameOf(s.sel), rect: s.sel.getBoundingClientRect(), hit: tEl ? s.sel === tEl || s.sel.contains(tEl) : undefined })
      })
    }
    setPlaced(out)
  }, [ready, sample, mode, who, source, test?.id, task?.id, page, device, taps]) // eslint-disable-line react-hooks/exhaustive-deps

  const scale = Math.min(1, avail / d.w)
  useEffect(() => { if (canvas.current) drawHeat(canvas.current, placed, scale, radius, opacity) }, [placed, scale, radius, opacity, frameH])

  const ranking = useMemo(() => {
    const m = new Map<string, { label: string; n: number; rect?: DOMRect; hit?: boolean }>()
    for (const p of placed) { const g = m.get(p.key) ?? { label: p.label, n: 0, rect: p.rect, hit: p.hit }; g.n++; m.set(p.key, g) }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 10)
  }, [placed])
  const onTarget = placed.filter((p) => p.hit).length
  const hovered = ranking.find(([k]) => k === hover)?.[1].rect
  const openHref = `${window.location.pathname}${window.location.search}#${page}${QUERY[page] ? `?${QUERY[page]}` : ''}`

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Heatmap</h1>
          <p>Where participants clicked while doing a usability task, added up and drawn as heat over the screen: blue where a few clicked, red where most did. Start with <b>first clicks</b>: people whose first click is on the right path usually finish the task. For one person’s path step by step, see <Link to="/console/sessions">Sessions</Link>.</p>
        </div>
        <div className="actions"><button className="btn" onClick={() => void refresh()}><RefreshCw size={14} /> Refresh</button></div>
      </div>

      <section className="card hm-controls">
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="Source">
            <button aria-pressed={source === 'test'} onClick={() => set({ source: null, page: null, device: null })}>Usability test</button>
            <button aria-pressed={source === 'browsing'} onClick={() => set({ source: 'browsing', page: null, device: null })}>Everyday browsing</button>
          </div>
          {source === 'test' && test && (
            <>
              <select className="select hm-select" value={test.id} onChange={(e) => set({ ut: e.target.value, utask: null, page: null, device: null })} aria-label="Test">
                {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select className="select hm-select wide" value={task?.id} onChange={(e) => set({ utask: e.target.value, page: null, device: null })} aria-label="Task">
                {test.tasks.map((t, i) => <option key={t.id} value={t.id}>Task {i + 1}: {short(t.prompt)}</option>)}
              </select>
            </>
          )}
          {source === 'browsing' && (
            <label className="row" style={{ gap: 8, fontSize: 13 }}><Switch checked={recording} onChange={() => { if (recording) endSession('stopped'); setFlag('insights', !recording) }} label="Record taps" /> Recording {recording ? 'on' : 'off'}</label>
          )}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <select className="select hm-select" value={page} onChange={(e) => set({ page: e.target.value, device: null })} aria-label="Screen">
            {pages.map((p, i) => <option key={p} value={p}>{p}{source === 'test' && i === 0 ? ' (start)' : ''}</option>)}
          </select>
          <div className="seg" role="group" aria-label="Device">{(Object.keys(DEVICES) as Device[]).map((x) => <button key={x} aria-pressed={device === x} onClick={() => set({ device: x })}>{x[0].toUpperCase() + x.slice(1)}</button>)}</div>
          <div className="seg" role="group" aria-label="Clicks">
            <button aria-pressed={mode === 'first'} onClick={() => setMode('first')}>First clicks</button>
            <button aria-pressed={mode === 'all'} onClick={() => setMode('all')}>All clicks</button>
          </div>
          {source === 'test' && (
            <div className="seg" role="group" aria-label="Participants">
              <button aria-pressed={who === 'all'} onClick={() => setWho('all')}>Everyone</button>
              <button aria-pressed={who === 'ok'} onClick={() => setWho('ok')}>Succeeded</button>
              <button aria-pressed={who === 'failed'} onClick={() => setWho('failed')}>Didn’t succeed</button>
            </div>
          )}
          <label className="hm-slider">Spread <input type="range" min={12} max={60} value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Heat spread" /></label>
          <label className="hm-slider">Opacity <input type="range" min={20} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} aria-label="Heat opacity" /></label>
        </div>
      </section>

      {source === 'test' && task && (
        <section className="card card-body hm-task">
          <div className="hm-task-text">
            <span className="muted" style={{ fontSize: 12 }}>Task {test!.tasks.indexOf(task) + 1} · {test!.name}</span>
            <b>{task.prompt}</b>
            <span className="muted" style={{ fontSize: 12.5 }}><Target size={12} /> Success: {task.success.kind === 'page' ? <>reach <span className="mono">{task.success.page}</span></> : <>click {task.success.label} on <span className="mono">{task.success.page}</span></>}</span>
          </div>
          {stats && stats.attempts > 0 && (
            <dl className="hm-stats">
              <div><dt>Participants</dt><dd className="num">{stats.attempts}</dd></div>
              <div><dt>Succeeded</dt><dd className="num">{pct(stats.success, stats.attempts)}</dd></div>
              <div><dt>Median time</dt><dd className="num">{secs(stats.medianMs)}</dd></div>
              <div><dt>First click right</dt><dd className="num">{pct(stats.firstCorrect, stats.firstTotal)}</dd></div>
            </dl>
          )}
          <Link className="btn sm" to={`/console/tests/${test!.id}`}>Test results</Link>
        </section>
      )}

      {sample && (
        <p className="hm-sample"><Info size={14} /> {source === 'test'
          ? <>No participant has done this task on this screen at {device} width yet, so this shows <b>sample data</b>: {SAMPLE_PEOPLE} made-up participants clicking this screen’s real buttons and links, more often on the way to the goal. It shows how the map reads; it is not a result. Share the test link from <Link to={`/console/tests/${test?.id}`}>the test</Link> to collect real clicks.</>
          : <>No recorded taps on this screen at {device} width yet, so this shows <b>sample data</b>, not real visitors. {recording ? 'Use the shop in another tab, then Refresh.' : 'Switch recording on and use the shop to see real taps.'}</>}</p>
      )}

      <div className="hm-grid">
        <section className="card hm-stage-card">
          <div className="hm-meta">
            <span><b className="num">{placed.length}</b> {mode === 'first' ? 'first click' : 'click'}{placed.length === 1 ? '' : 's'}{sample ? ' (sample)' : <> · <b className="num">{people}</b> {source === 'test' ? 'participant' : 'session'}{people === 1 ? '' : 's'}</>}{targetSel && placed.length > 0 ? <> · <b className="num">{pct(onTarget, placed.length)}</b> on the target</> : null} · {page} · {d.label}</span>
            <span className="hm-legend"><span>Fewer</span><i style={{ background: LEGEND }} /><span>More clicks</span></span>
            <a className="btn sm ghost" href={openHref} target="_blank" rel="noopener">Open <ExternalLink size={12} /></a>
          </div>
          <div className="hm-stage" ref={wrap}>
            <div className="hm-page" style={{ width: d.w * scale, height: (frameH || d.h) * scale }}>
              <iframe key={src + device} ref={frame} src={src} title={`${page} at ${d.label}`} tabIndex={-1} style={{ width: d.w, height: frameH || d.h, transform: `scale(${scale})` }} />
              <canvas ref={canvas} className="hm-canvas" aria-label={`Heatmap of ${placed.length} clicks`} />
              <div className="hm-fold" style={{ top: d.h * scale }}><span>Fold · {d.h}px</span></div>
              {target && <div className="hm-target" style={{ left: target.left * scale, top: target.top * scale, width: target.width * scale, height: target.height * scale }}><span>Target</span></div>}
              {hovered && <div className="hm-hl" style={{ left: hovered.left * scale, top: hovered.top * scale, width: hovered.width * scale, height: hovered.height * scale }} />}
              {!ready && <div className="hm-loading">Loading the screen…</div>}
            </div>
          </div>
        </section>
        <aside className="card card-body hm-side">
          <h3>{mode === 'first' ? 'Where first clicks went' : 'Most clicked'}</h3>
          {ranking.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No clicks here.</p>}
          <ol className="hm-rank">
            {ranking.map(([k, g]) => (
              <li key={k} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(k)} onBlur={() => setHover(null)} tabIndex={0}>
                <span className="hm-rank-label">{g.hit === true ? <Check size={13} className="hm-ok" aria-label="On the target" /> : g.hit === false && targetSel ? <X size={13} className="hm-no" aria-label="Off the target" /> : null}{g.label}</span>
                <span className="hm-bar"><i style={{ width: `${(g.n / ranking[0][1].n) * 100}%` }} /></span>
                <span className="num muted">{g.n} · {Math.round((g.n / placed.length) * 100)}%</span>
              </li>
            ))}
          </ol>
          <p className="muted" style={{ fontSize: 12 }}>Hover a row to see the element. {targetSel ? '✓ is the task’s target.' : source === 'test' && task?.success.kind === 'page' ? `Success is reaching ${task.success.page}, so there is no single target on this screen.` : ''}</p>
        </aside>
      </div>
    </main>
  )
}
