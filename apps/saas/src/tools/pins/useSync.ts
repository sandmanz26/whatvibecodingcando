import { useCallback, useEffect, useRef, useState } from 'react'
import { APP, LOCAL_SCOPE, TOOLS_API, readJSON, writeJSON } from '../shared'
import { validNotes, type PinNote } from './format'

export type SyncStatus = 'connecting' | 'synced' | 'saving' | 'local' | 'error'

export const STATUS_TEXT: Record<SyncStatus, string> = {
  synced: 'Synced — visible in any browser',
  saving: 'Saving…',
  connecting: 'Connecting…',
  local: 'Local only — no server configured',
  error: 'Sync error — saved on this device only',
}

const KEY = `${APP}.reviewPins`
const POLL_MS = 15000
const PUSH_DEBOUNCE = 700

/**
 * The whole set of notes, painted from localStorage first, then synced with the
 * server when one is configured. The server stores the full array and the last
 * write wins — accepted for a low-traffic internal tool.
 *
 * `busy` is true while someone is placing a pin, dragging one or has a note
 * open; polls are fetched but not applied then, so nobody's edit is yanked away.
 */
export function usePinSync(busy: boolean) {
  const [notes, setNotes] = useState<PinNote[]>(() => validNotes(readJSON(KEY, [])))
  const [status, setStatus] = useState<SyncStatus>(TOOLS_API ? 'connecting' : 'local')
  const [scope, setScope] = useState(LOCAL_SCOPE)
  const remote = useRef(!!TOOLS_API)
  const ready = useRef(false)
  const pending = useRef(false)
  const lastReceived = useRef('')
  const busyRef = useRef(busy)
  busyRef.current = busy

  useEffect(() => writeJSON(KEY, notes), [notes])

  const pull = useCallback(async () => {
    if (!remote.current) return
    try {
      const r = await fetch(`${TOOLS_API}/review-pins`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.configured) { remote.current = false; setStatus('local'); return }
      setScope(j.scope)
      if (ready.current && (busyRef.current || pending.current)) return
      const incoming = validNotes(j.annotations)
      lastReceived.current = JSON.stringify(incoming)
      ready.current = true
      setNotes(incoming)
      setStatus('synced')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!TOOLS_API) return
    void pull()
    const t = window.setInterval(pull, POLL_MS)
    return () => window.clearInterval(t)
  }, [pull])

  // Push after 700 ms of quiet; never push back what was just received.
  useEffect(() => {
    if (!remote.current || !ready.current) return
    const body = JSON.stringify(notes)
    if (body === lastReceived.current) return
    pending.current = true
    setStatus('saving')
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(`${TOOLS_API}/review-pins`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ annotations: notes }) })
        const j = await r.json()
        if (!j.configured) { remote.current = false; setStatus('local'); return }
        lastReceived.current = body
        setScope(j.scope)
        setStatus('synced')
      } catch {
        setStatus('error')
      } finally {
        pending.current = false
      }
    }, PUSH_DEBOUNCE)
    return () => { window.clearTimeout(t); pending.current = false }
  }, [notes])

  return { notes, setNotes, status, scope }
}
