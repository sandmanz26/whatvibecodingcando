import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { addSeries, ago, cmpVersion, fmt, installsIn, recent } from '../lib/logic'

export default function V2Projects() {
  const { id } = useParams()
  const inv = useStore()
  const { projects, teams, team, skill, open } = inv
  const nav = useNavigate()
  const focus = id ? inv.project(id) : undefined

  const card = (pid: string) => {
    const p = inv.project(pid)!
    const ins = installsIn(inv, p.id).sort((a, b) => recent(b.runs) - recent(a.runs))
    const findings = open.filter((x) => x.projectIds.includes(p.id)).length
    return (
      <section key={p.id} className="v2-panel" aria-labelledby={`p-${p.id}`}>
        <div className="v2-panel-head">
          <h2 className="v2-section mono" id={`p-${p.id}`}>{focus ? p.name : <Link to={`/v2/projects/${p.id}`}>{p.name}</Link>}</h2>
          <span className="v2-chip">{team(p.teamId)?.name}</span>
          {findings > 0 && <span className="v2-chip warn">{findings} to tidy</span>}
          <span className="v2-small" style={{ marginLeft: 'auto' }}>{fmt(recent(addSeries(ins.map((i) => i.runs))))} runs in 4 weeks · read {ago(p.scannedAt)}</span>
        </div>
        <p className="v2-small" style={{ margin: '-4px 0 12px' }}>{p.description}</p>
        <div className="v2-rows">
          {ins.map((i) => {
            const s = skill(i.skillId)!
            const behind = !i.edited && cmpVersion(i.version, s.version) < 0
            return (
              <button key={s.id} className="v2-row" onClick={() => nav(`/v2/skills/${s.id}`)}>
                <span className="main"><b>{s.title}</b><span>{s.teamId === p.teamId ? 'Theirs' : `Borrowed from ${team(s.teamId)?.name}`}{s.status === 'deprecated' ? ' · retired' : ''}</span></span>
                {i.edited ? <span className="v2-chip neg">Edited copy</span> : behind ? <span className="v2-chip warn">v{i.version}, behind</span> : <span className="v2-chip">v{i.version}</span>}
                <span className="side num" style={{ minWidth: 70 }}>{recent(i.runs) ? `${fmt(recent(i.runs))} runs` : 'unused'}</span>
              </button>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <main className="v2-canvas" style={{ paddingTop: 48 }}>
      <div className="v2-col v2-enter">
        {focus ? <div className="v2-small" style={{ marginBottom: 8 }}><Link to="/v2/projects">Projects</Link> / {team(focus.teamId)?.name}</div> : null}
        <header>
          <h1 className="v2-title">{focus ? focus.name : 'Projects'}</h1>
          <p className="v2-sub" style={{ marginTop: 4 }}>{focus ? 'The skills in this repository’s .claude/skills/ folder.' : 'Each repository and the skills installed in it, grouped by team.'}</p>
        </header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', marginTop: 32 }}>
          {focus ? card(focus.id) : teams.flatMap((t) => projects.filter((p) => p.teamId === t.id).map((p) => card(p.id)))}
        </div>
      </div>
    </main>
  )
}
