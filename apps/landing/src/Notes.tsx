import { useEffect, useRef, useState } from 'react'

/**
 * The page's own taste of the product: press C (or the dock button), click anything, leave a note.
 * Notes live in this component's memory only. Nothing is stored and nothing is sent anywhere.
 */
interface Note { id: number; x: number; y: number; text: string; on: string }

/** A short, readable name for what was clicked ("h2", "a.btn"). Never its text or value. */
function describe(el: Element | null): string {
  if (!el) return 'page'
  const tag = el.tagName.toLowerCase()
  const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/)[0]}` : ''
  return `${tag}${cls}`
}

export default function Notes({ on, setOn }: { on: boolean; setOn: (v: boolean) => void }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [draft, setDraft] = useState<{ x: number; y: number; on: string } | null>(null)
  const [text, setText] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const box = useRef<HTMLTextAreaElement | null>(null)

  const stop = () => { setOn(false); setDraft(null); setText('') }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)
      if (e.key === 'Escape') { if (draft) { setDraft(null); setText('') } else if (on) stop(); else setOpen(null) }
      else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'c') setOn(!on)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // While commenting, a click places a note and never reaches the page (links don't navigate).
  useEffect(() => {
    if (!on) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null
      if (t?.closest('.notes-ui')) return
      e.preventDefault(); e.stopPropagation()
      setOpen(null); setText('')
      setDraft({ x: e.pageX, y: e.pageY, on: describe(t) })
    }
    document.addEventListener('click', onClick, true)
    document.documentElement.classList.add('commenting')
    return () => { document.removeEventListener('click', onClick, true); document.documentElement.classList.remove('commenting') }
  }, [on])

  useEffect(() => { if (draft) box.current?.focus() }, [draft])

  const post = () => {
    const t = text.trim()
    if (!draft || !t) return
    setNotes((l) => [...l, { id: (l[l.length - 1]?.id ?? 0) + 1, ...draft, text: t }])
    setDraft(null); setText('')
  }
  // Keep popovers on screen near the right edge.
  const flip = (x: number) => (typeof window !== 'undefined' && x > window.innerWidth - 320 ? 'left' : '')

  return (
    <div className="notes-ui">
      <div className="notes-layer">
        {notes.map((n) => (
          <div key={n.id} className="note-at" style={{ left: n.x, top: n.y }}>
            <button className="pin" onClick={() => setOpen(open === n.id ? null : n.id)} aria-label={`Note ${n.id}`} aria-expanded={open === n.id}>{n.id}</button>
            {open === n.id && (
              <div className={`pop ${flip(n.x)}`}>
                <p className="pop-meta">You · on <b>{n.on}</b></p>
                <p className="pop-text">{n.text}</p>
                <div className="pop-row"><button className="link" onClick={() => { setNotes((l) => l.filter((x) => x.id !== n.id)); setOpen(null) }}>Delete</button></div>
              </div>
            )}
          </div>
        ))}
        {draft && (
          <div className="note-at" style={{ left: draft.x, top: draft.y }}>
            <span className="pin draft" aria-hidden>+</span>
            <div className={`pop ${flip(draft.x)}`}>
              <p className="pop-meta">New note · on <b>{draft.on}</b></p>
              <textarea ref={box} value={text} onChange={(e) => setText(e.target.value)} placeholder="What should change here?" rows={3} aria-label="Your note"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() } }} />
              <div className="pop-row">
                <button className="link" onClick={() => { setDraft(null); setText('') }}>Cancel</button>
                <button className="btn ink sm" onClick={post} disabled={!text.trim()}>Post</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`dock ${on ? 'on' : ''}`} role="region" aria-label="Notes on this page">
        {on ? (
          <>
            <span className="dock-live" aria-hidden />
            <span className="dock-text">Click anything to leave a note</span>
            <button className="dock-btn" onClick={stop}>Stop <kbd>Esc</kbd></button>
          </>
        ) : (
          <button className="dock-btn main" onClick={() => setOn(true)}>
            <span className="pin sm" aria-hidden>{notes.length || '+'}</span>
            {notes.length ? `${notes.length} ${notes.length === 1 ? 'note' : 'notes'} · add another` : 'Comment on this page'} <kbd>C</kbd>
          </button>
        )}
      </div>
    </div>
  )
}
