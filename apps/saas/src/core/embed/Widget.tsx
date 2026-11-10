import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquarePlus, MessagesSquare, X, Check, RotateCcw, Trash2, Pencil, CornerDownRight, MapPinOff } from 'lucide-react'
import { NS, MAX_TEXT, STATUS_LABEL, anchorAt, pageKey, pageUrl, place, statusOf, uid, type Anchor, type Backend, type Reply, type Status, type Thread } from './store'

export interface Config {
  project: string
  position: 'left' | 'right'
  shortcut: boolean
  /** floating: the buttons in a corner; hidden: none, the site opens it (data-vibe buttons, the API, C) */
  launcher: 'floating' | 'hidden'
  label: string
  accent: string
  mode: 'light' | 'dark'
  /** showing the draft configuration (from the panel's preview), with a way out */
  preview?: { exit: () => void }
}
/** Asked of the widget from outside: by a data-vibe button on the site or window.VibeCollab.open(). */
export const OPEN_EVENT = 'vibe-collab:open'
export type OpenWhat = 'comment' | 'list'

const NAME_KEY = `${NS}name`
const OPEN_KEY = `${NS}open`
const readName = () => { try { return localStorage.getItem(NAME_KEY) ?? '' } catch { return '' } }
const ago = (iso: string) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
const typing = (e: KeyboardEvent) => {
  const path = e.composedPath() as HTMLElement[]
  return path.some((n) => n instanceof HTMLElement && (n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName)))
}

interface Draft { anchor: Anchor; page: string; text: string }

