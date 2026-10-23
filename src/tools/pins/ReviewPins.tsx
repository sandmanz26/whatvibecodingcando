import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { PenLine, X, Plus, List, Download, Upload, Trash2, EyeOff } from 'lucide-react'
import { APP, isConsole, isEmbedded, readJSON, useFlag, writeJSON } from '../shared'
import { fromTxt, MAX_NOTES, MAX_TEXT, pinTop, readingOrder, toTxt, txtFileName, type PinNote } from './format'
import { STATUS_TEXT, usePinSync } from './useSync'

const BUTTON_KEY = `${APP}.reviewPins.button`
const BTN = 40
const TAP_SLOP = 5

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

/** Pointer drag that treats < 5 px of travel as a tap. Works for mouse and touch. */
function dragHandlers(onMove: (e: PointerEvent) => void, onTap: () => void, onEnd?: () => void) {
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      const sx = e.clientX, sy = e.clientY
      let moved = false
      const move = (ev: PointerEvent) => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < TAP_SLOP) return
        moved = true
        onMove(ev)
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
        if (moved) onEnd?.()
        else onTap()
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
    },
  }
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** Floating review button — mounted app-wide, visible only when its flag is on. */
export function ReviewPins() {
  const on = useFlag('reviewPins')
  const { pathname } = useLocation()
  const [hidden, setHidden] = useState(false)
  if (!on || hidden || isConsole(pathname) || isEmbedded) return null
  return <Pins onHide={() => setHidden(true)} />
}

