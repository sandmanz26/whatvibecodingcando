import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { MessageSquarePlus, MessageSquare, X, List, Download, Upload, Trash2, EyeOff, Check, RotateCcw, Send } from 'lucide-react'
import { APP, TOOL_DOM, isConsole, isEmbedded, readJSON, useFlag, writeJSON } from '../shared'
import { describeTarget } from '../insights/tracker'
import { useStore } from '../../store/store'
import { fromTxt, MAX_NOTES, MAX_TEXT, pinTop, toTxt, txtFileName, type PinNote } from './format'
import { STATUS_TEXT, usePinSync } from './useSync'

const BUTTON_KEY = `${APP}.reviewPins.button`
/** Fire with detail 'start' (comment mode) or 'list' (open the list) from anywhere in the app. */
export const COMMENT_EVENT = 'skillhouse:comments'
const BTN = 44
const TAP_SLOP = 5
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

function firstVisible(sel: string): Element | null {
  try {
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest(TOOL_DOM)) continue
      const r = el.getBoundingClientRect()
      if (r.width > 0 && r.height > 0) return el
    }
  } catch { /* selector from another version of the app */ }
  return null
}

/** Where a comment sits in the document: on its element when it can be found, else where it was placed. */
function anchor(n: PinNote, vw: number) {
  if (n.sel) {
    const el = firstVisible(n.sel)
    if (el) {
      const r = el.getBoundingClientRect()
      return { x: r.left + window.scrollX + ((n.ex ?? 50) / 100) * r.width, y: r.top + window.scrollY + ((n.ey ?? 50) / 100) * r.height, el, found: true }
    }
  }
  return { x: (n.x / 100) * vw, y: pinTop(n), el: null, found: !n.sel }
}

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`
}

/** Pointer drag that treats < 5 px of travel as a tap. */
function dragHandlers(onMove: (e: PointerEvent) => void, onTap: () => void, onEnd?: () => void) {
  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.preventDefault()
      const sx = e.clientX, sy = e.clientY
      let moved = false
      const move = (ev: PointerEvent) => { if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < TAP_SLOP) return; moved = true; onMove(ev) }
      const up = () => {
        window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
        if (moved) onEnd?.(); else onTap()
      }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
    },
  }
}

/** Comments on any screen and any element — mounted app-wide. */
export function ReviewPins() {
  const on = useFlag('reviewPins')
  const { pathname } = useLocation()
  const [hidden, setHidden] = useState(false)
  if (!on || hidden || isConsole(pathname) || isEmbedded) return null
  return <Comments onHide={() => setHidden(true)} />
}

function Comments({ onHide }: { onHide: () => void }) {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const { me } = useStore()
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [, setTick] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [hover, setHover] = useState<DOMRect | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [list, setList] = useState<'open' | 'resolved' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [confirmAll, setConfirmAll] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { notes, setNotes, status, scope } = usePinSync(placing || !!openId)

  const [btn, setBtn] = useState(() => readJSON(BUTTON_KEY, { x: window.innerWidth - BTN - 20, y: window.innerHeight - BTN - 88 }))
  const clamp = useCallback((p: { x: number; y: number }) => ({ x: Math.min(Math.max(8, p.x), window.innerWidth - BTN - 8), y: Math.min(Math.max(8, p.y), window.innerHeight - BTN - 8) }), [])

  // Layout moves under the comments (data loads, panels open): re-measure anchors.
  useEffect(() => {
    const onResize = () => { setVp({ w: window.innerWidth, h: window.innerHeight }); setBtn((b: { x: number; y: number }) => clamp(b)) }
    const onScroll = () => setTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onScroll, { passive: true })
    const t = window.setInterval(() => setTick((x) => x + 1), 1000)
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('scroll', onScroll); window.clearInterval(t) }
  }, [clamp])

  const ordered = useMemo(() => [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [notes])
  const number = useMemo(() => new Map(ordered.map((n, i) => [n.id, i + 1])), [ordered])
  const here = ordered.filter((n) => n.page === pathname && !n.resolved)
  const open = notes.find((n) => n.id === openId)
  const openCount = notes.filter((n) => !n.resolved).length

  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? null : x)), 2600) }
  const update = (id: string, patch: Partial<PinNote>) => setNotes((all) => all.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)))

  const closeCard = useCallback(() => {
    // A comment left empty with no replies is dropped rather than kept as a blank pin.
    setNotes((all) => all.filter((n) => n.id !== openId || n.text.trim() !== '' || (n.replies?.length ?? 0) > 0))
    setOpenId(null)
    setReply('')
  }, [openId, setNotes])

  // Comment mode: outline what's under the pointer; a click pins the comment to that element.
  useEffect(() => {
    if (!placing) return
    document.documentElement.dataset.commenting = 'on'
    const over = (e: MouseEvent) => {
      const t = e.target as Element
      if (!(t instanceof Element) || t.closest(TOOL_DOM)) { setHover(null); return }
      setHover(describeTarget(t).el.getBoundingClientRect())
    }
    const click = (e: MouseEvent) => {
      const t = e.target as Element
      if (!(t instanceof Element) || t.closest(TOOL_DOM)) return
      e.preventDefault()
      e.stopPropagation()
      if (notes.length >= MAX_NOTES) { setPlacing(false); return say(`Limit of ${MAX_NOTES} comments reached`) }
      const { el, sel, label } = describeTarget(t)
      const r = el.getBoundingClientRect()
      const now = new Date().toISOString()
      const n: PinNote = {
        id: uid(), page: pathname,
        x: Math.round((e.clientX / window.innerWidth) * 1000) / 10, y: Math.round((e.clientY / window.innerHeight) * 1000) / 10,
        vw: window.innerWidth, vh: window.innerHeight, scrollY: Math.round(window.scrollY),
        text: '', createdAt: now, updatedAt: now, sel, label: label.slice(0, 120), author: me.name,
        ex: Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * 1000) / 10, ey: Math.round(((e.clientY - r.top) / Math.max(1, r.height)) * 1000) / 10,
      }
      setNotes((all) => [...all, n])
      setPlacing(false)
      setHover(null)
      setOpenId(n.id)
    }
    document.addEventListener('mousemove', over, true)
    document.addEventListener('click', click, true)
    return () => {
      delete document.documentElement.dataset.commenting
      document.removeEventListener('mousemove', over, true)
      document.removeEventListener('click', click, true)
    }
  }, [placing, pathname, me.name, notes.length, setNotes])

  // Other entry points: the dock's Comment button and list (a window event), and the C key.
  useEffect(() => {
    const onEvent = (e: Event) => {
      const what = (e as CustomEvent<'start' | 'list'>).detail
      setMenu(false); setOpenId(null)
      if (what === 'list') setList('open')
      else { setList(null); setPlacing(true) }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'c' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      setMenu(false); setList(null); setOpenId(null); setPlacing(true)
    }
    window.addEventListener(COMMENT_EVENT, onEvent)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener(COMMENT_EVENT, onEvent); window.removeEventListener('keydown', onKey) }
  }, [])

  // Esc closes whatever is open: confirm → card → list → menu → comment mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (confirmAll) setConfirmAll(false)
      else if (openId) closeCard()
      else if (list) setList(null)
      else if (menu) setMenu(false)
      else if (placing) { setPlacing(false); setHover(null) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmAll, openId, list, menu, placing, closeCard])

  // From the list: go to the page, scroll the element into view, ring it, open the thread.
  useEffect(() => {
    if (!pending) return
    const n = notes.find((x) => x.id === pending)
    if (!n) { setPending(null); return }
    if (n.page !== pathname) return
    const t = window.setTimeout(() => {
      const a = anchor(n, window.innerWidth)
      window.scrollTo({ top: Math.max(0, a.y - window.innerHeight / 3), behavior: 'smooth' })
      setFlash(n.id)
      window.setTimeout(() => setFlash(null), 1800)
      setOpenId(n.id)
      setPending(null)
    }, 250)
    return () => window.clearTimeout(t)
  }, [pending, pathname, notes])

  const goTo = (n: PinNote) => {
    setList(null)
    setMenu(false)
    if (n.page !== pathname) nav(n.page)
    setPending(n.id)
  }

  const exportTxt = () => {
    const url = URL.createObjectURL(new Blob([toTxt(notes)], { type: 'text/plain' }))
    Object.assign(document.createElement('a'), { href: url, download: txtFileName() }).click()
    URL.revokeObjectURL(url)
    setMenu(false)
  }
  const importTxt = async (file: File) => {
    const incoming = fromTxt(await file.text())
    if (!incoming.length) return say('No comments found in that file')
    setNotes((all) => {
      const byId = new Map(all.map((n) => [n.id, n]))
      incoming.forEach((n) => byId.set(n.id, n))
      return [...byId.values()].slice(0, MAX_NOTES)
    })
    say(`Opened ${incoming.length} comment${incoming.length === 1 ? '' : 's'}`)
    setList('open')
  }

  const sendReply = () => {
    if (!open || !reply.trim()) return
    update(open.id, { replies: [...(open.replies ?? []), { id: uid(), author: me.name, text: reply.trim().slice(0, MAX_TEXT), at: new Date().toISOString() }] })
    setReply('')
  }

  const right = btn.x + BTN / 2 > vp.w / 2
  const below = btn.y + BTN / 2 < vp.h / 2
  const menuStyle: React.CSSProperties = { ...(right ? { right: vp.w - btn.x - BTN } : { left: btn.x }), ...(below ? { top: btn.y + BTN + 8 } : { bottom: vp.h - btn.y + 8 }) }

  const flashEl = flash ? notes.find((n) => n.id === flash) : undefined
  const flashRect = flashEl?.sel ? firstVisible(flashEl.sel)?.getBoundingClientRect() : undefined

  const card = (() => {
    if (!open) return null
    const a = anchor(open, vp.w)
    const py = a.y - window.scrollY
    const w = Math.min(340, vp.w - 24)
    const left = Math.min(Math.max(12, a.x - window.scrollX - w / 2), vp.w - w - 12)
    return py > vp.h / 2 ? { left, width: w, bottom: Math.max(12, vp.h - py + 22) } : { left, width: w, top: Math.max(12, Math.min(vp.h - 320, py + 22)) }
  })()

  const mine = (n: PinNote) => !n.author || n.author === me.name

  return createPortal(
    <div className="rp-root" data-review-pins>
      {here.map((n) => {
        const a = anchor(n, vp.w)
        return (
          <button key={n.id} className={`rp-pin ${openId === n.id ? 'open' : ''} ${a.found ? '' : 'lost'}`} style={{ left: a.x, top: a.y }}
            title={a.found ? n.label : `${n.label ?? 'Element'} isn’t on this layout any more`}
            aria-label={`Comment ${number.get(n.id)}${n.text ? `: ${n.text.slice(0, 40)}` : ''}`}
            onClick={() => { setMenu(false); setList(null); setOpenId(n.id) }}>
            {number.get(n.id)}
            {(n.replies?.length ?? 0) > 0 && <span className="rp-replies">{n.replies!.length}</span>}
          </button>
        )
      })}

      {placing && (
        <>
          <span className="rp-hint">Click the thing you want to comment on · Esc to cancel</span>
          {hover && <div className="rp-outline" style={{ left: hover.left - 3, top: hover.top - 3, width: hover.width + 6, height: hover.height + 6 }} />}
        </>
      )}
      {flashRect && <div className="rp-outline flash" style={{ left: flashRect.left - 4, top: flashRect.top - 4, width: flashRect.width + 8, height: flashRect.height + 8 }} />}

      <button
        className={`rp-fab ${placing ? 'placing' : ''}`}
        style={{ left: btn.x, top: btn.y }}
        aria-label={placing ? 'Stop commenting' : 'Comment on something (C)'}
        title={placing ? 'Stop commenting (Esc)' : 'Comment on something — or press C'}
        {...dragHandlers(
          (e) => setBtn(clamp({ x: e.clientX - BTN / 2, y: e.clientY - BTN / 2 })),
          // One click starts commenting; the ⋯ button beside it holds everything else.
          () => { setMenu(false); setOpenId(null); setList(null); if (placing) { setPlacing(false); setHover(null) } else setPlacing(true) },
          () => setBtn((b: { x: number; y: number }) => { writeJSON(BUTTON_KEY, b); return b }),
        )}
      >
        {placing ? <X size={18} /> : <MessageSquare size={18} />}
        {!placing && here.length > 0 && <span className="rp-badge">{here.length}</span>}
      </button>
      {!placing && (
        <button className="rp-more" style={{ left: Math.max(4, btn.x - 30), top: btn.y + BTN / 2 - 13 }} aria-label="More comment options" aria-expanded={menu}
          title="All comments, export, import" onClick={() => { setOpenId(null); setList(null); setMenu((m) => !m) }}>⋯</button>
      )}

      {menu && (
        <div className="rp-menu" style={menuStyle} role="menu">
          <button role="menuitem" onClick={() => { setMenu(false); setPlacing(true) }}><MessageSquarePlus size={15} /> Comment on something</button>
          <button role="menuitem" onClick={() => { setMenu(false); setList('open') }}><List size={15} /> All comments ({openCount} open)</button>
          <button role="menuitem" onClick={exportTxt} disabled={!notes.length}><Download size={15} /> Save to .txt</button>
          <button role="menuitem" onClick={() => fileRef.current?.click()}><Upload size={15} /> Open a .txt</button>
          <button role="menuitem" className="danger" onClick={() => { setMenu(false); setConfirmAll(true) }} disabled={!notes.length}><Trash2 size={15} /> Delete all comments</button>
          <button role="menuitem" onClick={onHide}><EyeOff size={15} /> Hide until reload</button>
          <div className={`rp-status ${status}`}><span>{STATUS_TEXT[status]}</span>{status === 'synced' && <small>{scope}</small>}</div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; setMenu(false); if (f) void importTxt(f) }} />

      {open && card && (
        <div className="rp-card" style={card} role="dialog" aria-label={`Comment ${number.get(open.id)}`}>
          <div className="rp-card-head">
            <b>Comment {number.get(open.id)}</b>
            <span>on {open.label ? `“${open.label}”` : 'this spot'} · <span className="mono">{open.page}</span></span>
          </div>
          {mine(open) && !(open.replies?.length) ? (
            <textarea autoFocus rows={3} maxLength={MAX_TEXT} placeholder="What should change here?" value={open.text} onChange={(e) => update(open.id, { text: e.target.value })} aria-label="Comment" />
          ) : (
            <div className="rp-msg"><b>{open.author ?? 'Someone'}</b> <span>{ago(open.createdAt)}</span><p>{open.text || '—'}</p></div>
          )}
          {(open.replies ?? []).map((r) => (
            <div key={r.id} className="rp-msg reply"><b>{r.author}</b> <span>{ago(r.at)}</span><p>{r.text}</p></div>
          ))}
          {(open.text.trim() || (open.replies?.length ?? 0) > 0) && (
            <form className="rp-reply" onSubmit={(e) => { e.preventDefault(); sendReply() }}>
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Reply as ${me.name.split(' ')[0]}`} aria-label="Reply" />
              <button type="submit" className="btn sm icon" aria-label="Send reply" disabled={!reply.trim()}><Send size={13} /></button>
            </form>
          )}
          <div className="rp-card-foot">
            <button className="btn sm ghost danger" onClick={() => { setNotes((all) => all.filter((n) => n.id !== open.id)); setOpenId(null) }}><Trash2 size={13} /> Delete</button>
            <span style={{ display: 'flex', gap: 6 }}>
              {(open.text.trim() || (open.replies?.length ?? 0) > 0) && (
                <button className="btn sm" onClick={() => { update(open.id, { resolved: !open.resolved }); say(open.resolved ? 'Reopened' : 'Resolved — find it under Resolved in the list'); setOpenId(null) }}>
                  {open.resolved ? <><RotateCcw size={13} /> Reopen</> : <><Check size={13} /> Resolve</>}
                </button>
              )}
              <button className="btn sm primary" onClick={closeCard}>Close</button>
            </span>
          </div>
        </div>
      )}

      {list && (
        <div className="rp-sheet" role="dialog" aria-label="All comments">
          <div className="rp-sheet-head">
            <b>Comments</b>
            <div className="seg" role="group" aria-label="Show" style={{ marginLeft: 8 }}>
              <button aria-pressed={list === 'open'} onClick={() => setList('open')}>Open {openCount}</button>
              <button aria-pressed={list === 'resolved'} onClick={() => setList('resolved')}>Resolved {notes.length - openCount}</button>
            </div>
            <button className="btn ghost sm icon" style={{ marginLeft: 'auto' }} onClick={() => setList(null)} aria-label="Close list"><X size={15} /></button>
          </div>
          {ordered.filter((n) => (list === 'open' ? !n.resolved : n.resolved)).length === 0 && (
            <p className="muted" style={{ padding: '18px 16px', fontSize: 13 }}>{list === 'open' ? 'No open comments. Use “Comment on something” and click any element.' : 'Nothing resolved yet.'}</p>
          )}
          <ol>
            {[...ordered].reverse().filter((n) => (list === 'open' ? !n.resolved : n.resolved)).map((n) => (
              <li key={n.id}>
                <button onClick={() => goTo(n)}>
                  <span className="rp-num">{number.get(n.id)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="rp-where"><span className="mono">{n.page}</span>{n.label ? ` · ${n.label}` : ''}</span>
                    <span className="rp-text">{n.text || 'Empty comment'}</span>
                    <span className="rp-meta">{n.author ?? 'Someone'} · {ago(n.createdAt)}{n.replies?.length ? ` · ${n.replies.length} repl${n.replies.length === 1 ? 'y' : 'ies'}` : ''}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}

      {confirmAll && (
        <div className="rp-confirm" role="alertdialog" aria-label="Delete all comments">
          <b>Delete all {notes.length} comment{notes.length === 1 ? '' : 's'}?</b>
          <p>This removes them for everyone on this deployment{status === 'local' || status === 'error' ? ' (here: this browser)' : ''}. It can’t be undone — save a .txt first if you might need them.</p>
          <div className="rp-card-foot">
            <button className="btn sm" onClick={() => setConfirmAll(false)}>Keep comments</button>
            <button className="btn sm danger" onClick={() => { setNotes([]); setConfirmAll(false); say('All comments deleted') }}>Delete {notes.length}</button>
          </div>
        </div>
      )}

      {toast && <div className="rp-toast" role="status">{toast}</div>}
    </div>,
    document.body,
  )
}
