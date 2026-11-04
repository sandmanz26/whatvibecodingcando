import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { DEVICES } from '../insights/ScreenViewer'
import type { Slot } from './store'

const PAD = 12
type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'found'; x: number; y: number; w: number; h: number }

const firstVisible = (doc: Document, sel: string) => {
  try {
    return Array.from(doc.querySelectorAll(sel)).find((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }) ?? null
  } catch { return null }
}

/**
 * Shows only the component: the real screen loads in a frame at the component's device width,
 * scrolls the component into view, and the frame is clipped to its box. It is a preview, so it
 * can't be clicked. A component that only appears after an action (an open menu, a search) is
 * reported as not found instead of showing the wrong part of the screen.
 */
export function Crop({ slot, maxHeight = 320 }: { slot: Slot; maxHeight?: number }) {
  const wrap = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [avail, setAvail] = useState(400)
  const [st, setSt] = useState<State>({ kind: 'loading' })
  const d = DEVICES[slot.device]
  const src = `${window.location.pathname}${window.location.search}#${slot.page}?${[slot.query, 'embed'].filter(Boolean).join('&')}`

  useLayoutEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setSt({ kind: 'loading' })
    const f = frame.current
    if (!f) return
    let timer = 0
    let tries = 0
    const measure = () => {
      const doc = f.contentDocument
      const el = doc && firstVisible(doc, slot.sel)
      if (!el) {
        // The screen renders after the frame loads; give it a few seconds before saying it isn't there.
        if (++tries > 25) { setSt({ kind: 'missing' }); return }
        timer = window.setTimeout(measure, 160)
        return
      }
      // Scroll the frame itself (scrollIntoView would also scroll the console page).
      const win = f.contentWindow!
      const r0 = el.getBoundingClientRect()
      win.scrollTo(0, Math.max(0, r0.top + win.scrollY - Math.max(PAD, (d.h - r0.height) / 2)))
      const r = el.getBoundingClientRect()
      const x = Math.max(0, r.left - PAD), y = Math.max(0, r.top - PAD)
      setSt({ kind: 'found', x, y, w: Math.min(d.w - x, r.width + PAD * 2), h: Math.min(d.h - y, r.height + PAD * 2) })
    }
    const onLoad = () => { tries = 0; window.clearTimeout(timer); measure() }
    f.addEventListener('load', onLoad)
    if (f.contentDocument?.readyState === 'complete' && f.contentWindow?.location.href !== 'about:blank') onLoad()
    return () => { f.removeEventListener('load', onLoad); window.clearTimeout(timer) }
  }, [src, slot.sel, d.w, d.h])

  const found = st.kind === 'found' ? st : null
  const scale = found ? Math.min(1, avail / found.w, maxHeight / found.h) : 0.3
  return (
    <div className="cmp-crop" ref={wrap}>
      <div className="cmp-crop-box" style={found ? { width: found.w * scale, height: found.h * scale } : { width: '100%', height: 120 }}>
        <iframe
          ref={frame}
          key={src}
          src={src}
          title={`Preview of ${slot.label}`}
          tabIndex={-1}
          aria-hidden
          style={{ width: d.w, height: d.h, transform: `scale(${scale})`, left: found ? -found.x * scale : 0, top: found ? -found.y * scale : 0, visibility: found ? 'visible' : 'hidden' }}
        />
        {st.kind === 'loading' && <span className="cmp-crop-msg muted">Loading the component…</span>}
        {st.kind === 'missing' && <span className="cmp-crop-msg muted">Not on this screen when it opens. It may need an action first, such as an open menu, or the screen changed since it was picked.</span>}
      </div>
    </div>
  )
}
