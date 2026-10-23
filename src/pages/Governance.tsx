import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ShieldCheck, Search, CircleCheck } from 'lucide-react'
import { useStore, useCan } from '../store/store'
import { Avatar, Empty, GuardedButton, Lens, Severity, Switch } from '../components/ui'
import { SegMeter } from '../components/charts'
import { LENS } from '../data/lens'
import { ActivityText } from './shared'
import { can, dateLabel, evaluate, minimumRole, type Violation } from '../lib/logic'
import type { AuditAction } from '../data/types'

type Tab = 'violations' | 'policies' | 'audit'

const ACTION_FILTERS: { id: 'all' | AuditAction; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'approved', label: 'Approvals' },
  { id: 'access', label: 'Access' },
  { id: 'role', label: 'Roles' },
  { id: 'policy', label: 'Policies' },
  { id: 'commented', label: 'Comments' },
]

export default function Governance() {
  const { skills, members, policies, audit, me, member, skill, dispatch, toast } = useStore()
  const allowed = useCan()
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') ?? 'violations') as Tab
  const setTab = (t: Tab) => setParams(t === 'violations' ? {} : { tab: t }, { replace: true })
  const [filter, setFilter] = useState<'all' | AuditAction>('all')
  const [q, setQ] = useState('')

  const violations = useMemo(() => evaluate(skills, members, policies), [skills, members, policies])
  const live = skills.filter((s) => s.stage !== 'deprecated')
  const flagged = new Set(violations.map((v) => v.skillId))
  const health = live.length ? (live.length - flagged.size) / live.length : 1
  const bySev = (s: Violation['severity']) => violations.filter((v) => v.severity === s).length
  const maintainers = members.filter((m) => m.role === 'Admin' || m.role === 'Maintainer')

  const fix = (v: Violation) => {
    const s = skill(v.skillId)!
    switch (v.policyId) {
      case 'p-owner':
        return (
          <select className="select" style={{ height: 28, width: 170, fontSize: 12.5 }} value="" aria-label="Reassign owner"
            disabled={!allowed('skill.publish')}
            onChange={(e) => { dispatch({ type: 'setOwner', id: s.id, ownerId: e.target.value }); toast(`Owner reassigned — “${s.title}” is compliant`) }}>
            <option value="" disabled>{allowed('skill.publish') ? 'Reassign owner…' : `Needs ${minimumRole('skill.publish')}`}</option>
            {maintainers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )
      case 'p-evals':
        return <GuardedButton className="btn sm" allowed={allowed('skill.edit', s)} reason="Needs ownership or Maintainer role" onClick={() => { dispatch({ type: 'attachEvals', id: s.id }); toast(`Eval suite attached to “${s.title}”`) }}>Attach evals</GuardedButton>
      case 'p-two-approvals': {
        const ok = can(me, 'skill.approve', s) && !s.approvals.includes(me.id)
        return <GuardedButton className="btn sm" allowed={ok} reason={s.approvals.includes(me.id) ? 'You already approved' : s.ownerId === me.id ? 'You own this skill' : `Needs ${minimumRole('skill.approve')} role`} onClick={() => { dispatch({ type: 'approve', id: s.id }); toast(`Second approval added to “${s.title}”`) }}>Add approval</GuardedButton>
      }
      case 'p-description':
        return <GuardedButton className="btn sm" allowed={allowed('skill.edit', s)} reason="Needs ownership or Maintainer role" onClick={() => nav(`/skills/${s.id}/edit`)}>Edit description</GuardedButton>
      default:
        return <Link className="btn sm" to={`/skills/${s.id}`}>Open</Link>
    }
  }

  const log = audit.filter((a) => (filter === 'all' || a.action === filter) &&
    (!q || `${a.detail} ${member(a.actorId)?.name} ${a.skillId ? skill(a.skillId)?.title : ''}`.toLowerCase().includes(q.toLowerCase())))
  const days = log.reduce<Record<string, typeof log>>((acc, a) => { const d = a.at.slice(0, 10); (acc[d] ??= []).push(a); return acc }, {})

  return (
    <main className="page">
      <div className="page-head">
        <div>
          <h1>Rules</h1>
          <p>Policies run continuously against every skill. Turn one on and the whole catalog is re-checked instantly.</p>
        </div>
      </div>

      <Lens info={LENS.governance} />

      <div className="grid g-kpi" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)', marginBottom: 20 }}>
        <section className="card hero">
          <div className="stat-label">Catalog health</div>
          <div className="hero-value num">{Math.round(health * 100)}<small>%</small></div>
          <div className="muted" style={{ fontSize: 12.5 }}>{live.length - flagged.size} of {live.length} active skills pass every enabled policy</div>
        </section>
        <section className="card card-body">
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <h2>{violations.length} open issue{violations.length === 1 ? '' : 's'}</h2>
            <span className="muted" style={{ fontSize: 12.5 }}>{policies.filter((p) => p.enabled).length} of {policies.length} policies on</span>
          </div>
          {violations.length ? (
            <SegMeter parts={[
              { id: 'c', label: 'Critical', value: bySev('critical'), color: 'var(--critical)' },
              { id: 's', label: 'Serious', value: bySev('serious'), color: 'var(--serious)' },
              { id: 'w', label: 'Warning', value: bySev('warning'), color: 'var(--warning)' },
            ]} />
          ) : <p className="row secondary" style={{ gap: 6 }}><CircleCheck size={16} color="var(--good)" /> Everything is compliant.</p>}
        </section>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'violations'} onClick={() => setTab('violations')}>Issues<span className="count">{violations.length}</span></button>
        <button role="tab" aria-selected={tab === 'policies'} onClick={() => setTab('policies')}>Policies<span className="count">{policies.length}</span></button>
        <button role="tab" aria-selected={tab === 'audit'} onClick={() => setTab('audit')}>Audit log<span className="count">{audit.length}</span></button>
      </div>

      {tab === 'violations' && (
        violations.length === 0 ? (
          <div className="card"><Empty title="No open issues"><ShieldCheck size={22} color="var(--good)" /></Empty></div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Severity</th><th>Skill</th><th>Issue</th><th>Policy</th><th className="r">Fix</th></tr></thead>
              <tbody>
                {[...violations].sort((a, b) => ['critical', 'serious', 'warning'].indexOf(a.severity) - ['critical', 'serious', 'warning'].indexOf(b.severity)).map((v) => {
                  const s = skill(v.skillId)!
                  return (
                    <tr key={v.policyId + v.skillId}>
                      <td><Severity level={v.severity} /></td>
                      <td><Link to={`/skills/${s.id}`} style={{ fontWeight: 550 }}>{s.title}</Link><div className="row muted" style={{ gap: 6, fontSize: 12 }}><Avatar member={member(s.ownerId)} />{member(s.ownerId)?.name}</div></td>
                      <td className="secondary">{v.message}</td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{policies.find((p) => p.id === v.policyId)?.name}</td>
                      <td className="r">{fix(v)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'policies' && (
        <div className="grid g-2">
          {policies.map((p) => {
            const n = violations.filter((v) => v.policyId === p.id).length
            return (
              <section key={p.id} className="card card-body" style={{ opacity: p.enabled ? 1 : 0.75 }}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div>
                    <div className="row" style={{ gap: 10, marginBottom: 4 }}><h3>{p.name}</h3></div>
                    <p className="secondary" style={{ fontSize: 13 }}>{p.description}</p>
                  </div>
                  <Switch checked={p.enabled} label={p.name} disabledReason={allowed('policies.manage') ? undefined : `Needs ${minimumRole('policies.manage')} role`}
                    onChange={() => { dispatch({ type: 'togglePolicy', id: p.id }); toast(`${p.enabled ? 'Disabled' : 'Enabled'} “${p.name}”`) }} />
                </div>
                <div className="row" style={{ justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
                  <Severity level={p.severity} />
                  <span className="muted" style={{ fontSize: 12.5 }}>{!p.enabled ? 'Off' : n ? `${n} skill${n > 1 ? 's' : ''} failing` : 'All passing'}</span>
                </div>
              </section>
            )
          })}
        </div>
      )}

      {tab === 'audit' && (
        <>
          <div className="toolbar">
            <div className="input-wrap">
              <Search size={15} />
              <input className="input" placeholder="Search the log" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search audit log" />
            </div>
            <div className="row wrap">
              {ACTION_FILTERS.map((f) => <button key={f.id} className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</button>)}
            </div>
          </div>
          <div className="card card-body">
            {log.length === 0 && <Empty title="Nothing in the log matches" />}
            {Object.entries(days).map(([d, rows]) => (
              <div key={d} style={{ marginBottom: 8 }}>
                <div className="muted" style={{ fontSize: 12, fontWeight: 600, padding: '6px 0' }}>{dateLabel(d)}</div>
                <div className="feed">
                  {rows.map((a) => (
                    <div key={a.id} className="feed-item">
                      <Avatar member={member(a.actorId)} />
                      <div className="what"><ActivityText event={a} /></div>
                      <div className="when num">{new Date(a.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
