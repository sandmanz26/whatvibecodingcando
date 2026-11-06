import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Copy, ExternalLink, Plus, Trash2, Target, Pencil } from 'lucide-react'
import { useStore } from '../store/store'
import { Empty, Modal } from '../components/ui'
import { DEVICES, ScreenViewer, type Device, type Picked } from '../tools/insights/ScreenViewer'
import { clearFiveSecResults, loadFiveSec, saveFiveSec, summarizeFiveSec, uid, type FiveSecTest } from '../tools/fivesec/store'

const link = (t: FiveSecTest) => `${window.location.origin}${window.location.pathname}#${t.page}?fivesec=${t.id}`
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—')

function Editor({ test, onSave, onClose }: { test: FiveSecTest; onSave: (t: FiveSecTest) => void; onClose: () => void }) {
  const [t, setT] = useState(test)
  const [picking, setPicking] = useState(false)
  const pick = (p: Picked) => setT((x) => ({ ...x, page: p.page, target: { sel: p.sel, label: p.label } }))
  return (
    <Modal title={test.name ? 'Edit 5-second test' : 'New 5-second test'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!t.name.trim() || !t.prompt.trim()} onClick={() => onSave(t)}>Save</button></>}>
      <div className="stack gap-12">
        <div className="field"><label htmlFor="fs-name">Name</label><input id="fs-name" className="input" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} placeholder="e.g. First look at the overview" /></div>
        <div className="field"><label htmlFor="fs-prompt">What participants are asked</label><textarea id="fs-prompt" className="textarea" rows={2} value={t.prompt} onChange={(e) => setT({ ...t, prompt: e.target.value })} placeholder="e.g. You want to find duplicate skills. Click where you would go first." /></div>
        <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div className="field" style={{ width: 140 }}><label htmlFor="fs-sec">Seconds</label><input id="fs-sec" className="input" type="number" min={3} max={15} value={t.seconds} onChange={(e) => setT({ ...t, seconds: Math.min(15, Math.max(3, Number(e.target.value) || 5)) })} /></div>
          <div className="field" style={{ flex: 1, minWidth: 200 }}><label>Screen</label><div className="row" style={{ gap: 8 }}><span className="mono">{t.page}</span>{t.target ? <span className="badge"><Target size={11} /> {t.target.label}</span> : <span className="muted">no right answer</span>}{t.target && <button className="btn ghost sm" onClick={() => setT({ ...t, target: undefined })}>Clear</button>}</div></div>
        </div>
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => setPicking((v) => !v)}>{picking ? 'Done picking' : 'Choose the screen and the right element'}</button>
        {picking && <ScreenViewer page={t.page} device="desktop" mode="pick" onPick={pick} maxHeight={360} />}
      </div>
    </Modal>
  )
}

