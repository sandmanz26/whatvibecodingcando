import { useEffect, useMemo, useState } from 'react'
import { Copy, Download, FileText, Printer, Sparkles } from 'lucide-react'
import { useStore } from '../../store/store'
import { cloud } from '../../saas/supabase'
import { copyText } from '../../saas/snippet'
import { download } from '../../saas/stats'
import { listStudies, projectSessions, type EventRow, type RunRow, type StudyRow } from '../../saas/cloud'
import { statusOf } from '../../core/embed/store'
import { usePanel, useThreads } from './Panel'

/**
 * Reports & insights (#/app/report): one page that pulls together what reviewers said (comments)
 * and what participants did (studies), with the findings worth acting on first. Copy it as
 * Markdown, download it, or print it.
 */

interface Finding { weight: number; text: string }
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export function Report() {
  const { s, project } = usePanel()
  const { toast } = useStore()
  const { threads } = useThreads(project?.id, s.account?.name)
  const [studies, setStudies] = useState<StudyRow[]>([])
  const [sessions, setSessions] = useState<{ runs: (RunRow & { study_id: string })[]; events: EventRow[] } | null>(null)
  useEffect(() => {
    if (!project || !cloud) return
    void listStudies(project.id).then(setStudies).catch(() => setStudies([]))
    void projectSessions(project.id).then(setSessions).catch(() => setSessions({ runs: [], events: [] }))
  }, [project?.id])

  const r = useMemo(() => {
    const open = threads.filter((t) => statusOf(t) !== 'completed')
    const byPage = [...open.reduce((m, t) => m.set(t.page, (m.get(t.page) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
    const runs = sessions?.runs ?? [], events = sessions?.events ?? []
    const clicks = events.filter((e) => e.kind === 'click')
    // Task success, per study and task.
    const tasks = studies.filter((st) => st.kind === 'usability').flatMap((st) => {
      const list = ((st.config as { tasks?: { id: string; prompt: string }[] }).tasks ?? [])
      const done = runs.filter((x) => x.study_id === st.id && x.finished_at)
      return list.map((t) => {
        const rs = done.flatMap((x) => (x.result.tasks ?? []).filter((y) => y.id === t.id))
        return { study: st.name, prompt: t.prompt, n: rs.length, ok: rs.filter((y) => y.outcome === 'success' || y.outcome === 'done').length, gaveUp: rs.filter((y) => y.outcome === 'gave_up').length }
      })
    })
    const stuck = [...clicks.filter((e) => e.rage || e.dead).reduce((m, e) => {
      const k = `${e.page} · ${e.label ?? e.sel ?? '?'}`
      const v = m.get(k) ?? new Set<string>(); v.add(e.run_id); return m.set(k, v)
    }, new Map<string, Set<string>>())].map(([k, v]) => [k, v.size] as const).sort((a, b) => b[1] - a[1])
    const doors = [...events.filter((e) => e.kind === 'door').reduce((m, e) => {
      const v = m.get(e.label ?? '?') ?? { saw: new Set<string>(), clicked: new Set<string>() }; (e.hit ? v.clicked : v.saw).add(e.run_id); return m.set(e.label ?? '?', v)
    }, new Map<string, { saw: Set<string>; clicked: Set<string> }>())]
    const answers = runs.flatMap((x) => x.result.answers ?? []).filter(Boolean).slice(0, 12)
    // The findings, most important first.
    const findings: Finding[] = []
    for (const t of tasks) if (t.n >= 1 && pct(t.ok, t.n) < 70) findings.push({ weight: 100 - pct(t.ok, t.n) + t.n, text: `Only ${pct(t.ok, t.n)}% finished “${t.prompt}” (${t.ok} of ${t.n}${t.gaveUp ? `, ${t.gaveUp} gave up` : ''}).` })
    for (const [k, n] of stuck.slice(0, 3)) if (n >= 1) findings.push({ weight: 40 + n * 10, text: `${n} ${n === 1 ? 'person' : 'people'} got stuck at ${k} (rage clicks or clicks on nothing clickable).` })
    if (byPage[0]) findings.push({ weight: 30 + byPage[0][1] * 5, text: `${byPage[0][0]} has the most open comments (${byPage[0][1]}).` })
    for (const [label, v] of doors) { const seen = Math.max(v.saw.size, v.clicked.size); if (seen) findings.push({ weight: 20 + pct(v.clicked.size, seen) / 2, text: `${pct(v.clicked.size, seen)}% of the people who saw “${label}” clicked it (${v.clicked.size} of ${seen}): interest in the feature.` }) }
    findings.sort((a, b) => b.weight - a.weight)
    return { open, byPage, runs, tasks, stuck, doors, answers, findings, completed: threads.length - open.length }
  }, [threads, studies, sessions])

  if (!project) return null
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
  const md = [
    `# ${project.name}: review and research report`, '', `${date} · ${project.siteUrl.replace(/^https?:\/\//, '') || 'no website set'}`, '',
    '## Key findings', '', ...(r.findings.length ? r.findings.slice(0, 8).map((f) => `- ${f.text}`) : ['- Nothing stands out yet: more comments or study participants will fill this in.']), '',
    '## Comments', '', `${threads.length} comments: ${r.open.length} open or ongoing, ${r.completed} completed.`, '',
    ...(r.byPage.length ? ['| Page | Open |', '|---|---|', ...r.byPage.slice(0, 10).map(([p, n]) => `| ${p} | ${n} |`), ''] : []),
    ...(r.open.length ? ['Open comments:', '', ...r.open.slice(0, 15).map((t) => `- **${t.author}** on ${t.page}${t.version ? ` (v${t.version})` : ''}: ${t.text.replace(/\n/g, ' ')}`), ''] : []),
    '## Studies', '', `${studies.length} studies, ${r.runs.length} participants.`, '',
    ...(r.tasks.length ? ['| Task | Finished | Gave up | People |', '|---|---|---|---|', ...r.tasks.map((t) => `| ${t.prompt} | ${pct(t.ok, t.n)}% | ${t.gaveUp} | ${t.n} |`), ''] : []),
    ...(r.stuck.length ? ['Where people got stuck:', '', ...r.stuck.slice(0, 10).map(([k, n]) => `- ${k}: ${n} ${n === 1 ? 'person' : 'people'}`), ''] : []),
    ...(r.doors.length ? ['Fake doors:', '', ...r.doors.map(([l, v]) => `- ${l}: ${v.clicked.size} of ${Math.max(v.saw.size, v.clicked.size)} clicked`), ''] : []),
    ...(r.answers.length ? ['What people remembered (5-second tests):', '', ...r.answers.map((a) => `- “${a}”`), ''] : []),
  ].join('\n')
  return (
    <div className="up-page rp-page">
      <div className="up-head">
        <div><h1>Report</h1><p>What reviewers said and what participants did on “{project.name}”, with the findings to act on first.</p></div>
        <span className="up-row">
          <button className="lp-btn" onClick={() => void copyText(md).then((ok) => toast(ok ? 'Copied as Markdown' : 'Copy failed', ok ? undefined : 'error'))}><Copy size={14} /> Copy</button>
          <button className="lp-btn" onClick={() => download(`${project.id}-report.md`, md, 'text/markdown')}><Download size={14} /> .md</button>
          <button className="lp-btn" onClick={() => window.print()}><Printer size={14} /> Print</button>
        </span>
      </div>
      {!cloud && <p className="up-note">In this demo the report covers comments only: studies need the server.</p>}
      <section className="up-card rp-key">
        <h2><Sparkles size={16} /> Key findings</h2>
        {r.findings.length ? <ol>{r.findings.slice(0, 8).map((f, i) => <li key={i}>{f.text}</li>)}</ol> : <p className="up-muted">Nothing stands out yet: more comments or study participants will fill this in.</p>}
      </section>
      <div className="db-kpis">
        <div className="db-kpi"><span>Comments</span><b>{threads.length}</b><small>{r.open.length} open · {r.completed} completed</small></div>
        <div className="db-kpi"><span>Studies</span><b>{studies.length}</b></div>
        <div className="db-kpi"><span>Participants</span><b>{r.runs.length}</b></div>
        <div className="db-kpi"><span>Got stuck</span><b>{new Set((sessions?.events ?? []).filter((e) => e.rage || e.dead).map((e) => e.run_id)).size}</b><small>people</small></div>
      </div>
      {r.byPage.length > 0 && <section className="up-card"><h2>Open comments by page</h2><table className="db-table"><thead><tr><th>Page</th><th>Open</th></tr></thead><tbody>{r.byPage.slice(0, 10).map(([p, n]) => <tr key={p}><td><code>{p}</code></td><td>{n}</td></tr>)}</tbody></table></section>}
      {r.tasks.length > 0 && <section className="up-card"><h2>Tasks</h2><table className="db-table"><thead><tr><th>Task</th><th>Study</th><th>Finished</th><th>Gave up</th><th>People</th></tr></thead><tbody>{r.tasks.map((t, i) => <tr key={i}><td>{t.prompt}</td><td>{t.study}</td><td>{pct(t.ok, t.n)}%</td><td>{t.gaveUp}</td><td>{t.n}</td></tr>)}</tbody></table></section>}
      {r.stuck.length > 0 && <section className="up-card"><h2>Where people got stuck</h2><ul className="rp-list">{r.stuck.slice(0, 10).map(([k, n]) => <li key={k}>{k}: <b>{n}</b> {n === 1 ? 'person' : 'people'}</li>)}</ul></section>}
      {r.answers.length > 0 && <section className="up-card"><h2>What people remembered</h2><ul className="rp-list">{r.answers.map((a, i) => <li key={i}>“{a}”</li>)}</ul></section>}
      <p className="up-muted"><FileText size={13} /> Built in your browser from the project’s comments and studies; nothing is sent anywhere else.</p>
    </div>
  )
}
