import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { MessageSquarePlus, MessageSquare, X, List, Download, Upload, Trash2, EyeOff, CheckCircle2, RotateCcw, Check } from 'lucide-react'
import { APP, TOOL_DOM, isEmbedded, readJSON, useFlag, writeJSON } from '../shared'
import { useStore } from '../../store/store'
import { fromTxt, MAX_NOTES, MAX_TEXT, pinTop, replyVoiceId, statusOf, STATUS_LABEL, toTxt, txtFileName, voiceId, type CommentStatus, type PinNote } from './format'
import { Thread } from './Thread'
import { VoiceNote } from '../voice/VoiceNote'
import { clock, deleteClip } from '../voice/audio'
import { STATUS_TEXT, usePinSync } from './useSync'
import { LEGACY_VERSION, getVersion, publishCommentCounts, setVersion, useVersion, type CommentCounts } from '../../lib/version'

const BUTTON_KEY = `${APP}.reviewPins.button`
/** The floating comment button duplicated the dock; kept in code, off for now. */
const SHOW_FAB = false
const NAME_KEY = `${APP}.reviewPins.name`
/** Fire with detail 'start' (comment mode) or 'list' (open the list) from anywhere in the app. */
export const COMMENT_EVENT = 'market:comments'
const verOf = (n: PinNote) => n.version ?? LEGACY_VERSION
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

/** Where a comment sits in the document: where it was placed (older comments pinned to an element follow it). */
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

/** Comments on every screen — mounted app-wide. */
export function ReviewPins() {
  const on = useFlag('reviewPins')
  const [hidden, setHidden] = useState(false)
  if (!on || hidden || isEmbedded) return null
  return <Comments onHide={() => setHidden(true)} />
}

