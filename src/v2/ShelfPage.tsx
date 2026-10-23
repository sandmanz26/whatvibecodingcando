import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useStore } from '../store/store'
import { intensity, recent, skillByTeam, teamSkills } from '../lib/logic'
import { Shelf } from './Shelf'

export default function V2ShelfPage() {
  const inv = useStore()
  const { teams, skills } = inv
  const { hash } = useLocation()

  // One scale for every shelf, so a tall book means the same thing on each.
  const max = useMemo(() => Math.max(1, ...skills.flatMap((s) => Object.values(skillByTeam(inv, s.id)).map(recent))), [inv, skills])
  const ranked = [...teams].sort((a, b) => intensity(inv, b) - intensity(inv, a))

  useEffect(() => {
    if (hash) document.getElementById(`shelf-${hash.slice(1)}`)?.scrollIntoView({ block: 'start' })
  }, [hash])

  return (
    <main className="v2-canvas" style={{ paddingTop: 48 }}>
      <div className="v2-col v2-enter">
        <header>
          <h1 className="v2-title">Shelves</h1>
          <p className="v2-sub" style={{ marginTop: 4 }}>One shelf per team, busiest first. A book is a skill the team has installed; the taller it stands, the more they ran it in the last four weeks.</p>
        </header>

        <div className="stack" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap)', marginTop: 32 }}>
          {ranked.map((t, i) => {
            const used = teamSkills(inv, t.id)
            const borrowed = used.filter((x) => x.skill.teamId !== t.id).length
            return (
              <section key={t.id} id={`shelf-${t.id}`} className="v2-panel" aria-labelledby={`h-${t.id}`} style={{ scrollMarginTop: 80 }}>
                <div className="v2-panel-head">
                  <h2 className="v2-section" id={`h-${t.id}`}>{t.name}</h2>
                  <span className="v2-chip">{intensity(inv, t).toFixed(1)} runs per person a week</span>
                  <span className="v2-small" style={{ marginLeft: 'auto' }}>{t.size} people · {used.length} skills · {borrowed} borrowed</span>
                </div>
                <Shelf teamId={t.id} height={190} max={max} showLegend={i === ranked.length - 1} />
              </section>
            )
          })}
        </div>
      </div>
    </main>
  )
}
