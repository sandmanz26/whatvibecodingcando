import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { BarList, LineChart } from '../components/charts'
import { WEEK_LABELS } from '../data/seed'
import { fmt, installsOf, intensity, recent, teamOfInstall, teamSkills, teamWeekly, teamsUsing } from '../lib/logic'

export default function Teams() {
  const inv = useStore()
  const { teams, skills, projects, team } = inv
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const t = team(params.get('team') ?? '') ?? teams[0]

  const d = useMemo(() => {
    const used = teamSkills(inv, t.id)
    const owned = skills.filter((s) => s.teamId === t.id && s.status !== 'deprecated')
    const lent = owned.map((s) => ({ s, others: teamsUsing(inv, s.id).filter((x) => x !== t.id) })).filter((x) => x.others.length)
    const borrowed = used.filter((x) => x.skill.teamId !== t.id)
    const runs = recent(teamWeekly(inv, t.id))
    const top3 = used.slice(0, 3).reduce((a, x) => a + x.runs, 0)
    return { used, owned, lent, borrowed, runs, top3, projects: projects.filter((p) => p.teamId === t.id) }
  }, [inv, t, skills, projects])

  const max = Math.max(...teams.map((x) => intensity(inv, x)))

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Teams</h1>
          <p>Each team leans on skills differently. Compare how much, and see what they own, borrow and lend.</p>
        </div>
      </div>

      <section className="card">
        <div className="card-head"><div><h2>Runs per person per week</h2><p>Last 4 weeks, all of a team’s projects</p></div></div>
        <div className="card-body">
          {[...teams].sort((a, b) => intensity(inv, b) - intensity(inv, a)).map((x) => (
            <button key={x.id} className={`intensity-row ${x.id === t.id ? 'on' : ''}`} onClick={() => setParams({ team: x.id }, { replace: true })} aria-pressed={x.id === t.id}>
              <span className="row" style={{ gap: 8 }}><i className="team-sq" style={{ background: `var(--s${x.slot})` }} />{x.name}<span className="muted" style={{ fontSize: 12 }}>{x.size} people</span></span>
              <span className="track"><span style={{ width: `${(intensity(inv, x) / max) * 100}%`, background: `var(--s${x.slot})` }} /></span>
              <span className="num">{intensity(inv, x).toFixed(1)}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="tabs mt-16" role="tablist">
        {teams.map((x) => <button key={x.id} role="tab" aria-selected={x.id === t.id} onClick={() => setParams({ team: x.id }, { replace: true })}>{x.name}</button>)}
      </div>

      <div className="grid g-4">
        <div className="card stat"><div className="stat-label">Runs · 4 weeks</div><div className="stat-value num">{fmt(d.runs)}</div><div className="stat-foot muted" style={{ fontSize: 12.5 }}>{intensity(inv, t).toFixed(1)} per person per week</div></div>
        <div className="card stat"><div className="stat-label">Skills they run</div><div className="stat-value num">{d.used.length}</div><div className="stat-foot muted" style={{ fontSize: 12.5 }}>Top 3 make {d.runs ? Math.round((d.top3 / d.runs) * 100) : 0}% of runs</div></div>
        <div className="card stat"><div className="stat-label">Borrowed</div><div className="stat-value num">{d.borrowed.length}</div><div className="stat-foot muted" style={{ fontSize: 12.5 }}>Owned by other teams</div></div>
        <div className="card stat"><div className="stat-label">Lent out</div><div className="stat-value num">{d.lent.length}<small className="muted" style={{ fontSize: 14, fontWeight: 500 }}> of {d.owned.length}</small></div><div className="stat-foot muted" style={{ fontSize: 12.5 }}>Own skills other teams run</div></div>
      </div>

      <div className="grid g-2 mt-16">
        <section className="card">
          <div className="card-head"><div><h2>What {t.name} runs</h2><p>Runs in the last 4 weeks · owner shown when it isn’t {t.name}</p></div></div>
          <div className="card-body">
            <BarList color={`var(--s${t.slot})`} rows={d.used.map((x) => ({
              id: x.skill.id,
              label: <>{x.skill.title}{x.skill.teamId !== t.id && <span className="muted" style={{ fontWeight: 400 }}> · from {team(x.skill.teamId)?.name}</span>}{x.runs === 0 && <span style={{ color: 'var(--critical-ink)', fontWeight: 400 }}> · unused</span>}</>,
              value: x.runs,
              onClick: () => nav(`/skills/${x.skill.id}`),
            }))} />
          </div>
        </section>
        <div className="stack" style={{ gap: 16 }}>
          <section className="card">
            <div className="card-head"><div><h2>Weekly runs</h2><p>Last 12 weeks</p></div></div>
            <div className="card-body"><LineChart series={[{ id: t.id, label: t.name, color: `var(--s${t.slot})`, values: teamWeekly(inv, t.id) }]} labels={WEEK_LABELS} height={170} area /></div>
          </section>
          <section className="card">
            <div className="card-head"><div><h2>Skills {t.name} owns</h2><p>And who else runs them</p></div></div>
            <div className="card-body" style={{ paddingTop: 4 }}>
              <div className="feed">
                {d.owned.map((s) => {
                  const others = [...new Set(installsOf(inv, s.id).map((i) => teamOfInstall(inv, i)).filter((x) => x !== t.id))]
                  return (
                    <Link key={s.id} to={`/skills/${s.id}`} className="feed-item" style={{ gridTemplateColumns: '1fr auto' }}>
                      <div className="what"><b>{s.title}</b></div>
                      <div className="muted" style={{ fontSize: 12.5 }}>{others.length ? `Also ${others.map((o) => team(o)?.name).join(', ')}` : 'Only this team'}</div>
                    </Link>
                  )
                })}
              </div>
            </div>
          </section>
          <section className="card">
            <div className="card-head"><div><h2>Projects</h2></div></div>
            <div className="card-body" style={{ paddingTop: 4 }}>
              <div className="feed">
                {d.projects.map((p) => (
                  <Link key={p.id} to={`/projects/${p.id}`} className="feed-item" style={{ gridTemplateColumns: '1fr auto' }}>
                    <div className="what"><b className="mono">{p.name}</b> <span className="muted">· {p.description}</span></div>
                    <div className="muted num" style={{ fontSize: 12.5 }}>{inv.installs.filter((i) => i.projectId === p.id).length} skills</div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
