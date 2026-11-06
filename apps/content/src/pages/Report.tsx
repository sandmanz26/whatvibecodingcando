import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Download, Printer, RefreshCw, Bookmark, BookmarkCheck, Eye, FlaskConical, Trash2 } from 'lucide-react'
import { useStore } from '../store/store'
import { Empty } from '../components/ui'
import { ScreenDrawer } from '../components/ScreenDrawer'
import { loadEvents } from '../tools/insights/store'
import { flushNow } from '../tools/insights/tracker'
import { buildReport, reportMarkdown, type Finding, type Period, type Report as R } from '../tools/report/generate'
import { addSample, hasSample, removeSample } from '../tools/report/sample'
import { REPO_EVENT, SOURCE_LABEL, isKept, keep } from '../tools/repo/store'

const PERIODS: { id: Period; label: string }[] = [{ id: 'all', label: 'All time' }, { id: '7d', label: 'Last 7 days' }, { id: 'today', label: 'Today' }]
const IMPACT_LABEL = { high: 'High impact', medium: 'Medium', low: 'Low' } as const
const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

export default function Report() {
  const { toast } = useStore()
  const [period, setPeriod] = useState<Period>('all')
  const [report, setReport] = useState<R | null>(null)
  const [title, setTitle] = useState(() => `Marketplace study — ${today()}`)
  const [show, setShow] = useState<Finding | null>(null)
  const [, setKeptVer] = useState(0)
  const [sample, setSample] = useState(hasSample)

  const generate = useCallback(async () => {
    flushNow()
    const d = await loadEvents()
    setReport(buildReport(d.events, period))
  }, [period])
  useEffect(() => { void generate() }, [generate])
  useEffect(() => {
    const sync = () => setKeptVer((v) => v + 1)
    window.addEventListener(REPO_EVENT, sync)
    return () => window.removeEventListener(REPO_EVENT, sync)
  }, [])

  const md = () => (report ? reportMarkdown(report, title) : '')
  const download = () => {
    const url = URL.createObjectURL(new Blob([md()], { type: 'text/markdown' }))
    Object.assign(document.createElement('a'), { href: url, download: `${title.replace(/[^\w-]+/g, '-').toLowerCase()}.md` }).click()
    URL.revokeObjectURL(url)
  }
  const keepOne = (f: Finding) => {
    const added = keep({ title: f.title, detail: f.detail, evidence: f.evidence, source: f.source, impact: f.impact, tags: f.tags, page: f.page, query: f.query, sel: f.sel })
    toast(added ? 'Kept in the insight repository' : 'Already in the repository')
  }
  const toggleSample = () => {
    if (sample) removeSample(); else addSample()
    setSample(!sample)
    toast(sample ? 'Sample data removed' : 'Sample research data added')
    void generate()
  }

  const empty = report && !report.sessions && !report.tasks.length && !report.findings.length

  return (
    <main className="page report-page">
      <div className="page-head no-print">
        <div>
          <h1>Research report</h1>
          <p>A one-page summary of what the research tools collected — sessions, usability tests, 5-second tests, fake doors, eye tracking, notes and comments — with findings ranked by impact. Built by fixed rules from your data, not by an AI model, so each finding says what it rests on. Check it before you share it.</p>
        </div>
        <div className="actions">
          <div className="seg" role="group" aria-label="Period">{PERIODS.map((p) => <button key={p.id} aria-pressed={period === p.id} onClick={() => setPeriod(p.id)}>{p.label}</button>)}</div>
          <button className="btn" onClick={() => void generate()}><RefreshCw size={14} /> Regenerate</button>
        </div>
      </div>

      <div className="row wrap no-print" style={{ gap: 8, marginBottom: 16 }}>
        <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(md()); toast('Copied as Markdown') }} disabled={!report}><Copy size={13} /> Copy Markdown</button>
        <button className="btn sm" onClick={download} disabled={!report}><Download size={13} /> Download .md</button>
        <button className="btn sm" onClick={() => window.print()} disabled={!report}><Printer size={13} /> Print or save as PDF</button>
        <div style={{ flex: 1 }} />
        <button className="btn sm ghost" onClick={toggleSample}>{sample ? <><Trash2 size={13} /> Remove sample data</> : <><FlaskConical size={13} /> Add sample research data</>}</button>
      </div>

      {!report ? <div className="card"><Empty title="Reading the research data…" /></div> : empty ? (
        <div className="card"><Empty title="Nothing to report yet">
          <span style={{ maxWidth: 480 }}>Record some sessions, run a usability or 5-second test, or put a fake door live, then come back. To see how a report looks, add sample research data.</span>
          <button className="btn sm primary" onClick={toggleSample}><FlaskConical size={13} /> Add sample research data</button>
        </Empty></div>
      ) : (
        <article className="report card card-body">
          <input className="report-title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Report title" />
          <p className="muted" style={{ fontSize: 13 }}>
            {PERIODS.find((p) => p.id === period)!.label} · {report.participants} participant{report.participants === 1 ? '' : 's'} · generated {new Date(report.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
            {sample && <span className="badge" style={{ marginLeft: 8 }}>Includes sample data</span>}
          </p>
          {report.smallSample && <p className="report-warn">Small sample: fewer than five participants. Treat these as signals to look into, not conclusions.</p>}

          {report.findings.length > 0 && (
            <section>
              <h2>In short</h2>
              <ul className="report-short">{report.findings.slice(0, 3).map((f) => <li key={f.id}>{f.title}.</li>)}</ul>
            </section>
          )}

          <section>
            <h2>In numbers</h2>
            <div className="report-nums">{report.numbers.map((n) => <div key={n.label}><span className="muted">{n.label}</span><b className="num">{n.value}</b>{n.note && <small className="muted">{n.note}</small>}</div>)}</div>
          </section>

          {report.sessions > 0 && (
            <section>
              <h2>Journey</h2>
              <p className="muted" style={{ fontSize: 13 }}>Sessions that reached each step</p>
              <div className="funnel">
                {report.funnel.map((f) => (
                  <div key={f.label} className="funnel-row">
                    <span>{f.label}</span>
                    <span className="funnel-bar"><i style={{ width: `${report.sessions ? (f.n / report.sessions) * 100 : 0}%` }} /></span>
                    <b className="num">{f.n}</b>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2>Findings</h2>
            {report.findings.length === 0 && <p className="muted">No findings yet — the data doesn’t show a clear pattern.</p>}
            <ol className="findings">
              {report.findings.map((f) => {
                const kept = isKept(f.title, f.page)
                return (
                  <li key={f.id} className={`finding ${f.positive ? 'good' : f.impact}`}>
                    <div className="finding-top">
                      <span className="badge">{f.positive ? 'Works' : IMPACT_LABEL[f.impact]}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{SOURCE_LABEL[f.source]}</span>
                    </div>
                    <h3>{f.title}</h3>
                    <p>{f.detail}</p>
                    <p className="finding-ev">Evidence: {f.evidence}{f.page ? <> · <span className="mono">{f.page}</span></> : null}</p>
                    <div className="row no-print" style={{ gap: 6 }}>
                      {f.page && <button className="btn sm" onClick={() => setShow(f)}><Eye size={13} /> Show on screen</button>}
                      <button className="btn sm" onClick={() => keepOne(f)} disabled={kept}>{kept ? <><BookmarkCheck size={13} /> Kept</> : <><Bookmark size={13} /> Keep in repository</>}</button>
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>

          {report.tasks.length > 0 && (
            <section>
              <h2>Usability tasks</h2>
              <table className="table">
                <thead><tr><th>Task</th><th className="r">Success</th><th className="r">Median time</th><th className="r">Good first tap</th></tr></thead>
                <tbody>{report.tasks.map((t) => (
                  <tr key={t.name}><td>{t.name}</td><td className="r num">{t.success}/{t.attempts}</td><td className="r num">{Math.round(t.medianMs / 1000)} s</td><td className="r num">{t.firstTotal ? `${t.firstRight}/${t.firstTotal}` : '—'}</td></tr>
                ))}</tbody>
              </table>
            </section>
          )}

          {(report.quotes.length > 0 || report.tagCounts.length > 0) && (
            <section>
              <h2>In their words</h2>
              {report.tagCounts.length > 0 && <div className="row wrap" style={{ gap: 6, marginBottom: 10 }}>{report.tagCounts.map((t) => <span key={t.tag} className="badge">{t.tag} · {t.n}</span>)}</div>}
              {report.quotes.map((q, i) => <blockquote key={i} className="quote">“{q.text}”<footer>— {q.who}{q.where ? `, ${q.where}` : ''}</footer></blockquote>)}
            </section>
          )}

          <p className="muted no-print" style={{ fontSize: 12.5, marginTop: 18 }}>Keep the findings that matter in the <Link to="/console/repo" style={{ textDecoration: 'underline' }}>insight repository</Link>, where they can be tagged and tracked.</p>
        </article>
      )}
      {show && show.page && <ScreenDrawer title={show.title} page={show.page} query={show.query} sel={show.sel} onClose={() => setShow(null)} />}
    </main>
  )
}
