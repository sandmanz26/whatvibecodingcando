import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { Timer } from 'lucide-react'
import { isConsole, isEmbedded } from '../shared'
import { describeTarget } from '../insights/tracker'
import { addFiveSecResult, loadFiveSec, uid, type FiveSecTest } from './store'

type Phase = 'intro' | 'showing' | 'done'

/**
 * Participant side of a 5-second test. Starts from any URL with ?fivesec=<id>: the screen
 * stays covered until they are ready, shows for five seconds, and the first click is kept.
 */
export function FiveSecRunner() {
  const { pathname, search } = useLocation()
  const nav = useNavigate()
  const [test, setTest] = useState<FiveSecTest | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [left, setLeft] = useState(0)
  const [result, setResult] = useState<{ missed: boolean; ms?: number } | null>(null)
  const started = useRef(0)
  const catcher = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = new URLSearchParams(search)
    const id = q.get('fivesec')
    if (!id || q.has('heatmap') || isEmbedded) return
    const t = loadFiveSec().find((x) => x.id === id)
    if (!t) return
    setTest(t)
    setPhase('intro')
    setResult(null)
    nav({ pathname: t.page, search: t.query ? `?${t.query}` : '' }, { replace: true })
  }, [search, pathname, nav])

  const finish = (r: Parameters<typeof addFiveSecResult>[0]) => {
    addFiveSecResult(r)
    setResult({ missed: !!r.missed, ms: r.ms })
    setPhase('done')
  }

  useEffect(() => {
    if (phase !== 'showing' || !test) return
    const t = window.setInterval(() => {
      const ms = Date.now() - started.current
      setLeft(Math.max(0, test.seconds * 1000 - ms))
      if (ms >= test.seconds * 1000) {
        window.clearInterval(t)
        finish({ id: uid(), testId: test.id, t: new Date().toISOString(), vw: window.innerWidth, vh: window.innerHeight, missed: true })
      }
    }, 50)
    return () => window.clearInterval(t)
  }, [phase, test]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!test || isConsole(pathname)) return null

  const onClick = (e: React.MouseEvent) => {
    if (phase !== 'showing') return
    const ms = Date.now() - started.current
    // The click lands on the transparent layer; find what was underneath it.
    const under = document.elementsFromPoint(e.clientX, e.clientY).find((el) => !catcher.current?.contains(el))
    if (!under) return
    const { el, sel, label } = describeTarget(under)
    const box = el.getBoundingClientRect()
    let hit = false
    if (test.target) { try { hit = [...document.querySelectorAll(test.target.sel)].some((m) => m.contains(under)) } catch { /* old selector */ } }
    finish({
      id: uid(), testId: test.id, t: new Date().toISOString(), vw: window.innerWidth, vh: window.innerHeight, ms,
      x: Math.round((e.clientX / window.innerWidth) * 1000) / 10, y: Math.round(e.clientY + window.scrollY), docH: document.documentElement.scrollHeight,
      ex: box.width ? Math.round(((e.clientX - box.left) / box.width) * 1000) / 10 : 50,
      ey: box.height ? Math.round(((e.clientY - box.top) / box.height) * 1000) / 10 : 50,
      sel, label, ...(test.target ? { hit } : {}),
    })
  }

  const close = () => setTest(null)

  return createPortal(
    <div data-insights-ignore data-fivesec>
      {phase === 'showing' && (
        <div ref={catcher} className="fs-catch" onClick={onClick}>
          <div className="fs-bar"><i style={{ width: `${(left / (test.seconds * 1000)) * 100}%` }} /></div>
        </div>
      )}
      {phase !== 'showing' && (
        <div className="fs-cover">
          <div className="fs-card">
            <span className="fs-icon"><Timer size={18} /></span>
            {phase === 'intro' ? (
              <>
                <h2>A {test.seconds}-second look</h2>
                <p>{test.prompt}</p>
                <p className="muted">The screen shows for {test.seconds} seconds. Your first click counts; nothing you type is recorded.</p>
                <div className="row" style={{ gap: 8, justifyContent: 'center', marginTop: 16 }}>
                  <button className="btn" onClick={close}>Not now</button>
                  <button className="btn primary" onClick={() => { started.current = Date.now(); setLeft(test.seconds * 1000); setPhase('showing') }}>Show the screen</button>
                </div>
              </>
            ) : (
              <>
                <h2>Thank you</h2>
                <p>{result?.missed ? 'Time ran out before a click — that’s useful to know too.' : `Your click was recorded after ${((result?.ms ?? 0) / 1000).toFixed(1)} s.`}</p>
                <button className="btn primary" style={{ marginTop: 16 }} onClick={close}>Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body,
  )
}
