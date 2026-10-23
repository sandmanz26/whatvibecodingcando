import { ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react'
import type { Skill } from '../data/types'
import { useStore, useCan } from '../store/store'
import { dateLabel } from '../lib/logic'

/** Where an external skill comes from, which version runs here, and the two jobs it creates: vet it, update it. */
export function SourceBlock({ skill, v2 = false }: { skill: Skill; v2?: boolean }) {
  const { dispatch, toast } = useStore()
  const allowed = useCan()
  const src = skill.source
  if (!src) return null
  const btn = v2 ? 'v2-btn sm' : 'btn sm'
  const canVet = allowed('skill.approve', skill)
  return (
    <div>
      <dl className={v2 ? 'v2-kv' : 'src-kv'}>
        <dt>From</dt><dd>{src.origin}</dd>
        <dt>Repository</dt><dd><a href={src.url} target="_blank" rel="noopener" style={{ display: 'inline-flex', gap: 4, alignItems: 'center', textDecoration: 'underline' }}>{src.repo}{src.path ? `/${src.path}` : ''} <ExternalLink size={12} /></a></dd>
        <dt>License</dt><dd>{src.license}</dd>
        <dt>Pinned at</dt><dd className="num">v{src.pinned} · {dateLabel(src.syncedAt)}</dd>
        <dt>Security review</dt><dd style={{ color: src.vetted ? undefined : 'var(--critical-ink, var(--negative))' }}>{src.vetted ? 'Passed' : 'Not yet'}</dd>
      </dl>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {!src.vetted && (
          <button className={btn} aria-disabled={!canVet} title={canVet ? undefined : 'A Maintainer who didn’t import it does the security review'}
            onClick={() => { if (!canVet) return; dispatch({ type: 'vetExternal', id: skill.id }); toast(`${skill.title} passed the security review`) }}>
            <ShieldCheck size={14} /> Mark security review passed
          </button>
        )}
        {src.latest && (
          <button className={btn} aria-disabled={!allowed('skill.edit', skill)}
            onClick={() => { if (!allowed('skill.edit', skill)) return; dispatch({ type: 'syncExternal', id: skill.id }); toast(`Pulled v${src.latest} — it goes through review before anyone runs it`) }}>
            <RefreshCw size={14} /> Pull v{src.latest} for review
          </button>
        )}
      </div>
      {src.latest && <p style={{ fontSize: 12.5, marginTop: 8, color: 'var(--ink-2, var(--muted))' }}>Upstream has v{src.latest}. The team keeps running v{src.pinned} until the update is reviewed.</p>}
    </div>
  )
}

export const sourceLabel = (s: Skill) => (s.source ? `From ${s.source.origin}` : 'Written here')
