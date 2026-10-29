import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Square, Play, Pause } from 'lucide-react'
import { isEmbedded, safeQuery } from '../shared'
import { clock, getClip, putClip, startRecording, type Recording } from './audio'
import { NARRATE_EVENT, NARRATION_CHANGED, audioId, clipsFor, loadNarrations, saveNarrations, type Chapter, type Clip, type Narration } from './narration'

const uid = () => Math.random().toString(36).slice(2, 10)
let recording = false
/** Is a walkthrough being recorded right now? */
export const narrating = () => recording
/** a screen visited for less than this is folded into the next one (passing through) */
const MIN_CHAPTER_MS = 1200

/**
 * Records a live walkthrough: the microphone runs while you move through the app, and each
 * screen becomes a chapter. Start and stop it from the dock (or NARRATE_EVENT).
 */
export function NarrationRecorder() {
  const { pathname } = useLocation()
  const nav = useNavigate()
  const [rec, setRec] = useState<Recording | null>(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<Narration | null>(null)
  const [, setTick] = useState(0)
  const chapters = useRef<Chapter[]>([])
  const recRef = useRef<Recording | null>(null)
  recRef.current = rec

  const start = async () => {
    if (recRef.current) return
    setError('')
    setSaved(null)
    try {
      const r = await startRecording()
      chapters.current = [{ page: window.location.hash.replace(/^#/, '').split('?')[0] || '/', ...(safeQuery() ? { query: safeQuery() } : {}), at: 0 }]
      setRec(r)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const stop = async () => {
    const r = recRef.current
    if (!r) return
    setRec(null)
    const { blob, ms } = await r.stop()
    const n: Narration = {
      id: uid(),
      title: `Walkthrough · ${new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
      startedAt: new Date(Date.now() - ms).toISOString(), ms, chapters: chapters.current, type: blob.type,
    }
    await putClip(audioId(n), blob)
    saveNarrations([...loadNarrations(), n])
    setSaved(n)
    window.setTimeout(() => setSaved((s) => (s?.id === n.id ? null : s)), 6000)
  }

  useEffect(() => {
    if (isEmbedded) return
    const on = (e: Event) => { const d = (e as CustomEvent).detail; if (d === 'start') void start(); if (d === 'stop') void stop() }
    window.addEventListener(NARRATE_EVENT, on)
    return () => window.removeEventListener(NARRATE_EVENT, on)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A new screen starts a new chapter; a screen passed through quickly is folded into the next.
  useEffect(() => {
    const r = recRef.current
    if (!r) return
    const at = Math.round(r.elapsed())
    const list = chapters.current
    const last = list[list.length - 1]
    if (last.page === pathname) return
    const q = safeQuery()
    const next = { page: pathname, ...(q ? { query: q } : {}), at }
    if (list.length > 1 && at - last.at < MIN_CHAPTER_MS) list[list.length - 1] = { ...next, at: last.at }
    else list.push(next)
  }, [pathname])

  // The microphone is on: show it, keep the timer moving, and warn before leaving the page.
  useEffect(() => {
    if (!rec) return
    const t = window.setInterval(() => setTick((x) => x + 1), 120)
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => { window.clearInterval(t); window.removeEventListener('beforeunload', warn) }
  }, [rec])
  useEffect(() => { recording = !!rec; window.dispatchEvent(new Event(NARRATION_CHANGED)) }, [rec])

  if (isEmbedded || (!rec && !error && !saved)) return null
  return createPortal(
    <div className="vo-pill" role="status" data-insights-ignore>
      {rec ? (
        <>
          <i className="vo-dot" />
          <b>Narrating</b>
          <span className="num">{clock(rec.elapsed())}</span>
          <span className="vo-meter" aria-hidden><i style={{ width: `${Math.round(rec.level() * 100)}%` }} /></span>
          <span className="mono vo-page">{pathname}</span>
          <span className="muted">· {chapters.current.length} screen{chapters.current.length === 1 ? '' : 's'}</span>
          <button className="btn sm" onClick={() => void stop()}><Square size={12} /> Stop</button>
        </>
      ) : error ? (
        <><span>{error}</span><button className="btn sm ghost" onClick={() => setError('')}>OK</button></>
      ) : saved && (
        <><span>Narration saved · {clock(saved.ms)} · {saved.chapters.length} screen{saved.chapters.length === 1 ? '' : 's'}</span><button className="btn sm" onClick={() => { setSaved(null); nav('/console/narration') }}>Open</button></>
      )}
    </div>,
    document.body,
  )
}

/** Plays what was said about the current screen, chapter by chapter. Lives in the dock. */
export function ExplainButton() {
  const { pathname } = useLocation()
  const [clips, setClips] = useState<Clip[]>(() => clipsFor(pathname))
  const [playing, setPlaying] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const sync = () => setClips(clipsFor(pathname))
    sync()
    window.addEventListener(NARRATION_CHANGED, sync)
    return () => window.removeEventListener(NARRATION_CHANGED, sync)
  }, [pathname])
  // Leaving the screen stops its explanation.
  useEffect(() => () => { audio.current?.pause(); setPlaying(false) }, [pathname])

  const play = async () => {
    if (playing) { audio.current?.pause(); setPlaying(false); return }
    const c = clips[0]
    const blob = await getClip(audioId(c.narration)).catch(() => undefined)
    if (!blob) return
    const a = audio.current ?? new Audio()
    audio.current = a
    if (a.src) URL.revokeObjectURL(a.src)
    a.src = URL.createObjectURL(blob)
    a.currentTime = c.from / 1000
    a.ontimeupdate = () => { if (a.currentTime * 1000 >= c.to) { a.pause(); setPlaying(false) } }
    a.onended = () => setPlaying(false)
    await a.play()
    setPlaying(true)
  }

  if (!clips.length) return null
  const ms = clips[0].to - clips[0].from
  return (
    <button className={`dock-rec ${playing ? 'on' : ''}`} onClick={() => void play()} title={`Play the explanation recorded for this screen (${clock(ms)})`}>
      {playing ? <Pause size={13} /> : <Play size={13} />} Explain {clock(ms)}
    </button>
  )
}
