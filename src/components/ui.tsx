import { useEffect, useRef, type ReactNode } from 'react'
import {
  Archive, BadgeCheck, Code2, Compass, FileText, FlaskConical, Headphones,
  Palette, Settings2, TriangleAlert, OctagonAlert, AlertCircle, CircleAlert, X,
} from 'lucide-react'
import type { Category, Member, Status } from '../data/types'
import { initials, type Severity as Sev } from '../lib/logic'
import { useStore } from '../store/store'

const AVATAR_TONES = ['#6a5d50', '#4f6170', '#5d6b4f', '#70506a', '#4f6b66', '#625178', '#7a5b45', '#4a5a7a']

export function Avatar({ member, size }: { member?: Member; size?: 'lg' }) {
  if (!member) return <span className={`avatar ${size ?? ''}`} style={{ background: '#999' }}>?</span>
  const n = Number(member.id.replace(/\D/g, '')) || 0
  return (
    <span className={`avatar ${size ?? ''}`} style={{ background: AVATAR_TONES[n % AVATAR_TONES.length] }} title={member.name} aria-hidden>
      {initials(member.name)}
    </span>
  )
}

export function AvatarStack({ ids, max = 3 }: { ids: string[]; max?: number }) {
  const { member } = useStore()
  return (
    <span className="avatar-stack">
      {ids.slice(0, max).map((id) => <Avatar key={id} member={member(id)} />)}
      {ids.length > max && <span className="avatar" style={{ background: 'var(--surface-3)', color: 'var(--ink-2)' }}>+{ids.length - max}</span>}
    </span>
  )
}

const STATUS_ICON: Record<Status, ReactNode> = {
  active: <BadgeCheck size={14} color="var(--good)" />,
  experimental: <FlaskConical size={14} color="var(--warning)" />,
  deprecated: <Archive size={14} color="var(--ink-3)" />,
}
export const STATUS_LABEL: Record<Status, string> = { active: 'Active', experimental: 'Experimental', deprecated: 'Retired' }

export function StatusBadge({ status }: { status: Status }) {
  return <span className="stage">{STATUS_ICON[status]}{STATUS_LABEL[status]}</span>
}
export const statusIcon = (s: Status) => STATUS_ICON[s]

const SEV_CLASS: Record<Sev, string> = { high: 'critical', medium: 'serious', low: 'warning' }
export function SeverityTag({ level }: { level: Sev }) {
  const Icon = level === 'high' ? OctagonAlert : level === 'medium' ? AlertCircle : TriangleAlert
  return <span className={`sev ${SEV_CLASS[level]}`}><Icon size={13} strokeWidth={2.4} />{level[0].toUpperCase() + level.slice(1)}</span>
}

export function TeamDots({ ids }: { ids: string[] }) {
  const { team } = useStore()
  return (
    <span className="team-dots" aria-label={ids.map((i) => team(i)?.name).join(', ')}>
      {ids.map((id) => {
        const t = team(id)
        return t ? <i key={id} style={{ background: `var(--s${t.slot})` }} title={t.name} /> : null
      })}
    </span>
  )
}

export function TeamTag({ id }: { id: string }) {
  const { team } = useStore()
  const t = team(id)
  if (!t) return null
  return (
    <span className="badge outline">
      <i style={{ width: 8, height: 8, borderRadius: 2, background: `var(--s${t.slot})`, display: 'inline-block' }} />
      {t.name}
    </span>
  )
}

const CAT_ICON: Record<Category, typeof Code2> = {
  Engineering: Code2,
  Design: Palette,
  Product: Compass,
  Support: Headphones,
  Operations: Settings2,
  Writing: FileText,
}
export const CATEGORIES = Object.keys(CAT_ICON) as Category[]

export function CategoryIcon({ category, size = 16 }: { category: Category; size?: number }) {
  const I = CAT_ICON[category]
  return <span className="cat-icon"><I size={size} /></span>
}

export function Switch({ checked, onChange, label, disabledReason }: { checked: boolean; onChange: () => void; label: string; disabledReason?: string }) {
  const btn = (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      aria-disabled={!!disabledReason}
      onClick={() => !disabledReason && onChange()}
    />
  )
  return disabledReason ? <span className="tip" data-tip={disabledReason}>{btn}</span> : btn
}

export function Modal({ title, description, onClose, children, footer }: {
  title: string; description?: string; onClose: () => void; children?: ReactNode; footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    ref.current?.querySelector<HTMLElement>('input, textarea, select, button')?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus() }
  }, [onClose])
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2 style={{ fontSize: 16 }}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {children && <div className="modal-body">{children}</div>}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{children}</div>
}

export function Toasts() {
  const { toasts, dismissToast } = useStore()
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          {t.tone === 'error' && <CircleAlert size={15} />}
          {t.text}
          <button onClick={() => dismissToast(t.id)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      ))}
    </div>
  )
}
