import { useMemo, useState } from 'react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { Empty, Modal } from '../components/ui'
import { DEVICES, ScreenViewer, type Device } from '../tools/insights/ScreenViewer'
import { layoutOf } from '../tools/insights/store'
import { clearGaze, loadGaze, loadGazeSessions } from '../tools/gaze/store'

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function EyeTracking() {
  const [ver, setVer] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const points = useMemo(() => (ver >= 0 ? loadGaze() : []), [ver])
  const sessions = useMemo(() => (ver >= 0 ? loadGazeSessions() : []), [ver])
  const pages = useMemo(() => {
    const m = new Map<string, number>()
    points.forEach((p) => m.set(p.page, (m.get(p.page) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [points])
  const [page, setPage] = useState<string | null>(null)
  const [device, setDevice] = useState<Device>('desktop')
  const shown = page ?? pages[0]?.[0] ?? '/'
  const start = `${window.location.pathname}${window.location.search}#/?gaze`

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Eye tracking</h1>
          <p>Estimates where people look, using their webcam, after a one-minute calibration. The video never leaves their browser and is never saved; only the estimated point on the page is kept. Webcam tracking is coarse (usually 100–200 px), so read the heatmap as areas, not single buttons.</p>
        </div>
        <div className="actions">
          <a className="btn primary" href={start} target="_blank" rel="noopener">Start a session <ExternalLink size={12} /></a>
          <button className="btn ghost danger" onClick={() => setConfirm(true)} disabled={!points.length} aria-label="Delete all gaze data"><Trash2 size={14} /></button>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="card"><Empty title="No gaze data yet"><span style={{ maxWidth: 480 }}>Start a session: the participant allows the camera, follows nine dots, sees how accurate the calibration is, then uses the app. Press Stop on the small bar when done, then come back here.</span></Empty></div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 260px', alignItems: 'start' }}>
          <section className="card">
            <div className="card-head">
              <div><h2>Where people looked</h2><p>All sessions on one screen, at one width</p></div>
              <div className="row wrap">
                <select className="select" style={{ width: 200, height: 30 }} value={shown} onChange={(e) => setPage(e.target.value)} aria-label="Screen">
                  {pages.map(([p, n]) => <option key={p} value={p}>{p} · {n} samples</option>)}
                </select>
                <div className="seg" role="group" aria-label="Device">
                  {(Object.keys(DEVICES) as Device[]).map((d) => <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
                </div>
              </div>
            </div>
            <div className="card-body"><ScreenViewer key={ver} page={shown} device={device} mode="gaze" /></div>
          </section>
          <section className="card">
            <div className="card-head"><div><h2>Sessions</h2><p>{sessions.length} calibrated</p></div></div>
            <div className="card-body" style={{ paddingTop: 4 }}>
              <div className="feed">
                {[...sessions].reverse().map((s) => {
                  const n = points.filter((p) => p.sid === s.sid).length
                  return (
                    <div key={s.sid} className="feed-item" style={{ gridTemplateColumns: '1fr auto' }}>
                      <div className="what"><b>{when(s.start)}</b><div className="muted" style={{ fontSize: 12 }}>{layoutOf(s.vw)} · {Math.round(n / 15)} s of gaze</div></div>
                      <span className="muted num" style={{ fontSize: 12.5 }}>±{s.accuracy ?? '?'} px</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>
        </div>
      )}
      {confirm && (
        <Modal title="Delete all gaze data?" description={`Removes ${points.length} gaze samples from this browser. This can’t be undone.`} onClose={() => setConfirm(false)}
          footer={<><button className="btn" onClick={() => setConfirm(false)}>Keep it</button><button className="btn primary" onClick={() => { clearGaze(); setConfirm(false); setVer((v) => v + 1) }}>Delete</button></>} />
      )}
    </main>
  )
}
