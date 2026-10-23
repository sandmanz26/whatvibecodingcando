import type { Member, Policy, Role, Skill, Stage } from '../data/types'
import { DEMO_NOW } from '../data/seed'

/* ---------- permissions ---------- */

export type Permission =
  | 'skill.create'
  | 'skill.edit'
  | 'skill.submit'
  | 'skill.approve'
  | 'skill.publish'
  | 'skill.deprecate'
  | 'skill.comment'
  | 'access.manage'
  | 'members.manage'
  | 'policies.manage'

const MATRIX: Record<Role, Permission[]> = {
  Admin: ['skill.create', 'skill.edit', 'skill.submit', 'skill.approve', 'skill.publish', 'skill.deprecate', 'skill.comment', 'access.manage', 'members.manage', 'policies.manage'],
  Maintainer: ['skill.create', 'skill.edit', 'skill.submit', 'skill.approve', 'skill.publish', 'skill.deprecate', 'skill.comment', 'access.manage'],
  Member: ['skill.create', 'skill.edit', 'skill.submit', 'skill.comment'],
  Viewer: [],
}

export const PERMISSION_LABELS: Record<Permission, string> = {
  'skill.create': 'Create drafts',
  'skill.edit': 'Edit skills',
  'skill.submit': 'Submit for review',
  'skill.approve': 'Approve reviews',
  'skill.publish': 'Publish to team',
  'skill.deprecate': 'Deprecate',
  'skill.comment': 'Comment',
  'access.manage': 'Manage team access',
  'members.manage': 'Manage members & roles',
  'policies.manage': 'Manage policies',
}

export const ROLES: Role[] = ['Admin', 'Maintainer', 'Member', 'Viewer']
export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as Permission[]

export function can(user: Member | undefined, p: Permission, skill?: Skill): boolean {
  if (!user) return false
  if (!MATRIX[user.role].includes(p)) return false
  // Members can only edit and submit their own skills.
  if (skill && user.role === 'Member' && (p === 'skill.edit' || p === 'skill.submit')) return skill.ownerId === user.id
  // Nobody approves their own work.
  if (skill && p === 'skill.approve') return skill.ownerId !== user.id
  return true
}

export function minimumRole(p: Permission): Role {
  return ([...ROLES].reverse().find((r) => MATRIX[r].includes(p)) ?? 'Admin') as Role
}

/* ---------- stages ---------- */

export const STAGES: { id: Stage; label: string; hint: string }[] = [
  { id: 'draft', label: 'Draft', hint: 'Being written' },
  { id: 'review', label: 'In review', hint: 'Waiting on reviewers' },
  { id: 'approved', label: 'Approved', hint: 'Ready to publish' },
  { id: 'published', label: 'Published', hint: 'Live for teams' },
  { id: 'deprecated', label: 'Deprecated', hint: 'Retired' },
]

export const stageLabel = (s: Stage) => STAGES.find((x) => x.id === s)!.label

export const isRisky = (s: Skill) => s.tools.some((t) => /^(Bash|Write|Edit)/.test(t))
export const requiredApprovals = (s: Skill, policies: Policy[]) =>
  policies.find((p) => p.id === 'p-two-approvals')?.enabled && isRisky(s) ? 2 : 1

/* ---------- policies ---------- */

export interface Violation {
  policyId: string
  skillId: string
  message: string
  severity: Policy['severity']
}

export function evaluate(skills: Skill[], members: Member[], policies: Policy[]): Violation[] {
  const out: Violation[] = []
  const on = (id: string) => policies.find((p) => p.id === id)
  const push = (pid: string, s: Skill, message: string) => {
    const p = on(pid)
    if (p?.enabled) out.push({ policyId: pid, skillId: s.id, message, severity: p.severity })
  }
  for (const s of skills) {
    if (s.stage === 'deprecated') continue
    const owner = members.find((m) => m.id === s.ownerId)
    if (s.stage === 'published') {
      if (!owner) push('p-owner', s, 'Owner no longer on the team')
      else if (owner.role === 'Viewer') push('p-owner', s, `Owner ${owner.name} is a Viewer and can’t maintain it`)
      if (!s.hasEvals) push('p-evals', s, 'Published without an eval suite')
      if (isRisky(s) && s.approvals.length < 2) push('p-two-approvals', s, `Runs ${s.tools.filter((t) => /^(Bash|Write|Edit)/.test(t)).join(', ')} with ${s.approvals.length} approval`)
      if (sum(s.usage.slice(-4)) === 0) push('p-stale', s, 'No runs in the last 4 weeks')
      if (s.source && !s.source.vetted) push('p-external', s, `Imported from ${s.source.repo} without a security review`)
      if (s.teamIds.length >= 3) {
        const totals = s.teamIds.map((t) => sum(s.usageByTeam[t] ?? []))
        const all = sum(totals)
        if (all > 0 && Math.max(...totals) / all > 0.85) push('p-access', s, `Shared with ${s.teamIds.length} teams, but one team makes ${Math.round((Math.max(...totals) / all) * 100)}% of runs`)
      }
    }
    if (s.description.length < 60) push('p-description', s, `Description is ${s.description.length} characters — too short to trigger reliably`)
  }
  return out
}