export function Widget({ backend, config, host }: { backend: Backend; config: Config; host: HTMLElement }) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState(pageKey)
  const [placing, setPlacing] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [nudge, setNudge] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [panel, setPanel] = useState(false)
  const [name, setNameState] = useState(readName)
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null)
  const [, setTick] = useState(0)
  const me = name.trim() || 'Guest'
  const nameTimer = useRef(0)
  const setName = (v: string) => {
    setNameState(v)
    try { localStorage.setItem(NAME_KEY, v) } catch { /* ignore */ }
    // The server keeps one name per reviewer: sent once typing pauses.
    window.clearTimeout(nameTimer.current)
    if (v.trim()) nameTimer.current = window.setTimeout(() => backend.setName?.(v.trim()), 800)
  }
  const say = useCallback((text: string, error = false) => { setToast({ text, error }); window.setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 3200) }, [])

  /* ---- data ---- */
  const reload = useCallback(async () => {
    try { setThreads(await backend.list()) } catch { say('Comments could not be loaded.', true) }
    setLoaded(true)
  }, [backend, say])
  useEffect(() => { void reload(); return backend.subscribe(() => void reload()) }, [backend, reload])

  /** Shows the change at once, saves it, and puts it back if saving fails. */
  const save = async (t: Thread, msg?: string) => {
    const before = threads
    setThreads((l) => (l.some((x) => x.id === t.id) ? l.map((x) => (x.id === t.id ? t : x)) : [...l, t]))
    try { await backend.upsert(t); if (msg) say(msg) } catch { setThreads(before); say('Not saved: this browser’s storage is full or blocked.', true) }
  }
  const remove = async (t: Thread) => {
    const before = threads
    setThreads((l) => l.filter((x) => x.id !== t.id))
    if (openId === t.id) setOpenId(null)
    try { await backend.remove(t.id); say('Comment deleted') } catch { setThreads(before); say('Not deleted: storage is blocked.', true) }
  }

  /* ---- following the host page ---- */
  const draftRef = useRef(draft)
  draftRef.current = draft
  useEffect(() => {
    let raf = 0
    const bump = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setTick((n) => n + 1)) }
    // Pins follow their elements: on scroll and resize at once, and a slow check for layout and route changes.
    const iv = window.setInterval(() => { setPage((p) => (p === pageKey() ? p : pageKey())); bump() }, 400)
    window.addEventListener('scroll', bump, true)
    window.addEventListener('resize', bump)
    return () => { clearInterval(iv); cancelAnimationFrame(raf); window.removeEventListener('scroll', bump, true); window.removeEventListener('resize', bump) }
  }, [])
  // A new page: whatever was being written or read belonged to the old one.
  const firstPage = useRef(true)
  useEffect(() => {
    if (firstPage.current) { firstPage.current = false; return }
    if (draftRef.current?.text.trim()) say('Your unposted comment was discarded because the page changed.', true)
    setDraft(null); setPlacing(false); setOpenId(null)
  }, [page, say])
  // Opening a comment that lives on another page: the id rides along to that page.
  useEffect(() => {
    if (!loaded) return
    let id: string | null = null
    try { id = sessionStorage.getItem(OPEN_KEY); sessionStorage.removeItem(OPEN_KEY) } catch { /* ignore */ }
    const t = id && threads.find((x) => x.id === id)
    if (t && t.page === page) reveal(t)
  }, [loaded]) // eslint-disable-line react-hooks/exhaustive-deps
  // A comment deleted elsewhere closes here.
  useEffect(() => { if (openId && loaded && !threads.some((t) => t.id === openId)) setOpenId(null) }, [threads, openId, loaded])

  /* ---- keyboard focus held by the host page ---- */
  // A dialog on the host page (Radix, MUI, Headless UI…) may keep the keyboard focus inside itself,
  // and the widget's fields then can't be typed in. That can't be undone from outside the dialog,
  // so say what is going on instead of leaving a field that silently ignores the keyboard.
  const root = useRef<HTMLDivElement>(null)
  const warnedFocus = useRef(0)
  const checkFocus = useCallback((field: Element | null) => {
    window.setTimeout(() => {
      const active = host.shadowRoot?.activeElement
      if (!field || !field.isConnected || active === field) return
      if (Date.now() - warnedFocus.current < 4000) return
      warnedFocus.current = Date.now()
      say('A dialog on this page is holding the keyboard. Close it, then write your comment.', true)
    }, 60)
  }, [host, say])
  const onFieldPointer = (e: React.PointerEvent) => {
    const t = e.target as Element
    if (t.closest('textarea, input')) checkFocus(t.closest('textarea, input'))
  }
  useEffect(() => { if (draft) checkFocus(root.current?.querySelector('textarea') ?? null) }, [!!draft]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- flow ---- */
  const busy = () => { if (draft?.text.trim()) { setNudge((n) => n + 1); return true } return false }
  const start = () => {
    if (busy()) return
    setDraft(null); setOpenId(null); setPanel(false); setPlacing(true)
  }
  const drop = (e: React.MouseEvent) => {
    const overlay = e.currentTarget as HTMLElement
    // Look through the overlay (and the widget) to the host element under the pointer.
    overlay.style.pointerEvents = 'none'
    const prev = host.style.pointerEvents
    host.style.pointerEvents = 'none'
    const el = document.elementFromPoint(e.clientX, e.clientY)
    host.style.pointerEvents = prev
    overlay.style.pointerEvents = ''
    setPlacing(false)
    if (!el || el === document.documentElement) { say('Click on the page’s content to comment.', true); return }
    setDraft({ anchor: anchorAt(el, e.clientX, e.clientY), page, text: '' })
  }
  const post = () => {
    if (!draft || !draft.text.trim()) return
    const t: Thread = { id: uid(), page: draft.page, anchor: draft.anchor, author: me, text: draft.text.trim().slice(0, MAX_TEXT), createdAt: new Date().toISOString(), replies: [] }
    setDraft(null)
    setOpenId(t.id)
    void save(t, 'Comment posted')
  }
  const openThread = (id: string) => { if (busy()) return; setDraft(null); setOpenId((cur) => (cur === id ? null : id)) }
  const reveal = (t: Thread) => {
    const p = place(t.anchor)
    if (p.y < 60 || p.y > window.innerHeight - 60) window.scrollBy({ top: p.y - window.innerHeight / 3 })
    setOpenId(t.id)
  }
  const go = (t: Thread) => {
    if (busy()) return
    setPanel(false)
    if (t.page === page) { setDraft(null); reveal(t); return }
    // Only ever a page of this site: a stored page key that would lead elsewhere is refused.
    const url = pageUrl(t.page)
    if (!url) { say('That comment’s page address isn’t on this site, so it wasn’t opened.', true); return }
    try { sessionStorage.setItem(OPEN_KEY, t.id) } catch { /* ignore */ }
    window.location.href = url
  }

  // The site's own buttons (data-vibe="comment" | "comments") and the JS API arrive as events on the host element.
  const startRef = useRef(() => {})
  startRef.current = () => (placing ? setPlacing(false) : start())
  useEffect(() => {
    const on = (e: Event) => {
      const what = (e as CustomEvent<OpenWhat>).detail
      if (what === 'list') setPanel(true)
      else startRef.current()
    }
    host.addEventListener(OPEN_EVENT, on)
    return () => host.removeEventListener(OPEN_EVENT, on)
  }, [host])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (placing) setPlacing(false)
        else if (draft) setDraft(null)
        else if (openId) setOpenId(null)
        else if (panel) setPanel(false)
        return
      }
      if (config.shortcut && (e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e) && !placing) { e.preventDefault(); start() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /* ---- what is on this page ---- */
  const here = useMemo(() => threads.filter((t) => t.page === page).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [threads, page])
  const number = (t: Thread) => here.indexOf(t) + 1
  const openOnPage = here.filter((t) => !t.resolved).length
  const open = here.find((t) => t.id === openId)

  return (
    <div className={`vc ${config.position} ${config.mode}`} ref={root} onPointerUp={onFieldPointer} style={{ ['--vc-accent' as string]: config.accent }}>
      {config.preview && <div className="vc-preview" role="status">Preview · draft settings <button onClick={config.preview.exit}>Exit preview</button></div>}
      {here.map((t) => {
        const p = place(t.anchor)
        if (p.y < -20 || p.y > window.innerHeight + 20) return null
        return (
          <button key={t.id} className={`vc-pin st-${statusOf(t)} ${openId === t.id ? 'sel' : ''} ${p.lost ? 'lost' : ''}`} style={{ left: p.x, top: p.y }}
            onClick={() => openThread(t.id)} aria-label={`Comment ${number(t)} by ${t.author}, ${STATUS_LABEL[statusOf(t)]}`}
            title={p.lost ? 'The element this comment was on is no longer on the page; shown where it was.' : undefined}>
            {t.resolved ? <Check size={12} /> : number(t)}
          </button>
        )
      })}

      {draft && (() => {
        const p = place(draft.anchor)
        return (
          <>
            <span className="vc-pin draft" style={{ left: p.x, top: p.y }} aria-hidden>+</span>
            <Card x={p.x} y={p.y} label="New comment" shake={nudge}>
              <div className="vc-card-head"><b>New comment</b><span className="vc-grow" /><button className="vc-icon" onClick={() => setDraft(null)} aria-label="Cancel"><X size={14} /></button></div>
              <textarea autoFocus rows={3} maxLength={MAX_TEXT} value={draft.text} placeholder="Write a comment…" aria-label="Comment"
                onChange={(e) => setDraft({ ...draft, text: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post() } }} />
              <div className="vc-row">
                <label className="vc-name">as <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name" aria-label="Your name" /></label>
                <span className="vc-grow" />
                <button className="vc-btn" onClick={() => setDraft(null)}>Cancel</button>
                <button className="vc-btn primary" disabled={!draft.text.trim()} onClick={post}>Post</button>
              </div>
            </Card>
          </>
        )
      })()}

      {open && (() => {
        const p = place(open.anchor)
        return <Card x={p.x} y={p.y} label={`Comment ${number(open)}`}><ThreadView t={open} n={number(open)} me={me} lost={p.lost} onSave={save} onRemove={remove} onClose={() => setOpenId(null)} /></Card>
      })()}

      {placing && <div className="vc-overlay" onClick={drop}><div className="vc-hint">Click anywhere to comment · Esc to cancel</div></div>}

      {panel && (
        <List threads={threads} page={page} name={name} setName={setName} where={backend.where}
          onPick={go} onClose={() => setPanel(false)} number={(t) => threads.filter((x) => x.page === t.page).sort((a, b) => a.createdAt.localeCompare(b.createdAt)).indexOf(t) + 1} />
      )}

      {config.launcher === 'floating' && <div className="vc-dock" role="toolbar" aria-label="Collaboration">
        <button className={`vc-btn primary ${placing ? 'on' : ''}`} onClick={() => (placing ? setPlacing(false) : start())} title={config.shortcut ? 'Comment (C)' : 'Comment'}>
          <MessageSquarePlus size={15} /> {placing ? 'Cancel' : config.label}
        </button>
        <button className="vc-icon dock" onClick={() => setPanel((v) => !v)} aria-label={`All comments, ${openOnPage} open on this page`} aria-expanded={panel}>
          <MessagesSquare size={15} />{openOnPage > 0 && <span className="vc-count">{openOnPage}</span>}
        </button>
      </div>}

      {toast && <div className={`vc-toast ${toast.error ? 'error' : ''}`} role="status">{toast.text}</div>}
    </div>
  )
}

