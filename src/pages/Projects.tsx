import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { Empty, StatusBadge, TeamTag } from '../components/ui'
import { Sparkline } from '../components/charts'
import { addSeries, ago, fmt, installsIn, recent } from '../lib/logic'
import { IssueCard, VersionTag } from './bits'

export default function Projects() {
  const inv = useStore()
  const { projects, teams, open } = inv
  const nav = useNavigate()
  const rows = useMemo(() => projects.map((p) => {
    const ins = installsIn(inv, p.id)
    return {
      p, ins,
      weekly: addSeries(ins.map((i) => i.runs)),
      borrowed: ins.filter((i) => inv.skill(i.skillId)?.teamId !== p.teamId).length,
      findings: open.filter((x) => x.projectIds.includes(p.id)).length,
    }
  }).sort((a, b) => teams.findIndex((t) => t.id === a.p.teamId) - teams.findIndex((t) => t.id === b.p.teamId) || recent(b.weekly) - recent(a.weekly)), [inv, projects, teams, open])

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p>Repositories with skills in <span className="mono">.claude/skills/</span>, and what each one has installed.</p>
        </div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Project</th><th>Team</th><th className="r">Skills</th><th className="r">From other teams</th><th className="r">Runs · 4 wks</th><th className="r">Findings</th><th className="r">Scanned</th></tr></thead>
          <tbody>
            {rows.map(({ p, ins, weekly, borrowed, findings }) => (
              <tr key={p.id} className="clickable" onClick={() => nav(`/projects/${p.id}`)}>
                <td><div className="mono" style={{ fontWeight: 550 }}>{p.name}</div><div className="muted" style={{ fontSize: 12 }}>{p.description}</div></td>
                <td><TeamTag id={p.teamId} /></td>
                <td className="r num">{ins.length}</td>
                <td className="r num">{borrowed || <span className="muted">—</span>}</td>
                <td className="r"><span className="row" style={{ justifyContent: 'flex-end', gap: 10 }}><Sparkline values={weekly} width={64} height={20} /><span className="num">{fmt(recent(weekly))}</span></span></td>
                <td className="r num">{findings || <span className="muted">—</span>}</td>
                <td className="r muted">{ago(p.scannedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

export function ProjectDetail() {
  const { id = '' } = useParams()
  const inv = useStore()
  const { project, skill, team, open } = inv
  const nav = useNavigate()
  const p = project(id)
  if (!p) return <main className="page"><div className="card"><Empty title="Project not found"><Link className="btn sm" to="/projects">Back to projects</Link></Empty></div></main>
  const ins = installsIn(inv, p.id).sort((a, b) => recent(b.runs) - recent(a.runs))
  const findings = open.filter((x) => x.projectIds.includes(p.id))

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1 className="mono">{p.name}</h1>
          <p>{p.description} · <TeamTag id={p.teamId} /> · scanned {ago(p.scannedAt)}</p>
        </div>
      </div>
      <div className="grid g-main">
        <section className="card" style={{ overflowX: 'auto' }}>
          <div className="card-head"><div><h2>Installed skills</h2><p>{ins.length} in .claude/skills/</p></div></div>
          <table className="table">
            <thead><tr><th>Skill</th><th>Owned by</th><th>Version</th><th className="r">Runs · 4 wks</th></tr></thead>
            <tbody>
              {ins.map((i) => {
                const s = skill(i.skillId)!
                return (
                  <tr key={s.id} className="clickable" onClick={() => nav(`/skills/${s.id}`)}>
                    <td><div style={{ fontWeight: 550 }}>{s.title}</div><StatusBadge status={s.status} /></td>
                    <td>{s.teamId === p.teamId ? <span className="muted">This team</span> : <span>{team(s.teamId)?.name}</span>}</td>
                    <td><VersionTag version={i.version} latest={s.version} edited={i.edited} /></td>
                    <td className="r"><span className="row" style={{ justifyContent: 'flex-end', gap: 10 }}><Sparkline values={i.runs} width={64} height={20} /><span className="num">{recent(i.runs) ? fmt(recent(i.runs)) : <span style={{ color: 'var(--critical-ink)' }}>0</span>}</span></span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
        <section className="card">
          <div className="card-head"><div><h2>Findings</h2><p>{findings.length ? `${findings.length} touch this project` : 'Nothing to tidy here'}</p></div></div>
          {findings.length > 0 && <div className="card-body stack" style={{ paddingTop: 4, gap: 4 }}>{findings.map((i) => <IssueCard key={i.id} issue={i} compact />)}</div>}
        </section>
      </div>
    </main>
  )
}