/** Reasons a skill can't move to `to` right now. Empty array = allowed. */
export function blockers(skill: Skill, to: Stage, user: Member | undefined, policies: Policy[]): string[] {
  const r: string[] = []
  const need = (p: Permission) => {
    if (!can(user, p, skill)) r.push(`Needs ${minimumRole(p)} role${user?.role === 'Member' && p !== 'skill.approve' ? ' or ownership' : ''}`)
  }
  if (to === skill.stage) return r
  if (to === 'review') need('skill.submit')
  if (to === 'draft') need('skill.edit')
  if (to === 'approved') {
    need('skill.publish')
    const req = requiredApprovals(skill, policies)
    if (skill.approvals.length < req) r.push(`Needs ${req} approval${req > 1 ? 's' : ''} (has ${skill.approvals.length})`)
  }
  if (to === 'published') {
    need('skill.publish')
    const req = requiredApprovals(skill, policies)
    if (skill.approvals.length < req) r.push(`Needs ${req} approval${req > 1 ? 's' : ''} (has ${skill.approvals.length})`)
    if (policies.find((p) => p.id === 'p-evals')?.enabled && !skill.hasEvals) r.push('Attach an eval suite first')
    if (policies.find((p) => p.id === 'p-external')?.enabled && skill.source && !skill.source.vetted) r.push('External code needs a security review first')
  }
  if (to === 'deprecated') need('skill.deprecate')
  return [...new Set(r)]
}

/* ---------- quality score (editor lint) ---------- */

export interface Check {
  id: string
  label: string
  ok: boolean
  hint: string
}

export function qualityChecks(s: Pick<Skill, 'title' | 'description' | 'triggers' | 'instructions' | 'examples' | 'hasEvals' | 'tools'>): Check[] {
  return [
    { id: 'title', label: 'Has a clear name', ok: s.title.trim().length >= 4, hint: 'Short, verb-or-noun phrase, e.g. “Release notes”.' },
    { id: 'desc', label: 'Description says when to use it', ok: s.description.length >= 60 && /\buse (when|for|before|after|on)\b/i.test(s.description), hint: 'Claude picks skills by description. Include “Use when …”.' },
    { id: 'triggers', label: 'At least 2 trigger phrases', ok: s.triggers.filter(Boolean).length >= 2, hint: 'How people actually ask for this.' },
    { id: 'instr', label: 'Instructions are specific', ok: s.instructions.trim().length >= 80, hint: 'Rules, order of steps, what “good” looks like.' },
    { id: 'examples', label: 'Includes an example request', ok: s.examples.filter(Boolean).length >= 1, hint: 'Helps reviewers test it.' },
    { id: 'evals', label: 'Eval suite attached', ok: s.hasEvals, hint: 'Required by policy before publishing.' },
    { id: 'tools', label: 'Tools are scoped', ok: !s.tools.some((t) => t === 'Bash' || t === 'Write'), hint: 'Prefer Bash(git diff:*) over unrestricted Bash.' },
  ]
}

/* ---------- trigger simulator ---------- */

const STOP = new Set('a an the to for of on in my this that is it and or with me can you please i we our be how what do'.split(' '))
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w))

export function matchSkills(prompt: string, skills: Skill[]) {
  const q = tokens(prompt)
  if (!q.length) return []
  return skills
    .filter((s) => s.stage === 'published' || s.stage === 'approved')
    .map((s) => {
      const trig = s.triggers.join(' ').toLowerCase()
      const phrase = s.triggers.some((t) => prompt.toLowerCase().includes(t.toLowerCase()))
      const hay = new Set(tokens(`${s.title} ${s.description} ${trig}`))
      const hits = q.filter((w) => hay.has(w) || [...hay].some((h) => h.length > 4 && (h.startsWith(w) || w.startsWith(h))))
      const score = Math.min(1, (phrase ? 0.55 : 0) + (hits.length / q.length) * 0.6)
      return { skill: s, score, hits: [...new Set(hits)] }
    })
    .filter((r) => r.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
}

/* ---------- metrics ---------- */

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

export function teamWeekly(skills: Skill[], teamId: string): number[] {
  const out = Array(12).fill(0)
  for (const s of skills) (s.usageByTeam[teamId] ?? []).forEach((v, i) => (out[i] += v))
  return out
}

export function hoursSaved(skills: Skill[], weeks = 4) {
  return sum(skills.map((s) => sum(s.usage.slice(-weeks)) * s.minutesSaved)) / 60
}

/* ---------- formatting ---------- */

export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (Math.abs(n) >= 10_000) return `${Math.round(n / 1000)}K`
  if (Math.abs(n) >= 1_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K`
  return `${Math.round(n)}`
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US')

export function ago(iso: string): string {
  const d = new Date(iso)
  const mins = Math.round((DEMO_NOW.getTime() - d.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const h = Math.round(mins / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== DEMO_NOW.getFullYear() ? 'numeric' : undefined })
}

export const dateLabel = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function bumpVersion(v: string, kind: 'patch' | 'minor' | 'major' = 'minor') {
  const [a, b, c] = v.split('.').map(Number)
  if (kind === 'major') return `${a + 1}.0.0`
  if (kind === 'minor') return `${a}.${b + 1}.0`
  return `${a}.${b}.${c + 1}`
}

export function toSkillMd(s: Pick<Skill, 'name' | 'description' | 'tools' | 'title' | 'instructions' | 'triggers' | 'examples'>) {
  const lines = ['---', `name: ${s.name || 'untitled-skill'}`, `description: ${s.description || '…'}`]
  if (s.tools.length) lines.push(`allowed-tools: ${s.tools.join(', ')}`)
  lines.push('---', '', `# ${s.title || 'Untitled skill'}`, '')
  if (s.triggers.filter(Boolean).length) {
    lines.push('## When to use', '')
    s.triggers.filter(Boolean).forEach((t) => lines.push(`- "${t}"`))
    lines.push('')
  }
  lines.push('## Instructions', '', s.instructions || '…', '')
  if (s.examples.filter(Boolean).length) {
    lines.push('## Examples', '')
    s.examples.filter(Boolean).forEach((e) => lines.push(`- ${e}`))
  }
  return lines.join('\n')
}

export const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
