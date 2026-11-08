import { useState } from 'react'
import { RotateCcw, Check, TriangleAlert } from 'lucide-react'
import { VOICE_DB } from './tools/voice/audio'

/**
 * Reset everything: reached only by URL (`/content/__reset` or `#/__reset`), never linked.
 * Shown instead of the app, so no tool is running and writing data back while it clears.
 *
 * It clears only this site's data. The SaaS app is on the same domain and prefixes all of its
 * storage with "saas:", so those keys are left alone, as is its own voice database.
 */
const OTHER_SYSTEM = 'saas:'

export const isResetUrl = () => /\/__reset\/?$/.test(window.location.pathname) || /^#\/?__reset\/?$/.test(window.location.hash)

function ownKeys(store: Storage): string[] {
  const keys: string[] = []
  try {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i)
      if (k !== null && !k.startsWith(OTHER_SYSTEM)) keys.push(k)
    }
  } catch { /* storage blocked */ }
  return keys
}

function deleteDb(name: string): Promise<'deleted' | 'blocked' | 'failed'> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = () => resolve('deleted')
      req.onerror = () => resolve('failed')
      // Another tab still has it open; it is deleted once that tab closes.
      req.onblocked = () => resolve('blocked')
    } catch { resolve('failed') }
  })
}

/** Where the site starts: the folder this page is served from. */
const home = () => `${window.location.pathname.replace(/__reset\/?$/, '')}#/`

export function ResetPage() {
  const [counts] = useState(() => ({ local: ownKeys(localStorage).length, session: ownKeys(sessionStorage).length }))
  const [state, setState] = useState<'ask' | 'busy' | 'done'>('ask')
  const [voice, setVoice] = useState<'deleted' | 'blocked' | 'failed'>('deleted')
  const [left, setLeft] = useState(0)

  const reset = async () => {
    setState('busy')
    for (const store of [localStorage, sessionStorage]) for (const k of ownKeys(store)) { try { store.removeItem(k) } catch { /* ignore */ } }
    setVoice(await deleteDb(VOICE_DB))
    setLeft(ownKeys(localStorage).length + ownKeys(sessionStorage).length)
    setState('done')
  }

  return (
    <main className="reset-page">
      <div className="reset-card" role="dialog" aria-labelledby="reset-title">
        {state !== 'done' ? (
          <>
            <span className="reset-icon" aria-hidden><RotateCcw size={20} /></span>
            <h1 id="reset-title">Reset everything?</h1>
            <p>This puts the content site back to how a first visitor sees it, in this browser:</p>
            <ul>
              <li>cart, orders and the shop version</li>
              <li>comments, compare reviews, design tokens and the dock’s position</li>
              <li>sessions, heatmap runs, usability and 5-second tests, fake doors, eye-tracking points</li>
              <li>voice notes and narrations</li>
            </ul>
            <p className="reset-muted">{counts.local + counts.session} saved item{counts.local + counts.session === 1 ? '' : 's'} found. The SaaS app’s data on this domain is not touched. This can’t be undone.</p>
            <div className="reset-actions">
              <a className="btn" href={home()}>Cancel</a>
              <button className="btn primary" onClick={() => void reset()} disabled={state === 'busy'}>{state === 'busy' ? 'Resetting…' : 'Reset everything'}</button>
            </div>
          </>
        ) : (
          <>
            <span className="reset-icon ok" aria-hidden><Check size={20} /></span>
            <h1 id="reset-title">Everything is reset</h1>
            {left > 0 && <p className="reset-warn"><TriangleAlert size={14} /> {left} item{left === 1 ? ' was' : 's were'} written again meanwhile, probably by another open tab. Close the site’s other tabs and reset again.</p>}
            {voice === 'blocked' && <p className="reset-warn"><TriangleAlert size={14} /> Voice recordings will be removed once the site’s other tabs are closed.</p>}
            {voice === 'failed' && <p className="reset-warn"><TriangleAlert size={14} /> Voice recordings couldn’t be removed in this browser.</p>}
            <p className="reset-muted">If the site is open in other tabs, reload them, or they may save their old data again.</p>
            <div className="reset-actions">
              <button className="btn primary" onClick={() => window.location.replace(home())}>Open the site</button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
