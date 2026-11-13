/**
 * The script's reviewer tools beside Comments: Inspect, Design system check and Design tokens.
 * Each one is a product the project turns on in the panel (a module of the published settings).
 * They work in the reviewer's tab only and send nothing anywhere (see design.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Flame, Palette, RotateCcw, ScanSearch, SquareDashedMousePointer, TriangleAlert, Upload, X } from 'lucide-react'
import { HOST_TAG, MAX_FILE, RULE_LABEL, applyTokens, dropProbe, inspect, pageTokens, parseTokenFile, removeTokens, scanPage, type Group, type Scan, type Tokens } from './design'
import { NS } from './store'
import { drawHeat, LEGEND } from '../heat'
import * as server from './server'

export type ToolId = 'inspect' | 'dscheck' | 'tokens' | 'heatmap'
export const TOOL_IDS: ToolId[] = ['inspect', 'dscheck', 'tokens', 'heatmap']
export const TOOL_META: Record<ToolId, { label: string; Icon: typeof Palette }> = {
  inspect: { label: 'Inspect', Icon: SquareDashedMousePointer },
  dscheck: { label: 'Design system check', Icon: ScanSearch },
  tokens: { label: 'Design tokens', Icon: Palette },
  heatmap: { label: 'Heatmap', Icon: Flame },
}

/* ---------- the reviewer's token file (this tab only) ---------- */

interface FileState { tokens: Tokens; reference: boolean; applied: boolean; matched: number; skipped: number }
const fileKey = (p: string) => `${NS}tokens:${p}`
let fileState: FileState | null = null
let loadedFor = ''
const subs = new Set<() => void>()
function loadFile(project: string) {
  if (loadedFor === project) return
  loadedFor = project
  try { const v = JSON.parse(sessionStorage.getItem(fileKey(project)) ?? 'null'); fileState = v && v.tokens?.list ? v : null } catch { fileState = null }
  if (fileState?.applied) fileState.matched = applyTokens(fileState.tokens)
}
function setFile(project: string, s: FileState | null) {
  fileState = s
  try { if (s) sessionStorage.setItem(fileKey(project), JSON.stringify(s)); else sessionStorage.removeItem(fileKey(project)) } catch { /* too large or blocked: kept for this page only */ }
  subs.forEach((f) => f())
}
function useFile(project: string) {
  loadFile(project)
  const [, set] = useState(0)
  useEffect(() => { const f = () => set((n) => n + 1); subs.add(f); return () => { subs.delete(f) } }, [])
  return fileState
}
/** What Inspect and the check compare against: the reviewer's file when they chose it, else the page's own variables. */
function reference(project: string): Tokens {
  loadFile(project)
  const t = fileState?.reference ? fileState.tokens : pageTokens()
  dropProbe()
  return t
}

/** Is this event about the widget itself (not the page)? */
const ours = (e: Event) => e.composedPath().some((n) => n instanceof Element && n.tagName.toLowerCase() === HOST_TAG)

/* ---------- the tool shown ---------- */

export function ToolView({ tool, project, onClose }: { tool: ToolId; project: string; onClose: () => void }) {
  if (tool === 'inspect') return <InspectTool project={project} onClose={onClose} />
  if (tool === 'dscheck') return <CheckTool project={project} onClose={onClose} />
  if (tool === 'heatmap') return <HeatmapTool project={project} onClose={onClose} />
  return <TokensTool project={project} onClose={onClose} />
}

function RefNote({ t }: { t: Tokens }) {
  if (t.source === 'file') return <p className="vc-muted">Checked against <b>{t.label}</b> (Design tokens).</p>
  if (!t.list.length) return <p className="vc-muted">This page defines no CSS variables, so only the type scale is checked. Drop a token file in Design tokens to check against it.</p>
  return <p className="vc-muted">Checked against {t.colors.length} colour, {t.radii.length} radius and {t.fonts.length} font variables of this page.</p>
}

/* ---------- Inspect ---------- */

