import { Link, useSearchParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { KIND_LABEL, type IssueKind } from '../lib/logic'
import { KIND_HINT } from '../pages/Health'

const KINDS: IssueKind[] = ['duplicate', 'copy', 'owner', 'external', 'deprecated', 'drift', 'unused']
const TONE = { high: 'neg', medium: 'warn', low: '' } as const

export default function V2Tidy() {
  const { issues, dismissed, setDismissed, skill, project, toast } = useStore()
  const [params, setParams] = useSearchParams()
  const kind = (params.get('kind') ?? 'all') as IssueKind | 'all'
  const showOff = params.get('show') === 'all'
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params)
    if (v === null) p.delete(k); else p.set(k, v)
    setParams(p, { replace: true })
  }
  const inKind = issues.filter((i) => kind === 'all' || i.kind === kind)
  const list = inKind.filter((i) => showOff || !dismissed.includes(i.id))
  const off = inKind.filter((i) => dismissed.includes(i.id)).length
  const count = (k: IssueKind | 'all') => issues.filter((i) => (k === 'all' || i.kind === k) && !dismissed.includes(i.id)).length

  return (
    <main className="v2-canvas" style={{ paddingTop: 48 }}>
      <div className="v2-col v2-enter">
        <header>
          <h1 className="v2-title">Tidy up</h1>
          <p className="v2-sub" style={{ marginTop: 4 }}>What makes the shelves messy, found by reading every project. The fix itself is a change in the repository.</p>
        </header>

        <div className="v2-seg" role="group" aria-label="Kind" style={{ margin: '24px 0 12px' }}>
          <button aria-pressed={kind === 'all'} onClick={() => set('kind', null)}>All {count('all')}</button>
          {KINDS.map((k) => <button key={k} aria-pressed={kind === k} onClick={() => set('kind', k)}>{KIND_LABEL[k]} {count(k)}</button>)}
        </div>
        {kind !== 'all' && <p className="v2-note" style={{ marginBottom: 16 }}>{KIND_HINT[kind]}</p>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {list.length === 0 && <div className="v2-panel"><div className="v2-empty">Nothing to tidy here.</div></div>}
          {list.map((i) => {
            const isOff = dismissed.includes(i.id)
            const s = skill(i.skillId)!
            const o = i.otherId ? skill(i.otherId) : undefined
            return (
              <section key={i.id} className="v2-panel" style={{ opacity: isOff ? 0.6 : 1 }}>
                <div className="v2-panel-head">
                  <span className={`v2-chip ${TONE[i.severity]}`}>{KIND_LABEL[i.kind]}</span>
                  <h2 className="v2-section" style={{ fontSize: 16 }}>{i.title}</h2>
                  <button className="v2-btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => { setDismissed(i.id, !isOff); toast(isOff ? 'Back on the list' : 'Left as is') }}>{isOff ? 'Put back' : 'Leave as is'}</button>
                </div>
                <p className="v2-note">{i.detail}</p>
                <p style={{ marginTop: 8, fontWeight: 500 }}>{i.action}</p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
                  <Link className="v2-chip teal" to={`/v2/skills/${s.id}`}>{s.title}</Link>
                  {o && <Link className="v2-chip teal" to={`/v2/skills/${o.id}`}>{o.title}</Link>}
                  {i.projectIds.map((p) => <Link key={p} className="v2-chip mono" to={`/v2/projects/${p}`}>{project(p)?.name}</Link>)}
                </div>
              </section>
            )
          })}
        </div>
        {off > 0 && <button className="v2-btn ghost sm" style={{ marginTop: 16 }} onClick={() => set('show', showOff ? null : 'all')}>{showOff ? 'Hide' : 'Show'} {off} left as is</button>}
      </div>
    </main>
  )
}
