import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Check, ChevronDown, ChevronRight, Copy, ExternalLink, Flag, Pencil, Plus, Play, TimerOff, Trash2, X } from 'lucide-react'
import { Empty, Modal } from '../components/ui'
import { ScreenViewer, type Device } from '../tools/insights/ScreenViewer'
import { layoutOf } from '../tools/insights/store'
import { loadSessions, loadTests, saveSessions, summarize, type Attempt, type TestTask, type UsabilityTest } from '../tools/tests/store'
import { StepDrawer, Timeline } from './Sessions'
import type { Step } from '../tools/insights/sessions'
import { useStore } from '../store/store'

/** A task attempt as timeline steps: the start page, then each tap, with page changes between them. */
function attemptSteps(task: TestTask, a: Attempt): Step[] {
  const steps: Step[] = [{ at: 0, t: '', kind: 'view', page: task.startPage, flags: [], vw: a.taps[0]?.vw ?? 1280 }]
  let page = task.startPage
  a.taps.forEach((tap, i) => {
    if (tap.page !== page) { steps.push({ at: tap.t, t: '', kind: 'view', page: tap.page, from: page, flags: [], vw: tap.vw }); page = tap.page }
    const last = i === a.taps.length - 1
    steps.push({
      at: tap.t, t: '', kind: 'tap', page: tap.page, label: tap.label, what: 'tap', where: tap.page,
      effect: tap.hit ? 'reached the goal' : last && a.outcome !== 'success' ? (a.outcome === 'timeout' ? 'then time ran out' : 'then they gave up') : 'kept going',
      flags: [], x: tap.x, y: tap.y, sel: tap.sel, vw: tap.vw,
    })
  })
  const end = a.pages[a.pages.length - 1]
  if (a.outcome === 'success' && task.success.kind === 'page' && end && end !== page) steps.push({ at: a.ms, t: '', kind: 'view', page: end, from: page, flags: [], vw: steps[0].vw })
  return steps
}

const testUrl = (t: UsabilityTest) => `${window.location.origin}${window.location.pathname}#${t.tasks[0]?.startPage ?? '/'}?test=${t.id}`
const pctOf = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0)
const secs = (ms: number) => (ms ? `${(ms / 1000).toFixed(1)} s` : '—')

/** The layout most of these taps were made at; taps only make sense drawn over that layout. */
function busiest(widths: number[]): Device {
  const n: Record<Device, number> = { mobile: 0, tablet: 0, desktop: 0 }
  widths.forEach((w) => n[layoutOf(w)]++)
  const [top, count] = Object.entries(n).sort((a, b) => b[1] - a[1])[0]
  return count ? (top as Device) : 'desktop'
}

function CopyLink({ test }: { test: UsabilityTest }) {
  const { toast } = useStore()
  return (
    <button className="btn sm" onClick={async () => {
      try { await navigator.clipboard.writeText(testUrl(test)); toast('Test link copied — send it to a participant') } catch { toast('Copy isn’t available in this browser', 'error') }
    }}><Copy size={13} /> Copy link</button>
  )
}

/** Success / timeout / gave up as one stacked bar, 2px gaps between segments. */
function OutcomeBar({ s, t, g }: { s: number; t: number; g: number }) {
  const total = s + t + g
  if (!total) return <span className="muted">No attempts</span>
  return (
    <div className="ut-obar" title={`${s} succeeded · ${t} timed out · ${g} gave up`}>
      {s > 0 && <i className="s" style={{ flex: s }} />}
      {t > 0 && <i className="t" style={{ flex: t }} />}
      {g > 0 && <i className="g" style={{ flex: g }} />}
    </div>
  )
}

export default function UsabilityTests() {
  const { id } = useParams()
  return id ? <Results id={id} /> : <List />
}

