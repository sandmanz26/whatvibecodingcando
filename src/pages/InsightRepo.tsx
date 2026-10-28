import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Download, Eye, Trash2, X } from 'lucide-react'
import { useStore } from '../store/store'
import { Empty, Modal } from '../components/ui'
import { ScreenDrawer } from '../components/ScreenDrawer'
import { REPO_EVENT, SOURCE_LABEL, STATUS_LABEL, SUGGESTED_TAGS, loadInsights, saveInsights, toMarkdown, uid, type Impact, type Insight, type InsightSource, type InsightStatus } from '../tools/repo/store'

const IMPACTS: Impact[] = ['high', 'medium', 'low']
const STATUSES = Object.keys(STATUS_LABEL) as InsightStatus[]

function Editor({ start, onSave, onClose }: { start: Insight; onSave: (i: Insight) => void; onClose: () => void }) {
  const [i, setI] = useState(start)
  return (
    <Modal title={start.title ? 'Edit insight' : 'New insight'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!i.title.trim()} onClick={() => onSave({ ...i, updatedAt: new Date().toISOString() })}>Save</button></>}>
      <div className="stack gap-12">
        <div className="field"><label htmlFor="in-t">Insight</label><input id="in-t" className="input" value={i.title} onChange={(e) => setI({ ...i, title: e.target.value })} placeholder="e.g. People expect the product photo to zoom" /></div>
        <div className="field"><label htmlFor="in-d">What it means</label><textarea id="in-d" className="textarea" rows={3} value={i.detail} onChange={(e) => setI({ ...i, detail: e.target.value })} /></div>
        <div className="field"><label htmlFor="in-e">Evidence</label><input id="in-e" className="input" value={i.evidence} onChange={(e) => setI({ ...i, evidence: e.target.value })} placeholder="e.g. 4 of 8 sessions, interview 3" /></div>
        <div className="row wrap" style={{ gap: 12 }}>
          <div className="field" style={{ width: 160 }}><label htmlFor="in-i">Impact</label><select id="in-i" className="select" value={i.impact} onChange={(e) => setI({ ...i, impact: e.target.value as Impact })}>{IMPACTS.map((x) => <option key={x}>{x}</option>)}</select></div>
          <div className="field" style={{ flex: 1, minWidth: 160 }}><label htmlFor="in-p">Screen (optional)</label><input id="in-p" className="input mono" value={i.page ?? ''} onChange={(e) => setI({ ...i, page: e.target.value || undefined })} placeholder="/product/p1" /></div>
        </div>
        <div className="field"><label>Tags</label><div className="row wrap" style={{ gap: 6 }}>{SUGGESTED_TAGS.map((t) => <button key={t} className="chip" aria-pressed={i.tags.includes(t)} onClick={() => setI({ ...i, tags: i.tags.includes(t) ? i.tags.filter((x) => x !== t) : [...i.tags, t] })}>{t}</button>)}</div></div>
      </div>
    </Modal>
  )
}

