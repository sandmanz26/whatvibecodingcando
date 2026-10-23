import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Skill } from '../data/types'
import { useStore } from '../store/store'
import { can, fmt, stageLabel, sum } from '../lib/logic'
import { firstName } from './bits'

/**
 * The shelf — this product's own element. Every skill is a spine: its height is runs in the last
 * four weeks; published skills stand, skills waiting for review lean at the end, drafts are hatched,
 * and a skill nobody ran for a month gathers dust. Teal marks the books whose next step is yours.
 */
export function Shelf({ skills, height = 236, showLegend = true }: { skills: Skill[]; height?: number; showLegend?: boolean }) {
  const { me, member } = useStore()
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ s: Skill; x: number } | null>(null)

  const { standing, leaning, max } = useMemo(() => {
    const live = skills.filter((s) => s.stage === 'published' || s.stage === 'deprecated')
      .sort((a, b) => a.category.localeCompare(b.category) || sum(b.usage.slice(-4)) - sum(a.usage.slice(-4)))
    const lean = skills.filter((s) => s.stage === 'review' || s.stage === 'approved' || s.stage === 'draft')
      .sort((a, b) => ['approved', 'review', 'draft'].indexOf(a.stage) - ['approved', 'review', 'draft'].indexOf(b.stage))
    return { standing: live, leaning: lean, max: Math.max(1, ...skills.map((s) => sum(s.usage.slice(-4)))) }
  }, [skills])

  const yours = (s: Skill) =>
    (s.stage === 'review' && can(me, 'skill.approve', s) && !s.approvals.includes(me.id)) ||
    (s.stage === 'approved' && can(me, 'skill.publish', s)) ||
    (s.stage === 'draft' && s.ownerId === me.id)

  const runs = (s: Skill) => sum(s.usage.slice(-4))
  // Waiting and draft books have no runs yet; they stand at a fixed, readable height.
  const h = (s: Skill) => (s.stage === 'published' || s.stage === 'deprecated')
    ? Math.max(64, Math.round(64 + (runs(s) / max) * (height - 80)))
    : Math.round(height * 0.58)

  const cls = (s: Skill) => {
    if (s.stage === 'deprecated' || (s.stage === 'published' && sum(s.usage.slice(-4)) === 0)) return 'dusty'
    if (s.stage === 'draft') return 'draft'
    if (s.stage === 'review' || s.stage === 'approved') return `waiting ${yours(s) ? 'yours' : ''}`
    return runs(s) < max * 0.15 ? 'thin' : ''
  }

  const show = (s: Skill, el: HTMLElement) => {
    const box = ref.current!.getBoundingClientRect()
    const b = el.getBoundingClientRect()
    setTip({ s, x: Math.min(Math.max(0, b.left - box.left + b.width / 2 - 130), box.width - 260) })
  }

  const book = (s: Skill) => (
    <button
      key={s.id}
      className={`book ${cls(s)}`}
      style={{ height: h(s) }}
      onClick={() => nav(`/v2/skills/${s.id}`)}
      onMouseEnter={(e) => show(s, e.currentTarget)}
      onFocus={(e) => show(s, e.currentTarget)}
      onMouseLeave={() => setTip(null)}
      onBlur={() => setTip(null)}
      aria-label={`${s.title}, ${stageLabel(s.stage)}${s.stage === 'published' ? `, ${fmt(runs(s))} runs in 4 weeks` : ''}`}
    >
      <span>{s.title}</span>
    </button>
  )

  return (
    <div className="shelf" ref={ref}>
      <div className="shelf-books" style={{ height }} onMouseLeave={() => setTip(null)}>
        {standing.map(book)}
        {leaning.map(book)}
      </div>
      <div className="shelf-plank" />
      {tip && (
        <div className="shelf-tip" style={{ left: tip.x, bottom: height + 26 }} role="status">
          <b>{tip.s.title}</b>
          {tip.s.stage === 'published' || tip.s.stage === 'deprecated' ? (
            <><span className="fig num">{fmt(runs(tip.s))}</span> <span className="v2-small">runs in 4 weeks · {Math.round((runs(tip.s) * tip.s.minutesSaved) / 60)} h saved</span></>
          ) : (
            <span className="v2-small">{stageLabel(tip.s.stage)} · v{tip.s.version}{tip.s.stage === 'review' ? ` · ${tip.s.approvals.length} approval${tip.s.approvals.length === 1 ? '' : 's'}` : ''}</span>
          )}
          <div className="v2-small" style={{ marginTop: 4 }}>{firstName(member(tip.s.ownerId))} wrote it · {tip.s.category}</div>
        </div>
      )}
      {showLegend && (
        <div className="shelf-legend">
          <span><i style={{ background: 'var(--chart-1)' }} />Standing: published, height is runs in 4 weeks</span>
          <span><i style={{ border: '1.5px solid var(--text)', transform: 'rotate(-7deg)' }} />Leaning: waiting for review</span>
          <span><i style={{ border: '1.5px solid var(--accent)', transform: 'rotate(-7deg)' }} />Waiting on you</span>
          <span><i style={{ background: '#f6f6f5', border: '1px solid #dcdcda' }} />Draft</span>
          <span><i style={{ background: '#c8c8c5' }} />Retired or gathering dust</span>
        </div>
      )}
    </div>
  )
}
