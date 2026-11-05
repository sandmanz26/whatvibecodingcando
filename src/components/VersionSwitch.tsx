import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GripVertical, MessageSquarePlus, MessagesSquare, Columns2, Palette, ScanSearch, MousePointerClick, Flame, GitBranch } from 'lucide-react'
import { COMMENT_EVENT } from '../tools/pins/ReviewPins'
import { getFlag, isEmbedded, readJSON, setFlag, useFlag, writeJSON } from '../tools/shared'
import { SESSION_EVENT, endSession, sessionState } from '../tools/insights/tracker'
import { DESIGN_EVENT, loadDesign } from '../tools/design/tokens'
import { presetOf } from '../tools/design/presets'
import { INSPECT_EVENT, INSPECT_STATE } from '../tools/inspect/Inspector'
import { LATEST, VERSIONS, setVersion, useVersion, versionOf } from '../lib/version'
import { useStore } from '../store/store'

const POS_KEY = 'market.dock'

/**
 * The research dock, not part of the product: comments, the shop's versions, and the tools
 * shown to visitors (compare components, design tokens, inspect, sessions, heatmap). Other
 * research pages are reached by their URL (#/console/…). Drag it by its handle; the spot is remembered.
 */
export function VersionSwitch() {
  const { search } = useLocation()
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const recording = useFlag('insights')
  const [session, setSession] = useState(sessionState)
  const [design, setDesign] = useState(loadDesign)
  const [inspecting, setInspecting] = useState(false)
  useEffect(() => {
    const sync = (e: Event) => setInspecting(!!(e as CustomEvent<boolean>).detail)
    window.addEventListener(INSPECT_STATE, sync)
    return () => window.removeEventListener(INSPECT_STATE, sync)
  }, [])
  useEffect(() => {
    const sync = () => setDesign(loadDesign())
    window.addEventListener(DESIGN_EVENT, sync)
    return () => window.removeEventListener(DESIGN_EVENT, sync)
  }, [])
  useEffect(() => {
    const sync = () => setSession(sessionState())
    window.addEventListener(SESSION_EVENT, sync)
    // The tracker may have started a session before this listener existed.
    sync()
    return () => window.removeEventListener(SESSION_EVENT, sync)
  }, [])
  const [pos, setPos] = useState<{ x: number; y: number }>(() => readJSON(POS_KEY, { x: 16, y: window.innerHeight - (window.innerWidth <= 860 ? 140 : 72) }))

  const clamp = useCallback((p: { x: number; y: number }) => {
    const w = ref.current?.offsetWidth ?? 360, h = ref.current?.offsetHeight ?? 52
    return { x: Math.min(Math.max(8, p.x), window.innerWidth - w - 8), y: Math.min(Math.max(8, p.y), window.innerHeight - h - 8) }
  }, [])
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p))
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clamp])

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    const ox = e.clientX - pos.x, oy = e.clientY - pos.y
    let last = pos
    const move = (ev: PointerEvent) => { last = clamp({ x: ev.clientX - ox, y: ev.clientY - oy }); setPos(last) }
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); writeJSON(POS_KEY, last) }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }
  // Keyboard users move it with the arrow keys on the handle.
  const keyMove = (e: React.KeyboardEvent) => {
    const d = e.shiftKey ? 40 : 10
    const delta = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] }[e.key]
    if (!delta) return
    e.preventDefault()
    const next = clamp({ x: pos.x + delta[0], y: pos.y + delta[1] })
    setPos(next); writeJSON(POS_KEY, next)
  }

  // Comments may have been switched off in this browser earlier; the button turns them back on.
  const comment = (what: 'start' | 'list') => {
    const fire = () => window.dispatchEvent(new CustomEvent(COMMENT_EVENT, { detail: what }))
    if (getFlag('reviewPins')) fire()
    else { setFlag('reviewPins', true); window.setTimeout(fire, 80) }
  }

  if (isEmbedded || new URLSearchParams(search).has('heatmap')) return null

  return (
    <>
      <div ref={ref} className="dock" style={{ left: pos.x, top: pos.y }} role="toolbar" aria-label="Research tools" data-insights-ignore>
        <button className="dock-grip" onPointerDown={startDrag} onKeyDown={keyMove} aria-label="Move the dock (drag, or use arrow keys)" title="Drag to move"><GripVertical size={15} /></button>
        {recording && (session === 'active'
          ? <button className="dock-rec on" onClick={() => endSession('ended')} title="Recording this session. End it here; the next one starts on the main page."><i /> End session</button>
          : <span className="dock-rec" title="Recording is on. A session starts counting when the main page opens."><i /> Starts on home</span>)}
        {design && <button className="dock-rec" onClick={() => nav('/console/design')} title="A simulated design is on in this browser">{presetOf(design.preset).name}</button>}
        <button className="dock-comment" onClick={() => comment('start')} title="Comment anywhere on the screen — or press C"><MessageSquarePlus size={15} /> Comment</button>
        <button className="dock-icon" onClick={() => comment('list')} aria-label="All comments" title="All comments"><MessagesSquare size={15} /></button>
        <VersionMenu />
        <span className="dock-sep" aria-hidden />
        <button className="dock-icon" onClick={() => nav('/console/compare')} aria-label="Compare components" title="Compare two components side by side"><Columns2 size={15} /></button>
        <button className="dock-icon" onClick={() => nav('/console/design')} aria-label="Design tokens" title="Design tokens: try, upload and compare"><Palette size={15} /></button>
        <button className={`dock-icon ${inspecting ? 'on' : ''}`} onClick={() => window.dispatchEvent(new Event(INSPECT_EVENT))} aria-label="Inspect styles" aria-pressed={inspecting} title="Inspect: hover anything to see its colours, font and whether they are design tokens (I)"><ScanSearch size={15} /></button>
        <button className="dock-icon" onClick={() => nav('/console/sessions')} aria-label="Sessions" title="Sessions: what each person tapped, in order"><MousePointerClick size={15} /></button>
        <button className="dock-icon" onClick={() => nav('/console/heatmap')} aria-label="Heatmap" title="Heatmap: where people tap on each screen"><Flame size={15} /></button>
      </div>
    </>
  )
}

