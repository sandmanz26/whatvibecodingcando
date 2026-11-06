import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ScreenViewer } from '../tools/insights/ScreenViewer'

/** The real screen a finding is about, with its element ringed. */
export function ScreenDrawer({ title, page, query, sel, onClose }: { title: string; page: string; query?: string; sel?: string; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} data-insights-ignore>
        <div className="drawer-head">
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 16 }}>{title}</h2>
            <div className="muted mono" style={{ fontSize: 12.5 }}>{page}{query ? `?${query}` : ''}</div>
          </div>
          <button className="btn ghost sm icon" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <ScreenViewer key={`${page}${query}${sel}`} page={page} query={query} device="desktop" mode="dots" focus={sel} maxHeight={Math.max(360, window.innerHeight - 200)} />
        {sel && <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>The outlined box is the element. Orange dots are recorded taps on this screen.</p>}
      </aside>
    </>
  )
}