function Comments({ onHide }: { onHide: () => void }) {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const { me } = useStore()
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [, setTick] = useState(0)
  const [placing, setPlacing] = useState(false)
  const [flash, setFlash] = useState<string | null>(null)
  const [menu, setMenu] = useState(false)
  const [list, setList] = useState<'open' | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  /** A comment being written: not saved, not numbered, no status — until it is posted. */
  const [draft, setDraft] = useState<PinNote | null>(null)
  /** A posted comment whose text its author is changing. */
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const { notes, setNotes, status, scope } = usePinSync(placing || !!openId || !!draft)
  // The name comments and replies are signed with, kept per browser so reviewers can tell each other apart.
  const [name, setNameState] = useState<string>(() => readJSON(NAME_KEY, me.name))
  const setName = (v: string) => { setNameState(v); writeJSON(NAME_KEY, v) }
  const [filter, setFilter] = useState<CommentStatus | 'all'>('all')

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

  // Comments belong to the shop version they were made on: pins, numbers and the list show the current one.
  const version = useVersion()
  const all = useMemo(() => [...notes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [notes])
  const ordered = useMemo(() => all.filter((n) => verOf(n) === version), [all, version])
  const [allVersions, setAllVersions] = useState(false)
  const number = useMemo(() => {
    const m = new Map<string, number>()
    const per = new Map<string, number>()
    for (const n of all) { const v = verOf(n); const k = (per.get(v) ?? 0) + 1; per.set(v, k); m.set(n.id, k) }
    return m
  }, [all])
  const here = ordered.filter((n) => n.page === pathname)
  // Switching version: a comment being written or read belonged to the version before.
  const firstVersion = useRef(true)
  useEffect(() => {
    if (firstVersion.current) { firstVersion.current = false; return }
    setOpenId(null); setEditing(null)
    setDraft((d) => {
      if (d && (d.text.trim() || d.voice)) say('Your unposted comment was discarded because the version changed')
      if (d?.voice) void deleteClip(voiceId(d.id))
      return null
    })
  }, [version]) // eslint-disable-line react-hooks/exhaustive-deps
  // The dock shows how many comments each version has.
  useEffect(() => {
    const c: CommentCounts = {}
    for (const n of notes) { const v = verOf(n); const x = (c[v] ??= { total: 0, unresolved: 0 }); x.total++; if (!n.resolved) x.unresolved++ }
    publishCommentCounts(c)
  }, [notes])
  const open = notes.find((n) => n.id === openId)

  const say = (t: string) => { setToast(t); window.setTimeout(() => setToast((x) => (x === t ? null : x)), 2600) }
  const update = (id: string, patch: Partial<PinNote>) => setNotes((all) => all.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)))

  const closeCard = useCallback(() => { setOpenId(null); setEditing(null) }, [])

  const draftHasContent = !!draft && (draft.text.trim() !== '' || !!draft.voice)
  /** Throws the draft (and any voice note recorded for it) away. */
  const discardDraft = useCallback(() => {
    setDraft((d) => { if (d?.voice) void deleteClip(voiceId(d.id)); return null })
  }, [])
  /** Before starting something else: an empty draft is dropped; one with content must be posted or cancelled first. */
  const draftBlocks = () => {
    if (!draft) return false
    if (!draftHasContent) { discardDraft(); return false }
    say('Post or cancel the comment you’re writing first')
    return true
  }
  const postDraft = () => {
    if (!draft || !draftHasContent) return
    const now = new Date().toISOString()
    const posted: PinNote = { ...draft, text: draft.text.trim(), createdAt: now, updatedAt: now }
    setNotes((all) => [...all, posted])
    setDraft(null)
    setOpenId(posted.id)
  }

  // Comment mode: a crosshair, and a click drops the comment right there — anywhere on the page.
  useEffect(() => {
    if (!placing) return
    document.documentElement.dataset.commenting = 'on'
    const click = (e: MouseEvent) => {
      const t = e.target as Element
      if (!(t instanceof Element) || t.closest(TOOL_DOM)) return
      e.preventDefault()
      e.stopPropagation()
      if (notes.length >= MAX_NOTES) { setPlacing(false); return say(`Limit of ${MAX_NOTES} comments reached`) }
      const now = new Date().toISOString()
      const n: PinNote = {
        id: uid(), page: pathname,
        x: Math.round((e.clientX / window.innerWidth) * 1000) / 10, y: Math.round((e.clientY / window.innerHeight) * 1000) / 10,
        vw: window.innerWidth, vh: window.innerHeight, scrollY: Math.round(window.scrollY),
        text: '', createdAt: now, updatedAt: now, author: name.trim() || me.name, version: getVersion(),
      }
      setDraft(n)
      setPlacing(false)
      setOpenId(null)
    }
    document.addEventListener('click', click, true)
    return () => {
      delete document.documentElement.dataset.commenting
      document.removeEventListener('click', click, true)
    }
  }, [placing, pathname, me.name, name, notes.length, setNotes])

  const draftBlocksRef = useRef(draftBlocks)
  draftBlocksRef.current = draftBlocks
  // Leaving the page drops a comment that was never posted.
  useEffect(() => {
    if (draft && draft.page !== pathname) { if (draftHasContent) say('The comment you hadn’t posted was discarded'); discardDraft() }
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Other entry points: the dock's Comment button and list (a window event), and the C key.
  useEffect(() => {
    const onEvent = (e: Event) => {
      const what = (e as CustomEvent<'start' | 'list'>).detail
      if (draftBlocksRef.current()) return
      setMenu(false); setOpenId(null)
      if (what === 'list') setList('open')
      else { setList(null); setPlacing(true) }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'c' || e.metaKey || e.ctrlKey || e.altKey) return
      if (document.documentElement.dataset.sessionRecording === 'on') return
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
      e.preventDefault()
      if (draftBlocksRef.current()) return
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
      else if (draft) discardDraft()
      else if (editing) setEditing(null)
      else if (openId) closeCard()
      else if (list) setList(null)
      else if (menu) setMenu(false)
      else if (placing) setPlacing(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmAll, openId, list, menu, placing, closeCard, draft, editing, discardDraft])

  // From the list: go to the page, scroll the spot into view, ping it, open the comment.
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
    // A comment from another version is shown on that version.
    if (verOf(n) !== version) setVersion(verOf(n))
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

  const right = btn.x + BTN / 2 > vp.w / 2
  const below = btn.y + BTN / 2 < vp.h / 2
  const menuStyle: React.CSSProperties = { ...(right ? { right: vp.w - btn.x - BTN } : { left: btn.x }), ...(below ? { top: btn.y + BTN + 8 } : { bottom: vp.h - btn.y + 8 }) }

  const flashEl = flash ? notes.find((n) => n.id === flash) : undefined
  const flashAt = flashEl ? anchor(flashEl, vp.w) : undefined

  const cardFor = (n: PinNote | null | undefined) => {
    if (!n) return null
    const a = anchor(n, vp.w)
    const py = a.y - window.scrollY
    const w = Math.min(340, vp.w - 24)
    const left = Math.min(Math.max(12, a.x - window.scrollX - w / 2), vp.w - w - 12)
    return py > vp.h / 2 ? { left, width: w, bottom: Math.max(12, vp.h - py + 22) } : { left, width: w, top: Math.max(12, Math.min(vp.h - 320, py + 22)) }
  }
  const card = cardFor(open)
  const draftCard = draft && draft.page === pathname ? cardFor(draft) : null

  const author = name.trim() || me.name
  const mine = (n: PinNote) => !n.author || n.author === author
  const removeNote = (n: PinNote) => {
    if (n.voice) void deleteClip(voiceId(n.id))
    n.replies?.forEach((r) => { if (r.voice) void deleteClip(replyVoiceId(r.id)) })
  }
  const listed = allVersions ? all : ordered
  const counts = { all: listed.length, open: 0, ongoing: 0, done: 0 } as Record<CommentStatus | 'all', number>
  listed.forEach((n) => counts[statusOf(n)]++)

  return createPortal(
    <div className="rp-root" data-review-pins>
      {here.map((n) => {
        const a = anchor(n, vp.w)
        return (
          <button key={n.id} className={`rp-pin ${openId === n.id ? 'open' : ''} st-${statusOf(n)}`} style={{ left: a.x, top: a.y }}
            title={`${STATUS_LABEL[statusOf(n)]} · ${n.text ? n.text.slice(0, 80) : n.voice ? 'Voice note' : 'Empty comment'}`}
            aria-label={`Comment ${number.get(n.id)}, ${STATUS_LABEL[statusOf(n)]}${n.text ? `: ${n.text.slice(0, 40)}` : ''}`}
            onClick={() => { if (draftBlocks()) return; setMenu(false); setList(null); setEditing(null); setOpenId(n.id) }}>
            {n.resolved ? <Check size={13} strokeWidth={3} /> : number.get(n.id)}
          </button>
        )
      })}
      {draft && draft.page === pathname && (() => { const a = anchor(draft, vp.w); return <span className="rp-pin draft open" style={{ left: a.x, top: a.y }} aria-hidden>+</span> })()}

      {placing && (
        <>
          <span className="rp-hint">Click anywhere to leave a comment · Esc to cancel</span>
        </>
      )}
      {flashAt && <span className="rp-ping" style={{ left: flashAt.x, top: flashAt.y }} aria-hidden />}

      {/* The floating button and its ⋯ menu are hidden: the dock's Comment and All comments do the same. */}
      {SHOW_FAB && (<>
      <button
        className={`rp-fab ${placing ? 'placing' : ''}`}
        style={{ left: btn.x, top: btn.y }}
        aria-label={placing ? 'Stop commenting' : 'Comment on something (C)'}
        title={placing ? 'Stop commenting (Esc)' : 'Comment on something — or press C'}
        {...dragHandlers(
          (e) => setBtn(clamp({ x: e.clientX - BTN / 2, y: e.clientY - BTN / 2 })),
          // One click starts commenting; the ⋯ button beside it holds everything else.
          () => { if (draftBlocks()) return; setMenu(false); setOpenId(null); setList(null); if (placing) setPlacing(false); else setPlacing(true) },
          () => setBtn((b: { x: number; y: number }) => { writeJSON(BUTTON_KEY, b); return b }),
        )}
      >
        {placing ? <X size={18} /> : <MessageSquare size={18} />}
        {!placing && here.length > 0 && <span className="rp-badge">{here.length}</span>}
      </button>
      {!placing && (
        <button className="rp-more" style={{ left: Math.max(4, btn.x - 30), top: btn.y + BTN / 2 - 13 }} aria-label="More comment options" aria-expanded={menu}
          title="All comments, export, import" onClick={() => { if (draftBlocks()) return; setOpenId(null); setList(null); setMenu((m) => !m) }}>⋯</button>
      )}

      </>)}

      {menu && (
        <div className="rp-menu" style={menuStyle} role="menu">
          <button role="menuitem" onClick={() => { setMenu(false); setPlacing(true) }}><MessageSquarePlus size={15} /> Comment on something</button>
          <button role="menuitem" onClick={() => { setMenu(false); setList('open') }}><List size={15} /> All comments ({notes.length})</button>
          <button role="menuitem" onClick={exportTxt} disabled={!notes.length}><Download size={15} /> Save to .txt</button>
          <button role="menuitem" onClick={() => fileRef.current?.click()}><Upload size={15} /> Open a .txt</button>
          <button role="menuitem" className="danger" onClick={() => { setMenu(false); setConfirmAll(true) }} disabled={!notes.length}><Trash2 size={15} /> Delete all comments</button>
          <button role="menuitem" onClick={onHide}><EyeOff size={15} /> Hide until reload</button>
          <div className={`rp-status ${status}`}><span>{STATUS_TEXT[status]}</span>{status === 'synced' && <small>{scope}</small>}</div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".txt,text/plain" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; setMenu(false); if (f) void importTxt(f) }} />

      {draft && draftCard && (
        <div className="rp-card" style={draftCard} role="dialog" aria-label="New comment">
          <div className="rp-card-head">
            <b>New comment</b>
            <span>{author} · <span className="mono">{draft.page}</span></span>
          </div>
          <div className="rp-card-body">
            <textarea autoFocus rows={3} maxLength={MAX_TEXT} placeholder="Write your comment…" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} aria-label="Comment"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); postDraft() } }} />
            <VoiceNote key={draft.id} clipId={voiceId(draft.id)} ms={draft.voice?.ms} editable onChange={(ms) => setDraft((d) => (d ? { ...d, voice: ms === undefined ? undefined : { ms } } : d))} />
          </div>
          <div className="rp-card-foot">
            <span className="muted" style={{ fontSize: 12 }}>Text, a voice note, or both</span>
            <span style={{ flex: 1 }} />
            <button className="btn sm ghost" onClick={discardDraft}>Cancel</button>
            <button className="btn sm primary" onClick={postDraft} disabled={!draftHasContent}>Post</button>
          </div>
        </div>
      )}

      {open && card && !draft && (
        <div className="rp-card" style={card} role="dialog" aria-label={`Comment ${number.get(open.id)}`}>
          <div className="rp-card-head">
            <b>Comment {number.get(open.id)} <span className={`rp-status-tag ${statusOf(open)}`}>{STATUS_LABEL[statusOf(open)]}</span></b>
            <span>{open.author ?? 'Someone'} · {ago(open.createdAt)}{open.editedAt ? ' · edited' : ''} · <span className="mono">{open.page}</span></span>
          </div>
          <div className="rp-card-body">
            {editing?.id === open.id ? (
              <>
                <textarea autoFocus rows={3} maxLength={MAX_TEXT} value={editing.text} onChange={(e) => setEditing({ id: open.id, text: e.target.value })} aria-label="Edit comment" />
                <VoiceNote key={`e-${open.id}`} clipId={voiceId(open.id)} ms={open.voice?.ms} editable onChange={(ms) => update(open.id, { voice: ms === undefined ? undefined : { ms } })} />
                <div className="rp-edit-foot">
                  <button className="btn sm ghost" onClick={() => setEditing(null)}>Cancel</button>
                  <button className="btn sm primary" disabled={!editing.text.trim() && !open.voice} onClick={() => { if (editing.text.trim() !== open.text) update(open.id, { text: editing.text.trim(), editedAt: new Date().toISOString() }); setEditing(null) }}>Save</button>
                </div>
              </>
            ) : (
              <>
                {open.text && <div className="rp-msg"><p>{open.text}</p></div>}
                {open.voice && <VoiceNote key={open.id} clipId={voiceId(open.id)} ms={open.voice.ms} editable={false} onChange={() => {}} />}
                {mine(open) && !open.resolved && <button className="rp-edit" onClick={() => setEditing({ id: open.id, text: open.text })}>Edit</button>}
              </>
            )}
            {open.resolved && <p className="rp-done-note"><CheckCircle2 size={13} /> Completed{open.resolvedBy ? ` by ${open.resolvedBy}` : ''}{open.resolvedAt ? ` · ${ago(open.resolvedAt)}` : ''}</p>}
            {editing?.id !== open.id && (
              <Thread key={`t-${open.id}`} note={open} me={author} ago={ago}
                onReply={(r) => update(open.id, { replies: [...(open.replies ?? []), r] })}
                onDelete={(r) => update(open.id, { replies: (open.replies ?? []).filter((x) => x.id !== r.id) })} />
            )}
          </div>
          {editing?.id !== open.id && (
            <div className="rp-card-foot">
              {mine(open) && <button className="btn sm ghost danger" onClick={() => { removeNote(open); setNotes((all) => all.filter((n) => n.id !== open.id)); setOpenId(null) }}><Trash2 size={13} /> Delete</button>}
              <span style={{ flex: 1 }} />
              {open.resolved
                ? <button className="btn sm" onClick={() => update(open.id, { resolved: false, resolvedBy: undefined, resolvedAt: undefined })}><RotateCcw size={13} /> Reopen</button>
                : <button className="btn sm" onClick={() => { update(open.id, { resolved: true, resolvedBy: author, resolvedAt: new Date().toISOString() }); say('Set as completed') }}><CheckCircle2 size={13} /> Set as completed</button>}
              <button className="btn sm primary" onClick={closeCard}>Close</button>
            </div>
          )}
        </div>
      )}

      {list && (
        <div className="rp-sheet" role="dialog" aria-label="All comments">
          <div className="rp-sheet-head">
            <b>Comments</b>
            <span className="muted">{allVersions ? `all versions · ${all.length}` : `v${version} · ${ordered.length}`}</span>
            <button className="btn ghost sm icon" style={{ marginLeft: 'auto' }} onClick={() => setList(null)} aria-label="Close list"><X size={15} /></button>
          </div>
          <div className="rp-filters" role="group" aria-label="Show comments">
            {(['all', 'open', 'ongoing', 'done'] as const).map((f) => (
              <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : STATUS_LABEL[f]} <span>{counts[f]}</span></button>
            ))}
          </div>
          <label className="rp-allver"><input type="checkbox" checked={allVersions} onChange={(e) => setAllVersions(e.target.checked)} /> Show every version</label>
          <label className="rp-name">Commenting as <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} aria-label="Your name for comments" /></label>
          {listed.length === 0 && <p className="muted" style={{ padding: '18px 16px', fontSize: 13 }}>{allVersions ? 'No comments yet.' : `No comments on v${version} yet.`} Press Comment (or C) and click anywhere on a screen.</p>}
          {listed.length > 0 && filter !== 'all' && counts[filter] === 0 && <p className="muted" style={{ padding: '18px 16px', fontSize: 13 }}>No {STATUS_LABEL[filter].toLowerCase()} comments.</p>}
          <ol>
            {[...listed].reverse().filter((n) => filter === 'all' || statusOf(n) === filter).map((n) => (
              <li key={n.id} className={`st-${statusOf(n)}`}>
                <button onClick={() => goTo(n)}>
                  <span className="rp-num">{number.get(n.id)}</span>
                  <span style={{ minWidth: 0 }}>
                    <span className="rp-where mono">{allVersions && <span className="rp-ver">v{verOf(n)}</span>}{n.page}</span>
                    <span className="rp-text">{n.voice && <span className="rp-voice">🎙 {clock(n.voice.ms)}</span>}{n.text || (n.voice ? 'Voice note' : 'Empty comment')}</span>
                    <span className="rp-meta"><span className={`rp-status-tag ${statusOf(n)}`}>{STATUS_LABEL[statusOf(n)]}</span> {n.author ?? 'Someone'} · {ago(n.createdAt)}{n.replies?.length ? ` · ${n.replies.length} repl${n.replies.length === 1 ? 'y' : 'ies'}` : ''}</span>
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
            <button className="btn sm danger" onClick={() => { notes.forEach(removeNote); setNotes([]); setConfirmAll(false); say('All comments deleted') }}>Delete {notes.length}</button>
          </div>
        </div>
      )}

      {toast && <div className="rp-toast" role="status">{toast}</div>}
    </div>,
    document.body,
  )
}
