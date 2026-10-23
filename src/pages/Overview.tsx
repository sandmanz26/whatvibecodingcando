import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { useStore } from '../store/store'
import { Sparkline } from '../components/charts'
import { ago, intensity, isShared, recent, skillWeekly, sum, teamSkills, teamWeekly } from '../lib/logic'
import { IssueCard, UsageMatrix } from './bits'

export default function Overview() {
  const inv = useStore()
  const { skills, projects, teams, open } = inv

  const m = useMemo(() => {
    const live = skills.filter((s) => s.status !== 'deprecated')
    const shared = live.filter((s) => isShared(inv, s.id))
    const byRuns = [...skills].sort((a, b) => recent(skillWeekly(inv, b.id)) - recent(skillWeekly(inv, a.id)))
    return { live, shared, byRuns }
  }, [inv, skills])

  const high = open.filter((i) => i.severity === 'high').length
  const scanned = projects.map((p) => p.scannedAt).sort().at(-1)!

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Skills across Arunika Labs</h1>
          <p>{skills.length} skills installed in {projects.length} projects, used by {teams.length} teams. Inventory read from each repository {ago(scanned)}; runs from Claude Code usage logs. <span className="badge outline">Sample data</span></p>
        </div>
      </div>

      <div className="grid g-4">
        <Link to="/skills" className="card stat">
          <div className="stat-label">Skills in use</div>
          <div className="stat-value num">{m.live.length}</div>
          <div className="stat-foot"><span className="muted" style={{ fontSize: 12.5 }}>{skills.filter((s) => s.status === 'experimental').length} experimental · {skills.filter((s) => s.status === 'deprecated').length} retired</span></div>
        </Link>
        <Link to="/skills?scope=shared" className="card stat">
          <div className="stat-label">Shared across teams</div>
          <div className="stat-value num">{m.shared.length}<small className="muted" style={{ fontSize: 14, fontWeight: 500 }}> of {m.live.length}</small></div>
          <div className="stat-foot"><span className="muted" style={{ fontSize: 12.5 }}>The rest stay inside one team</span></div>
        </Link>
        <Link to="/projects" className="card stat">
          <div className="stat-label">Projects with skills</div>
          <div className="stat-value num">{projects.length}</div>
          <div className="stat-foot"><span className="muted" style={{ fontSize: 12.5 }}>{inv.installs.length} installed copies</span></div>
        </Link>
        <Link to="/health" className="card stat">
          <div className="stat-label">To tidy up</div>
          <div className="stat-value num">{open.length}</div>
          <div className="stat-foot"><span className="muted" style={{ fontSize: 12.5 }}>{high} high priority</span><ArrowRight size={14} color="var(--ink-3)" /></div>
        </Link>
      </div>

      <div className="grid g-main mt-16">
        <section className="card">
          <div className="card-head">
            <div><h2>How each team uses skills</h2><p>Runs per person per week, last 4 weeks</p></div>
            <Link to="/teams" className="btn ghost sm">Teams <ArrowRight size={13} /></Link>
          </div>
          <div className="card-body team-cards">
            {[...teams].sort((a, b) => intensity(inv, b) - intensity(inv, a)).map((t) => {
              const used = teamSkills(inv, t.id)
              const runs = recent(teamWeekly(inv, t.id))
              const top = used.slice(0, 3)
              const topShare = runs ? Math.round((sum(top.map((x) => x.runs)) / runs) * 100) : 0
              return (
                <Link key={t.id} to={`/teams?team=${t.id}`} className="team-card">
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="row" style={{ gap: 8 }}><i className="team-sq" style={{ background: `var(--s${t.slot})` }} /><b>{t.name}</b></span>
                    <Sparkline values={teamWeekly(inv, t.id)} width={80} height={24} color={`var(--s${t.slot})`} />
                  </div>
                  <div className="num big">{intensity(inv, t).toFixed(1)}</div>
                  <div className="muted" style={{ fontSize: 12.5 }}>{used.length} skills · {t.size} people · top 3 make {topShare}% of runs</div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{top.map((x) => x.skill.title).join(', ')}</div>
                </Link>
              )
            })}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <div><h2>Fix first</h2><p>{open.length ? 'Highest priority findings' : 'Nothing open'}</p></div>
          </div>
          <div className="card-body" style={{ paddingTop: 4 }}>
            {open.slice(0, 5).map((i) => <IssueCard key={i.id} issue={i} compact />)}
            {open.length > 5 && <Link to="/health" className="btn ghost sm" style={{ marginTop: 8 }}>All {open.length} findings <ArrowRight size={13} /></Link>}
          </div>
        </section>
      </div>

      <section className="card mt-16">
        <div className="card-head">
          <div><h2>Who uses what</h2><p>Every skill and how much each team runs it</p></div>
          <Link to="/skills" className="btn ghost sm">All skills <ArrowRight size={13} /></Link>
        </div>
        <div className="card-body"><UsageMatrix skills={m.byRuns} /></div>
      </section>
    </main>
  )
}

