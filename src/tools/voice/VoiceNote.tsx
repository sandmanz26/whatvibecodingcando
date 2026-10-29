import { useEffect, useRef, useState } from 'react'
import { Mic, Square, Trash2 } from 'lucide-react'
import { clipUrl, clock, deleteClip, putClip, startRecording, type Recording } from './audio'

/**
 * Records, plays and removes the voice note of one comment. The microphone starts only on
 * "Record voice note"; closing the card while recording throws that recording away.
 */
export function VoiceNote({ clipId, ms, editable, onChange }: { clipId: string; ms?: number; editable: boolean; onChange: (ms: number | undefined) => void }) {
  const [rec, setRec] = useState<Recording | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [missing, setMissing] = useState(false)
  const [error, setError] = useState('')
  const [, setTick] = useState(0)
  const recRef = useRef<Recording | null>(null)
  recRef.current = rec

  useEffect(() => {
    if (ms === undefined) { setUrl(null); return }
    let u: string | null = null
    void clipUrl(clipId).then((x) => { u = x; setUrl(x); setMissing(!x) })
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [clipId, ms])
  useEffect(() => () => recRef.current?.cancel(), [])
  useEffect(() => {
    if (!rec) return
    const t = window.setInterval(() => setTick((x) => x + 1), 120)
    return () => window.clearInterval(t)
  }, [rec])

  const start = async () => {
    setError('')
    try { setRec(await startRecording()) } catch (e) { setError((e as Error).message) }
  }
  const stop = async () => {
    const r = recRef.current
    if (!r) return
    setRec(null)
    const { blob, ms: len } = await r.stop()
    await putClip(clipId, blob)
    onChange(len)
  }

  if (rec) return (
    <div className="vn vn-rec" role="status">
      <i className="vo-dot" /> <span className="num">{clock(rec.elapsed())}</span>
      <span className="vo-meter" aria-hidden><i style={{ width: `${Math.round(rec.level() * 100)}%` }} /></span>
      <button className="btn sm" onClick={() => void stop()}><Square size={12} /> Stop</button>
    </div>
  )
  if (ms !== undefined) return (
    <div className="vn">
      {url ? <audio controls src={url} preload="metadata" aria-label={`Voice note, ${clock(ms)}`} /> : <span className="muted" style={{ fontSize: 12.5 }}>{missing ? `Voice note (${clock(ms)}) — the audio is only in the browser that recorded it` : 'Loading…'}</span>}
      {editable && <button className="btn ghost sm icon" onClick={() => { void deleteClip(clipId); onChange(undefined) }} aria-label="Delete voice note" title="Delete voice note"><Trash2 size={13} /></button>}
    </div>
  )
  if (!editable) return null
  return (
    <div className="vn">
      <button className="btn sm" onClick={() => void start()}><Mic size={13} /> Record voice note</button>
      {error && <span style={{ color: 'var(--critical-ink)', fontSize: 12.5 }}>{error}</span>}
    </div>
  )
}
