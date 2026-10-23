import type { Member } from '../data/types'
import { initials } from '../lib/logic'

/** The product's mark: three skills standing on a shelf, one leaning — drawn from its own object. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      <rect x="5" y="7" width="4" height="15" rx="1" fill="#1f201d" />
      <rect x="10.5" y="4" width="4" height="18" rx="1" fill="#1b6e66" />
      <rect x="16" y="9" width="4" height="13" rx="1" fill="#1f201d" transform="rotate(-12 18 22)" />
      <rect x="3" y="22" width="22" height="2.5" rx="1.25" fill="#8c8c88" />
    </svg>
  )
}

/** Each person's stable hue, as a pale tint: identity, not data. Golden-angle steps keep neighbours far apart. */
export function personTint(m?: Member) {
  const n = m ? Number(m.id.replace(/\D/g, '')) || 0 : 0
  const hue = Math.round((n * 137.5 + 20) % 360)
  return `hsl(${hue} 52% 87%)`
}

export function Face({ member, size }: { member?: Member; size?: 'sm' | 'lg' }) {
  return (
    <span className={`v2-face ${size ?? ''}`} style={{ background: personTint(member) }} title={member?.name} aria-hidden>
      {member ? initials(member.name) : '?'}
    </span>
  )
}

export const firstName = (m?: Member) => m?.name.split(' ')[0] ?? 'Someone'

/** "Thursday 22 October" — the demo clock is fixed. */
export const longDate = (d: Date) => d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
