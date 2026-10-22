import { Link } from 'react-router-dom'
import type { AuditEvent } from '../data/types'
import { useStore } from '../store/store'

const VERB: Record<AuditEvent['action'], string> = {
  created: 'created',
  updated: 'updated',
  submitted: 'submitted',
  approved: 'approved',
  published: 'published',
  deprecated: 'deprecated',
  commented: 'commented on',
  access: 'changed access for',
  role: 'changed a role',
  policy: 'changed a policy',
  restored: 'moved back',

}

export function ActivityText({ event }: { event: AuditEvent }) {
  const { member, skill } = useStore()
  const actor = member(event.actorId)
  const s = event.skillId ? skill(event.skillId) : undefined
  return (
    <>
      <b>{actor?.name ?? 'Someone'}</b> {VERB[event.action]}{' '}
      {s && <Link to={`/skills/${s.id}`} style={{ color: 'var(--ink)', fontWeight: 550 }}>{s.title}</Link>}
      <div className="muted" style={{ fontSize: 12.5 }}>{event.detail}</div>
    </>
  )
}