function Pins({ onHide }: { onHide: () => void }) {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const vp = useViewport()
  const [placing, setPlacing] = useState(false)
  const [menu, setMenu] = useState(false)
  const [list, setList] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pendingOpen, setPendingOpen] = useState<string | null>(null)
  const [, setScrollTick] = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const { notes, setNotes, status, scope } = usePinSync(placing || dragging || !!openId)

  const [btn, setBtn] = useState(() => readJSON(BUTTON_KEY, { x: window.innerWidth - BTN - 16, y: window.innerHeight - BTN - 96 }))
  const clamp = useCallback((p: { x: number; y: number }) => ({
    x: Math.min(Math.max(8, p.x), window.innerWidth - BTN - 8),
    y: Math.min(Math.max(8, p.y), window.innerHeight - BTN - 8),
  }), [])
  useEffect(() => setBtn((b: { x: number; y: number }) => clamp(b)), [vp, clamp])

  const ordered = useMemo(() => readingOrder(notes), [notes])
  const number = useMemo(() => new Map(ordered.map((n, i) => [n.id, i + 1])), [ordered])
  const onPage = ordered.filter((n) => n.page === pathname)
  const openNote = notes.find((n) => n.id === openId)

  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? null : x)), 2600) }
  const update = (id: string, patch: Partial<PinNote>) =>
    setNotes((all) => all.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)))
  const remove = (id: string) => setNotes((all) => all.filter((n) => n.id !== id))

  const closeCard = useCallback(() => {
    // A note left empty is dropped rather than kept as a blank pin.
    setNotes((all) => all.filter((n) => n.id !== openId || n.text.trim() !== ''))
    setOpenId(null)
  }, [openId, setNotes])

  // Esc closes whatever is open: card → list → menu → placing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirmAll) setConfirmAll(false)
      else if (openId) closeCard()
      else if (list) setList(false)
      else if (menu) setMenu(false)
      else if (placing) setPlacing(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmAll, openId, list, menu, placing, closeCard])

  // Keep the note card next to its pin while the page scrolls.
  useEffect(() => {
    if (!openId) return
    const on = () => setScrollTick((t) => t + 1)
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [openId])

  // After navigating from the list (or an import), scroll to the note and open it.
  useEffect(() => {
    if (!pendingOpen) return
    const n = notes.find((x) => x.id === pendingOpen)
    if (!n) { setPendingOpen(null); return }
    if (n.page !== pathname) return
    const t = window.setTimeout(() => {
      window.scrollTo({ top: Math.max(0, pinTop(n) - window.innerHeight / 3) })
      setOpenId(n.id)
      setPendingOpen(null)
    }, 60)
    return () => window.clearTimeout(t)
  }, [pendingOpen, pathname, notes])

  const goTo = (n: PinNote) => {
    setList(false)
    setMenu(false)
    if (n.page !== pathname) nav(n.page)
    setPendingOpen(n.id)
  }

  const place = (e: React.PointerEvent) => {
    e.preventDefault()
    if (notes.length >= MAX_NOTES) { setPlacing(false); return say(`Limit of ${MAX_NOTES} notes reached`) }
    const now = new Date().toISOString()
    const n: PinNote = {
      id: uid(), page: pathname,
      x: Math.round((e.clientX / window.innerWidth) * 1000) / 10,
      y: Math.round((e.clientY / window.innerHeight) * 1000) / 10,
      vw: window.innerWidth, vh: window.innerHeight, scrollY: Math.round(window.scrollY),
      text: '', createdAt: now, updatedAt: now,
    }
    setNotes((all) => [...all, n])
    setPlacing(false)
    setOpenId(n.id)
  }

  const exportTxt = () => {
    const url = URL.createObjectURL(new Blob([toTxt(notes)], { type: 'text/plain' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: txtFileName() })
    a.click()
    URL.revokeObjectURL(url)
    setMenu(false)
  }

  const importTxt = async (file: File) => {
    const incoming = fromTxt(await file.text())
    if (!incoming.length) return say('No notes found in that file')
    // Merge by id; the file wins, so opening the same file twice never duplicates.
    setNotes((all) => {
      const byId = new Map(all.map((n) => [n.id, n]))
      incoming.forEach((n) => byId.set(n.id, n))
      return [...byId.values()].slice(0, MAX_NOTES)
    })
    say(`Opened ${incoming.length} note${incoming.length === 1 ? '' : 's'}`)
    const pages = new Set(incoming.map((n) => n.page))
    if (pages.size === 1) { const p = [...pages][0]; if (p !== pathname) nav(p) }
    else setList(true)
  }

  // Menu opens away from the nearest screen edge.
  const right = btn.x + BTN / 2 > vp.w / 2
  const below = btn.y + BTN / 2 < vp.h / 2
  const menuStyle: React.CSSProperties = {
    ...(right ? { right: vp.w - btn.x - BTN } : { left: btn.x }),
    ...(below ? { top: btn.y + BTN + 8 } : { bottom: vp.h - btn.y + 8 }),
  }

  const card = (() => {
    if (!openNote) return null
    const px = (openNote.x / 100) * vp.w
    const py = pinTop(openNote) - window.scrollY
    const w = Math.min(320, vp.w - 24)
    const left = Math.min(Math.max(12, px - w / 2), vp.w - w - 12)
    const style: React.CSSProperties = py > vp.h / 2 ? { left, width: w, bottom: Math.max(12, vp.h - py + 20) } : { left, width: w, top: Math.min(vp.h - 200, py + 20) }
    return { style }
  })()

  return createPortal(
    <div className="rp-root" data-review-pins>
      {onPage.map((n) => (
        <button
          key={n.id}
          className={`rp-pin ${openId === n.id ? 'open' : ''}`}
          style={{ left: (n.x / 100) * vp.w, top: pinTop(n) }}
          aria-label={`Note ${number.get(n.id)}${n.text ? `: ${n.text.slice(0, 40)}` : ''}`}
          {...dragHandlers(
            (e) => { setDragging(true); update(n.id, { x: Math.round((e.clientX / window.innerWidth) * 1000) / 10, y: Math.round((e.clientY / window.innerHeight) * 1000) / 10, vw: window.innerWidth, vh: window.innerHeight, scrollY: Math.round(window.scrollY) }) },
            () => { setMenu(false); setOpenId(n.id) },
            () => setDragging(false),
          )}
        >
          {number.get(n.id)}
        </button>
      ))}

      {placing && (
        <div className="rp-placing" onPointerDown={place}>
          <span className="rp-hint">Tap where the note goes</span>
        </div>
      )}

      <button
        className={`rp-fab ${placing ? 'placing' : ''}`}
        style={{ left: btn.x, top: btn.y }}
        aria-label={placing ? 'Cancel placing a note' : 'Review notes'}
        aria-expanded={menu}
        {...dragHandlers(
          (e) => setBtn(clamp({ x: e.clientX - BTN / 2, y: e.clientY - BTN / 2 })),
          () => { if (placing) setPlacing(false); else { setOpenId(null); setList(false); setMenu((m) => !m) } },
          () => setBtn((b: { x: number; y: number }) => { writeJSON(BUTTON_KEY, b); return b }),
        )}
      >
        {placing ? <X size={18} /> : <PenLine size={17} />}
        {!placing && onPage.length > 0 && <span className="rp-badge">{onPage.length}</span>}
      </button>

      {menu && (
        <div className="rp-menu" style={menuStyle} role="menu">
          <button role="menuitem" onClick={() => { setMenu(false); setPlacing(true) }}><Plus size={15} /> Add a note</button>
          <button role="menuitem" onClick={() => { setMenu(false); setList(true) }}><List size={15} /> All notes ({notes.length})</button>
          <button role="menuitem" onClick={exportTxt} disabled={!notes.length}><Download size={15} /> Save to .txt</button>
          <button role="menuitem" onClick={() => fileRef.current?.click()}><Upload size={15} /> Open a .txt</button>
          <button role="menuitem" className="danger" onClick={() => { setMenu(false); setConfirmAll(true) }} disabled={!notes.length}><Trash2 size={15} /> Delete all notes</button>
          <button role="menuitem" onClick={onHide}><EyeOff size={15} /> Hide until reload</button>
          <div className={`rp-status ${status}`}>
            <span>{STATUS_TEXT[status]}</span>
            {status === 'synced' && <small>{scope}</small>}
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; setMenu(false); if (f) void importTxt(f) }} />

      {openNote && card && (
        <div className="rp-card" style={card.style} role="dialog" aria-label={`Note ${number.get(openNote.id)}`}>
          <div className="rp-card-head">
            <b>Note {number.get(openNote.id)}</b>
            <span className="mono">{openNote.page}</span>
          </div>
          <textarea
            autoFocus
            rows={4}
            maxLength={MAX_TEXT}
            placeholder="What should change here?"
            value={openNote.text}
            onChange={(e) => update(openNote.id, { text: e.target.value })}
            aria-label="Note text"
          />
          <div className="rp-card-foot">
            <button className="btn sm danger" onClick={() => { remove(openNote.id); setOpenId(null) }}><Trash2 size={13} /> Delete</button>
            <button className="btn sm primary" onClick={closeCard}>Close</button>
          </div>
        </div>
      )}

      {list && (
        <div className="rp-sheet" role="dialog" aria-label="All notes">
          <div className="rp-sheet-head">
            <b>All notes</b>
            <span className="muted">{notes.length}</span>
            <button className="btn ghost sm icon" style={{ marginLeft: 'auto' }} onClick={() => setList(false)} aria-label="Close list"><X size={15} /></button>
          </div>
          {ordered.length === 0 && <p className="muted" style={{ padding: '18px 16px', fontSize: 13 }}>No notes yet. Use “Add a note” to drop the first one.</p>}
          <ol>
            {ordered.map((n) => (
              <li key={n.id}>
                <button onClick={() => goTo(n)}>
                  <span className="rp-num">{number.get(n.id)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="mono muted" style={{ fontSize: 11.5 }}>{n.page}</span>
                    <span className="rp-text">{n.text || 'Empty note'}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {confirmAll && (
        <div className="rp-confirm" role="alertdialog" aria-label="Delete all notes">
          <b>Delete all {notes.length} note{notes.length === 1 ? '' : 's'}?</b>
          <p>This removes them for everyone on this deployment{status === 'local' || status === 'error' ? ' (here: this browser)' : ''}. It can’t be undone — save a .txt first if you might need them.</p>
          <div className="rp-card-foot">
            <button className="btn sm" onClick={() => setConfirmAll(false)}>Keep notes</button>
            <button className="btn sm danger" onClick={() => { setNotes([]); setConfirmAll(false); say('All notes deleted') }}>Delete {notes.length}</button>
          </div>
        </div>
      )}

      {toast && <div className="rp-toast" role="status">{toast}</div>}
    </div>,
    document.body,
  )
}
