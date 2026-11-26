/**
 * The script's reviewer tools beside Comments: Inspect, Design system check and Design tokens.
 * Each one is a product the project turns on in the panel (a module of the published settings).
 * They work in the reviewer's tab only and send nothing anywhere (see design.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Flame, Palette, RotateCcw, ScanSearch, SquareDashedMousePointer, TriangleAlert, Upload, X } from 'lucide-react'
import { HOST_TAG, MAX_FILE, RULE_LABEL, applyTokens, dropProbe, inspect, pageTokens, parseTokenFile, removeTokens, scanPage, type Group, type Scan, type Tokens } from './design'
import { NS } from './store'
import { drawHeat, drawHeatGroups, LEGEND } from '../heat'
import * as server from './server'
import { deviceOf, prepare, type Anchor, type Device, type RawPt } from './heatmath'
import { binsToPoints, exposureWeight, fmtShare, place, rowOf, tagOfLabel, type Resolve } from '../heatstats'
import { cleanSummary, compareViews, MIN_EXPOSURES, verName, versionsOf, viewOf, type Summary } from './heatsummary'
import { defaultInvite, inviteUrl, labelOf, pageOf, reviewerClicksOff, setReviewerClicksOff, type Invite } from './research'
import { takeHint } from './hints'

import { TOOL_IDS, type ToolId } from './decide'
export { TOOL_IDS, type ToolId }
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

type HeatPt = RawPt
const HEAT_ERRORS: Record<string, string> = {
  not_invited: 'Only your team and invited reviewers can see heatmaps. Open this site from your panel (Open my site) or through a review link.',
  origin_not_allowed: 'The Heatmap product isn’t on for this address (Widget → Website, Products).',
  rate_limited: 'Too many requests. Wait a minute.',
}
/** Above this many clicks in one view, the map is drawn from the server's bins of all clicks (full data). */
const RAW_MAX = 20000
/** A page of the ourhunch panel, on the host that served this script (e.g. https://ourhunch.com/app#/app/research). */
function panelUrl(path: string) {
  const el = document.querySelector<HTMLScriptElement>('script[src*="vibe.js"]')
  let origin = 'https://ourhunch.com'
  try { if (el?.src) origin = new URL(el.src, window.location.href).origin } catch { /* keep default */ }
  return `${origin}/app#${path}`
}

/** Our own demo page: the trial has no study yet, so the heatmap shows labelled sample data instead of an error. */
const onDemoPage = () => /\/embed-demo\.html$/.test(window.location.pathname)

/** Inside a fixed or sticky overlay (notes, banners): not part of the page itself. */
function floating(el: Element) {
  for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) { const pos = getComputedStyle(e).position; if (pos === 'fixed' || pos === 'sticky') return true }
  return false
}

/** Labelled sample clicks around the demo page's links, buttons and headings (deterministic, no real people). */
function samplePoints(): HeatPt[] {
  let seed = 7
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() || 1e-9)) * Math.cos(2 * Math.PI * rnd())
  const vw = window.innerWidth
  const targets = [...document.querySelectorAll('a[href], button, h1, h2, h3, img, [role="button"]')]
    .filter((el) => !el.closest('[data-vibe], vibe-collab') && el.getBoundingClientRect().width > 0 && !floating(el)).slice(0, 14)
  const out: HeatPt[] = []
  targets.forEach((el, i) => {
    const r = el.getBoundingClientRect()
    const cx = r.left + r.width / 2 + window.scrollX, cy = r.top + r.height / 2 + window.scrollY
    const n = Math.round(30 / (1 + i * 0.45))
    for (let k = 0; k < n; k++) {
      out.push({ x: cx + gauss() * Math.min(r.width / 3, 40), y: cy + gauss() * Math.min(r.height / 3, 18), vw, sel: null, ex: null, ey: null,
        rage: false, dead: false, p: Math.floor(rnd() * 24), t: k, dev: null, label: null, ver: null })
    }
  })
  return out
}

