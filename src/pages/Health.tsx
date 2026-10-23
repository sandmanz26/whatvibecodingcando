import { useSearchParams } from 'react-router-dom'
import { useStore } from '../store/store'
import { Empty } from '../components/ui'
import { KIND_LABEL, type IssueKind } from '../lib/logic'
import { IssueCard } from './bits'

const KINDS: IssueKind[] = ['duplicate', 'copy', 'owner', 'external', 'deprecated', 'drift', 'unused']

export const KIND_HINT: Record<IssueKind, string> = {
  duplicate: 'Two skills that say they do the same job. Merge them into one shared skill.',
  copy: 'A project edited its copy of another team’s skill. That team needs it too: share it properly.',
  owner: 'Nobody answers for these skills any more.',
  external: 'Skills that came from outside: security reviews and upstream updates.',
  deprecated: 'Retired skills that are still installed somewhere.',
  drift: 'The same skill on different versions in different projects.',
  unused: 'Installed but not run in four weeks.',
}

export default function Health({ base = '' }: { base?: string }) {
  const { issues, dismissed } = useStore()
  const [params, setParams] = useSearchParams()
  const kind = (params.get('kind') ?? 'all') as IssueKind | 'all'
  const showOff = params.get('show') === 'all'
  const set = (k: string, v: string | null) => {
    const p = new URLSearchParams(params)
    if (v === null) p.delete(k)
    else p.set(k, v)
    setParams(p, { replace: true })
  }

  const openOf = (k: IssueKind | 'all') => issues.filter((i) => (k === 'all' || i.kind === k) && !dismissed.includes(i.id)).length
  const list = issues.filter((i) => (kind === 'all' || i.kind === kind) && (showOff || !dismissed.includes(i.id)))
  const off = issues.filter((i) => (kind === 'all' || i.kind === kind) && dismissed.includes(i.id)).length

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Health</h1>
          <p>What makes the skills messy, found by reading every project. Each finding says what to do; the change itself happens in the repository.</p>
        </div>
      </div>

      <div className="row wrap" style={{ marginBottom: 16 }}>
        <button className="chip" aria-pressed={kind === 'all'} onClick={() => set('kind', null)}>All <span className="num" style={{ opacity: 0.6 }}>{openOf('all')}</span></button>
        {KINDS.map((k) => (
          <button key={k} className="chip" aria-pressed={kind === k} onClick={() => set('kind', k)}>
            {KIND_LABEL[k]} <span className="num" style={{ opacity: 0.6 }}>{openOf(k)}</span>
          </button>
        ))}
      </div>
      {kind !== 'all' && <p className="muted" style={{ marginBottom: 12, fontSize: 13 }}>{KIND_HINT[kind]}</p>}

      {list.length === 0 ? (
        <div className="card"><Empty title="Nothing to tidy here">{off > 0 && <span style={{ fontSize: 13 }}>{off} left as is.</span>}</Empty></div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>{list.map((i) => <IssueCard key={i.id} issue={i} base={base} />)}</div>
      )}
      {off > 0 && (
        <button className="btn ghost sm" style={{ marginTop: 16 }} onClick={() => set('show', showOff ? null : 'all')}>
          {showOff ? 'Hide' : 'Show'} {off} left as is
        </button>
      )}
    </main>
  )
}
