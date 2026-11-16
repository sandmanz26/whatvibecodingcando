import { useEffect, useRef, useState } from 'react'
import { IcX, WDock, WPin, WThread } from './Widget'

/**
 * The page's own taste of the product: press C (or the dock's Comment), click anything, leave a
 * comment. It looks and behaves like the real widget, but comments live in this component's
 * memory only. Nothing is stored and nothing is sent anywhere.
 */
interface Note { id: number; x: number; y: number; text: string; by: string; on: string; done: boolean }

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
  const [name, setName] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const box = useRef<HTMLTextAreaElement | null>(null)

  const stop = () => { setOn(false); setDraft(null); setText('') }
  const say = (m: string) => { setToast(m); window.setTimeout(() => setToast(''), 1800) }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable)
      if (e.key === 'Escape') { if (draft) { setDraft(null); setText('') } else if (on) stop(); else setOpen(null) }
      else if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'c') { if (on) stop(); else setOn(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // While commenting, a click places a comment and never reaches the page (links don't navigate).
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
    const id = (notes[notes.length - 1]?.id ?? 0) + 1
    setNotes((l) => [...l, { id, ...draft, text: t, by: name.trim() || 'Guest', done: false }])
    setDraft(null); setText(''); setOn(false); setOpen(id); say('Comment posted')
  }
  // Keep cards on screen near the right edge.
  const flip = (x: number) => (typeof window !== 'undefined' && x > window.innerWidth - 330 ? 'left' : '')
  const openCount = notes.filter((n) => !n.done).length

  return (
    <div className="notes-ui">
      <div className="notes-layer">
        {notes.map((n) => (
          <div key={n.id} className="note-at" style={{ left: n.x, top: n.y }}>
            <button className="note-pin" onClick={() => setOpen(open === n.id ? null : n.id)} aria-label={`Comment ${n.id}`} aria-expanded={open === n.id}><WPin n={n.id} done={n.done} /></button>
            {open === n.id && (
              <div className={`pop ${flip(n.x)}`}>
                <WThread n={n.id} author={n.by} text={n.text} done={n.done} meta={<>on {n.on}</>}
                  onDone={() => setNotes((l) => l.map((x) => (x.id === n.id ? { ...x, done: !x.done } : x)))}
                  onDelete={() => { setNotes((l) => l.filter((x) => x.id !== n.id)); setOpen(null) }}
                  onClose={() => setOpen(null)} />
              </div>
            )}
          </div>
        ))}
        {draft && (
          <div className="note-at" style={{ left: draft.x, top: draft.y }}>
            <span className="note-pin"><WPin n="+" className="draft" /></span>
            <div className={`pop ${flip(draft.x)}`}>
              <div className="w w-card">
                <div className="w-top"><b>New comment</b><span className="w-meta">on {draft.on}</span><span className="w-grow" /><button className="w-ic" onClick={() => { setDraft(null); setText('') }} aria-label="Cancel"><IcX size={14} /></button></div>
                <textarea ref={box} className="w-input" value={text} onChange={(e) => setText(e.target.value)} placeholder="What should change here?" rows={3} aria-label="Your comment"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); post() } }} />
                <div className="w-actions">
                  <span className="w-as">as</span>
                  <input className="w-input name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Your name" />
                  <span className="w-grow" />
                  <button className="w-btn" onClick={() => { setDraft(null); setText('') }}>Cancel</button>
                  <button className="w-btn primary" onClick={post} disabled={!text.trim()}>Post</button>
                </div>
                <p className="w-fine">A demo of the widget: this comment stays in this tab.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {on && <div className="w w-hint" role="status">Click anywhere to comment · Esc to cancel</div>}
      {toast && <div className="w w-toast" role="status">{toast}</div>}
      <div className="dock-at" role="region" aria-label="Comments on this page">
        <WDock active={on} count={openCount} onComment={() => (on ? stop() : setOn(true))}
          onList={() => { const last = notes[notes.length - 1]; if (last) { setOpen(last.id); window.scrollTo({ top: last.y - window.innerHeight / 2, behavior: 'smooth' }) } else setOn(true) }} />
      </div>
    </div>
  )
}