export default function InsightRepo() {
  const { toast } = useStore()
  const [list, setList] = useState(loadInsights)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<InsightStatus | 'all'>('all')
  const [impact, setImpact] = useState<Impact | 'all'>('all')
  const [source, setSource] = useState<InsightSource | 'all'>('all')
  const [tag, setTag] = useState<string | null>(null)
  const [editing, setEditing] = useState<Insight | null>(null)
  const [show, setShow] = useState<Insight | null>(null)

  useEffect(() => {
    const sync = () => setList(loadInsights())
    window.addEventListener(REPO_EVENT, sync)
    return () => window.removeEventListener(REPO_EVENT, sync)
  }, [])
  const put = (next: Insight[]) => { saveInsights(next); setList(next) }
  const patch = (id: string, p: Partial<Insight>) => put(list.map((x) => (x.id === id ? { ...x, ...p, updatedAt: new Date().toISOString() } : x)))

  const tags = useMemo(() => [...new Set(list.flatMap((i) => i.tags))].sort(), [list])
  const shown = list.filter((i) =>
    (status === 'all' || i.status === status) && (impact === 'all' || i.impact === impact) && (source === 'all' || i.source === source) &&
    (!tag || i.tags.includes(tag)) &&
    (!q.trim() || `${i.title} ${i.detail} ${i.evidence} ${i.page ?? ''} ${i.tags.join(' ')}`.toLowerCase().includes(q.trim().toLowerCase())))
  const count = (s: InsightStatus) => list.filter((i) => i.status === s).length
  const blank = (): Insight => ({ id: uid(), title: '', detail: '', evidence: '', source: 'manual', impact: 'medium', status: 'new', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
  const exportMd = () => {
    const url = URL.createObjectURL(new Blob([toMarkdown(shown)], { type: 'text/markdown' }))
    Object.assign(document.createElement('a'), { href: url, download: 'insights.md' }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Insight repository</h1>
          <p>Findings worth keeping, from the research report, the design system check, or added by hand. Tag them, track what happens to them, and jump to the screen each one is about.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={exportMd} disabled={!shown.length}><Download size={14} /> Export</button>
          <button className="btn primary" onClick={() => setEditing(blank())}><Plus size={14} /> New insight</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card"><Empty title="No insights kept yet">
          <span>Keep findings from the <Link to="/console/report" style={{ textDecoration: 'underline' }}>research report</Link> or the <Link to="/console/dscheck" style={{ textDecoration: 'underline' }}>design system check</Link>, or add one by hand.</span>
        </Empty></div>
      ) : (
        <>
          <div className="row wrap" style={{ gap: 6, marginBottom: 12 }}>
            <button className="chip" aria-pressed={status === 'all'} onClick={() => setStatus('all')}>All <span className="num" style={{ opacity: .6 }}>{list.length}</span></button>
            {STATUSES.map((s) => <button key={s} className="chip" aria-pressed={status === s} onClick={() => setStatus(s)}>{STATUS_LABEL[s]} <span className="num" style={{ opacity: .6 }}>{count(s)}</span></button>)}
          </div>
          <div className="toolbar">
            <div className="input-wrap"><Search size={15} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search insights" aria-label="Search insights" /></div>
            <select className="select" style={{ width: 150 }} value={impact} onChange={(e) => setImpact(e.target.value as Impact | 'all')} aria-label="Impact"><option value="all">Any impact</option>{IMPACTS.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)} impact</option>)}</select>
            <select className="select" style={{ width: 190 }} value={source} onChange={(e) => setSource(e.target.value as InsightSource | 'all')} aria-label="Source"><option value="all">From anywhere</option>{(Object.keys(SOURCE_LABEL) as InsightSource[]).map((x) => <option key={x} value={x}>{SOURCE_LABEL[x]}</option>)}</select>
            {tag && <button className="chip" aria-pressed onClick={() => setTag(null)}>{tag} <X size={12} /></button>}
            <span className="muted" style={{ marginLeft: 'auto', fontSize: 12.5 }}>{shown.length} insight{shown.length === 1 ? '' : 's'}</span>
          </div>
          {tags.length > 0 && <div className="row wrap" style={{ gap: 6, margin: '-4px 0 14px' }}><span className="muted" style={{ fontSize: 12.5 }}>Tags:</span>{tags.map((t) => <button key={t} className="badge outline" onClick={() => setTag(t === tag ? null : t)} style={{ cursor: 'pointer' }}>{t}</button>)}</div>}

          <div className="stack" style={{ gap: 10 }}>
            {shown.map((i) => (
              <article key={i.id} className={`card insight ${i.status}`}>
                <div className="row wrap" style={{ gap: 8 }}>
                  <span className="badge">{i.impact[0].toUpperCase() + i.impact.slice(1)}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{SOURCE_LABEL[i.source]} · {new Date(i.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                  <select className="select insight-status" value={i.status} onChange={(e) => patch(i.id, { status: e.target.value as InsightStatus })} aria-label={`Status of ${i.title}`}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
                </div>
                <h3>{i.title}</h3>
                {i.detail && <p>{i.detail}</p>}
                <p className="finding-ev">Evidence: {i.evidence || '—'}{i.page ? <> · <span className="mono">{i.page}</span></> : null}</p>
                <div className="row wrap" style={{ gap: 6 }}>
                  {i.tags.map((t) => <button key={t} className="badge outline" onClick={() => setTag(t)} style={{ cursor: 'pointer' }}>{t}</button>)}
                  <div style={{ flex: 1 }} />
                  {i.page && <button className="btn sm" onClick={() => setShow(i)}><Eye size={13} /> Show on screen</button>}
                  <button className="btn sm ghost" onClick={() => setEditing(i)}>Edit</button>
                  <button className="btn sm ghost danger" onClick={() => { put(list.filter((x) => x.id !== i.id)); toast('Insight removed') }} aria-label={`Delete ${i.title}`}><Trash2 size={13} /></button>
                </div>
              </article>
            ))}
            {shown.length === 0 && <div className="card"><Empty title="No insights match" /></div>}
          </div>
        </>
      )}
      {editing && <Editor start={editing} onClose={() => setEditing(null)} onSave={(i) => { put(list.some((x) => x.id === i.id) ? list.map((x) => (x.id === i.id ? i : x)) : [i, ...list]); setEditing(null) }} />}
      {show && show.page && <ScreenDrawer title={show.title} page={show.page} query={show.query} sel={show.sel} onClose={() => setShow(null)} />}
    </main>
  )
}