function InspectTool({ project, onClose }: { project: string; onClose: () => void }) {
  const tokens = useMemo(() => reference(project), [project])
  const [el, setEl] = useState<Element | null>(null)
  const [pinned, setPinned] = useState(false)
  const [, tick] = useState(0)
  const pinnedRef = useRef(false)
  pinnedRef.current = pinned
  useEffect(() => {
    let raf = 0
    const target = (e: Event) => (ours(e) ? null : (e.target instanceof Element ? e.target : null))
    const move = (e: PointerEvent) => {
      if (pinnedRef.current) return
      const t = target(e)
      if (!t) return
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setEl(t))
    }
    // While inspecting, clicks pick an element: they never press the page's buttons, follow links or submit forms.
    const block = (e: Event) => { if (target(e)) { e.preventDefault(); e.stopPropagation() } }
    const click = (e: MouseEvent) => { const t = target(e); if (!t) return; e.preventDefault(); e.stopPropagation(); setEl(t); setPinned(true) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (pinnedRef.current) setPinned(false); else onClose() } }
    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => tick((n) => n + 1)) }
    document.addEventListener('pointermove', move, true)
    document.addEventListener('click', click, true)
    const blocked = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'submit', 'touchstart', 'auxclick', 'dblclick']
    for (const t of blocked) document.addEventListener(t, block, true)
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', redraw, true)
    window.addEventListener('resize', redraw)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointermove', move, true)
      document.removeEventListener('click', click, true)
      for (const t of blocked) document.removeEventListener(t, block, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', redraw, true)
      window.removeEventListener('resize', redraw)
    }
  }, [onClose])
  useEffect(() => { if (el && !el.isConnected) { setEl(null); setPinned(false) } })

  const info = el && el.isConnected ? inspect(el, tokens) : null
  const r = el?.isConnected ? el.getBoundingClientRect() : null
  const W = Math.min(300, window.innerWidth - 16), H = 300, DOCK = 84
  let style: React.CSSProperties = {}
  if (r) {
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
    if (r.bottom + 8 + H < window.innerHeight - DOCK) style = { left, top: r.bottom + 8, width: W }
    else if (r.top - 8 - H > 56) style = { left, bottom: Math.max(DOCK, window.innerHeight - r.top + 8), width: W }
    else style = { left: Math.max(8, window.innerWidth - W - 12), top: 60, width: W }
  }
  return (
    <>
      <div className="vc-hint vc-hint-bar">{pinned ? 'Pinned · click another element, or Esc' : 'Inspect · hover anything, click to pin'}<button onClick={onClose}><X size={12} /> Stop</button></div>
      {r && <div className={`vc-ibox ${pinned ? 'pinned' : ''}`} style={{ left: r.left, top: r.top, width: r.width, height: r.height }}><span>{Math.round(r.width)} × {Math.round(r.height)}</span></div>}
      {info && (
        <div className={`vc-card vc-insp ${pinned ? '' : 'through'}`} style={style} role="dialog" aria-label="Inspected styles">
          <div className="vc-card-head"><b className="vc-mono vc-trunc" title={info.name}>{info.name}</b><span className="vc-grow" />{pinned && <button className="vc-icon" onClick={() => setPinned(false)} aria-label="Unpin"><X size={13} /></button>}</div>
          <dl className="vc-rows">
            {info.rows.map((x) => (
              <div key={x.label} className={x.off ? 'off' : ''}>
                <dt>{x.label}</dt>
                <dd>
                  <span className="vc-val">{x.swatch && <i style={{ background: x.swatch }} />}<span className="vc-mono">{x.value}</span></span>
                  {x.token ? <span className="vc-ok"><Check size={11} /> {x.token}</span> : x.off ? <span className="vc-bad"><TriangleAlert size={11} /> {x.off}</span> : null}
                  {x.note && <span className="vc-muted">{x.note}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <div className={`vc-sum ${info.offCount ? 'bad' : ''}`}>{info.offCount ? `${info.offCount} value${info.offCount === 1 ? '' : 's'} aren’t design tokens` : 'Everything checked matches the tokens'}</div>
          <RefNote t={tokens} />
        </div>
      )}
    </>
  )
}

/* ---------- Design system check ---------- */

function CheckTool({ project, onClose }: { project: string; onClose: () => void }) {
  const [scan, setScan] = useState<Scan | null>(null)
  const [tokens, setTokens] = useState<Tokens | null>(null)
  const [show, setShow] = useState<{ el: Element; n: number; of: number } | null>(null)
  const [, tick] = useState(0)
  const run = () => {
    setScan(null); setShow(null)
    // After a paint, so the panel shows "Checking…" first on a large page.
    window.setTimeout(() => { const t = reference(project); setTokens(t); setScan(scanPage(t)); dropProbe() }, 30)
  }
  useEffect(run, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const redraw = () => tick((n) => n + 1)
    window.addEventListener('scroll', redraw, true)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('scroll', redraw, true); window.removeEventListener('keydown', key) }
  }, [onClose])
  const reveal = (g: Group) => {
    const live = g.els.filter((e) => e.isConnected)
    if (!live.length) return
    const n = show && live.includes(show.el) ? (live.indexOf(show.el) + 1) % live.length : 0
    live[n].scrollIntoView({ block: 'center', behavior: 'smooth' })
    setShow({ el: live[n], n: n + 1, of: live.length })
  }
  const r = show?.el.isConnected ? show.el.getBoundingClientRect() : null
  const total = scan?.groups.reduce((s, g) => s + g.els.length, 0) ?? 0
  return (
    <>
      {r && <div className="vc-ibox pinned" style={{ left: r.left, top: r.top, width: r.width, height: r.height }}><span>{show!.n} of {show!.of}</span></div>}
      <div className="vc-panel" role="dialog" aria-label="Design system check">
        <div className="vc-card-head"><b>Design system check</b><span className="vc-grow" /><button className="vc-icon" onClick={run} aria-label="Check again" title="Check again"><RotateCcw size={14} /></button><button className="vc-icon" onClick={onClose} aria-label="Close"><X size={14} /></button></div>
        {!scan ? <p className="vc-empty">Checking this page…</p> : (
          <>
            <p className={`vc-sum ${scan.groups.length ? 'bad' : ''}`}>{scan.groups.length ? `${scan.groups.length} value${scan.groups.length === 1 ? '' : 's'} off the design system, used ${total} time${total === 1 ? '' : 's'}` : 'Everything on this page matches the tokens'} · {scan.checked} elements checked{scan.capped ? ' (the first 5,000)' : ''}</p>
            {tokens && <RefNote t={tokens} />}
            <ul className="vc-items">
              {scan.groups.map((g) => (
                <li key={`${g.rule}|${g.value}`}>
                  <button onClick={() => reveal(g)} title="Show on the page (click again for the next)">
                    <span className="vc-row"><b>{RULE_LABEL[g.rule]}</b><span className="vc-grow" /><span className="vc-muted">{g.els.length}×</span></span>
                    <span className="vc-val">{g.swatch && <i style={{ background: g.swatch }} />}<span className="vc-mono">{g.value}</span>{g.suggest && <span className="vc-muted"> → {g.suggest}</span>}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="vc-where">Reads the page’s rendered styles in your browser only; nothing is sent.</p>
          </>
        )}
      </div>
    </>
  )
}

/* ---------- Design tokens ---------- */

function TokensTool({ project, onClose }: { project: string; onClose: () => void }) {
  const file = useFile(project)
  const [error, setError] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const page = useMemo(() => { const t = pageTokens(); dropProbe(); return t }, [file?.applied])
  useEffect(() => { const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key) }, [onClose])
  const pick = (f: File | undefined) => {
    if (!f) return
    setError('')
    if (f.size > MAX_FILE) { setError(`${f.name} is larger than 2 MB.`); return }
    void f.text().then((text) => {
      const r = parseTokenFile(f.name, text)
      dropProbe()
      if (!r.tokens) { setError(r.error ?? 'That file couldn’t be read.'); return }
      if (fileState?.applied) removeTokens()
      setFile(project, { tokens: r.tokens, reference: true, applied: false, matched: 0, skipped: r.skipped })
    })
  }
  const toggleApply = () => {
    if (!file) return
    if (file.applied) { removeTokens(); setFile(project, { ...file, applied: false, matched: 0 }); return }
    const n = applyTokens(file.tokens)
    if (!n) { setError('None of the file’s tokens match a CSS variable this page defines, so there is nothing to apply.'); return }
    setFile(project, { ...file, applied: true, matched: n })
  }
  const remove = () => { removeTokens(); setFile(project, null); setError('') }
  const shown = (file?.tokens ?? page).list.slice(0, 60)
  return (
    <div className="vc-panel" role="dialog" aria-label="Design tokens">
      <div className="vc-card-head"><b>Design tokens</b><span className="vc-grow" /><button className="vc-icon" onClick={onClose} aria-label="Close"><X size={14} /></button></div>
      <p className="vc-muted">This page defines {page.list.length} CSS variables ({page.colors.length} colours, {page.radii.length} radii, {page.fonts.length} fonts).</p>
      {file ? (
        <div className="vc-box">
          <div className="vc-row"><b className="vc-trunc">{file.tokens.label}</b><span className="vc-grow" /><button className="vc-icon" onClick={remove} aria-label="Remove the file"><X size={13} /></button></div>
          <p className="vc-muted">{file.tokens.list.length} tokens: {file.tokens.colors.length} colours, {file.tokens.radii.length} radii, {file.tokens.fonts.length} fonts{file.skipped ? ` · ${file.skipped} skipped` : ''}</p>
          <label className="vc-check"><input type="checkbox" checked={file.reference} onChange={() => setFile(project, { ...file, reference: !file.reference })} /> Check Inspect and the design system check against this file</label>
          <label className="vc-check"><input type="checkbox" checked={file.applied} onChange={toggleApply} /> Apply it to this page{file.applied ? ` (${file.matched} variables)` : ''}</label>
          {file.applied && <p className="vc-where">Only you see this, in this tab. Untick it, or close the tab, to go back.</p>}
        </div>
      ) : (
        <button className="vc-btn vc-drop" onClick={() => input.current?.click()}><Upload size={14} /> Choose a token file (.json or .css)</button>
      )}
      <input ref={input} type="file" accept=".json,.css,.tokens,application/json,text/css" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = '' }} />
      {error && <p className="vc-bad">{error}</p>}
      <ul className="vc-items vc-toks">
        {shown.map((t) => <li key={t.name}><span className="vc-val">{t.kind === 'color' && <i style={{ background: t.value }} />}<span className="vc-mono vc-trunc">{t.name}</span></span><span className="vc-mono vc-muted vc-trunc">{t.value}</span></li>)}
        {!shown.length && <li className="vc-empty">No tokens to show.</li>}
      </ul>
      <p className="vc-where">W3C design tokens, Tokens Studio or CSS variables, up to 2 MB. The file stays in this browser tab; nothing is uploaded.</p>
    </div>
  )
}

export const ToolIcon = ({ id }: { id: ToolId }) => { const I = TOOL_META[id].Icon; return <I size={15} /> }

/* ---------- Heatmap: study participants' clicks, drawn over this page ---------- */

interface HeatPt { x: number; y: number; vw: number | null; sel: string | null; ex: number | null; ey: number | null; rage: boolean | null; dead: boolean | null }
const HEAT_ERRORS: Record<string, string> = {
  not_invited: 'Open the site through a review link to see its heatmap.',
  origin_not_allowed: 'The Heatmap product isn’t on for this address (Widget → Website, Products).',
  rate_limited: 'Too many requests. Wait a minute.',
}
function HeatmapTool({ project, onClose }: { project: string; onClose: () => void }) {
  const [data, setData] = useState<{ studies: { id: string; name: string }[]; points: HeatPt[] } | null>(null)
  const [study, setStudy] = useState('')
  const [error, setError] = useState('')
  const [opacity, setOpacity] = useState(0.75)
  const [kind, setKind] = useState<'click' | 'gaze'>('click')
  const [page, setPage] = useState(window.location.pathname)
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let live = true
    setData(null); setError('')
    server.rpc<{ studies: { id: string; name: string }[]; points: HeatPt[] }>('heatmap_points', { p_public_id: project, p_page: page, p_study: study || null, p_kind: kind })
      .then((d) => { if (live) setData({ studies: d.studies ?? [], points: d.points ?? [] }) })
      .catch((e: Error) => { if (live) setError(HEAT_ERRORS[e.message] ?? `The heatmap couldn’t load (${e.message}).`) })
    return () => { live = false }
  }, [project, page, study, kind])
  useEffect(() => {
    if (!data) return
    let raf = 0
    const draw = () => {
      const c = canvas.current
      if (!c) return
      const W = window.innerWidth, H = window.innerHeight
      const found = new Map<string, Element | null>()
      const at = (sel: string) => { if (!found.has(sel)) { let el: Element | null = null; try { el = document.querySelector(sel) } catch { el = null } found.set(sel, el) } return found.get(sel) }
      const pts: { x: number; y: number }[] = []
      for (const p of data.points) {
        let x: number, y: number
        const el = p.sel ? at(p.sel) : null
        const r = el?.getBoundingClientRect()
        if (r && r.width > 0 && r.height > 0 && p.ex != null && p.ey != null) { x = r.left + p.ex * r.width; y = r.top + p.ey * r.height }
        else { x = p.x * (W / (p.vw || W)) - window.scrollX; y = p.y - window.scrollY }
        if (x > -60 && x < W + 60 && y > -60 && y < H + 60) pts.push({ x, y })
      }
      drawHeat(c, pts, 1, 28, opacity)
    }
    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw) }
    draw()
    window.addEventListener('scroll', redraw, true)
    window.addEventListener('resize', redraw)
    const iv = window.setInterval(() => { if (window.location.pathname !== page) setPage(window.location.pathname) }, 500)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', redraw, true); window.removeEventListener('resize', redraw); window.clearInterval(iv); window.removeEventListener('keydown', key) }
  }, [data, opacity, page, onClose])
  const n = data?.points.length ?? 0
  const rage = data?.points.filter((p) => p.rage).length ?? 0
  const dead = data?.points.filter((p) => p.dead).length ?? 0
  return (
    <>
      <canvas ref={canvas} className="vc-heat" aria-hidden />
      <div className="vc-panel vc-heatpanel" role="dialog" aria-label="Heatmap">
        <div className="vc-card-head"><b>Heatmap · {page}</b><span className="vc-grow" /><button className="vc-icon" onClick={onClose} aria-label="Close"><X size={14} /></button></div>
        {error ? <p className="vc-bad">{error}</p> : !data ? <p className="vc-empty">Loading…</p> : (
          <>
            <div className="vc-seg"><button aria-pressed={kind === 'click'} onClick={() => setKind('click')}>Clicks</button><button aria-pressed={kind === 'gaze'} onClick={() => setKind('gaze')}>Where people looked</button></div>
            <p className={`vc-sum ${n ? '' : 'bad'}`}>{n ? `${n} ${kind === 'gaze' ? 'gaze point' : 'click'}${n === 1 ? '' : 's'} on this page${n >= 20000 ? ' (the latest 20,000)' : ''}` : kind === 'gaze' ? 'No eye tracking on this page yet' : 'No clicks on this page yet'}{n && kind === 'click' ? ` · ${rage} rage · ${dead} on nothing clickable` : ''}</p>
            {data.studies.length > 0 && (
              <label className="vc-q">Study
                <select value={study} onChange={(e) => setStudy(e.target.value)}>
                  <option value="">All studies</option>
                  {data.studies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <label className="vc-q">Opacity <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></label>
            <div className="vc-legend" style={{ background: LEGEND }} aria-hidden /><div className="vc-row vc-muted"><span>fewer</span><span className="vc-grow" /><span>more clicks</span></div>
          </>
        )}
        <p className="vc-where">From study participants who agreed to take part (eye tracking only from those who also agreed to it, and estimated: about 100–200 px); never other visitors. Open another page and the map follows.</p>
      </div>
    </>
  )
}

