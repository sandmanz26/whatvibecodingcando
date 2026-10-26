import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Sparkles, X, Send } from 'lucide-react'
import { useStore } from '../store/store'
import { assistantReply, rp, type Reply } from '../lib/ai'
import { Placeholder, Stars } from './ui'

interface Msg { from: 'you' | 'ai'; text: string; reply?: Reply }

const STARTERS = ['Running shoes for a beginner under 500k', 'A gift for someone who loves coffee', 'Quiet headphones for working', 'Sunscreen for oily skin']

/** The shopping assistant: a side panel that turns a plain request into a few picks. */
export function Assistant() {
  const { assistant, closeAssistant } = useStore()
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const list = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  // Moving to another page closes the panel; the conversation stays for next time.
  useEffect(() => { closeAssistant() }, [pathname, closeAssistant])

  const send = (t: string) => {
    const m = t.trim()
    if (!m) return
    const prev = msgs.filter((x) => x.from === 'you').at(-1)?.text ?? ''
    // Follow-ups refine the last request instead of starting over.
    const full = /^(cheaper|best rated)/i.test(m) && prev ? `${prev} ${/cheaper/i.test(m) ? 'cheapest' : /best/i.test(m) ? 'best rated' : ''}` : m
    setMsgs((x) => [...x, { from: 'you', text: m }, { from: 'ai', text: '', reply: assistantReply(full) }])
    setText('')
  }

  useEffect(() => { if (assistant.open && assistant.prompt) send(assistant.prompt) }, [assistant.at]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }) }, [msgs])
  useEffect(() => {
    if (!assistant.open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && closeAssistant()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [assistant.open, closeAssistant])

  if (!assistant.open) return null
  return (
    <aside className="ai-panel" role="dialog" aria-label="Shopping assistant">
      <div className="ai-head">
        <b className="row" style={{ gap: 8 }}><Sparkles size={16} /> Shopping assistant</b>
        <button className="btn ghost sm icon" onClick={closeAssistant} aria-label="Close assistant"><X size={15} /></button>
      </div>
      <div className="ai-list" ref={list}>
        {msgs.length === 0 && (
          <div className="ai-hello">
            <p>Tell me what you need, who it’s for, or your budget. I’ll pick a few products.</p>
            <div className="ai-chips">{STARTERS.map((s) => <button key={s} className="chip" onClick={() => send(s)}>{s}</button>)}</div>
          </div>
        )}
        {msgs.map((m, i) => m.from === 'you'
          ? <div key={i} className="ai-you">{m.text}</div>
          : (
            <div key={i} className="ai-ai">
              <p>{m.reply!.text}</p>
              <div className="ai-picks">
                {m.reply!.products.map((p) => (
                  <Link key={p.id} to={`/product/${p.id}`} className="ai-pick" onClick={closeAssistant}>
                    <Placeholder label="Photo" />
                    <span><b>{p.title}</b><span>{rp(p.price)} · <Stars value={p.rating} /></span></span>
                  </Link>
                ))}
              </div>
              {i === msgs.length - 1 && <div className="ai-chips">{m.reply!.follow.map((f) => <button key={f} className="chip" onClick={() => send(f)}>{f}</button>)}</div>}
            </div>
          ))}
      </div>
      <form className="ai-input" onSubmit={(e) => { e.preventDefault(); send(text) }}>
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask for anything…" aria-label="Message the assistant" />
        <button className="btn primary icon" type="submit" aria-label="Send"><Send size={15} /></button>
      </form>
      <p className="ai-note">Prototype: answers are scripted from the sample catalogue.</p>
    </aside>
  )
}