/** A card beside its pin, kept on screen. */
function Card({ x, y, label, shake, children }: { x: number; y: number; label: string; shake?: number; children: React.ReactNode }) {
  const W = Math.min(320, window.innerWidth - 16)
  const left = Math.max(8, Math.min(x + 18, window.innerWidth - W - 8))
  const below = y < window.innerHeight * 0.55
  const style = below ? { left, top: Math.max(8, y - 12), width: W } : { left, bottom: Math.max(8, window.innerHeight - y - 12), width: W }
  return <div key={shake} className={`vc-card ${shake ? 'shake' : ''}`} style={style} role="dialog" aria-label={label}>{children}</div>
}

function ThreadView({ t, n, me, lost, onSave, onRemove, onClose }: {
  t: Thread; n: number; me: string; lost: boolean
  onSave: (t: Thread, msg?: string) => Promise<void>; onRemove: (t: Thread) => Promise<void>; onClose: () => void
}) {
  const [edit, setEdit] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [confirm, setConfirm] = useState(false)
  const mine = t.mine ?? t.author === me
  const status: Status = statusOf(t)
  useEffect(() => { setEdit(null); setReply(''); setConfirm(false) }, [t.id])
  const send = () => {
    const text = reply.trim()
    if (!text) return
    const r: Reply = { id: uid(), author: me, text: text.slice(0, MAX_TEXT), at: new Date().toISOString() }
    setReply('')
    void onSave({ ...t, replies: [...t.replies, r] })
  }
  return (
    <>
      <div className="vc-card-head">
        <span className={`vc-badge st-${status}`}>{STATUS_LABEL[status]}</span>
        <b>#{n}</b>
        <span className="vc-grow" />
        {mine && !t.resolved && edit === null && <button className="vc-icon" onClick={() => setEdit(t.text)} aria-label="Edit comment"><Pencil size={13} /></button>}
        {mine && <button className="vc-icon" onClick={() => setConfirm(true)} aria-label="Delete comment"><Trash2 size={13} /></button>}
        <button className="vc-icon" onClick={onClose} aria-label="Close"><X size={14} /></button>
      </div>
      {confirm && (
        <div className="vc-confirm">
          <span>Delete this comment{t.replies.length ? ` and its ${t.replies.length} repl${t.replies.length === 1 ? 'y' : 'ies'}` : ''}?</span>
          <span className="vc-row"><button className="vc-btn" onClick={() => setConfirm(false)}>Keep</button><button className="vc-btn danger" onClick={() => void onRemove(t)}>Delete</button></span>
        </div>
      )}
      <div className="vc-meta"><b>{t.author}</b> · {ago(t.createdAt)}{t.editedAt ? ' · edited' : ''}</div>
      {edit === null ? <p className="vc-text">{t.text}</p> : (
        <div className="vc-stack">
          <textarea autoFocus rows={3} maxLength={MAX_TEXT} value={edit} onChange={(e) => setEdit(e.target.value)} aria-label="Edit comment" />
          <div className="vc-row"><span className="vc-grow" />
            <button className="vc-btn" onClick={() => setEdit(null)}>Cancel</button>
            <button className="vc-btn primary" disabled={!edit.trim() || edit.trim() === t.text} onClick={() => { void onSave({ ...t, text: edit.trim(), editedAt: new Date().toISOString() }); setEdit(null) }}>Save</button>
          </div>
        </div>
      )}
      {lost && <p className="vc-lost"><MapPinOff size={12} /> The element it was on isn’t on the page now.</p>}
      {t.replies.length > 0 && (
        <ol className="vc-replies" aria-label="Replies">
          {t.replies.map((r) => (
            <li key={r.id}>
              <div className="vc-meta"><CornerDownRight size={11} /> <b>{r.author}</b> · {ago(r.at)}
                {(r.mine ?? r.author === me) && !t.resolved && <button className="vc-icon sm" onClick={() => void onSave({ ...t, replies: t.replies.filter((x) => x.id !== r.id) })} aria-label="Delete reply"><Trash2 size={11} /></button>}
              </div>
              <p className="vc-text">{r.text}</p>
            </li>
          ))}
        </ol>
      )}
      {t.resolved ? (
        <div className="vc-row vc-done"><span>Completed by {t.resolved.by} · {ago(t.resolved.at)}</span><span className="vc-grow" />
          <button className="vc-btn" onClick={() => void onSave({ ...t, resolved: undefined }, 'Reopened')}><RotateCcw size={13} /> Reopen</button></div>
      ) : edit === null && (
        <div className="vc-stack">
          <textarea rows={2} maxLength={MAX_TEXT} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply…" aria-label="Reply"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }} />
          <div className="vc-row">
            <button className="vc-btn" onClick={() => void onSave({ ...t, resolved: { by: me, at: new Date().toISOString() } }, 'Set as completed')}><Check size={13} /> Set as completed</button>
            <span className="vc-grow" />
            <button className="vc-btn primary" disabled={!reply.trim()} onClick={send}>Reply</button>
          </div>
        </div>
      )}
    </>
  )
}

