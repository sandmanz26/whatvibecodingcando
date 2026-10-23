import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/store'
import { BarList, Heatmap, LineChart } from '../components/charts'
import { Lens } from '../components/ui'
import { LENS } from '../data/lens'
import { WEEK_LABELS } from '../data/seed'
import { compact, fmt, sum, teamWeekly } from '../lib/logic'

const RANGES = { 4: 'Last 4 weeks', 8: 'Last 8 weeks', 12: 'Last 12 weeks' } as const

export default function Insights() {
  const { skills, teams, members } = useStore()
  const nav = useNavigate()
  const [weeks, setWeeks] = useState<4 | 8 | 12>(4)
  const [team, setTeam] = useState('all')
  const [rate, setRate] = useState(35)
  const [adoption, setAdoption] = useState(100)
  const [license, setLicense] = useState(60)

  // Scope every number on the page to the same slice.
  const scoped = useMemo(() => skills.map((s) => {
    const u = team === 'all' ? s.usage : (s.usageByTeam[team] ?? Array(12).fill(0))
    return { ...s, scopedUsage: u.slice(-weeks) }
  }), [skills, team, weeks])

  const runs = sum(scoped.map((s) => sum(s.scopedUsage)))
  const hours = sum(scoped.map((s) => sum(s.scopedUsage) * s.minutesSaved)) / 60
  const scaledHours = hours * (adoption / 100)
  const seats = team === 'all' ? members.length : members.filter((m) => m.teamId === team).length
  const months = weeks / 4.33
  const value = scaledHours * rate
  const cost = seats * license * months
  const roi = cost ? value / cost : 0

  const byValue = [...scoped].map((s) => ({ s, v: (sum(s.scopedUsage) * s.minutesSaved) / 60 })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 7)

  const heatCols = WEEK_LABELS.slice(-weeks)
  const heatRows = teams.map((t) => ({ id: t.id, label: t.name }))
  const heatVals = teams.map((t) => teamWeekly(skills, t.id).slice(-weeks))

  const funnel = (() => {
    const pool = team === 'all' ? members : members.filter((m) => m.teamId === team)
    const n = pool.length
    return [
      { id: 'seats', label: 'Seats', value: n },
      { id: 'tried', label: 'Used a skill', value: Math.round(n * 0.92) },
      { id: 'weekly', label: 'Weekly active', value: Math.round(n * 0.75) },
      { id: 'authors', label: 'Wrote a skill', value: new Set(skills.filter((s) => s.stage !== 'deprecated' && pool.some((m) => m.id === s.ownerId)).map((s) => s.ownerId)).size },
    ]
  })()

  const series = team === 'all'
    ? teams.map((t) => ({ id: t.id, label: t.name, color: `var(--s${t.slot})`, values: teamWeekly(skills, t.id).slice(-weeks) }))
    : [{ id: team, label: teams.find((t) => t.id === team)!.name, color: `var(--s${teams.find((t) => t.id === team)!.slot})`, values: teamWeekly(skills, team).slice(-weeks) }]

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Value</h1>
          <p>Is this worth it? Adjust the assumptions and every number recalculates.</p>
        </div>
      </div>

      <Lens info={LENS.insights} />

      <div className="toolbar">
        <div className="seg" role="group" aria-label="Date range">
          {([4, 8, 12] as const).map((w) => <button key={w} aria-pressed={weeks === w} onClick={() => setWeeks(w)}>{RANGES[w]}</button>)}
        </div>
        <select className="select" style={{ width: 180 }} value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
          <option value="all">All teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="grid g-main">
        <div className="stack gap-16">
          <div className="grid g-3">
            <section className="card hero" style={{ gridColumn: 'span 1' }}>
              <div className="stat-label">Estimated value</div>
              <div className="hero-value num" style={{ fontSize: 44 }}>${compact(value)}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{fmt(scaledHours)} hrs × ${rate}/hr</div>
            </section>
            <section className="card stat">
              <div className="stat-label">Return on spend</div>
              <div className="stat-value num">{roi.toFixed(1)}×</div>
              <div className="muted" style={{ fontSize: 12.5 }}>vs ${fmt(cost)} in seats</div>
            </section>
            <section className="card stat">
              <div className="stat-label">Skill runs</div>
              <div className="stat-value num">{fmt(runs)}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{(runs / Math.max(1, seats) / weeks).toFixed(1)} per person per week</div>
            </section>
          </div>

          <section className="card">
            <div className="card-head"><div><h2>Adoption by team</h2><p>Weekly runs — darker means more use</p></div></div>
            <div className="card-body"><Heatmap rows={heatRows} cols={heatCols} values={heatVals} /></div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Weekly runs</h2><p>{team === 'all' ? 'By team' : series[0].label}</p></div></div>
            <div className="card-body"><LineChart series={series} labels={heatCols} height={220} area={series.length === 1} /></div>
          </section>
        </div>

        <aside className="stack gap-16">
          <section className="card card-body stack gap-16">
            <div>
              <h2>Assumptions</h2>
              <p className="muted" style={{ fontSize: 12.5 }}>Your numbers, not ours.</p>
            </div>
            <div className="field">
              <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor="rate">Loaded hourly cost</label><b className="num">${rate}</b></div>
              <input id="rate" type="range" min={10} max={150} step={5} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
            </div>
            <div className="field">
              <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor="adopt">Trust in “minutes saved”</label><b className="num">{adoption}%</b></div>
              <input id="adopt" type="range" min={10} max={100} step={5} value={adoption} onChange={(e) => setAdoption(Number(e.target.value))} />
              <span className="hint">Owners self-report time saved. Discount it if you’re skeptical.</span>
            </div>
            <div className="field">
              <div className="row" style={{ justifyContent: 'space-between' }}><label htmlFor="lic">Seat cost / month</label><b className="num">${license}</b></div>
              <input id="lic" type="range" min={0} max={200} step={5} value={license} onChange={(e) => setLicense(Number(e.target.value))} />
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Where the value comes from</h2><p>Hours saved, same range</p></div></div>
            <div className="card-body">
              <BarList rows={byValue.map(({ s, v }) => ({ id: s.id, label: s.title, value: v, onClick: () => nav(`/skills/${s.id}`) }))} format={(n) => `${fmt(n)}h`} />
            </div>
          </section>

          <section className="card">
            <div className="card-head"><div><h2>Adoption funnel</h2><p>People, {team === 'all' ? 'whole workspace' : teams.find((t) => t.id === team)?.name}</p></div></div>
            <div className="card-body">
              <BarList rows={funnel.map((f) => ({ id: f.id, label: f.label, value: f.value }))} color="var(--seq-4)" />
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}
