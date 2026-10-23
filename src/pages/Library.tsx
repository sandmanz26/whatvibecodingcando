import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, X, GitBranch } from 'lucide-react'
import { useStore } from '../store/store'
import { Empty, StatusBadge, TeamDots, STATUS_LABEL } from '../components/ui'
import { Sparkline } from '../components/charts'
import { fmt, installsOf, recent, skillWeekly, teamsUsing } from '../lib/logic'
import type { Status } from '../data/types'

const SORTS = { used: 'Most used', spread: 'Most teams', issues: 'Most findings', az: 'A–Z' } as const

export default function Library() {
  const inv = useStore()
  const { skills, teams, projects, member, team, open } = inv
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const status = (params.get('status') ?? 'all') as Status | 'all'
  const teamF = params.get('team') ?? 'all'
  const projectF = params.get('project') ?? 'all'
  const scope = params.get('scope') ?? 'all'
  const sort = (params.get('sort') ?? 'used') as keyof typeof SORTS

  const set = (k: string, v: string, def: string) => {
    const p = new URLSearchParams(params)
    if (v === def || !v) p.delete(k)
    else p.set(k, v)
    setParams(p, { replace: true })
  }

  const rows = useMemo(() => skills.map((s) => {
    const ins = installsOf(inv, s.id)
    return {
      s, ins,
      using: teamsUsing(inv, s.id),
      weekly: skillWeekly(inv, s.id),
      versions: new Set(ins.filter((i) => !i.edited).map((i) => i.version)).size,
      copies: ins.filter((i) => i.edited).length,
      findings: open.filter((i) => i.skillId === s.id || i.otherId === s.id).length,
    }
  }), [inv, skills, open])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const r = rows.filter(({ s, ins, using }) =>
      (status === 'all' || s.status === status) &&
      (teamF === 'all' || using.includes(teamF)) &&
      (projectF === 'all' || ins.some((i) => i.projectId === projectF)) &&
      (scope === 'all' || (scope === 'shared' ? using.length > 1 : using.length <= 1)) &&
      (!t || `${s.title} ${s.name} ${s.description} ${s.triggers.join(' ')}`.toLowerCase().includes(t)))
    const by = {
      used: (a: typeof r[0], b: typeof r[0]) => recent(b.weekly) - recent(a.weekly),
      spread: (a: typeof r[0], b: typeof r[0]) => b.using.length - a.using.length || recent(b.weekly) - recent(a.weekly),
      issues: (a: typeof r[0], b: typeof r[0]) => b.findings - a.findings,
      az: (a: typeof r[0], b: typeof r[0]) => a.s.title.localeCompare(b.s.title),
    }[sort]
    return [...r].sort(by)
  }, [rows, q, status, teamF, projectF, scope, sort])

  const filtered = q || status !== 'all' || teamF !== 'all' || projectF !== 'all' || scope !== 'all'

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Skills</h1>
          <p>Every skill found in the company’s repositories: who owns it, which teams run it, and in which projects.</p>
        </div>
      </div>

      <div className="row wrap" style={{ marginBottom: 12 }}>
        {(['all', 'active', 'experimental', 'deprecated'] as const).map((s) => (
          <button key={s} className="chip" aria-pressed={status === s} onClick={() => set('status', s, 'all')}>
            {s === 'all' ? 'All' : STATUS_LABEL[s]}
            <span className="num" style={{ opacity: 0.6 }}>{s === 'all' ? skills.length : skills.filter((x) => x.status === s).length}</span>
          </button>
        ))}
      </div>

      <div className="toolbar">
        <div className="input-wrap">
          <Search size={15} />
          <input className="input" placeholder="Search skills or triggers" value={q} onChange={(e) => set('q', e.target.value, '')} aria-label="Search skills" />
        </div>
        <select className="select" style={{ width: 170 }} value={teamF} onChange={(e) => set('team', e.target.value, 'all')} aria-label="Used by team">
          <option value="all">Used by any team</option>
          {teams.map((t) => <option key={t.id} value={t.id}>Used by {t.name}</option>)}
        </select>
        <select className="select" style={{ width: 170 }} value={projectF} onChange={(e) => set('project', e.target.value, 'all')} aria-label="Project">
          <option value="all">In any project</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Scope">
          <button aria-pressed={scope === 'all'} onClick={() => set('scope', 'all', 'all')}>All</button>
          <button aria-pressed={scope === 'shared'} onClick={() => set('scope', 'shared', 'all')}>Shared</button>
          <button aria-pressed={scope === 'one'} onClick={() => set('scope', 'one', 'all')}>One team</button>
        </div>
        <select className="select" style={{ width: 150 }} value={sort} onChange={(e) => set('sort', e.target.value, 'used')} aria-label="Sort">
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {filtered && <button className="btn ghost sm" onClick={() => setParams({}, { replace: true })}><X size={13} /> Clear</button>}
        <div style={{ flex: 1 }} />
        <span className="muted" style={{ fontSize: 12.5 }}>{list.length} skill{list.length === 1 ? '' : 's'}</span>
      </div>

      {list.length === 0 ? (
        <div className="card"><Empty title="No skills match these filters"><button className="btn sm" onClick={() => setParams({}, { replace: true })}>Clear filters</button></Empty></div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr><th>Skill</th><th>Status</th><th>Owned by</th><th>Used by</th><th className="r">Projects</th><th>Versions</th><th className="r">Runs · 4 wks</th><th className="r">Findings</th></tr>
            </thead>
            <tbody>
              {list.map(({ s, ins, using, weekly, versions, copies, findings }) => {
                const owner = member(s.ownerId)
                return (
                  <tr key={s.id} className="clickable" onClick={() => nav(`/skills/${s.id}`)}>
                    <td>
                      <div style={{ fontWeight: 550 }} className="row">{s.title}{s.source && <span className="badge outline" title={`From ${s.source.repo}`} style={{ height: 20 }}><GitBranch size={11} /> {s.source.origin.split(' ')[0]}</span>}</div>
                      <div className="mono muted" style={{ fontSize: 11.5 }}>{s.name}</div>
                    </td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>
                      <div>{team(s.teamId)?.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{owner?.active ? owner.name : <span style={{ color: 'var(--critical-ink)' }}>No active owner</span>}</div>
                    </td>
                    <td><span className="row" style={{ gap: 8 }}><TeamDots ids={using} />{using.length > 1 ? <span className="muted" style={{ fontSize: 12 }}>{using.length} teams</span> : null}</span></td>
                    <td className="r num">{ins.length}</td>
                    <td>
                      {versions > 1 ? <span className="badge" style={{ color: '#8f6100' }}>{versions} versions</span> : <span className="muted num">v{s.version}</span>}
                      {copies > 0 && <span className="badge" style={{ color: 'var(--critical-ink)', marginLeft: 4 }}>{copies} edited cop{copies > 1 ? 'ies' : 'y'}</span>}
                    </td>
                    <td className="r"><span className="row" style={{ justifyContent: 'flex-end', gap: 10 }}><Sparkline values={weekly} width={64} height={20} /><span className="num">{fmt(recent(weekly))}</span></span></td>
                    <td className="r num">{findings || <span className="muted">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  )
}
