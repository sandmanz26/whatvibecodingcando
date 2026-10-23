import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LayoutGrid, List, Plus, Search, Star, X } from 'lucide-react'
import { useStore, useCan } from '../store/store'
import { Avatar, CATEGORIES, CategoryIcon, Empty, GuardedButton, Lens, StageBadge, TeamDots } from '../components/ui'
import { Sparkline } from '../components/charts'
import { LENS } from '../data/lens'
import { ago, fmt, minimumRole, STAGES, sum } from '../lib/logic'
import type { Stage } from '../data/types'

const SORTS = { used: 'Most used', updated: 'Recently updated', az: 'A–Z', rating: 'Highest rated' } as const

export default function Library() {
  const { skills, teams, member } = useStore()
  const allowed = useCan()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const stage = (params.get('stage') ?? 'all') as Stage | 'all'
  const team = params.get('team') ?? 'all'
  const cat = params.get('cat') ?? 'all'
  const sort = (params.get('sort') ?? 'used') as keyof typeof SORTS
  const view = params.get('view') ?? 'grid'

  const set = (k: string, v: string, def: string) => {
    const p = new URLSearchParams(params)
    if (v === def || !v) p.delete(k)
    else p.set(k, v)
    setParams(p, { replace: true })
  }

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const r = skills.filter((s) =>
      (stage === 'all' || s.stage === stage) &&
      (team === 'all' || s.teamIds.includes(team)) &&
      (cat === 'all' || s.category === cat) &&
      (!t || `${s.title} ${s.name} ${s.description} ${s.triggers.join(' ')}`.toLowerCase().includes(t)))
    const by = {
      used: (a: typeof r[0], b: typeof r[0]) => sum(b.usage.slice(-4)) - sum(a.usage.slice(-4)),
      updated: (a: typeof r[0], b: typeof r[0]) => b.updatedAt.localeCompare(a.updatedAt),
      az: (a: typeof r[0], b: typeof r[0]) => a.title.localeCompare(b.title),
      rating: (a: typeof r[0], b: typeof r[0]) => b.rating - a.rating,
    }[sort]
    return [...r].sort(by)
  }, [skills, q, stage, team, cat, sort])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: skills.length }
    skills.forEach((s) => (c[s.stage] = (c[s.stage] ?? 0) + 1))
    return c
  }, [skills])

  const filtered = q || stage !== 'all' || team !== 'all' || cat !== 'all'

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Skill library</h1>
          <p>Every Claude skill your team has written, who owns it, and who can use it.</p>
        </div>
        <div className="actions">
          <GuardedButton className="btn primary" allowed={allowed('skill.create')} reason={`Needs ${minimumRole('skill.create')} role`} onClick={() => nav('/skills/new')}>
            <Plus size={15} /> New skill
          </GuardedButton>
        </div>
      </div>

      <Lens info={LENS.library} />

      <div className="row wrap" style={{ marginBottom: 12 }}>
        {(['all', ...STAGES.map((s) => s.id)] as const).map((s) => (
          <button key={s} className="chip" aria-pressed={stage === s} onClick={() => set('stage', s, 'all')}>
            {s === 'all' ? 'All' : STAGES.find((x) => x.id === s)!.label}
            <span className="num" style={{ opacity: 0.6 }}>{counts[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="input-wrap">
          <Search size={15} />
          <input className="input" placeholder="Search skills or triggers" value={q} onChange={(e) => set('q', e.target.value, '')} aria-label="Search skills" />
        </div>
        <select className="select" style={{ width: 170 }} value={team} onChange={(e) => set('team', e.target.value, 'all')} aria-label="Team">
          <option value="all">All teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className="select" style={{ width: 160 }} value={cat} onChange={(e) => set('cat', e.target.value, 'all')} aria-label="Category">
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select className="select" style={{ width: 170 }} value={sort} onChange={(e) => set('sort', e.target.value, 'used')} aria-label="Sort">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {filtered && <button className="btn ghost sm" onClick={() => setParams({}, { replace: true })}><X size={13} /> Clear</button>}
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 12.5 }}>{list.length} skill{list.length === 1 ? '' : 's'}</span>
        <div className="seg" role="group" aria-label="View">
          <button aria-pressed={view === 'grid'} onClick={() => set('view', 'grid', 'grid')} aria-label="Grid view"><LayoutGrid size={14} /></button>
          <button aria-pressed={view === 'table'} onClick={() => set('view', 'table', 'grid')} aria-label="Table view"><List size={14} /></button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card"><Empty title="No skills match these filters"><button className="btn sm" onClick={() => setParams({}, { replace: true })}>Clear filters</button></Empty></div>
      ) : view === 'grid' ? (
        <div className="skill-grid">
          {list.map((s) => {
            const runs = sum(s.usage.slice(-4))
            return (
              <button key={s.id} className="card skill-card" onClick={() => nav(`/skills/${s.id}`)}>
                <div className="top">
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <CategoryIcon category={s.category} />
                    <div style={{ minWidth: 0 }}>
                      <h3>{s.title}</h3>
                      <div className="slug">{s.name} · v{s.version}</div>
                    </div>
                  </div>
                  <StageBadge stage={s.stage} />
                </div>
                <p className="desc">{s.description}</p>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <div className="num" style={{ fontWeight: 600, fontSize: 15 }}>{runs ? fmt(runs) : '—'}</div>
                    <div className="muted" style={{ fontSize: 11.5 }}>runs · 4 wks</div>
                  </div>
                  {runs > 0 && <Sparkline values={s.usage} width={110} />}
                </div>
                <div className="foot">
                  <span className="row" style={{ gap: 6 }}><Avatar member={member(s.ownerId)} />{member(s.ownerId)?.name}</span>
                  <TeamDots ids={s.teamIds} />
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr><th>Skill</th><th>Stage</th><th>Owner</th><th>Teams</th><th className="r">Runs · 4 wks</th><th className="r">Rating</th><th className="r">Updated</th></tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => nav(`/skills/${s.id}`)}>
                  <td>
                    <div style={{ fontWeight: 550 }}>{s.title}</div>
                    <div className="mono muted" style={{ fontSize: 11.5 }}>{s.name}</div>
                  </td>
                  <td><StageBadge stage={s.stage} /></td>
                  <td><span className="row" style={{ gap: 6 }}><Avatar member={member(s.ownerId)} />{member(s.ownerId)?.name}</span></td>
                  <td><TeamDots ids={s.teamIds} /></td>
                  <td className="r num">{fmt(sum(s.usage.slice(-4)))}</td>
                  <td className="r num">{s.rating ? <span className="row" style={{ justifyContent: 'flex-end', gap: 4 }}><Star size={12} fill="currentColor" color="var(--ink-3)" />{s.rating.toFixed(1)}</span> : '—'}</td>
                  <td className="r muted">{ago(s.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
