import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useStore } from '../store/store'
import { DEMO_NOW } from '../data/seed'
import { KIND_LABEL, intensity, isShared, teamSkills, teamsUsing } from '../lib/logic'
import { Shelf } from './Shelf'
import { longDate } from './bits'

const TONE = { high: 'neg', medium: 'warn', low: '' } as const

export default function V2Home() {
  const inv = useStore()
  const { skills, projects, teams, open, team } = inv
  const nav = useNavigate()

  const n = useMemo(() => {
    const live = skills.filter((s) => s.status !== 'deprecated')
    const shared = live.filter((s) => isShared(inv, s.id))
    const widest = [...live].map((s) => ({ s, teams: teamsUsing(inv, s.id) })).sort((a, b) => b.teams.length - a.teams.length).slice(0, 5)
    const ranked = [...teams].sort((a, b) => intensity(inv, b) - intensity(inv, a))
    return { live, shared, widest, ranked }
  }, [inv, skills, teams])

  const dup = open.filter((i) => i.kind === 'duplicate').length
  const fact = dup
    ? `${dup === 1 ? 'One job has' : `${dup === 2 ? 'Two' : dup === 3 ? 'Three' : dup} jobs have`} two skills each.`
    : open.length ? `${open.length} things to tidy.` : 'The shelves are tidy.'
  const busiest = n.ranked[0]
  const max = Math.max(...teams.map((t) => intensity(inv, t)))

  return (
    <main className="v2-canvas">
      <div className="v2-col v2-enter">
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <div>
            {/* Two deliberate lines: who, then today's one fact. */}
            <h1 className="v2-greeting">Morning, Arunika Labs.<br className="v2-br" /> {fact}</h1>
            <p className="v2-sub">{longDate(DEMO_NOW)} · {skills.length} skills in {projects.length} projects, read from each repository this morning. Sample data.</p>
          </div>
          {open.length > 0 && <button className="v2-btn primary" onClick={() => nav('/v2/tidy')}>Start tidying <ArrowRight size={15} /></button>}
        </header>

        <section className="v2-grid" style={{ marginTop: 50 }} aria-label="The shelves in numbers">
          <div className="v2-tile lead v2-span-3">
            <span className="label">Shared across teams</span>
            <span className="value">{n.shared.length}<small>of {n.live.length}</small></span>
            <span className="cap">The rest stay on one team’s shelf</span>
          </div>
          <div className="v2-tile v2-span-3">
            <span className="label">Busiest team</span>
            <span className="value">{intensity(inv, busiest).toFixed(1)}</span>
            <span className="cap">{busiest.name}: runs per person a week</span>
          </div>
          <div className="v2-tile v2-span-3">
            <span className="label">Projects</span>
            <span className="value">{projects.length}</span>
            <span className="cap">{inv.installs.length} installed copies</span>
          </div>
          <div className="v2-tile v2-span-3">
            <span className="label">To tidy</span>
            <span className="value">{open.length}</span>
            <span className="cap">{open.filter((i) => i.severity === 'high').length} first</span>
          </div>
        </section>

        <div className="v2-grid" style={{ marginTop: 'var(--gap)', alignItems: 'start' }}>
          <section className="v2-panel v2-span-9" aria-labelledby="shelf-h">
            <div className="v2-panel-head">
              <h2 className="v2-section" id="shelf-h">{busiest.name}’s shelf</h2>
              <span className="v2-chip">{teamSkills(inv, busiest.id).length} skills</span>
              <Link className="v2-link" to="/v2/shelf">Every team’s shelf</Link>
            </div>
            <Shelf teamId={busiest.id} height={220} showLegend />
          </section>

          <section className="v2-panel v2-span-3" aria-labelledby="tidy-h">
            <div className="v2-panel-head">
              <h2 className="v2-section" id="tidy-h">Tidy first</h2>
              <span className="v2-chip">{open.length}</span>
            </div>
            {open.length === 0 ? <div className="v2-empty">Nothing to tidy.</div> : (
              <div className="v2-rows">
                {open.slice(0, 4).map((i) => (
                  <button key={i.id} className="v2-row" onClick={() => nav(`/v2/tidy?kind=${i.kind}`)}>
                    <span className="main">
                      <b>{i.title}</b>
                      <span><span className={`v2-chip ${TONE[i.severity]}`} style={{ marginRight: 6 }}>{KIND_LABEL[i.kind]}</span>{i.action}</span>
                    </span>
                  </button>
                ))}
                {open.length > 4 && <Link className="v2-link" to="/v2/tidy" style={{ paddingTop: 4 }}>{open.length - 4} more</Link>}
              </div>
            )}
          </section>
        </div>

        <div className="v2-grid" style={{ marginTop: 'var(--gap)', alignItems: 'start' }}>
          <section className="v2-panel v2-span-6" aria-labelledby="teams-h">
            <div className="v2-panel-head">
              <h2 className="v2-section" id="teams-h">How hard each team leans on skills</h2>
              <span className="v2-small" style={{ marginLeft: 'auto' }}>Runs per person a week</span>
            </div>
            <div className="v2-rows">
              {n.ranked.map((t) => (
                <Link key={t.id} to={`/v2/shelf#${t.id}`} className="v2-row">
                  <span className="main">
                    <b>{t.name}</b>
                    <span className="v2-meter" style={{ marginTop: 6 }}><i style={{ width: `${(intensity(inv, t) / max) * 100}%` }} /></span>
                  </span>
                  <span className="side num">{intensity(inv, t).toFixed(1)}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="v2-panel v2-span-6" aria-labelledby="wide-h">
            <div className="v2-panel-head">
              <h2 className="v2-section" id="wide-h">Shared most widely</h2>
              <Link className="v2-link" to="/v2/shelf">Shelves</Link>
            </div>
            <div className="v2-rows">
              {n.widest.map(({ s, teams: ts }) => (
                <button key={s.id} className="v2-row" onClick={() => nav(`/v2/skills/${s.id}`)}>
                  <span className="main"><b>{s.title}</b><span>{team(s.teamId)?.name}’s, also on {ts.filter((t) => t !== s.teamId).map((t) => team(t)?.name).join(', ') || 'no other shelf'}</span></span>
                  <span className="side">{ts.length} teams</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
