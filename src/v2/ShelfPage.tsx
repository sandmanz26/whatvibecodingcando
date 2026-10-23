import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Download } from 'lucide-react'
import { ImportExternal } from '../components/ImportExternal'
import { useStore } from '../store/store'
import { fmt, stageLabel, sum } from '../lib/logic'
import type { Stage } from '../data/types'
import { Shelf } from './Shelf'
import { Face, firstName } from './bits'

const STAGE_TONE: Record<Stage, string> = { published: '', review: 'teal', approved: 'pos', draft: '', deprecated: '' }

export default function V2ShelfPage() {
  const { skills, teams, member } = useStore()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const team = params.get('team') ?? 'all'
  const [view, setView] = useState<'shelf' | 'list'>('shelf')
  const [importing, setImporting] = useState(false)
  const source = params.get('from') ?? 'all'
  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (!v || v === 'all') p.delete(k); else p.set(k, v)
    setParams(p, { replace: true })
  }

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return skills.filter((s) => (team === 'all' || s.teamIds.includes(team)) &&
      (source === 'all' || (source === 'outside' ? !!s.source : !s.source)) &&
      (!t || `${s.title} ${s.description} ${s.triggers.join(' ')}`.toLowerCase().includes(t)))
  }, [skills, q, team, source])

  const byCategory = useMemo(() => {
    const m = new Map<string, typeof list>()
    list.forEach((s) => m.set(s.category, [...(m.get(s.category) ?? []), s]))
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [list])

  const count = (st: Stage) => list.filter((s) => s.stage === st).length
  const leaning = count('review') + count('approved')

  return (
    <main className="v2-canvas" style={{ paddingTop: 48 }}>
      <div className="v2-col v2-enter">
        <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
          <h1 className="v2-title">The shelf</h1>
          <p className="v2-sub" style={{ marginTop: 4 }}>
            {list.length} skills · {count('published')} standing, {leaning} leaning for review, {count('draft')} draft{count('draft') === 1 ? '' : 's'}, {count('deprecated')} retired · {list.filter((s) => s.source).length} from outside
          </p>
          </div>
          <button className="v2-btn" onClick={() => setImporting(true)}><Download size={15} /> Bring one in</button>
        </header>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', margin: '24px 0 var(--gap)' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 360 }}>
            <Search size={15} style={{ position: 'absolute', left: 14, top: 12, color: 'var(--muted)' }} />
            <input className="v2-input" style={{ paddingLeft: 38 }} placeholder="What do you need help with?" value={q} onChange={(e) => set('q', e.target.value)} aria-label="Search skills" />
          </div>
          <div className="v2-seg" role="group" aria-label="Lent to">
            <button aria-pressed={team === 'all'} onClick={() => set('team', 'all')}>Every team</button>
            {teams.map((t) => <button key={t.id} aria-pressed={team === t.id} onClick={() => set('team', t.id)}>{t.name}</button>)}
          </div>
          <div className="v2-seg" role="group" aria-label="Source">
            <button aria-pressed={source === 'all'} onClick={() => set('from', 'all')}>Anywhere</button>
            <button aria-pressed={source === 'here'} onClick={() => set('from', 'here')}>Written here</button>
            <button aria-pressed={source === 'outside'} onClick={() => set('from', 'outside')}>From outside</button>
          </div>
          <div className="v2-seg" role="group" aria-label="View" style={{ marginLeft: 'auto' }}>
            <button aria-pressed={view === 'shelf'} onClick={() => setView('shelf')}>Shelves</button>
            <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
          </div>
        </div>

        {list.length === 0 && <div className="v2-empty">No skill matches “{q}”. Try the words people use when they ask for help, like “review” or “release notes”.</div>}

        {view === 'shelf' ? (
          <div className="v2-grid" style={{ alignItems: 'start' }}>
            {byCategory.map(([cat, items], i) => (
              <section key={cat} className={`v2-panel ${byCategory.length % 2 === 1 && i === byCategory.length - 1 ? 'v2-span-12' : 'v2-span-6'}`} aria-label={cat}>
                <div className="v2-panel-head">
                  <h2 className="v2-section">{cat}</h2>
                  <span className="v2-chip">{items.length}</span>
                  <span className="v2-small" style={{ marginLeft: 'auto' }}>{fmt(sum(items.map((s) => sum(s.usage.slice(-4)))))} runs in 4 weeks</span>
                </div>
                <Shelf skills={items} height={170} showLegend={false} />
              </section>
            ))}
          </div>
        ) : (
          <section className="v2-panel" style={{ padding: 8 }}>
            <div className="v2-rows">
              {[...list].sort((a, b) => sum(b.usage.slice(-4)) - sum(a.usage.slice(-4))).map((s) => {
                const owner = member(s.ownerId)
                const runs = sum(s.usage.slice(-4))
                return (
                  <button key={s.id} className="v2-row" onClick={() => nav(`/v2/skills/${s.id}`)}>
                    <Face member={owner} />
                    <span className="main"><b>{s.title}</b><span>{s.description}</span></span>
                    <span className="side" style={{ width: 120 }}>{s.source ? s.source.origin : firstName(owner)}<br />{s.teamIds.length} team{s.teamIds.length === 1 ? '' : 's'}</span>
                    <span className="side num" style={{ width: 110, color: 'var(--text)' }}>{runs ? fmt(runs) : '—'}<br /><span className="v2-small">runs, 4 weeks</span></span>
                    <span style={{ width: 96, textAlign: 'right' }}><span className={`v2-chip ${STAGE_TONE[s.stage]}`}>{stageLabel(s.stage)}</span></span>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>
      {importing && <ImportExternal base="/v2" onClose={() => setImporting(false)} />}
    </main>
  )
}
