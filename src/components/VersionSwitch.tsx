import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { GripVertical, Moon, Sun, RotateCcw, MessageSquarePlus, MessagesSquare } from 'lucide-react'
import { COMMENT_EVENT } from '../tools/pins/ReviewPins'
import { getFlag, isConsole, isEmbedded, readJSON, setFlag, writeJSON } from '../tools/shared'
import { useStore } from '../store/store'
import { useTheme } from '../lib/theme'
import { Avatar, Modal } from './ui'

const POS_KEY = 'skillhouse.dock'

/** The same place in the other version, so switching never loses where you are. */
function counterpart(path: string, toV2: boolean): string {
  if (toV2) {
    if (path === '/skills/new') return '/v2/write'
    const edit = path.match(/^\/skills\/([^/]+)\/edit$/)
    if (edit) return `/v2/write/${edit[1]}`
    const skill = path.match(/^\/skills\/([^/]+)$/)
    if (skill) return `/v2/skills/${skill[1]}`
    if (path.startsWith('/skills')) return '/v2/shelf'
    if (path.startsWith('/pipeline')) return '/v2/review'
    return '/v2'
  }
  const skill = path.match(/^\/v2\/skills\/([^/]+)$/)
  if (skill) return `/skills/${skill[1]}`
  const write = path.match(/^\/v2\/write\/([^/]+)$/)
  if (write) return `/skills/${write[1]}/edit`
  if (path === '/v2/write') return '/skills/new'
  if (path.startsWith('/v2/shelf')) return '/skills'
  if (path.startsWith('/v2/review')) return '/pipeline'
  return '/'
}

/**
 * The floating dock: who you're viewing as, which version, theme and reset.
 * Drag it by its handle anywhere on screen; the spot is remembered.
 */
export function VersionSwitch() {
  const { pathname, search } = useLocation()
  const nav = useNavigate()
  const { me, members, dispatch, toast } = useStore()
  const [theme, toggleTheme] = useTheme()
  const [confirmReset, setConfirmReset] = useState(false)
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

  return (
    <>
      <div ref={ref} className="dock" style={{ left: pos.x, top: pos.y }} role="toolbar" aria-label="Demo controls" data-insights-ignore>
        <button className="dock-grip" onPointerDown={startDrag} onKeyDown={keyMove} aria-label="Move the dock (drag, or use arrow keys)" title="Drag to move"><GripVertical size={15} /></button>
        <label className="dock-user" title="Switch person to see permissions change">
          <Avatar member={me} />
          <span>
            <select aria-label="Viewing as" value={me.id} onChange={(e) => {
              dispatch({ type: 'setUser', id: e.target.value })
              const m = members.find((x) => x.id === e.target.value)!
              toast(`Now viewing as ${m.name} (${m.role})`)
            }}>
              {(['Admin', 'Maintainer', 'Member', 'Viewer'] as const).map((r) => (
                <optgroup key={r} label={r}>{members.filter((m) => m.role === r).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>
              ))}
            </select>
            <small>{me.role}</small>
          </span>
        </label>
        {!isConsole(pathname) && (
          <>
            <button className="dock-comment" onClick={() => comment('start')} title="Comment anywhere on the screen — or press C"><MessageSquarePlus size={15} /> Comment</button>
            <button className="dock-icon" onClick={() => comment('list')} aria-label="All comments" title="All comments"><MessagesSquare size={15} /></button>
          </>
        )}
        <div className="dock-seg" role="group" aria-label="App version">
          <button aria-pressed={!v2} onClick={() => v2 && nav(counterpart(pathname, false))}>v1 <span>Classic</span></button>
          <button aria-pressed={v2} onClick={() => !v2 && nav(counterpart(pathname, true))}>v2 <span>Shelf</span></button>
        </div>
        {!v2 && <button className="dock-icon" onClick={toggleTheme} aria-label="Toggle theme" title="Toggle theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>}
        <button className="dock-icon" onClick={() => setConfirmReset(true)} aria-label="Reset demo data" title="Reset demo data"><RotateCcw size={15} /></button>
      </div>
      {confirmReset && (
        <Modal
          title="Reset demo data?"
          description="Every change you made — new skills, approvals, roles, policies — goes back to the original seed. Comments, sessions and theme stay."
          onClose={() => setConfirmReset(false)}
          footer={<>
            <button className="btn" onClick={() => setConfirmReset(false)}>Keep my changes</button>
            <button className="btn primary" onClick={() => { dispatch({ type: 'reset' }); setConfirmReset(false); toast('Demo data reset') }}>Reset data</button>
          </>}
        />
      )}
    </>
  )
}