function List() {
  const nav = useNavigate()
  const tests = loadTests()
  const sessions = loadSessions()
  return (
    <main className="page">
      
      <div className="page-head">
        <div>
          <h1>Usability tests</h1>
          <p>Give people tasks with a time limit and see who succeeds, how long it takes, and where they tap first. Taps and timings only — never what anyone types.</p>
        </div>
        <div className="actions"><button className="btn primary" onClick={() => nav('/console/tests/new/edit')}><Plus size={15} /> New test</button></div>
      </div>

      {tests.length === 0 ? (
        <div className="card"><Empty title="No tests yet"><button className="btn sm" onClick={() => nav('/console/tests/new/edit')}>Create a test</button></Empty></div>
      ) : (
        <div className="grid g-2">
          {tests.map((t) => {
            const sum = summarize(t, sessions)
            const att = sum.tasks.reduce((n, x) => n + x.attempts, 0)
            const ok = sum.tasks.reduce((n, x) => n + x.success, 0)
            return (
              <section key={t.id} className="card card-body stack gap-12">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2><Link to={`/console/tests/${t.id}`}>{t.name}</Link></h2>
                    <p className="muted" style={{ fontSize: 12.5 }}>{t.tasks.length} task{t.tasks.length === 1 ? '' : 's'} · {sum.sessions.length} participant{sum.sessions.length === 1 ? '' : 's'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="stat-value num" style={{ fontSize: 22 }}>{att ? `${pctOf(ok, att)}%` : '—'}</div>
                    <div className="muted" style={{ fontSize: 12 }}>task success</div>
                  </div>
                </div>
                <div className="row wrap">
                  <Link className="btn sm primary" to={`/console/tests/${t.id}`}>Results</Link>
                  <a className="btn sm" href={testUrl(t)} target="_blank" rel="noopener"><Play size={13} /> Try it</a>
                  <CopyLink test={t} />
                  <Link className="btn sm ghost" to={`/console/tests/${t.id}/edit`}><Pencil size={13} /> Edit</Link>
                </div>
              </section>
            )
          })}
        </div>
      )}

      <section className="card card-body mt-24">
        <h3 style={{ marginBottom: 6 }}>How it works</h3>
        <ol className="secondary" style={{ margin: 0, paddingLeft: 18, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Write tasks as goals (“Find…”, “Turn on…”), not instructions (“Click the menu”). Pick what counts as success: reaching a page, or tapping an element you choose on screen.</li>
          <li>Send the link. The participant sees one task at a time with a timer, and can give up.</li>
          <li>Come back here: success rate, time on task, first-click accuracy, and every tap drawn on the real screen.</li>
        </ol>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>This demo has no backend, so results are stored in the browser where the test was taken. Run sessions on this device, or add a server to collect them from anywhere.</p>
      </section>
    </main>
  )
}

function Results({ id }: { id: string }) {
  const nav = useNavigate()
  const test = loadTests().find((t) => t.id === id)
  const [version, setVersion] = useState(0)
  const sessions = useMemo(() => (version >= 0 ? loadSessions() : []), [version])
  const [open, setOpen] = useState<string | null>(null)
  const [viewPage, setViewPage] = useState<string | null>(null)
  const [device, setDevice] = useState<Device | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [who, setWho] = useState<string | null>(null)
  const [replay, setReplay] = useState<{ steps: Step[]; i: number; title: string } | null>(null)

  if (!test) return <main className="page"><div className="card"><Empty title="Test not found"><Link className="btn sm" to="/console/tests">All tests</Link></Empty></div></main>

  const sum = summarize(test, sessions)
  const att = sum.tasks.reduce((n, x) => n + x.attempts, 0)
  const ok = sum.tasks.reduce((n, x) => n + x.success, 0)
  const firstOk = sum.tasks.reduce((n, x) => n + x.firstCorrect, 0)
  const firstAll = sum.tasks.reduce((n, x) => n + x.firstTotal, 0)
  const allMs = sum.sessions.flatMap((s) => s.attempts.filter((a) => a.outcome === 'success').map((a) => a.ms)).sort((a, b) => a - b)

  return (
    <main className="page">
      
      <div className="page-head">
        <div>
          <div className="muted" style={{ fontSize: 12.5, marginBottom: 2 }}><Link to="/console/tests">Usability tests</Link> /</div>
          <h1>{test.name}</h1>
          <p>{test.tasks.length} tasks · {sum.sessions.length} participant{sum.sessions.length === 1 ? '' : 's'}</p>
        </div>
        <div className="actions">
          <Link className="btn" to={`/console/tests/${test.id}/edit`}><Pencil size={14} /> Edit</Link>
          <CopyLink test={test} />
          <a className="btn primary" href={testUrl(test)} target="_blank" rel="noopener"><Play size={14} /> Try it</a>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <section className="card stat"><div className="stat-label">Participants</div><div className="stat-value num">{sum.sessions.length}</div><div className="muted" style={{ fontSize: 12 }}>{sum.sessions.filter((s) => s.finishedAt).length} finished every task</div></section>
        <section className="card stat"><div className="stat-label">Task success</div><div className="stat-value num">{att ? `${pctOf(ok, att)}%` : '—'}</div><div className="muted" style={{ fontSize: 12 }}>{ok} of {att} attempts</div></section>
        <section className="card stat"><div className="stat-label">Median time on task</div><div className="stat-value num">{secs(allMs[Math.floor(allMs.length / 2)] ?? 0)}</div><div className="muted" style={{ fontSize: 12 }}>successful attempts only</div></section>
        <section className="card stat"><div className="stat-label">First click right</div><div className="stat-value num">{firstAll ? `${pctOf(firstOk, firstAll)}%` : '—'}</div><div className="muted" style={{ fontSize: 12 }}>a strong predictor of success</div></section>
      </div>

      {sum.sessions.length === 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <Empty title="No one has taken this test yet">
            <span style={{ maxWidth: 480 }}>Press “Try it” to take it yourself, or copy the link for a participant. Results show up here as soon as a task is done — refresh this page to see them.</span>
          </Empty>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <div><h2>Tasks</h2><p>Expand a task to see first clicks and every tap on the real screen</p></div>
          <span className="ut-legend"><i className="s" />Succeeded <i className="t" />Timed out <i className="g" />Gave up</span>
        </div>
        <div className="card-body" style={{ overflowX: 'auto', paddingTop: 8 }}>
          <table className="table">
            <thead><tr><th></th><th>Task</th><th style={{ minWidth: 160 }}>Outcome</th><th className="r">Success</th><th className="r">Median time</th><th className="r">Avg taps</th><th className="r">Direct</th><th className="r">First click right</th></tr></thead>
            <tbody>
              {sum.tasks.map((x, i) => {
                const isOpen = open === x.task.id
                const pages = x.pages.length ? x.pages : [x.task.startPage]
                const page = isOpen && viewPage && pages.includes(viewPage) ? viewPage : (x.task.success.kind === 'element' ? x.task.success.page : pages[0])
                const taps = sum.sessions.flatMap((s) => s.attempts.filter((a) => a.taskId === x.task.id).flatMap((a) => a.taps)).filter((t) => t.page === page)
                const dev = device ?? busiest(taps.map((t) => t.vw))
                return (
                  <Fragment key={x.task.id}>
                    <tr className="clickable" onClick={() => { setOpen(isOpen ? null : x.task.id); setViewPage(null) }} aria-expanded={isOpen}>
                      <td style={{ width: 24 }}>{isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td style={{ maxWidth: 360 }}>
                        <div style={{ fontWeight: 550 }}>{i + 1}. {x.task.prompt}</div>
                        <div className="muted" style={{ fontSize: 12 }}>Success: {x.task.success.kind === 'page' ? <>reach <span className="mono">{x.task.success.page}</span></> : <>tap “{x.task.success.label}”</>} · limit {x.task.limitSec} s</div>
                      </td>
                      <td><OutcomeBar s={x.success} t={x.timeouts} g={x.gaveUp} /></td>
                      <td className="r num">{x.attempts ? `${pctOf(x.success, x.attempts)}%` : '—'}</td>
                      <td className="r num">{secs(x.medianMs)}</td>
                      <td className="r num">{x.attempts ? x.avgTaps.toFixed(1) : '—'}</td>
                      <td className="r num">{x.success ? `${pctOf(x.direct, x.success)}%` : '—'}</td>
                      <td className="r num">{x.firstTotal ? `${pctOf(x.firstCorrect, x.firstTotal)}%` : '—'}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td />
                        <td colSpan={7}>
                          <div className="ut-detail">
                            <div className="stack gap-12">
                              <div>
                                <div className="label" style={{ marginBottom: 6 }}>First clicks</div>
                                {x.firstTaps.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>No taps yet.</p>}
                                <div className="stack gap-4">
                                  {x.firstTaps.slice(0, 8).map((f) => (
                                    <div key={f.label} className="row" style={{ fontSize: 13, gap: 8 }}>
                                      {f.correct ? <Check size={14} color="var(--good-ink)" aria-label="On target" /> : <X size={14} color="var(--critical-ink)" aria-label="Off target" />}
                                      <span style={{ flex: 1 }}>{f.label}</span>
                                      <span className="num muted">{f.n}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="label" style={{ marginBottom: 6 }}>Screen</div>
                                <select className="select" value={page} onChange={(e) => setViewPage(e.target.value)} aria-label="Screen">
                                  {pages.map((p) => <option key={p}>{p}</option>)}
                                </select>
                                <div className="seg" role="group" aria-label="Device" style={{ marginTop: 8 }}>
                                  {(['mobile', 'tablet', 'desktop'] as Device[]).map((d) => <button key={d} aria-pressed={dev === d} onClick={() => setDevice(d)}>{d[0].toUpperCase() + d.slice(1)}</button>)}
                                </div>
                              </div>
                              <p className="muted" style={{ fontSize: 12 }}>Green outlines mark taps that hit the target; red, taps that missed. Numbers show how many taps landed on each element.</p>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <ScreenViewer key={`${x.task.id}-${page}`} page={page} device={dev} mode="elements" task={`${test.id}:${x.task.id}`} maxHeight={560} />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {sum.sessions.length > 0 && (
        <section className="card mt-16">
          <div className="card-head">
            <div><h2>Participants</h2><p>Open a participant to see every tap, in order, for each task</p></div>
            <button className="btn sm danger" onClick={() => setConfirm(true)}><Trash2 size={13} /> Delete results</button>
          </div>
          <div className="card-body" style={{ overflowX: 'auto', paddingTop: 8 }}>
            <table className="table">
              <thead><tr><th>Participant</th><th>Date</th><th>Screen</th>{test.tasks.map((t, i) => <th key={t.id} className="r">Task {i + 1}</th>)}</tr></thead>
              <tbody>
                {[...sum.sessions].reverse().map((s) => (
                  <Fragment key={s.id}>
                  <tr className="clickable" onClick={() => setWho(who === s.id ? null : s.id)} aria-expanded={who === s.id}>
                    <td style={{ fontWeight: 550 }}><span className="row" style={{ gap: 6 }}>{who === s.id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{s.participant}</span></td>
                    <td className="muted">{new Date(s.startedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td className="secondary">{layoutOf(s.vw)}</td>
                    {test.tasks.map((t) => {
                      const a = s.attempts.find((x) => x.taskId === t.id)
                      return (
                        <td key={t.id} className="r num">
                          {!a ? <span className="muted">—</span>
                            : a.outcome === 'success' ? <span className="row" style={{ justifyContent: 'flex-end', gap: 4, color: 'var(--good-ink)' }}><Check size={13} />{secs(a.ms)}</span>
                              : a.outcome === 'timeout' ? <span className="row" style={{ justifyContent: 'flex-end', gap: 4, color: 'var(--critical-ink)' }}><TimerOff size={13} />timed out</span>
                                : <span className="row" style={{ justifyContent: 'flex-end', gap: 4 }} ><Flag size={13} />gave up</span>}
                        </td>
                      )
                    })}
                  </tr>
                  {who === s.id && (
                    <tr>
                      <td colSpan={3 + test.tasks.length}>
                        <div className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(3, test.tasks.length)}, minmax(0, 1fr))`, padding: '6px 0 12px' }}>
                          {test.tasks.map((t, i) => {
                            const a = s.attempts.find((x) => x.taskId === t.id)
                            const steps = a ? attemptSteps(t, a) : []
                            return (
                              <div key={t.id} className="card card-body" style={{ padding: 14 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>Task {i + 1}</div>
                                <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>{t.prompt}</div>
                                {!a ? <p className="muted" style={{ fontSize: 13 }}>Not attempted.</p>
                                  : <Timeline steps={steps} active={null} onPick={(k) => setReplay({ steps, i: k, title: `${s.participant} · task ${i + 1}` })} />}
                              </div>
                            )
                          })}
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        Results come from this browser. <button className="btn ghost sm" onClick={() => setVersion((v) => v + 1)}>Refresh</button>
        <a className="btn ghost sm" href={testUrl(test)} target="_blank" rel="noopener">Open test <ExternalLink size={12} /></a>
      </p>

      {replay && <StepDrawer steps={replay.steps} index={replay.i} onMove={(i) => setReplay({ ...replay, i })} onClose={() => setReplay(null)} title={replay.title} />}

      {confirm && (
        <Modal title="Delete all results for this test?" description={`Removes ${sum.sessions.length} session${sum.sessions.length === 1 ? '' : 's'}. The test itself stays.`} onClose={() => setConfirm(false)}
          footer={<>
            <button className="btn" onClick={() => setConfirm(false)}>Keep results</button>
            <button className="btn primary" onClick={() => { saveSessions(loadSessions().filter((s) => s.testId !== test.id)); setConfirm(false); setVersion((v) => v + 1); nav(`/console/tests/${test.id}`) }}>Delete results</button>
          </>}
        />
      )}
    </main>
  )
}
