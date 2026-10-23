import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Skill } from '../data/types'
import { useStore } from '../store/store'
import { fmt, installsOf, recent, skillByTeam, teamOfInstall } from '../lib/logic'

interface Book { s: Skill; runs: number; own: boolean; versions: string[]; edited: boolean }

/**
 * A team's shelf — this product's own element. Every skill the team has installed is a spine:
 * height is how much this team ran it in four weeks. Skills the team owns stand; skills borrowed
 * from another team lean; a skill nobody ran for a month, or a retired one, gathers dust.
 * Teal marks a book with something to tidy.
 */
export function Shelf({ teamId, height = 200, max: maxIn, showLegend = false }: { teamId: string; height?: number; max?: number; showLegend?: boolean }) {
  const inv = useStore()
  const { skills, team, open } = inv
  const nav = useNavigate()
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ b: Book; x: number } | null>(null)

  const { books, max } = useMemo(() => {
    const books: Book[] = skills.flatMap((s) => {
      const mine = installsOf(inv, s.id).filter((i) => teamOfInstall(inv, i) === teamId)
      if (!mine.length) return []
      return [{ s, runs: recent(skillByTeam(inv, s.id)[teamId] ?? []), own: s.teamId === teamId, versions: [...new Set(mine.map((i) => i.version))], edited: mine.some((i) => i.edited) }]
    }).sort((a, b) => Number(b.own) - Number(a.own) || b.runs - a.runs)
    return { books, max: maxIn ?? Math.max(1, ...books.map((b) => b.runs)) }
  }, [inv, skills, teamId, maxIn])

  const flagged = (s: Skill) => open.some((i) => i.skillId === s.id || i.otherId === s.id)
  const h = (b: Book) => Math.max(56, Math.round(56 + (Math.sqrt(b.runs) / Math.sqrt(max)) * (height - 64)))
  const cls = (b: Book) => [
    b.s.source ? 'ext' : '',
    b.s.status === 'deprecated' || b.runs === 0 ? 'dusty' : !b.own ? 'waiting' : '',
    flagged(b.s) && b.s.status !== 'deprecated' && b.runs > 0 ? (b.own ? 'flag' : 'yours') : '',
  ].join(' ')

  const show = (b: Book, el: HTMLElement) => {
    const box = ref.current!.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    setTip({ b, x: Math.min(Math.max(0, r.left - box.left + r.width / 2 - 130), box.width - 260) })
  }

  return (
    <div className="shelf" ref={ref}>
      <div className="shelf-books" style={{ height }} onMouseLeave={() => setTip(null)}>
        {books.map((b) => (
          <button
            key={b.s.id}
            className={`book ${cls(b)}`}
            style={{ height: h(b) }}
            onClick={() => nav(`/v2/skills/${b.s.id}`)}
            onMouseEnter={(e) => show(b, e.currentTarget)}
            onFocus={(e) => show(b, e.currentTarget)}
            onMouseLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
            aria-label={`${b.s.title}, ${fmt(b.runs)} runs in 4 weeks${b.own ? '' : `, borrowed from ${team(b.s.teamId)?.name}`}`}
          >
            <span>{b.s.title}</span>
          </button>
        ))}
      </div>
      <div className="shelf-plank" />
      {tip && (
        <div className="shelf-tip" style={{ left: tip.x, bottom: height + 26 }} role="status">
          <b>{tip.b.s.title}</b>
          <span className="fig num">{fmt(tip.b.runs)}</span> <span className="v2-small">runs in 4 weeks</span>
          <div className="v2-small" style={{ marginTop: 4 }}>
            {tip.b.own ? 'Theirs' : `Borrowed from ${team(tip.b.s.teamId)?.name}`} · v{tip.b.versions.join(', v')}{tip.b.edited ? ' · edited copy' : ''}
            {tip.b.s.status === 'deprecated' ? ' · retired' : ''}{tip.b.s.source ? ` · from ${tip.b.s.source.origin}` : ''}
          </div>
        </div>
      )}
      {showLegend && (
        <div className="shelf-legend">
          <span><i style={{ background: 'var(--chart-1)' }} />Standing: the team’s own skill, height is runs in 4 weeks</span>
          <span><i style={{ border: '1.5px solid var(--text)', transform: 'rotate(-7deg)' }} />Leaning: borrowed from another team</span>
          <span><i style={{ background: 'var(--accent)' }} />Teal: something to tidy</span>
          <span><i className="ext-key" style={{ background: 'var(--chart-1)' }} />Label: from outside the company</span>
          <span><i style={{ background: '#c8c8c5' }} />Dust: unused for 4 weeks, or retired</span>
        </div>
      )}
    </div>
  )
}
