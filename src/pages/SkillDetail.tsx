import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { useStore } from '../store/store'
import { CategoryIcon, Empty, StatusBadge, TeamTag } from '../components/ui'
import { Legend, LineChart, Sparkline } from '../components/charts'
import { WEEK_LABELS } from '../data/seed'
import { dateLabel, fmt, installsOf, recent, similarTo, skillByTeam, teamsUsing } from '../lib/logic'
import { IssueCard, VersionTag } from './bits'

export function skillMd(s: { name: string; description: string; tools: string[]; title: string; triggers: string[]; instructions: string }) {
  const lines = ['---', `name: ${s.name}`, `description: ${s.description}`]
  if (s.tools.length) lines.push(`allowed-tools: ${s.tools.join(', ')}`)
  lines.push('---', '', `# ${s.title}`, '', '## When to use', '', ...s.triggers.map((t) => `- "${t}"`), '', '## Instructions', '', s.instructions)
  return lines.join('\n')
}

export default function SkillDetail() {
  const { id = '' } = useParams()
  const inv = useStore()
  const { skill, member, team, project, teams, open } = inv
  const nav = useNavigate()
  const s = skill(id)

  const d = useMemo(() => {
    if (!s) return null
    const ins = installsOf(inv, s.id).sort((a, b) => recent(b.runs) - recent(a.runs))
    const by = skillByTeam(inv, s.id)
    return { ins, by, using: teamsUsing(inv, s.id), similar: similarTo(inv, s) }
  }, [inv, s])

  if (!s || !d) return <main className="page"><div className="card"><Empty title="Skill not found"><Link className="btn sm" to="/skills">Back to skills</Link></Empty></div></main>

  const owner = member(s.ownerId)
  const findings = open.filter((i) => i.skillId === s.id || i.otherId === s.id)
  const series = teams.filter((t) => d.using.includes(t.id)).map((t) => ({ id: t.id, label: t.name, color: `var(--s${t.slot})`, values: d.by[t.id] ?? [] }))

  return (
    <main className="page">
      <div className="page-head">
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <CategoryIcon category={s.category} size={20} />
          <div>
            <h1 className="row" style={{ gap: 10 }}>{s.title} <StatusBadge status={s.status} /></h1>
            <p className="mono" style={{ fontSize: 12.5 }}>{s.name} · v{s.version}</p>
            <p style={{ maxWidth: 720, marginTop: 6 }}>{s.description}</p>
            {s.replacedBy && <p style={{ marginTop: 6 }}>Retired. Use <Link to={`/skills/${s.replacedBy}`} style={{ textDecoration: 'underline' }}>{skill(s.replacedBy)?.title}</Link> instead.</p>}
          </div>
        </div>
      </div>

      <div className="grid g-main">
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><div><h2>Where it runs</h2><p>{d.ins.length} project{d.ins.length === 1 ? '' : 's'} in {d.using.length} team{d.using.length === 1 ? '' : 's'}</p></div></div>
            <table className="table">
              <thead><tr><th>Project</th><th>Team</th><th>Version</th><th className="r">Runs · 4 wks</th></tr></thead>
              <tbody>
                {d.ins.map((i) => {
                  const p = project(i.projectId)!
                  return (
                    <tr key={i.projectId} className="clickable" onClick={() => nav(`/projects/${p.id}`)}>
                      <td><span className="mono" style={{ fontWeight: 550 }}>{p.name}</span></td>
                      <td><TeamTag id={p.teamId} /></td>
                      <td><VersionTag version={i.version} latest={s.version} edited={i.edited} /></td>
                      <td className="r"><span className="row" style={{ justifyContent: 'flex-end', gap: 10 }}><Sparkline values={i.runs} width={64} height={20} /><span className="num">{recent(i.runs) ? fmt(recent(i.runs)) : <span style={{ color: 'var(--critical-ink)' }}>0</span>}</span></span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          {series.length > 0 && (
            <section className="card">
              <div className="card-head"><div><h2>Weekly runs by team</h2><p>Last 12 weeks</p></div><Legend items={series} /></div>
              <div className="card-body"><LineChart series={series} labels={WEEK_LABELS} height={200} /></div>
            </section>
          )}

          <section className="card">
            <div className="card-head"><div><h2>Similar skills</h2><p>Skills whose description and triggers overlap with this one</p></div></div>
            <div className="card-body" style={{ paddingTop: 4 }}>
              {d.similar.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>No other skill does the same job.</p> : d.similar.map(({ skill: o, score }) => (
                <Link key={o.id} to={`/skills/${o.id}`} className="sim-result">
                  <span><b style={{ fontWeight: 550 }}>{o.title}</b> <span className="muted" style={{ fontSize: 12.5 }}>· {team(o.teamId)?.name}{o.status === 'deprecated' ? ' · retired' : ''}</span></span>
                  <span className="sim-bar"><span style={{ width: `${Math.round(score * 100)}%` }} /></span>
                  <span className="num" style={{ fontSize: 12.5 }}>{Math.round(score * 100)}%</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>SKILL.md</h2><p>As Claude reads it</p></div></div>
            <div className="card-body"><pre className="code">{skillMd(s)}</pre></div>
          </section>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-body">
              <dl className="src-kv">
                <dt>Owner</dt><dd>{owner?.active ? owner.name : <span style={{ color: 'var(--critical-ink)' }}>{owner ? `${owner.name} (left)` : 'Nobody'}</span>}</dd>
                <dt>Owning team</dt><dd>{team(s.teamId)?.name}</dd>
                <dt>Lives in</dt><dd className="mono" style={{ fontSize: 12 }}>{s.home}</dd>
                <dt>Latest</dt><dd>v{s.version} · {dateLabel(s.updatedAt)}</dd>
                <dt>Tools</dt><dd className="mono" style={{ fontSize: 12 }}>{s.tools.join(', ') || 'none'}</dd>
                {s.source && <>
                  <dt>Comes from</dt><dd><a href={s.source.url} target="_blank" rel="noreferrer" className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>{s.source.repo}<ExternalLink size={12} /></a></dd>
                  <dt>Licence</dt><dd>{s.source.license}</dd>
                  <dt>Security review</dt><dd>{s.source.vetted ? 'Passed' : <span style={{ color: 'var(--critical-ink)' }}>Not yet</span>}</dd>
                  {s.source.upstream && <><dt>Upstream</dt><dd>v{s.source.upstream} available</dd></>}
                </>}
              </dl>
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Findings</h2><p>{findings.length ? `${findings.length} open` : 'Nothing to tidy'}</p></div></div>
            {findings.length > 0 && <div className="card-body stack" style={{ paddingTop: 4, gap: 4 }}>{findings.map((i) => <IssueCard key={i.id} issue={i} compact />)}</div>}
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Versions</h2></div></div>
            <div className="card-body">
              <div className="timeline">
                {s.versions.map((v, i) => (
                  <div key={v.version} className={`tl-item ${i === 0 ? 'current' : ''}`}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>v{v.version} <span className="muted" style={{ fontWeight: 400 }}>· {dateLabel(v.at)}</span></div>
                    <div className="muted" style={{ fontSize: 12.5 }}>{v.note}</div>
                    <div className="muted" style={{ fontSize: 12 }}>{d.ins.filter((x) => x.version === v.version).map((x) => project(x.projectId)?.name).join(', ') || 'No project on this version'}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