/** Switch the shop between its released versions, with what each one added. */
function VersionMenu() {
  const version = useVersion()
  const { toast } = useStore()
  const [open, setOpen] = useState(false)
  const [down, setDown] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const out = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('pointerdown', out)
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('pointerdown', out); window.removeEventListener('keydown', key) }
  }, [open])
  const pick = (id: string) => {
    setOpen(false)
    if (id === version) return
    setVersion(id)
    const v = versionOf(id)
    toast(`Now on v${v.id} · ${v.name}`)
  }
  return (
    <div className="dock-ver" ref={box}>
      <button className={`dock-verbtn ${open ? 'on' : ''}`} onClick={() => { setDown((box.current?.getBoundingClientRect().top ?? 999) < 380); setOpen((o) => !o) }} aria-haspopup="menu" aria-expanded={open} title="Switch the shop between its versions">
        <GitBranch size={14} /> v{version}
      </button>
      {open && (
        <div className={`dock-vermenu ${down ? 'down' : ''}`} role="menu" aria-label="Versions">
          <div className="dock-verhead"><b>Versions</b><span>Each release turns features on. Switch to see the shop as it was.</span></div>
          {[...VERSIONS].reverse().map((v) => (
            <button key={v.id} role="menuitemradio" aria-checked={v.id === version} className={v.id === version ? 'on' : ''} onClick={() => pick(v.id)}>
              <span className="dock-verrow"><b>v{v.id}</b><span>{v.name}</span>{v.id === LATEST && <em>Latest</em>}<small>{v.date}</small></span>
              {v.adds.length ? v.adds.map((a) => <span key={a.feature} className="dock-veradd">+ {a.text}</span>) : <span className="dock-veradd muted">The first release</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
