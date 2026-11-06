/**
 * Voice — recording from the microphone and keeping the audio in this browser.
 *
 * Privacy rules:
 * - The microphone only starts when someone presses a record button, and a visible
 *   indicator shows while it is on. It stops when they stop (or leave the page).
 * - Audio stays in this browser (IndexedDB). Nothing is uploaded or transcribed.
 *
 * Audio is too big for localStorage, so clips live in IndexedDB keyed by id; the
 * notes and narrations that use them keep only the id and length.
 */
import { APP } from '../shared'

const DB = `${APP}-voice`
const STORE = 'clips'

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const r = run(d.transaction(STORE, mode).objectStore(STORE))
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

export const putClip = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id)).then(() => undefined)
export const getClip = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
export const deleteClip = (id: string) => tx('readwrite', (s) => s.delete(id)).then(() => undefined).catch(() => undefined)

/** An object URL for a stored clip; revoke it when done. */
export async function clipUrl(id: string): Promise<string | null> {
  const b = await getClip(id).catch(() => undefined)
  return b ? URL.createObjectURL(b) : null
}

/* ---------- recording ---------- */

const MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']
export const extOf = (type: string) => (type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm')

export interface Recording {
  /** 0–1 microphone level, for a live meter */
  level(): number
  /** ms since recording started */
  elapsed(): number
  stop(): Promise<{ blob: Blob; ms: number }>
  /** stop and throw the audio away */
  cancel(): void
}

export const micSupported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

/** Asks for the microphone and starts recording. Throws a readable Error when it can't. */
export async function startRecording(): Promise<Recording> {
  if (!micSupported()) throw new Error('This browser can’t record audio.')
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch (e) {
    throw new Error(e instanceof DOMException && e.name === 'NotAllowedError' ? 'The microphone wasn’t allowed.' : 'No microphone was found.')
  }
  const mimeType = MIME.find((m) => MediaRecorder.isTypeSupported(m))
  const rec = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 48000 } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  rec.start(1000)
  const started = performance.now()

  // A level meter, so it's obvious the microphone hears something.
  const ctx = new AudioContext()
  const analyser = ctx.createAnalyser()
  analyser.fftSize = 512
  ctx.createMediaStreamSource(stream).connect(analyser)
  const buf = new Uint8Array(analyser.fftSize)
  const end = () => { stream.getTracks().forEach((t) => t.stop()); void ctx.close() }

  return {
    level() {
      analyser.getByteTimeDomainData(buf)
      let peak = 0
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128))
      return Math.min(1, peak / 64)
    },
    elapsed: () => performance.now() - started,
    stop() {
      return new Promise((resolve) => {
        rec.onstop = () => { end(); resolve({ blob: new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), ms: Math.round(performance.now() - started) }) }
        rec.stop()
      })
    },
    cancel() { rec.onstop = () => end(); rec.stop() },
  }
}

export const clock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
