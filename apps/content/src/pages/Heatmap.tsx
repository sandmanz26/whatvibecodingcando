import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { RefreshCw, ExternalLink, Info, Check, X, Target, Eye, MousePointerClick, Play, Pause, ArrowLeft } from 'lucide-react'
import { Switch } from '../components/ui'
import { DEVICES, type Device } from '../tools/insights/ScreenViewer'
import { layoutOf, loadEvents, type ClickEvent } from '../tools/insights/store'
import { endSession, flushNow } from '../tools/insights/tracker'
import { LEGEND, drawHeat, rng, sampleTaps, type HeatPoint } from '@vibe/core/heat'
import { setFlag, useFlag } from '../tools/shared'
import { nameOf } from '../tools/compare/store'
import { loadSessions, loadTests, summarize, type UsabilityTest } from '../tools/tests/store'
import { loadGaze, loadGazeSessions, timeOf } from '../tools/gaze/store'
import { aoiStats, fixationsOf, idtFor, saccadesOf, type Aoi, type Fixation } from '@vibe/core/gaze-analysis'
import { sampleGaze } from '../tools/gaze/sample'

/** Screens for everyday browsing, with or without recorded taps. */
const SCREENS = ['/', '/search', '/product/p1', '/cart', '/checkout']
const QUERY: Record<string, string> = { '/search': 'q=running%20shoes' }
const MAX_H = 9000
const SAMPLE_PEOPLE = 12
/** Readable names for the screen parts used as areas of interest. */
const AOI_NAMES: [string, string][] = [['header', 'Header'], ['.crumbs', 'Breadcrumb'], ['.gallery', 'Product photos'], ['.buy', 'Buy box'], ['.hero, .hero2', 'Hero'], ['.deal-timer', 'Deal countdown'], ['.summary', 'Order summary']]

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

  // Clicks: where they clicked. Eyes: where they looked (webcam eye tracking), read as fixations.
  const layer = params.get('layer') === 'eyes' ? 'eyes' : 'clicks'
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
  // One run only (opened from the results list), or every run of the task.
  const runId = params.get('run')
  const [pidx, setPidx] = useState(0)
  const [playT, setPlayT] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const [showHeat, setShowHeat] = useState(true)
  const [showPath, setShowPath] = useState(true)
  const [aois, setAois] = useState<Aoi[]>([])
  const [hoverAoi, setHoverAoi] = useState<string | null>(null)

  const refresh = useCallback(async () => { flushNow(); setVer((v) => v + 1); const r = await loadEvents(); setClicks(r.events.filter((e): e is ClickEvent => e.type === 'click')) }, [])
  useEffect(() => { void refresh() }, [refresh])

  /* ---------- the taps of the chosen source ---------- */
  const taps: Tap[] = useMemo(() => {
    if (source === 'test') {
      if (!test || !task) return []
      // "First" is the first click on each page of an attempt: on the start page that is the task's
      // first click; on a later page, where they went first once they got there.
      return sessions.filter((s) => s.testId === test.id && (!runId || s.id === runId)).flatMap((s) => s.attempts.filter((a) => a.taskId === task.id).flatMap((a) => {
        const seenPage = new Set<string>()
        return a.taps.map((t) => {
          const first = !seenPage.has(t.page)
          seenPage.add(t.page)
          return { pid: s.id, page: t.page, vw: t.vw, sel: t.sel, ex: t.ex ?? 50, ey: t.ey ?? 50, x: t.x, y: t.y, label: t.label, first, hit: t.hit, ok: a.outcome === 'success' }
        })
      }))
    }
    const seen = new Set<string>()
    return clicks.map((c) => {
      const k = `${c.sid}|${c.page}`
      const first = !seen.has(k)
      seen.add(k)
      return { pid: c.sid, page: c.page, vw: c.vw, sel: c.sel, ex: c.ex, ey: c.ey, x: c.x, y: c.y, label: c.label, first, rage: c.rage, dead: c.dead || c.fx === 'nothing' }
    })
  }, [source, test, task, sessions, clicks])

  const gaze = useMemo(() => (ver >= 0 ? loadGaze() : []), [ver])
  const testRuns = useMemo(() => new Set(sessions.filter((x) => x.testId === test?.id && (!runId || x.id === runId)).map((x) => x.id)), [sessions, test?.id, runId])
  const gazeHereAll = useMemo(() => gaze.filter((p) => (source === 'test' ? p.task === task?.id && !!p.test && testRuns.has(p.test) : !p.test)), [gaze, source, task?.id, testRuns])
  // Every page this task (or browsing) touched, in the order people went: the start page, then the
  // pages they visited (with or without a click there), then any other page with clicks or gaze.
  const pages = useMemo(() => {
    const visited = source === 'test' && test && task
      ? sessions.filter((x) => x.testId === test.id && (!runId || x.id === runId)).flatMap((x) => x.attempts.filter((a) => a.taskId === task.id).flatMap((a) => a.pages))
      : []
    const base = source === 'test' ? [task?.startPage ?? '/'] : SCREENS
    return [...new Set([...base, ...visited, ...taps.map((t) => t.page), ...gazeHereAll.map((g) => g.page)])]
  }, [source, test, task, sessions, taps, gazeHereAll])
  const pageCount = (p: string) => ({ clicks: taps.filter((t) => t.page === p).length, eyes: gazeHereAll.filter((g) => g.page === p).length })
  const page = pages.includes(params.get('page') ?? '') ? params.get('page')! : pages[0]
  const device: Device = (['mobile', 'tablet', 'desktop'] as Device[]).includes(params.get('device') as Device) ? params.get('device') as Device
    : busiest(layer === 'eyes' ? gazeHereAll.filter((g) => g.page === page).map((g) => g.vw) : taps.filter((t) => t.page === page).map((t) => t.vw))
  const d = DEVICES[device]
  const onPage = taps.filter((t) => t.page === page && layoutOf(t.vw) === device)
  const sample = onPage.length === 0
  // Who succeeded only means something in a usability test.
  const whoNow = source === 'test' ? who : 'all'
  const chosen = onPage.filter((t) => (mode === 'all' || t.first) && (whoNow === 'all' || (whoNow === 'ok' ? t.ok : t.ok === false)))
  const people = new Set(onPage.map((t) => t.pid)).size
  const stats = source === 'test' && test && task ? summarize(test, sessions).tasks.find((x) => x.task.id === task.id) : undefined
  const targetSel = source === 'test' && task?.success.kind === 'element' && task.success.page === page ? task.success.sel : null

  /* ---------- eyes: gaze samples → fixations, per person ---------- */
  const gazeAcc = useMemo(() => new Map((ver >= 0 ? loadGazeSessions() : []).map((g) => [g.sid, g.accuracy])), [ver])
  const testOutcome = useMemo(() => {
    const m = new Map<string, { ok: boolean; firstRight: boolean | null; acc?: number }>()
    if (source !== 'test' || !test || !task) return m
    for (const s of sessions.filter((x) => x.testId === test.id && (!runId || x.id === runId))) {
      const a = s.attempts.find((x) => x.taskId === task.id)
      if (a) m.set(s.id, { ok: a.outcome === 'success', firstRight: a.firstTapCorrect, acc: s.gaze?.accuracy })
    }
    return m
  }, [source, test, task, sessions])
  const realEyes = useMemo(() => {
    const groups = new Map<string, { start: number; acc: number | null; samples: { t: number; x: number; y: number }[] }>()
    for (const p of gaze) {
      if (p.page !== page || layoutOf(p.vw) !== device) continue
      if (source === 'test' ? !(p.task === task?.id && p.test && testOutcome.has(p.test)) : !!p.test) continue
      const key = p.test ?? p.sid
      const t = timeOf(p)
      const g = groups.get(key) ?? { start: p.tt !== undefined ? t - p.tt : t, acc: (p.test ? testOutcome.get(p.test)?.acc : undefined) ?? gazeAcc.get(p.sid) ?? null, samples: [] }
      if (p.tt === undefined) g.start = Math.min(g.start, t)
      g.samples.push({ t, x: (p.x / 100) * d.w, y: p.y })
      groups.set(key, g)
    }
    return [...groups.entries()].map(([id, g]) => ({ id, start: g.start, acc: g.acc, samples: g.samples }))
  }, [gaze, gazeAcc, page, device, source, task?.id, testOutcome, d.w])
  const eyeSample = realEyes.length === 0
  const accs = realEyes.map((e) => e.acc).filter((a): a is number => a !== null).sort((a, b) => a - b)
  const accuracy = accs.length ? accs[Math.floor(accs.length / 2)] : null
  const eyePeople = useMemo(() => {
    const base = eyeSample
      ? sampleGaze(aois.map((a) => ({ rect: a.rect, weight: a.target ? 3 : 1, target: a.target })), `${source}|${test?.id}|${task?.id}|${page}|${device}`).map((p) => ({ ...p, acc: null as number | null }))
      : realEyes
    const opts = idtFor(eyeSample ? 110 : accuracy)
    return base
      .filter((p) => source !== 'test' || who === 'all' || eyeSample || (who === 'ok') === !!testOutcome.get(p.id)?.ok)
      .map((p) => ({ id: p.id, start: p.start, fixations: fixationsOf(p.samples, opts) }))
      .filter((p) => p.fixations.length > 0)
  }, [eyeSample, realEyes, aois, source, test?.id, task?.id, page, device, accuracy, who, testOutcome])
  const person = eyePeople[Math.min(pidx, Math.max(0, eyePeople.length - 1))]
  // Playback runs from the first fixation (no blank lead-in); the clock still shows time since the task began.
  const pathBase = person ? person.fixations[0].start : 0
  const pathEnd = person ? Math.max(...person.fixations.map((f) => f.start + f.dur)) - pathBase : 0
  const lead = person ? pathBase - person.start : 0
  const shownFix: Fixation[] = person ? person.fixations.filter((f) => playT === null || f.start - pathBase <= playT) : []
  const aoiTable = useMemo(() => aoiStats(aois, eyePeople), [aois, eyePeople])
  const allFix = eyePeople.flatMap((p) => p.fixations)
  const sacc = eyePeople.flatMap((p) => saccadesOf(p.fixations))
  const targetStat = aoiTable.find((s) => s.aoi.target)
  // Looked at the target, yet their first click went somewhere else: the target didn't read as the way forward.
  const lookedNotClicked = !eyeSample && targetStat ? eyePeople.filter((p) => testOutcome.get(p.id)?.firstRight === false && p.fixations.some((f) => { const r = targetStat.aoi.rect; return f.x >= r.x && f.x <= r.x + r.w && f.y >= r.y && f.y <= r.y + r.h })).length : null
  useEffect(() => { setPidx(0); setPlayT(null); setPlaying(false) }, [page, device, task?.id, source, layer])
  // Playback: the scanpath grows in real time.
  useEffect(() => {
    if (!playing) return
    let raf = 0, last = performance.now()
    const tick = (now: number) => {
      // A frame's timestamp can be slightly before the moment playback started: never step backwards.
      setPlayT((t) => { const n = Math.max(0, (t ?? 0) + Math.max(0, now - last)); if (n >= pathEnd) { setPlaying(false); return null } return n })
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, pathEnd])

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
    // Areas of interest: the task's target, then the screen's main parts in reading order.
    const parts: Aoi[] = []
    const seenEl = new Set<Element>()
    const add = (el: Element, target = false) => {
      if (seenEl.has(el)) return
      const r = el.getBoundingClientRect()
      if (r.width < 40 || r.height < 24 || r.height > 1400) return
      seenEl.add(el)
      const head = (el.querySelector('h1, h2, h3') as HTMLElement | null)?.innerText?.split('\n')[0].trim()
      const named = AOI_NAMES.find(([sel]) => el.matches(sel))?.[1]
      parts.push({ id: `aoi-${parts.length}`, label: target ? `Target: ${task?.success.kind === 'element' ? task.success.label : nameOf(el)}` : named ?? (head ? head.slice(0, 40) : nameOf(el)), rect: { x: r.left, y: r.top, w: r.width, h: r.height }, ...(target ? { target: true } : {}) })
    }
    if (tEl) add(tEl, true)
    doc.querySelectorAll('header, .crumbs, .hero, .hero2, .gallery, .buy, .deal-timer, .block, .ai-card, .cart > .card, .summary').forEach((el) => { if (parts.length < 11) add(el) })
    setAois(parts)
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
  // Eyes: each fixation weighs by how long it lasted (one stamp per 60 ms), so long looks burn hotter.
  const eyeHeat = useMemo(() => allFix.flatMap((f) => Array.from({ length: Math.max(1, Math.round(f.dur / 60)) }, () => ({ x: f.x, y: f.y }))), [allFix])
  useEffect(() => {
    if (!canvas.current) return
    drawHeat(canvas.current, layer === 'eyes' ? (showHeat ? eyeHeat : []) : placed, scale, layer === 'eyes' ? Math.max(radius, accuracy ?? 60) : radius, opacity)
  }, [placed, eyeHeat, layer, showHeat, scale, radius, opacity, frameH, accuracy])

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
        <div className="actions">
          <Link className="btn" to="/console/heatmap"><ArrowLeft size={14} /> All results</Link>
          <button className="btn" onClick={() => void refresh()}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      <section className="card hm-controls">
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="Source">
            <button aria-pressed={source === 'test'} onClick={() => set({ source: null, page: null, device: null, run: null })}>Usability test</button>
            <button aria-pressed={source === 'browsing'} onClick={() => set({ source: 'browsing', page: null, device: null, run: null })}>Everyday browsing</button>
          </div>
          {source === 'test' && test && (
            <>
              <select className="select hm-select" value={test.id} onChange={(e) => set({ ut: e.target.value, utask: null, page: null, device: null, run: null })} aria-label="Test">
                {tests.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <select className="select hm-select wide" value={task?.id} onChange={(e) => set({ utask: e.target.value, page: null, device: null, run: null })} aria-label="Task">
                {test.tasks.map((t, i) => <option key={t.id} value={t.id}>Task {i + 1}: {short(t.prompt)}</option>)}
              </select>
            </>
          )}
          <div className="seg" role="group" aria-label="Layer">
            <button aria-pressed={layer === 'clicks'} onClick={() => set({ layer: null })}><MousePointerClick size={13} /> Clicks</button>
            <button aria-pressed={layer === 'eyes'} onClick={() => set({ layer: 'eyes' })}><Eye size={13} /> Eyes</button>
          </div>
          {source === 'browsing' && (
            <label className="row" style={{ gap: 8, fontSize: 13 }}><Switch checked={recording} onChange={() => { if (recording) endSession('stopped'); setFlag('insights', !recording) }} label="Record taps" /> Recording {recording ? 'on' : 'off'}</label>
          )}
        </div>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="seg" role="group" aria-label="Device">{(Object.keys(DEVICES) as Device[]).map((x) => <button key={x} aria-pressed={device === x} onClick={() => set({ device: x })}>{x[0].toUpperCase() + x.slice(1)}</button>)}</div>
          {layer === 'clicks' ? (
            <div className="seg" role="group" aria-label="Clicks">
              <button aria-pressed={mode === 'first'} onClick={() => setMode('first')}>First clicks</button>
              <button aria-pressed={mode === 'all'} onClick={() => setMode('all')}>All clicks</button>
            </div>
          ) : (
            <div className="seg" role="group" aria-label="Show">
              <button aria-pressed={showHeat} onClick={() => setShowHeat((v) => !v)}>Attention heat</button>
              <button aria-pressed={showPath} onClick={() => setShowPath((v) => !v)}>Scanpath</button>
            </div>
          )}
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
          {runId ? (() => { const s = sessions.find((x) => x.id === runId); return (
            <span className="hm-run-pill">One run: <b>{s?.participant ?? 'removed'}</b>{s ? ` · ${new Date(s.startedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''} <button className="link-btn" onClick={() => set({ run: null, page: null, device: null })}>Show all runs</button></span>
          ) })() : null}
        </section>
      )}

      <nav className="hm-pages" aria-label="Pages">
        {pages.map((p, i) => {
          const c = pageCount(p)
          return (
            <button key={p} aria-pressed={page === p} onClick={() => set({ page: p, device: null })}>
              <span className="mono">{p}</span>
              <small>{source === 'test' && i === 0 && <em>start</em>}{c.clicks} click{c.clicks === 1 ? '' : 's'}{c.eyes ? <> · <Eye size={11} /> {c.eyes}</> : null}</small>
            </button>
          )
        })}
      </nav>
      {(() => {
        // Recorded here, but at another width: say so, instead of an empty (or sample) map.
        const here = layer === 'eyes' ? gazeHereAll.filter((g) => g.page === page) : taps.filter((t) => t.page === page)
        const other = (['mobile', 'tablet', 'desktop'] as Device[]).filter((x) => x !== device && here.some((h) => layoutOf(h.vw) === x))
        const none = !here.some((h) => layoutOf(h.vw) === device)
        return none && other.length ? <p className="hm-sample"><Info size={14} /> <span>Nothing at {device} width on this page, but there is at {other.map((o, k) => <span key={o}>{k ? ', ' : ''}<button className="link-btn" onClick={() => set({ device: o })}>{o}</button></span>)} width.</span></p> : null
      })()}
      {layer === 'eyes' && (
        <p className="hm-sample"><Info size={14} /> <span>{eyeSample
          ? <>No one has done this {source === 'test' ? 'task' : 'screen'} with eye tracking on at {device} width yet, so this shows <b>sample gaze</b>: 8 made-up people’s raw webcam-like samples (30 a second, with noise), run through the same fixation algorithm as real data. It shows how the view reads; it is not a result. Start a task from the dock (Heatmap) with “also record where I look” ticked.</>
          : <>Eyes: {eyePeople.length} {eyePeople.length === 1 ? 'person' : 'people'} with eye tracking, median accuracy ±{accuracy ?? '?'} px. Webcam tracking is good for areas, not single words: read fixations as “around here”.</>}</span></p>
      )}
      {layer === 'clicks' && sample && (
        <p className="hm-sample"><Info size={14} /> <span>{source === 'test'
          ? <>No participant has done this task on this screen at {device} width yet, so this shows <b>sample data</b>: {SAMPLE_PEOPLE} made-up participants clicking this screen’s real buttons and links, more often on the way to the goal. It shows how the map reads; it is not a result. Run it from the dock on any shop page (Heatmap → Start the task here), or share the test link from <Link to={`/console/tests/${test?.id}`}>the test</Link>.</>
          : <>No recorded taps on this screen at {device} width yet, so this shows <b>sample data</b>, not real visitors. {recording ? 'Use the shop, then Refresh.' : 'Turn on recording from the dock (Sessions) and use the shop.'}</>}</span></p>
      )}

      <div className="hm-grid">
        <section className="card hm-stage-card">
          <div className="hm-meta">
            {layer === 'eyes' ? <span><b className="num">{allFix.length}</b> fixations · <b className="num">{eyePeople.length}</b> {eyeSample ? 'sample people' : 'people'} · {page} · {d.label}</span> : <span><b className="num">{placed.length}</b> {mode === 'first' ? 'first click' : 'click'}{placed.length === 1 ? '' : 's'}{sample ? ' (sample)' : <> · <b className="num">{people}</b> {source === 'test' ? 'participant' : 'session'}{people === 1 ? '' : 's'}</>}{targetSel && placed.length > 0 ? <> · <b className="num">{pct(onTarget, placed.length)}</b> on the target</> : null} · {page} · {d.label}</span>}
            <span className="hm-legend"><span>Fewer</span><i style={{ background: LEGEND }} /><span>{layer === 'eyes' ? 'Longer looks' : 'More clicks'}</span></span>
            <a className="btn sm ghost" href={openHref} target="_blank" rel="noopener">Open <ExternalLink size={12} /></a>
          </div>
          <div className="hm-stage" ref={wrap}>
            <div className="hm-page" style={{ width: d.w * scale, height: (frameH || d.h) * scale }}>
              <iframe key={src + device} ref={frame} src={src} title={`${page} at ${d.label}`} tabIndex={-1} style={{ width: d.w, height: frameH || d.h, transform: `scale(${scale})` }} />
              <canvas ref={canvas} className="hm-canvas" aria-label={`Heatmap of ${placed.length} clicks`} />
              <div className="hm-fold" style={{ top: d.h * scale }}><span>Fold · {d.h}px</span></div>
              {target && <div className="hm-target" style={{ left: target.left * scale, top: target.top * scale, width: target.width * scale, height: target.height * scale }}><span>Target</span></div>}
              {layer === 'eyes' && showPath && person && (
                <svg className="hm-path" width={d.w * scale} height={(frameH || d.h) * scale} aria-label={`Scanpath of ${person.id}`}>
                  {shownFix.slice(1).map((f, i) => <line key={i} x1={shownFix[i].x * scale} y1={shownFix[i].y * scale} x2={f.x * scale} y2={f.y * scale} />)}
                  {shownFix.map((f, i) => (
                    <g key={i} transform={`translate(${f.x * scale} ${f.y * scale})`}>
                      <circle r={Math.max(9, Math.sqrt(f.dur) * 0.9) * Math.max(0.6, scale)} className={i === shownFix.length - 1 && playT !== null ? 'now' : ''} />
                      <text dy="0.35em">{i + 1}</text>
                    </g>
                  ))}
                </svg>
              )}
              {layer === 'eyes' && hoverAoi && (() => { const a = aois.find((x) => x.id === hoverAoi); return a ? <div className="hm-hl" style={{ left: a.rect.x * scale, top: a.rect.y * scale, width: a.rect.w * scale, height: a.rect.h * scale }} /> : null })()}
              {hovered && <div className="hm-hl" style={{ left: hovered.left * scale, top: hovered.top * scale, width: hovered.width * scale, height: hovered.height * scale }} />}
              {!ready && <div className="hm-loading">Loading the screen…</div>}
            </div>
          </div>
        </section>
        {layer === 'eyes' ? (
        <aside className="card card-body hm-side">
          <h3>Eye movement</h3>
          <dl className="hm-eyestats">
            <div><dt>Fixations / person</dt><dd className="num">{eyePeople.length ? (allFix.length / eyePeople.length).toFixed(1) : '—'}</dd></div>
            <div><dt>Avg fixation</dt><dd className="num">{allFix.length ? `${Math.round(allFix.reduce((a, f) => a + f.dur, 0) / allFix.length)} ms` : '—'}</dd></div>
            <div><dt>Avg saccade</dt><dd className="num">{sacc.length ? `${Math.round(sacc.reduce((a, x) => a + x.amp, 0) / sacc.length)} px` : '—'}</dd></div>
            <div><dt>Accuracy</dt><dd className="num">{eyeSample ? 'sample' : accuracy !== null ? `±${accuracy} px` : '—'}</dd></div>
          </dl>
          {targetStat && (
            <p className="hm-insight">
              <b>{targetStat.viewers} of {targetStat.people}</b> looked at the target{targetStat.ttff !== null ? <>, first after <b>{(targetStat.ttff / 1000).toFixed(1)} s</b> (median)</> : null}.
              {lookedNotClicked !== null && lookedNotClicked > 0 && <> <b>{lookedNotClicked}</b> saw it but clicked something else first.</>}
            </p>
          )}
          <h3>Scanpath</h3>
          {person ? (
            <div className="hm-play">
              <select className="select hm-select" value={pidx} onChange={(e) => { setPidx(Number(e.target.value)); setPlayT(null); setPlaying(false) }} aria-label="Person">
                {eyePeople.map((p, i) => <option key={p.id} value={i}>{eyeSample ? `Sample person ${i + 1}` : `Participant ${i + 1}`} · {p.fixations.length} fixations</option>)}
              </select>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn sm icon" onClick={() => { if (!playing && (playT === null || playT >= pathEnd)) setPlayT(0); setPlaying((v) => !v) }} aria-label={playing ? 'Pause' : 'Play the scanpath'}>{playing ? <Pause size={13} /> : <Play size={13} />}</button>
                <input type="range" min={0} max={Math.max(1, Math.round(pathEnd))} value={playT === null ? Math.round(pathEnd) : Math.round(playT)} onChange={(e) => { setPlaying(false); const v = Number(e.target.value); setPlayT(v >= pathEnd ? null : v) }} aria-label="Scanpath time" style={{ flex: 1 }} />
                <span className="num muted" style={{ fontSize: 12 }}>{((lead + (playT ?? pathEnd)) / 1000).toFixed(1)} s</span>
              </div>
            </div>
          ) : <p className="muted" style={{ fontSize: 13 }}>No fixations here.</p>}
          <h3>Areas of interest</h3>
          <table className="hm-aoi">
            <thead><tr><th>Area</th><th title="People who looked at it">Seen</th><th title="Time to first fixation, median">TTFF</th><th title="Total time looking, per person who looked">Dwell</th></tr></thead>
            <tbody>
              {aoiTable.map((x) => (
                <tr key={x.aoi.id} className={x.aoi.target ? 'target' : ''} onMouseEnter={() => setHoverAoi(x.aoi.id)} onMouseLeave={() => setHoverAoi(null)}>
                  <td title={x.aoi.label}>{x.aoi.label}</td>
                  <td className="num">{x.people ? `${Math.round((x.viewers / x.people) * 100)}%` : '—'}</td>
                  <td className="num">{x.ttff === null ? '—' : `${(x.ttff / 1000).toFixed(1)} s`}</td>
                  <td className="num">{x.viewers ? `${(x.dwell / x.viewers / 1000).toFixed(1)} s` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 12 }}>Fixations: I-DT, dispersion {idtFor(eyeSample ? 110 : accuracy).dispersion} px, at least 100 ms. TTFF counts from the start of the task. Hover an area to see it.</p>
        </aside>
        ) : (
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
        )}
      </div>
    </main>
  )
}
