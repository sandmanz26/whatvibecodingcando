import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { KIND_LABEL, cmpVersion, dateLabel, fmt, installsOf, recent, similarTo, skillWeekly, teamsUsing } from '../lib/logic'
import { SkillDoc } from './SkillDoc'
import { Face } from './bits'

const TONE = { high: 'neg', medium: 'warn', low: '' } as const

export default function V2SkillPage() {
  const { id } = useParams()
  const inv = useStore()
  const { skill, member, team, project, open } = inv
  const nav = useNavigate()
  const s = skill(id ?? '')

  if (!s) return (
    <main className="v2-canvas"><div className="v2-col"><h1 className="v2-title">This skill isn’t on any shelf</h1>
      <p className="v2-sub"><Link to="/v2/shelf" style={{ textDecoration: 'underline' }}>Back to the shelves</Link></p></div></main>
  )

  const owner = member(s.ownerId)
  const ins = installsOf(inv, s.id).sort((a, b) => recent(b.runs) - recent(a.runs))
  const using = teamsUsing(inv, s.id)
  const versions = new Set(ins.filter((i) => !i.edited).map((i) => i.version))
  const findings = open.filter((i) => i.skillId === s.id || i.otherId === s.id)
  const similar = similarTo(inv, s)

  return (
    <main className="v2-canvas" style={{ paddingTop: 48 }}>
      <div className="v2-col v2-enter">
        <div className="v2-small" style={{ marginBottom: 8 }}><Link to="/v2/shelf">Shelves</Link> / {team(s.teamId)?.name}</div>
        <header>
          <h1 className="v2-title">{s.title}</h1>
          <p className="v2-sub" style={{ marginTop: 4, maxWidth: 760 }}>{s.description}</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            <span className="v2-chip">{s.status === 'deprecated' ? 'Retired' : s.status === 'experimental' ? 'Experimental' : 'Active'}</span>
            <span className="v2-chip">v{s.version}</span>
            {s.source && <span className={`v2-chip ${s.source.vetted ? '' : 'neg'}`}>From {s.source.repo}{s.source.vetted ? '' : ' · not reviewed'}</span>}
            {s.replacedBy && <Link className="v2-chip teal" to={`/v2/skills/${s.replacedBy}`}>Use {skill(s.replacedBy)?.title} instead</Link>}
          </div>
        </header>

        <section className="v2-grid" style={{ marginTop: 32 }} aria-label="At a glance">
          <div className="v2-tile lead v2-span-3"><span className="label">Runs, last 4 weeks</span><span className="value">{fmt(recent(skillWeekly(inv, s.id)))}</span><span className="cap">Across every project</span></div>
          <div className="v2-tile v2-span-3"><span className="label">Teams</span><span className="value">{using.length}</span><span className="cap">{using.map((t) => team(t)?.name).join(', ')}</span></div>
          <div className="v2-tile v2-span-3"><span className="label">Projects</span><span className="value">{ins.length}</span><span className="cap">{ins.filter((i) => i.edited).length ? `${ins.filter((i) => i.edited).length} edited cop${ins.filter((i) => i.edited).length > 1 ? 'ies' : 'y'}` : 'All follow the source'}</span></div>
          <div className="v2-tile v2-span-3"><span className="label">Versions in use</span><span className="value">{versions.size}</span><span className="cap">{versions.size > 1 ? `Latest is v${s.version}` : 'Everyone on the same one'}</span></div>
        </section>

        <div className="v2-grid" style={{ marginTop: 'var(--gap)', alignItems: 'start' }}>
          <div className="v2-span-9" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <section className="v2-panel" aria-labelledby="where-h">
              <div className="v2-panel-head"><h2 className="v2-section" id="where-h">Where it runs</h2></div>
              <div className="v2-rows">
                {ins.map((i) => {
                  const p = project(i.projectId)!
                  const behind = !i.edited && cmpVersion(i.version, s.version) < 0
                  return (
                    <button key={p.id} className="v2-row" onClick={() => nav(`/v2/projects/${p.id}`)}>
                      <span className="main"><b className="mono">{p.name}</b><span>{team(p.teamId)?.name} · {p.description}</span></span>
                      {i.edited ? <span className="v2-chip neg">Edited copy</span> : behind ? <span className="v2-chip warn">v{i.version}, behind</span> : <span className="v2-chip">v{i.version}</span>}
                      <span className="side num" style={{ minWidth: 70 }}>{recent(i.runs) ? `${fmt(recent(i.runs))} runs` : 'unused'}</span>
                    </button>
                  )
                })}
              </div>
            </section>

            {similar.length > 0 && (
              <section className="v2-panel" aria-labelledby="sim-h">
                <div className="v2-panel-head"><h2 className="v2-section" id="sim-h">Does the same job</h2><span className="v2-small" style={{ marginLeft: 'auto' }}>Overlap in description and triggers</span></div>
                <div className="v2-rows">
                  {similar.map(({ skill: o, score }) => (
                    <button key={o.id} className="v2-row" onClick={() => nav(`/v2/skills/${o.id}`)}>
                      <span className="main"><b>{o.title}</b><span>{team(o.teamId)?.name}{o.status === 'deprecated' ? ' · retired' : ''}</span></span>
                      <span className="side num">{Math.round(score * 100)}%</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="v2-panel" aria-labelledby="doc-h">
              <div className="v2-panel-head"><h2 className="v2-section" id="doc-h">SKILL.md</h2></div>
              <SkillDoc skill={s} />
            </section>
          </div>

          <div className="v2-span-3" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)' }}>
            <section className="v2-panel" aria-label="Details">
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                <Face member={owner} />
                <div><b>{owner?.name ?? 'Nobody'}</b><div className="v2-small">{owner?.active ? `Owner · ${owner.title}` : 'Owner left the company'}</div></div>
              </div>
              <dl className="v2-kv">
                <dt>Team</dt><dd>{team(s.teamId)?.name}</dd>
                <dt>Updated</dt><dd>{dateLabel(s.updatedAt)}</dd>
                <dt>Lives in</dt><dd className="mono" style={{ fontSize: 12 }}>{s.home}</dd>
              </dl>
            </section>
            <section className="v2-panel" aria-labelledby="f-h">
              <div className="v2-panel-head"><h2 className="v2-section" id="f-h">To tidy</h2><span className="v2-chip">{findings.length}</span></div>
              {findings.length === 0 ? <div className="v2-empty">Nothing.</div> : (
                <div className="v2-rows">
                  {findings.map((f) => (
                    <Link key={f.id} to={`/v2/tidy?kind=${f.kind}`} className="v2-row" style={{ alignItems: 'flex-start' }}>
                      <span className="main"><b style={{ whiteSpace: 'normal' }}>{f.title}</b><span><span className={`v2-chip ${TONE[f.severity]}`}>{KIND_LABEL[f.kind]}</span></span></span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  )
}
