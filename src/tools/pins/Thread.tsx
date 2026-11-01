import { useEffect, useRef, useState } from 'react'
import { Trash2, CornerDownRight } from 'lucide-react'
import { MAX_TEXT, replyVoiceId, type PinNote, type Reply } from './format'
import { VoiceNote } from '../voice/VoiceNote'
import { deleteClip } from '../voice/audio'

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** The replies under a comment, and a box to write one — with text, a voice note, or both. */
export function Thread({ note, me, ago, onReply, onDelete }: {
  note: PinNote
  me: string
  ago: (iso: string) => string
  onReply: (r: Reply) => void
  onDelete: (r: Reply) => void
}) {
  const replies = note.replies ?? []
  const [draftId, setDraftId] = useState(rid)
  const [text, setText] = useState('')
  const [voiceMs, setVoiceMs] = useState<number | undefined>(undefined)
  const posted = useRef(false)
  const pending = useRef<{ id: string; ms?: number }>({ id: draftId })
  pending.current = { id: draftId, ms: voiceMs }

  // A voice note recorded for a reply that was never sent is thrown away.
  useEffect(() => () => { if (pending.current.ms !== undefined && !posted.current) void deleteClip(replyVoiceId(pending.current.id)) }, [])

  const send = () => {
    if (!text.trim() && voiceMs === undefined) return
    posted.current = true
    onReply({ id: draftId, author: me, text: text.trim(), at: new Date().toISOString(), ...(voiceMs !== undefined ? { voice: { ms: voiceMs } } : {}) })
    setText('')
    setVoiceMs(undefined)
    setDraftId(rid())
    posted.current = false
  }

  return (
    <div className="rp-thread">
      {replies.length > 0 && (
        <ol className="rp-replies" aria-label="Replies">
          {replies.map((r) => (
            <li key={r.id}>
              <div className="rp-reply-head">
                <CornerDownRight size={12} aria-hidden /><b>{r.author}</b><span>· {ago(r.at)}</span>
                {r.author === me && !note.resolved && <button className="btn ghost sm icon" onClick={() => { if (r.voice) void deleteClip(replyVoiceId(r.id)); onDelete(r) }} aria-label="Delete reply" title="Delete reply"><Trash2 size={12} /></button>}
              </div>
              {r.text && <p>{r.text}</p>}
              {r.voice && <VoiceNote clipId={replyVoiceId(r.id)} ms={r.voice.ms} editable={false} onChange={() => {}} />}
            </li>
          ))}
        </ol>
      )}
      {!note.resolved && (
        <div className="rp-compose">
          <textarea rows={2} maxLength={MAX_TEXT} value={text} onChange={(e) => setText(e.target.value)} placeholder={replies.length ? 'Reply…' : 'Write a reply…'} aria-label="Reply"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send() } }} />
          <div className="rp-compose-foot">
            <VoiceNote key={draftId} clipId={replyVoiceId(draftId)} ms={voiceMs} editable onChange={setVoiceMs} />
            <button className="btn sm" onClick={send} disabled={!text.trim() && voiceMs === undefined}>Reply</button>
          </div>
        </div>
      )}
    </div>
  )
}
