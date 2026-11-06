import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Flame, Eye, Trash2, Pencil, Check, X, Download, ArrowRight, CheckCircle2, TimerOff, Flag, MousePointerClick } from 'lucide-react'
import { Empty, Modal } from '../components/ui'
import { useStore } from '../store/store'
import { layoutOf, loadEvents, type ClickEvent } from '../tools/insights/store'
import { loadGaze, removeGaze } from '../tools/gaze/store'
import { loadSessions, loadTests, saveSessions, type Outcome, type TestSession } from '../tools/tests/store'

interface Row { key: string; session: TestSession; testId: string; testName: string; taskId: string; taskNo: number; prompt: string; outcome: Outcome; ms: number; taps: number; pages: string[]; eyes: boolean; at: string; layout: string }
const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const OUT: Record<Outcome, { label: string; icon: React.ReactNode; cls: string }> = {
  success: { label: 'Succeeded', icon: <CheckCircle2 size={13} />, cls: 'ok' },
  timeout: { label: 'Time’s up', icon: <TimerOff size={13} />, cls: 'bad' },
  gave_up: { label: 'Gave up', icon: <Flag size={13} />, cls: 'bad' },
}

/**
 * Heatmap results start as a list: every run of every task, so a test done many times stays
 * manageable. Open one run or all runs of a task as a heatmap, rename, delete one or several,
 * export. Runs are started from the dock on the shop's own pages, not here.
 */
