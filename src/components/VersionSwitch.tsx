import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GripVertical, Moon, Sun, MessageSquarePlus, MessagesSquare, FlaskConical } from 'lucide-react'
import { COMMENT_EVENT } from '../tools/pins/ReviewPins'
import { getFlag, isConsole, isEmbedded, readJSON, setFlag, writeJSON } from '../tools/shared'
import { useTheme } from '../lib/theme'

const POS_KEY = 'skillhouse.dock'

/** The same place in the other version, so switching never loses where you are. */
function counterpart(path: string, toV2: boolean): string {
  if (toV2) {
    const m = path.match(/^\/(skills|projects)\/([^/]+)$/)
    if (m) return `/v2/${m[1]}/${m[2]}`
    if (path.startsWith('/projects')) return '/v2/projects'
    if (path.startsWith('/health')) return '/v2/tidy'
    if (path.startsWith('/skills') || path.startsWith('/teams')) return '/v2/shelf'
    return '/v2'
  }
  const m = path.match(/^\/v2\/(skills|projects)\/([^/]+)$/)
  if (m) return `/${m[1]}/${m[2]}`
  if (path.startsWith('/v2/projects')) return '/projects'
  if (path.startsWith('/v2/tidy')) return '/health'
  if (path.startsWith('/v2/shelf')) return '/teams'
  return '/'
}

/**
 * The research dock — not part of the product: comments, version switch, theme and
 * the way into the research console. Drag it by its handle; the spot is remembered.
 */
export function VersionSwitch() {
  const { pathname, search } = useLocation()
  const nav = useNavigate()
  const [theme, toggleTheme] = useTheme()
  const ref = useRef<HTMLDivElement>(null)
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
  const v2 = pathname === '/v2' || pathname.startsWith('/v2/')
  const research = isConsole(pathname)

  return (
    <>
      <div ref={ref} className="dock" style={{ left: pos.x, top: pos.y }} role="toolbar" aria-label="Research tools" data-insights-ignore>
        <button className="dock-grip" onPointerDown={startDrag} onKeyDown={keyMove} aria-label="Move the dock (drag, or use arrow keys)" title="Drag to move"><GripVertical size={15} /></button>
        <button className="dock-comment" onClick={() => comment('start')} title="Comment anywhere on the screen — or press C"><MessageSquarePlus size={15} /> Comment</button>
        <button className="dock-icon" onClick={() => comment('list')} aria-label="All comments" title="All comments"><MessagesSquare size={15} /></button>
        <div className="dock-seg" role="group" aria-label="App version">
          <button aria-pressed={!v2 && !research} onClick={() => (v2 || research) && nav(counterpart(pathname, false))}>v1 <span>Classic</span></button>
          <button aria-pressed={v2} onClick={() => !v2 && nav(counterpart(pathname, true))}>v2 <span>Shelf</span></button>
        </div>
        {!v2 && <button className="dock-icon" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>}
        <button className="dock-icon" onClick={() => nav('/console/insights')} aria-label="Research console" title="Research console: sessions, heatmaps, usability tests"><FlaskConical size={15} /></button>
      </div>
    </>
  )
}