export default function FiveSecond() {
  const { id } = useParams()
  const nav = useNavigate()
  const { toast } = useStore()
  const [tests, setTests] = useState(loadFiveSec)
  const [editing, setEditing] = useState<FiveSecTest | null>(null)
  const [device, setDevice] = useState<Device>('desktop')
  const [ver, setVer] = useState(0)
  const test = tests.find((t) => t.id === id) ?? tests[0]
  const sum = useMemo(() => (test && ver >= 0 ? summarizeFiveSec(test) : null), [test, ver])

  const save = (t: FiveSecTest) => {
    const next = tests.some((x) => x.id === t.id) ? tests.map((x) => (x.id === t.id ? t : x)) : [...tests, t]
    saveFiveSec(next); setTests(next); setEditing(null); nav(`/console/fivesec/${t.id}`)
  }
  const remove = (t: FiveSecTest) => { const next = tests.filter((x) => x.id !== t.id); saveFiveSec(next); clearFiveSecResults(t.id); setTests(next); nav('/console/fivesec') }
  const blank = (): FiveSecTest => ({ id: uid(), name: '', prompt: '', page: '/', seconds: 5, createdAt: new Date().toISOString() })

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>5-second tests</h1>
          <p>A screen shows for five seconds and the first click is recorded: where people expect to go before they have time to read. Send the participant link; results collect here.</p>
        </div>
        <div className="actions"><button className="btn primary" onClick={() => setEditing(blank())}><Plus size={14} /> New test</button></div>
      </div>

      {!test ? <div className="card"><Empty title="No 5-second tests yet" /></div> : (
        <div className="ses">
          <nav className="ses-list" aria-label="Tests">
            {tests.map((t) => {
              const s = summarizeFiveSec(t)
              return (
                <Link key={t.id} to={`/console/fivesec/${t.id}`} className={`ses-row ${t.id === test.id ? 'on' : ''}`}>
                  <b>{t.name}</b>
                  <span className="muted">{s.participants} participant{s.participants === 1 ? '' : 's'}{t.target ? ` · ${pct(s.hits, s.participants)} right` : ''}</span>
                </Link>
              )
            })}
          </nav>
          {sum && (
            <section className="stack gap-16" style={{ minWidth: 0 }}>
              <div className="card card-body">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <h2 style={{ fontSize: 17 }}>{test.name}</h2>
                    <p className="muted" style={{ fontSize: 13 }}>“{test.prompt}” · <span className="mono">{test.page}</span> · {test.seconds} s{test.target ? ` · right answer: ${test.target.label}` : ''}</p>
                  </div>
                  <div className="row wrap">
                    <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(link(test)); toast('Participant link copied') }}><Copy size={13} /> Copy link</button>
                    <a className="btn sm" href={link(test)} target="_blank" rel="noopener">Try it <ExternalLink size={12} /></a>
                    <button className="btn sm ghost" onClick={() => setEditing(test)} aria-label="Edit test"><Pencil size={13} /></button>
                    <button className="btn sm ghost danger" onClick={() => remove(test)} aria-label="Delete test"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
              <div className="grid g-4">
                <div className="card stat"><div className="stat-label">Participants</div><div className="stat-value num">{sum.participants}</div></div>
                <div className="card stat"><div className="stat-label">Clicked in time</div><div className="stat-value num">{pct(sum.clicked, sum.participants)}</div><div className="stat-foot muted" style={{ fontSize: 12.5 }}>{sum.participants - sum.clicked} ran out of time</div></div>
                <div className="card stat"><div className="stat-label">Median first click</div><div className="stat-value num">{sum.clicked ? `${(sum.medianMs / 1000).toFixed(1)} s` : '—'}</div></div>
                <div className="card stat"><div className="stat-label">Clicked the right place</div><div className="stat-value num">{test.target ? pct(sum.hits, sum.participants) : '—'}</div><div className="stat-foot muted" style={{ fontSize: 12.5 }}>{test.target ? test.target.label : 'No right answer set'}</div></div>
              </div>
              <div className="card">
                <div className="card-head">
                  <div><h2>First clicks</h2><p>{test.target ? 'Boxes count first clicks per element: green is the right one, red is somewhere else' : 'Every first click'}</p></div>
                  <div className="row wrap">
                    <div className="seg" role="group" aria-label="Device">
                      {(Object.keys(DEVICES) as Device[]).map((d) => <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
                    </div>
                    {sum.participants > 0 && <button className="btn sm ghost" onClick={() => { clearFiveSecResults(test.id); setVer((v) => v + 1) }}>Clear results</button>}
                  </div>
                </div>
                <div className="card-body grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 240px', alignItems: 'start' }}>
                  <ScreenViewer key={`${test.id}-${ver}`} page={test.page} query={test.query} device={device} mode={test.target ? 'elements' : 'dots'} fivesec={test.id} focus={test.target?.sel} />
                  <div>
                    <div className="label" style={{ marginBottom: 8 }}>What they clicked first</div>
                    {sum.firsts.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No clicks yet.</p>}
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {sum.firsts.map((f) => <li key={f.label}>{f.label} <span className="muted num">· {f.n}</span>{test.target && f.hit && <span className="badge" style={{ marginLeft: 6, height: 18 }}>right</span>}</li>)}
                    </ol>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
      {editing && <Editor test={editing} onSave={save} onClose={() => setEditing(null)} />}
    </main>
  )
}