function HeatmapTool({ project, onClose }: { project: string; onClose: () => void }) {
  const [sample, setSample] = useState(false)
  const [data, setData] = useState<{ studies: { id: string; name: string }[]; points: HeatPt[]; anchors: Anchor[]; summary: Summary | null } | null>(null)
  const [study, setStudy] = useState('')
  const [error, setError] = useState('')
  const [opacity, setOpacity] = useState(0.75)
  const [kind, setKind] = useState<'click' | 'gaze'>(() => {
    // The panel's "Gaze heatmap" opens it on where people looked (#vibe_heat=gaze); the hint leaves the address.
    return takeHint('heat', 'gaze') ? 'gaze' : 'click'
  })
  const [page, setPage] = useState(pageOf(window.location.pathname))
  const [device, setDevice] = useState<Device>(deviceOf(window.innerWidth))
  const [equal, setEqual] = useState(true)
  const [goodOnly, setGoodOnly] = useState(true)
  const [exposed, setExposed] = useState(false)
  const [ver, setVer] = useState<string | null>(null)
  const [vs, setVs] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [top, setTop] = useState(0)
  const [unplaced, setUnplaced] = useState(0)
  // Refreshes while the panel is open and the tab visible, so reviewers' clicks show as they happen.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const iv = window.setInterval(() => { if (document.visibilityState === 'visible') setTick((t) => t + 1) }, 10_000)
    return () => window.clearInterval(iv)
  }, [])
  const [invite, setInvite] = useState<Invite | null>(null)
  useEffect(() => { void defaultInvite(project).then(setInvite).catch(() => setInvite(null)) }, [project, tick])
  const [mine, setMine] = useState(() => !reviewerClicksOff(project))
  const [diff, setDiff] = useState(false)
  const [copied, setCopied] = useState(false)
  const key0 = useRef('')
  useEffect(() => {
    let live = true
    const k = `${project}|${page}|${study}|${kind}`
    if (key0.current !== k) { key0.current = k; setData(null) }
    setError('')
    const pts = server.rpc<{ studies: { id: string; name: string }[]; points: HeatPt[]; anchors?: Anchor[] }>('heatmap_points', { p_public_id: project, p_page: page, p_study: study || null, p_kind: kind })
    const sum = kind === 'click' ? server.rpc<unknown>('heatmap_summary', { p_public_id: project, p_page: page, p_study: study || null }).then(cleanSummary).catch(() => null) : Promise.resolve(null)
    Promise.all([pts, sum])
      .then(([d, summary]) => {
        if (!live) return
        // Our demo page keeps its labelled sample until real clicks exist.
        const real = (d.points ?? []).length > 0
        if (!real && onDemoPage() && kind === 'click') { setSample(true); setData({ studies: d.studies ?? [], points: samplePoints(), anchors: [], summary: null }); return }
        setSample(false)
        setData({ studies: d.studies ?? [], points: d.points ?? [], anchors: d.anchors ?? [], summary })
      })
      .catch((e: Error) => {
        if (!live) return
        if (onDemoPage() && kind === 'click') { setSample(true); setData({ studies: [], points: samplePoints(), anchors: [], summary: null }); return }
        setError(HEAT_ERRORS[e.message] ?? `The heatmap couldn’t load (${e.message}).`)
      })
    return () => { live = false }
  }, [project, page, study, kind, tick])
  // Versions: never mixed. The busiest version on this device is shown first; the reviewer can pick another.
  const versions = useMemo(() => {
    if (!data) return []
    if (data.summary?.groups.length) return versionsOf(data.summary, device)
    const m = new Map<string, Set<number>>()
    for (const p of data.points) if (device === 'all' || !p.dev || p.dev === device) { const k = p.ver ?? ''; const v = m.get(k) ?? new Set<number>(); v.add(p.p ?? 0); m.set(k, v) }
    return [...m].map(([v, ps]) => ({ ver: v, people: ps.size })).sort((a, b) => b.people - a.people)
  }, [data, device])
  const version = ver != null && versions.some((v) => v.ver === ver) ? ver : (versions[0]?.ver ?? '')
  const view = useMemo(() => (data?.summary ? viewOf(data.summary, device, version) : null), [data, device, version])
  const other = vs != null && vs !== version && versions.some((v) => v.ver === vs) ? vs : null
  const compared = useMemo(() => (view && other != null && data?.summary ? compareViews(view, viewOf(data.summary, device, other), [verName(version), verName(other)]) : []), [view, other, data, device, version])
  const prep = useMemo(() => (data ? prepare(data.points, { kind, device, equal, maxAcc: goodOnly ? 220 : null, version, anchors: data.anchors }) : null), [data, kind, device, equal, goodOnly, version])
  // Big studies: the server's bins of every click (in 1/80-width units), not the newest 20,000.
  const binned = kind === 'click' && !!view && (view.clicks > RAW_MAX || (data?.points.length ?? 0) >= RAW_MAX)
  useEffect(() => {
    if (!prep) return
    let raf = 0
    const draw = () => {
      const c = canvas.current
      if (!c) return
      const W = window.innerWidth, H = window.innerHeight
      const found = new Map<string, Element | null>()
      const resolve: Resolve = (sel) => {
        if (!found.has(sel)) { let el: Element | null = null; try { el = document.querySelector(sel) } catch { el = null } found.set(sel, el) }
        const el = found.get(sel)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return { left: r.left + window.scrollX, top: r.top + window.scrollY, width: r.width, height: r.height, tag: tagOfLabel(labelOf(el)) ?? undefined }
      }
      // Exposure: a click where only some people scrolled counts for the people who didn't get there.
      const weigh = (y: number, vw: number) => (exposed && view ? exposureWeight(view.reach(rowOf(y, vw)), view.reachedAt(rowOf(y, vw))) : 1)
      const vis = (x: number, y: number) => x > -100 && x < W + 100 && y > -100 && y < H + 100
      if (binned && view) {
        const pts = binsToPoints(view.bins, W, equal).map((p) => ({ x: p.x - window.scrollX, y: p.y - window.scrollY, w: p.w * weigh(p.y, W) })).filter((p) => vis(p.x, p.y))
        setUnplaced(0)
        setTop(drawHeat(c, pts, 1, prep.radius, opacity).top)
        return
      }
      if (kind === 'gaze') {
        let lost = 0
        const groups = prep.groups.map((g) => {
          const pl = place(g.pts.map((p) => ({ ...p, tag: tagOfLabel(p.label) })), resolve, W)
          lost += pl.unplaced
          return { h: g.h, points: pl.placed.map((p) => ({ x: p.px - window.scrollX, y: p.py - window.scrollY, w: p.w })).filter((p) => vis(p.x, p.y)) }
        })
        setUnplaced(lost)
        setTop(drawHeatGroups(c, groups, 1, opacity).top)
        return
      }
      const pl = place(prep.pts.map((p) => ({ ...p, tag: tagOfLabel(p.label) })), resolve, W)
      setUnplaced(pl.unplaced)
      const pts = pl.placed.map((p) => ({ x: p.px - window.scrollX, y: p.py - window.scrollY, w: p.w * weigh(p.py, W) })).filter((p) => vis(p.x, p.y))
      setTop(drawHeat(c, pts, 1, prep.radius, opacity).top)
    }
    let tm = 0
    const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw) }
    // Resizing re-lays out the page: wait until it settles.
    const resized = () => { window.clearTimeout(tm); tm = window.setTimeout(redraw, 150) }
    draw()
    window.addEventListener('scroll', redraw, true)
    window.addEventListener('resize', resized)
    const iv = window.setInterval(() => { if (pageOf(window.location.pathname) !== page) setPage(pageOf(window.location.pathname)) }, 500)
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', key)
    return () => { cancelAnimationFrame(raf); window.clearTimeout(tm); window.removeEventListener('scroll', redraw, true); window.removeEventListener('resize', resized); window.clearInterval(iv); window.removeEventListener('keydown', key) }
  }, [prep, opacity, page, onClose, kind, binned, view, equal, exposed])
  const n = data?.points.length ?? 0
  const units = binned && view ? view.clicks : prep?.units ?? 0
  const people = binned && view ? view.people : prep?.people ?? 0
  const rage = binned && view ? view.elements.reduce((a, e) => a + e.rage, 0) : prep?.pts.filter((p) => p.rage).length ?? 0
  const dead = binned && view ? view.elements.reduce((a, e) => a + e.dead, 0) : prep?.pts.filter((p) => p.dead).length ?? 0
  const corrected = prep?.drift.filter((d) => d.applied) ?? []
  const resid = corrected.length ? Math.round(corrected.map((d) => d.residual).sort((a, b) => a - b)[Math.floor(corrected.length / 2)]) : 0
  return (
    <>
      <canvas ref={canvas} className="vc-heat" aria-hidden />
      <div className="vc-panel vc-heatpanel" role="dialog" aria-label="Heatmap">
        <div className="vc-card-head"><b>Heatmap · {page}</b><span className="vc-grow" /><button className="vc-icon" onClick={onClose} aria-label="Close"><X size={14} /></button></div>
        {error ? <p className="vc-bad">{error}</p> : !data ? <p className="vc-empty">Loading…</p> : (
          <>
            {sample && <p className="vc-sample"><b>Sample data.</b> This is what a click heatmap looks like. Click around this page: your own clicks replace it within a few seconds.</p>}
            <div className="vc-seg"><button aria-pressed={kind === 'click'} onClick={() => setKind('click')}>Clicks</button><button aria-pressed={kind === 'gaze'} onClick={() => setKind('gaze')}>Where people looked</button></div>
            <p className="vc-muted" data-vc-heatkind="">{kind === 'click' ? 'Where people clicked or tapped. Fills automatically from your team and reviewers, and from visitors who press OK when the widget is open to everyone.' : 'Where people’s eyes rested, using their webcam (Labs). Only people who turn on eye tracking and calibrate (about 20 s). Video never leaves their browser.'}</p>
            <button type="button" className="vc-linkbtn" aria-expanded={diff} onClick={() => setDiff(!diff)}>What’s the difference?</button>
            {diff && (
              <table className="vc-table"><thead><tr><th /><th>Clicks</th><th>Where people looked</th></tr></thead><tbody>
                <tr><td>Data from</td><td>Your team, reviewers and invited people, automatically</td><td>Only people who turn on eye tracking in a study</td></tr>
                <tr><td>You learn</td><td>What people try to use</td><td>What people notice or read</td></tr>
                <tr><td>Needs</td><td>Nothing: just use the site</td><td>Their webcam, consent and a 20 s calibration</td></tr>
                <tr><td>Accuracy</td><td>Exact spot</td><td>Approximate (often 100–200 px): read areas</td></tr>
              </tbody></table>
            )}
            {kind === 'click' && (
              <div className="vc-invite">
                <div className="vc-row">
                  <button type="button" className="vc-btn primary" disabled={!invite?.token} onClick={() => { if (invite?.token && navigator.clipboard) void navigator.clipboard.writeText(inviteUrl(invite.token)).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000) }) }}>{copied ? 'Copied' : 'Copy invite link'}</button>
                  {invite?.token && <a className="vc-btn" href={`https://wa.me/?text=${encodeURIComponent(`Could you look around this site for a few minutes? It helps us improve it: ${inviteUrl(invite.token)}`)}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>}
                </div>
                <p className="vc-muted">{invite ? (invite.token ? `${invite.people} ${invite.people === 1 ? 'person' : 'people'} so far · people you invite agree first, then browse.` : invite.open ? 'The invite link is off (Research in your panel).' : 'The site heatmap is paused (Research in your panel).') : 'Invite link not available here.'} <a href={panelUrl('/app/research')} target="_blank" rel="noopener noreferrer">More options in your panel</a></p>
              </div>
            )}
            <div className="vc-seg" role="group" aria-label="Device">{(['all', 'desktop', 'tablet', 'mobile'] as Device[]).map((d) => <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d === 'all' ? 'All' : d[0].toUpperCase() + d.slice(1)}</button>)}</div>
            {versions.length > 1 && (
              <label className="vc-q">Site version (never mixed)
                <select value={version} onChange={(e) => setVer(e.target.value)}>{versions.map((v) => <option key={v.ver} value={v.ver}>{verName(v.ver)} · {v.people} {v.people === 1 ? 'person' : 'people'}</option>)}</select>
              </label>
            )}
            {!sample && !n && (
              <div className="vc-sample">
                <b>{kind === 'gaze' ? 'No eye tracking here yet.' : 'No clicks on this page yet.'}</b> {kind === 'gaze'
                  ? 'Eye tracking needs a study with eye tracking on (Labs): set it up in your panel.'
                  : 'Click around: your clicks and your reviewers’ show here within a few seconds. To get more, copy the invite link above and send it to a few people (5–10 is a good start).'}
              </div>
            )}
            <p className={`vc-sum ${units ? '' : 'bad'}`}>{units
              ? `${kind === 'click' && view && view.people > people ? `${people} of ${view.people} people clicked` : `${people} ${people === 1 ? 'person' : 'people'}`} · ${kind === 'gaze' ? `${units} fixation${units === 1 ? '' : 's'}` : `${units} click${units === 1 ? '' : 's'}`}${prep?.hidden ? ` · ${prep.hidden} with poor eye tracking left out` : ''}${binned ? ' · all clicks (server bins)' : n >= RAW_MAX ? ' (the latest 20,000 points)' : ''}`
              : n ? `Nothing on ${device === 'all' ? 'any device' : device} for this page${prep?.hidden ? ` (${prep.hidden} left out for poor eye tracking)` : ''}` : kind === 'gaze' ? 'No eye tracking on this page yet' : 'No clicks on this page yet'}{units && kind === 'click' ? ` · ${rage} rage · ${dead} on nothing clickable` : ''}</p>
            {unplaced > 0 && <p className="vc-muted"><TriangleAlert size={12} /> {unplaced} {kind === 'gaze' ? 'fixation' : 'click'}{unplaced === 1 ? '' : 's'} couldn’t be placed on this version of the page (their element isn’t here now), so {unplaced === 1 ? 'it is' : 'they are'} left off the map.</p>}
            {kind === 'gaze' && !!prep?.drift.length && <p className={corrected.length ? 'vc-sum' : 'vc-muted'}>{corrected.length ? `Drift-corrected with their own clicks: ${corrected.length} of ${prep.drift.length} ${prep.drift.length === 1 ? 'person' : 'people'} · error after ≈ ${resid} px` : 'Not drift-corrected (needs 5 clicks with gaze just before them)'} · each person drawn at their own accuracy</p>}
            <label className="vc-check"><input type="checkbox" checked={mine} onChange={(e) => { setMine(e.target.checked); setReviewerClicksOff(project, !e.target.checked) }} /> Record my clicks for this heatmap</label>
            <label className="vc-check"><input type="checkbox" checked={equal} onChange={(e) => setEqual(e.target.checked)} /> Each person counts the same</label>
            {kind === 'click' && view && view.depthPeople > 0 && <label className="vc-check"><input type="checkbox" checked={exposed} onChange={(e) => setExposed(e.target.checked)} /> Adjust for how many people saw it (scrolled that far)</label>}
            {kind === 'gaze' && <label className="vc-check"><input type="checkbox" checked={goodOnly} onChange={(e) => setGoodOnly(e.target.checked)} /> Leave out eye tracking calibrated worse than 220 px</label>}
            {data.studies.length > 0 && (
              <label className="vc-q">Study
                <select value={study} onChange={(e) => setStudy(e.target.value)}>
                  <option value="">All studies</option>
                  {data.studies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
            )}
            <label className="vc-q">Opacity <input type="range" min={0.2} max={1} step={0.05} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} /></label>
            {prep?.note && <p className="vc-bad">{prep.note}</p>}
            {!binned && !!prep?.capped && kind === 'click' && <p className="vc-muted">{prep.capped} repeated or excess clicks left out (at most 60 per person on a page).</p>}
            <div className="vc-legend" style={{ background: LEGEND }} aria-hidden /><div className="vc-row vc-muted"><span>few</span><span className="vc-grow" /><span>{kind === 'gaze' ? 'longest looked at' : top > 0 ? `≈ ${top < 10 ? top.toFixed(1) : Math.round(top)} ${equal ? 'people' : 'clicks'} per 50 px square${exposed ? ' (adjusted)' : ''}` : 'most clicks'}</span></div>
            {kind === 'click' && view && view.depthPeople > 0 && (
              <details className="vc-q"><summary>How far people scrolled ({view.depthPeople} people)</summary>
                <div className="vc-reach" role="img" aria-label="Share of people who reached each depth of the page">
                  {view.curve.map((c) => <div key={c.at} className="vc-reach-row"><span>{Math.round(c.at * 100)}%</span><i style={{ width: `${Math.round(c.share * 100)}%` }} /><b>{Math.round(c.share * 100)}%</b></div>)}
                </div>
                <p className="vc-muted">Left: depth of the page. Right: share of people who got at least that far.</p>
              </details>
            )}
            {kind === 'click' && view && view.elements.length > 0 && (
              <details className="vc-q" open><summary>Elements: who clicked, who saw them</summary>
                <table className="vc-table"><thead><tr><th>Element</th><th title="People who clicked it, of everyone on this page (95% interval)">Of people</th><th title="People who clicked it, of the people who saw it (95% interval)">Per view</th></tr></thead>
                  <tbody>{view.elements.slice(0, 10).map((e) => (
                    <tr key={e.sel} className={e.perView.ok ? '' : 'vc-faint'} title={e.perView.ok ? '' : `Seen by fewer than ${MIN_EXPOSURES} people: too few to trust`}>
                      <td>{e.label}{e.dead ? ` · ${e.dead} dead` : ''}</td><td>{fmtShare(e.people, view.people)}</td><td>{e.seen || e.people ? `${fmtShare(e.people, Math.max(e.seen, e.people))} of ${Math.max(e.seen, e.people)}` : '–'}</td>
                    </tr>))}</tbody></table>
                <p className="vc-muted">± is the 95% range: with few people it is wide. Greyed: seen by fewer than {MIN_EXPOSURES}.</p>
                {versions.length > 1 && (
                  <label className="vc-q">Compare with
                    <select value={other ?? ''} onChange={(e) => setVs(e.target.value || null)}><option value="">—</option>{versions.filter((v) => v.ver !== version).map((v) => <option key={v.ver} value={v.ver}>{verName(v.ver)}</option>)}</select>
                  </label>
                )}
                {compared.length > 0 && <ul className="vc-muted">{compared.map((c) => <li key={c.sel}><b>{c.label}:</b> {c.c.words}</li>)}</ul>}
              </details>
            )}
          </>
        )}
        <p className="vc-where">{kind === 'gaze' ? 'Labs: where people’s eyes rested (fixations), weighted by how long. Webcam eye tracking is approximate (often 100–200 px), and the map is never sharper than that: read areas, not exact spots.' : 'Where people clicked.'} From your team, invited reviewers and people who agreed through a link; never other visitors. Pages with ids share a map (/product/:id).</p>
      </div>
    </>
  )
}