export default function HeatmapRuns() {
  const { toast } = useStore()
  const [ver, setVer] = useState(0)
  const tests = useMemo(() => loadTests(), [])
  const sessions = useMemo(() => (ver >= 0 ? loadSessions() : []), [ver])
  const gaze = useMemo(() => (ver >= 0 ? loadGaze() : []), [ver])
  const [clicks, setClicks] = useState<ClickEvent[]>([])
  useEffect(() => { void loadEvents().then((r) => setClicks(r.events.filter((e): e is ClickEvent => e.type === 'click'))) }, [ver])
  const [q, setQ] = useState('')
  const [outcome, setOutcome] = useState<'all' | 'ok' | 'failed'>('all')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [confirm, setConfirm] = useState<{ keys: string[]; label: string } | null>(null)

  const rows: Row[] = useMemo(() => sessions.flatMap((s) => {
    const t = tests.find((x) => x.id === s.testId)
    if (!t) return []
    return s.attempts.map((a) => {
      const i = t.tasks.findIndex((k) => k.id === a.taskId)
      return {
        key: `${s.id}|${a.taskId}`, session: s, testId: t.id, testName: t.name, taskId: a.taskId, taskNo: i + 1, prompt: t.tasks[i]?.prompt ?? '(a task that was removed)',
        outcome: a.outcome, ms: a.ms, taps: a.taps.length, pages: [...new Set(a.pages)], at: s.startedAt, layout: layoutOf(s.vw),
        eyes: !!s.gaze || gaze.some((g) => g.test === s.id && g.task === a.taskId),
      }
    })
  }).sort((a, b) => b.at.localeCompare(a.at)), [sessions, tests, gaze])
  const shown = rows.filter((r) => (outcome === 'all' || (outcome === 'ok' ? r.outcome === 'success' : r.outcome !== 'success')) && (!q.trim() || `${r.session.participant} ${r.prompt}`.toLowerCase().includes(q.trim().toLowerCase())))
  const groups = useMemo(() => {
    const m = new Map<string, Row[]>()
    for (const r of shown) m.set(`${r.testId}|${r.taskId}`, [...(m.get(`${r.testId}|${r.taskId}`) ?? []), r])
    return [...m.values()].sort((a, b) => a[0].testName.localeCompare(b[0].testName) || a[0].taskNo - b[0].taskNo)
  }, [shown])
  const browsingSessions = new Set(clicks.map((c) => c.sid)).size

  /** Deletes runs (a participant's attempt at a task) and their eye data; an emptied participant goes too. */
  const remove = (keys: string[]) => {
    const drop = new Set(keys)
    const next = loadSessions().map((s) => ({ ...s, attempts: s.attempts.filter((a) => !drop.has(`${s.id}|${a.taskId}`)) })).filter((s) => s.attempts.length > 0 || !sessions.some((o) => o.id === s.id && o.attempts.length > 0))
    saveSessions(next)
    removeGaze((g) => !!g.test && drop.has(`${g.test}|${g.task}`))
    setPicked(new Set())
    setConfirm(null)
    setVer((v) => v + 1)
    toast(keys.length === 1 ? 'Run deleted' : `${keys.length} runs deleted`)
  }
  const rename = () => {
    if (!renaming) return
    const name = renaming.name.trim().slice(0, 40)
    if (!name) return
    saveSessions(loadSessions().map((s) => (s.id === renaming.id ? { ...s, participant: name } : s)))
    setRenaming(null); setVer((v) => v + 1)
  }
  const exportCsv = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const lines = [['test', 'task', 'participant', 'started', 'outcome', 'seconds', 'clicks', 'pages', 'width', 'eye tracking'].join(','),
      ...shown.map((r) => [r.testName, `Task ${r.taskNo}: ${r.prompt}`, r.session.participant, r.at, r.outcome, (r.ms / 1000).toFixed(1), r.taps, r.pages.join(' > '), r.layout, r.eyes ? 'yes' : 'no'].map(esc).join(','))]
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), { href: url, download: 'heatmap-runs.csv' }).click()
    URL.revokeObjectURL(url)
  }
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const view = (r: Row, run?: boolean) => `/console/heatmap/view?ut=${r.testId}&utask=${r.taskId}${run ? `&run=${r.session.id}&page=${encodeURIComponent(r.pages[0] ?? '/')}&device=${r.layout}` : ''}`

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Heatmap results</h1>
          <p>Every run of a usability task, newest first. Open one run, or all runs of a task together, as a heatmap of clicks and (when recorded) eye movement. Start a run from the dock on any shop page: <Flame size={13} style={{ verticalAlign: -2 }} /> Heatmap → Start the task here.</p>
        </div>
        <div className="actions">
          <button className="btn" onClick={exportCsv} disabled={!shown.length}><Download size={14} /> Export CSV</button>
          {picked.size > 0 && <button className="btn danger" onClick={() => setConfirm({ keys: [...picked], label: `${picked.size} selected run${picked.size === 1 ? '' : 's'}` })}><Trash2 size={14} /> Delete {picked.size}</button>}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card"><Empty title="No runs yet">
          <span style={{ maxWidth: 520 }}>Go to any shop page, open <b>Heatmap</b> in the dock, pick a task and press <b>Start the task here</b>. When you finish, the run shows up here.</span>
          <Link className="btn sm" to="/console/heatmap/view">See an example with sample data</Link>
        </Empty></div>
      ) : (
        <>
          <div className="row wrap hm-runs-filters">
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or task" aria-label="Search runs" style={{ maxWidth: 260 }} />
            <div className="seg" role="group" aria-label="Outcome">
              <button aria-pressed={outcome === 'all'} onClick={() => setOutcome('all')}>All</button>
              <button aria-pressed={outcome === 'ok'} onClick={() => setOutcome('ok')}>Succeeded</button>
              <button aria-pressed={outcome === 'failed'} onClick={() => setOutcome('failed')}>Didn’t succeed</button>
            </div>
            <span className="muted" style={{ fontSize: 13 }}>{shown.length} of {rows.length} runs</span>
          </div>
          {groups.length === 0 && <div className="card card-body muted">No runs match.</div>}
          {groups.map((g) => {
            const ok = g.filter((r) => r.outcome === 'success').length
            const allPicked = g.every((r) => picked.has(r.key))
            return (
              <section key={g[0].key} className="card hm-runs">
                <div className="hm-runs-head">
                  <input type="checkbox" checked={allPicked} onChange={() => setPicked((p) => { const n = new Set(p); g.forEach((r) => (allPicked ? n.delete(r.key) : n.add(r.key))); return n })} aria-label="Select all runs of this task" />
                  <div className="hm-runs-title">
                    <span className="muted" style={{ fontSize: 12 }}>{g[0].testName} · Task {g[0].taskNo}</span>
                    <b>{g[0].prompt}</b>
                    <span className="muted" style={{ fontSize: 12.5 }}>{g.length} run{g.length === 1 ? '' : 's'} · {Math.round((ok / g.length) * 100)}% succeeded</span>
                  </div>
                  <Link className="btn sm primary" to={view(g[0])}>All runs as a heatmap <ArrowRight size={13} /></Link>
                  <button className="btn sm ghost danger icon" onClick={() => setConfirm({ keys: g.map((r) => r.key), label: `all ${g.length} run${g.length === 1 ? '' : 's'} of task ${g[0].taskNo}` })} aria-label="Delete all runs of this task" title="Delete all runs of this task"><Trash2 size={14} /></button>
                </div>
                <table className="table hm-runs-table">
                  <thead><tr><th /><th>Who</th><th>When</th><th>Result</th><th className="r">Time</th><th className="r">Clicks</th><th>Pages</th><th /></tr></thead>
                  <tbody>
                    {g.map((r) => (
                      <tr key={r.key} className={picked.has(r.key) ? 'picked' : ''}>
                        <td><input type="checkbox" checked={picked.has(r.key)} onChange={() => toggle(r.key)} aria-label={`Select run by ${r.session.participant}`} /></td>
                        <td>
                          {renaming?.id === r.session.id ? (
                            <span className="row" style={{ gap: 4 }}>
                              <input className="input" style={{ height: 28, width: 150 }} value={renaming.name} autoFocus maxLength={40} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setRenaming(null) }} aria-label="Name" />
                              <button className="btn sm icon ghost" onClick={rename} aria-label="Save name" disabled={!renaming.name.trim()}><Check size={13} /></button>
                              <button className="btn sm icon ghost" onClick={() => setRenaming(null)} aria-label="Cancel"><X size={13} /></button>
                            </span>
                          ) : (
                            <span className="row" style={{ gap: 4 }}>
                              <b>{r.session.participant}</b>
                              {r.eyes && <Eye size={13} className="muted" aria-label="with eye tracking" />}
                              <button className="btn sm icon ghost hm-rename" onClick={() => setRenaming({ id: r.session.id, name: r.session.participant })} aria-label={`Rename ${r.session.participant}`} title="Rename"><Pencil size={12} /></button>
                            </span>
                          )}
                        </td>
                        <td className="muted">{when(r.at)} · {r.layout}</td>
                        <td><span className={`hm-out ${OUT[r.outcome].cls}`}>{OUT[r.outcome].icon} {OUT[r.outcome].label}</span></td>
                        <td className="r num">{(r.ms / 1000).toFixed(1)} s</td>
                        <td className="r num">{r.taps}</td>
                        <td className="mono hm-journey" title={r.pages.join(' → ')}>{r.pages.join(' → ')}</td>
                        <td className="r">
                          <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                            <Link className="btn sm" to={view(r, true)}>View</Link>
                            <button className="btn sm icon ghost danger" onClick={() => setConfirm({ keys: [r.key], label: `the run by ${r.session.participant}` })} aria-label={`Delete run by ${r.session.participant}`} title="Delete"><Trash2 size={13} /></button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )
          })}
        </>
      )}

      <section className="card card-body hm-browse">
        <MousePointerClick size={18} />
        <div style={{ flex: 1 }}><b>Everyday browsing</b><p className="muted" style={{ fontSize: 13, margin: 0 }}>{clicks.length ? `${clicks.length} recorded clicks from ${browsingSessions} session${browsingSessions === 1 ? '' : 's'}, outside any task.` : 'Clicks recorded while Sessions recording is on, outside any task.'}</p></div>
        <Link className="btn sm" to="/console/heatmap/view?source=browsing">Open as a heatmap <ArrowRight size={13} /></Link>
      </section>

      {confirm && (
        <Modal title={`Delete ${confirm.label}?`} description="Their clicks and eye tracking for these tasks are removed from this browser. This can’t be undone." onClose={() => setConfirm(null)}
          footer={<><button className="btn" onClick={() => setConfirm(null)}>Keep</button><button className="btn primary" onClick={() => remove(confirm.keys)}>Delete</button></>} />
      )}
    </main>
  )
}