function List({ threads, page, name, setName, where, onPick, onClose, number }: {
  threads: Thread[]; page: string; name: string; setName: (v: string) => void; where: string
  onPick: (t: Thread) => void; onClose: () => void; number: (t: Thread) => number
}) {
  const [scope, setScope] = useState<'page' | 'all'>('page')
  const [filter, setFilter] = useState<Status | 'all'>('all')
  const inScope = threads.filter((t) => scope === 'all' || t.page === page)
  const count = (f: Status | 'all') => inScope.filter((t) => f === 'all' || statusOf(t) === f).length
  const shown = inScope.filter((t) => filter === 'all' || statusOf(t) === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return (
    <aside className="vc-panel" aria-label="All comments">
      <div className="vc-card-head"><b>Comments</b><span className="vc-grow" /><button className="vc-icon" onClick={onClose} aria-label="Close"><X size={14} /></button></div>
      <label className="vc-name">Commenting as <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Your name" aria-label="Your name" /></label>
      <div className="vc-seg" role="group" aria-label="Which pages">
        <button aria-pressed={scope === 'page'} onClick={() => setScope('page')}>This page</button>
        <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All pages</button>
      </div>
      <div className="vc-chips" role="group" aria-label="Status">
        {(['all', 'open', 'ongoing', 'completed'] as const).map((f) => (
          <button key={f} aria-pressed={filter === f} onClick={() => setFilter(f)}>{f === 'all' ? 'All' : STATUS_LABEL[f]} <span>{count(f)}</span></button>
        ))}
      </div>
      <ul className="vc-items">
        {shown.length === 0 && <li className="vc-empty">{inScope.length === 0 ? (scope === 'page' ? 'No comments on this page yet. Press Comment and click anywhere.' : 'No comments yet.') : `No ${filter === 'all' ? '' : STATUS_LABEL[filter as Status].toLowerCase() + ' '}comments.`}</li>}
        {shown.map((t) => (
          <li key={t.id}>
            <button onClick={() => onPick(t)}>
              <span className="vc-row"><span className={`vc-badge st-${statusOf(t)}`}>{STATUS_LABEL[statusOf(t)]}</span><b>#{number(t)} {t.author}</b><span className="vc-grow" /><span className="vc-muted">{ago(t.createdAt)}</span></span>
              <span className="vc-snippet">{t.text}</span>
              <span className="vc-muted">{t.replies.length} repl{t.replies.length === 1 ? 'y' : 'ies'}{t.page !== page ? ` · on ${t.page}` : ''}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="vc-where">{where}</p>
    </aside>
  )
}
