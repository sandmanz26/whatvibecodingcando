import { useState } from 'react'
import { ExternalLink, Plus, Trash2, Pencil, RotateCcw } from 'lucide-react'
import { Empty, Modal, Switch } from '../components/ui'
import { ScreenViewer, type Picked } from '../tools/insights/ScreenViewer'
import { DEFAULT_MESSAGE, clearDoorEvents, doorStats, loadDoors, saveDoors, uid, type FakeDoor } from '../tools/doors/store'

const pct = (n: number) => `${Math.round(n * 100)}%`
const appLink = (page: string) => `${window.location.pathname}${window.location.search}#${page}`

function Editor({ door, onSave, onClose }: { door: FakeDoor; onSave: (d: FakeDoor) => void; onClose: () => void }) {
  const [d, setD] = useState(door)
  const pick = (p: Picked) => setD((x) => ({ ...x, page: p.page, sel: p.sel, anchorLabel: p.label }))
  const ok = d.name.trim() && d.sel && (d.mode === 'existing' || d.label.trim())
  return (
    <Modal title={door.sel ? 'Edit fake door' : 'New fake door'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!ok} onClick={() => onSave(d)}>Save</button></>}>
      <div className="stack gap-12">
        <div className="field"><label htmlFor="fd-name">What it measures</label><input id="fd-name" className="input" value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="e.g. Would people export the skill list?" /></div>
        <div className="field">
          <label>Element</label>
          <span className="muted" style={{ fontSize: 13 }}>{d.sel ? <>On <span className="mono">{d.page}</span>: {d.anchorLabel}</> : 'Pick one below.'}</span>
        </div>
        <ScreenViewer page={d.page} device="desktop" mode="pick" onPick={pick} maxHeight={320} />
        <div className="seg" role="group" aria-label="Kind of door">
          <button aria-pressed={d.mode === 'new'} onClick={() => setD({ ...d, mode: 'new' })}>Add a new button after it</button>
          <button aria-pressed={d.mode === 'existing'} onClick={() => setD({ ...d, mode: 'existing' })}>Make this element the door</button>
        </div>
        {d.mode === 'new' && <div className="field"><label htmlFor="fd-label">Button text</label><input id="fd-label" className="input" value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} placeholder="e.g. Export CSV" /></div>}
        {d.mode === 'existing' && <p className="muted" style={{ fontSize: 12.5 }}>While the door is live, this element no longer does what it normally does.</p>}
        <div className="field"><label htmlFor="fd-msg">Shown after a click</label><textarea id="fd-msg" className="textarea" rows={2} value={d.message} onChange={(e) => setD({ ...d, message: e.target.value })} /></div>
      </div>
    </Modal>
  )
}

export default function FakeDoorsPage() {
  const [doors, setDoors] = useState(loadDoors)
  const [editing, setEditing] = useState<FakeDoor | null>(null)
  const [ver, setVer] = useState(0)
  const put = (next: FakeDoor[]) => { saveDoors(next); setDoors(next) }
  const save = (d: FakeDoor) => { put(doors.some((x) => x.id === d.id) ? doors.map((x) => (x.id === d.id ? d : x)) : [...doors, d]); setEditing(null) }
  const blank = (): FakeDoor => ({ id: uid(), name: '', page: '/', sel: '', anchorLabel: '', mode: 'new', label: '', message: DEFAULT_MESSAGE, live: false, createdAt: new Date().toISOString() })

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Fake doors</h1>
          <p>A button for something that isn’t built yet. Clicking it shows a short “coming soon” note; we count how many people saw the door and how many tried it. Only whether it was seen and clicked is recorded, per anonymous tab.</p>
        </div>
        <div className="actions"><button className="btn primary" onClick={() => setEditing(blank())}><Plus size={14} /> New fake door</button></div>
      </div>

      {doors.length === 0 ? <div className="card"><Empty title="No fake doors yet" /></div> : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table" key={ver}>
            <thead><tr><th>Door</th><th>Where</th><th>Live</th><th className="r">Saw it</th><th className="r">Clicked</th><th className="r">Click rate</th><th className="r">Clicks</th><th /></tr></thead>
            <tbody>
              {doors.map((d) => {
                const s = doorStats(d.id)
                return (
                  <tr key={d.id}>
                    <td><div style={{ fontWeight: 550 }}>{d.name}</div><div className="muted" style={{ fontSize: 12 }}>{d.mode === 'new' ? `New button “${d.label}”` : `Existing element: ${d.anchorLabel}`}</div></td>
                    <td><a className="mono row" style={{ gap: 4 }} href={appLink(d.page)} target="_blank" rel="noopener">{d.page}<ExternalLink size={11} /></a></td>
                    <td><Switch checked={d.live} onChange={() => put(doors.map((x) => (x.id === d.id ? { ...x, live: !x.live } : x)))} label={`${d.name} live`} /></td>
                    <td className="r num">{s.seen}</td>
                    <td className="r num">{s.clickedBy}</td>
                    <td className="r num"><b>{s.seen ? pct(s.rate) : '—'}</b></td>
                    <td className="r num">{s.clicks}</td>
                    <td className="r">
                      <span className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                        <button className="btn ghost sm icon" onClick={() => setEditing(d)} aria-label={`Edit ${d.name}`}><Pencil size={13} /></button>
                        <button className="btn ghost sm icon" onClick={() => { clearDoorEvents(d.id); setVer((v) => v + 1) }} aria-label={`Reset counts for ${d.name}`} title="Reset counts"><RotateCcw size={13} /></button>
                        <button className="btn ghost sm icon danger" onClick={() => { clearDoorEvents(d.id); put(doors.filter((x) => x.id !== d.id)) }} aria-label={`Delete ${d.name}`}><Trash2 size={13} /></button>
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Saw it and Clicked count tabs (people), not visits. Click rate = clicked ÷ saw it. Counts are kept in this browser.</p>
      {editing && <Editor door={editing} onSave={save} onClose={() => setEditing(null)} />}
    </main>
  )
}
