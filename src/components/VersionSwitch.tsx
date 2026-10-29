import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GripVertical, Moon, Sun, MessageSquarePlus, MessagesSquare, FlaskConical, Mic } from 'lucide-react'
import { COMMENT_EVENT } from '../tools/pins/ReviewPins'
import { getFlag, isEmbedded, readJSON, setFlag, useFlag, writeJSON } from '../tools/shared'
import { SESSION_EVENT, endSession, sessionState } from '../tools/insights/tracker'
import { DESIGN_EVENT, loadDesign } from '../tools/design/tokens'
import { presetOf } from '../tools/design/presets'
import { ExplainButton, narrating } from '../tools/voice/Narrator'
import { NARRATE_EVENT, NARRATION_CHANGED } from '../tools/voice/narration'
import { useTheme } from '../lib/theme'

const POS_KEY = 'market.dock'

/**
 * The research dock — not part of the product: session, comments, design variant, theme and
 * the way into the research console. Drag it by its handle; the spot is remembered.
 */
export function VersionSwitch() {
  const { search } = useLocation()
  const nav = useNavigate()
  const [theme, toggleTheme] = useTheme()
  const ref = useRef<HTMLDivElement>(null)
  const recording = useFlag('insights')
  const [session, setSession] = useState(sessionState)
  const [design, setDesign] = useState(loadDesign)
  const [isNarrating, setNarrating] = useState(narrating)
  useEffect(() => {
    const sync = () => setNarrating(narrating())
    window.addEventListener(NARRATION_CHANGED, sync)
    return () => window.removeEventListener(NARRATION_CHANGED, sync)
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
        {!isNarrating && <button className="dock-icon" onClick={() => window.dispatchEvent(new CustomEvent(NARRATE_EVENT, { detail: 'start' }))} aria-label="Narrate a walkthrough" title="Narrate: record your voice while you go through the screens"><Mic size={15} /></button>}
        <ExplainButton />
        <button className="dock-comment" onClick={() => comment('start')} title="Comment anywhere on the screen — or press C"><MessageSquarePlus size={15} /> Comment</button>
        <button className="dock-icon" onClick={() => comment('list')} aria-label="All comments" title="All comments"><MessagesSquare size={15} /></button>
        <button className="dock-icon" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
        <button className="dock-icon" onClick={() => nav('/console/insights')} aria-label="Research console" title="Research console: sessions, heatmaps, usability tests"><FlaskConical size={15} /></button>
      </div>
    </>
  )
}
