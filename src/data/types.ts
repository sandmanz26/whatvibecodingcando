export type Role = 'Admin' | 'Maintainer' | 'Member' | 'Viewer'

export type Stage = 'draft' | 'review' | 'approved' | 'published' | 'deprecated'

export type Category = 'Engineering' | 'Design' | 'Product' | 'Support' | 'Operations' | 'Writing'

export interface Team {
  id: string
  name: string
  /** categorical slot 1–4, fixed per team so color follows the entity */
  slot: 1 | 2 | 3 | 4
}

export interface Member {
  id: string
  name: string
  title: string
  role: Role
  teamId: string
  email: string
  joinedAt: string
}

export interface Comment {
  id: string
  authorId: string
  text: string
  at: string
}

export interface Version {
  version: string
  at: string
  authorId: string
  note: string
}

export interface Skill {
  id: string
  /** kebab-case slug, the `name` in SKILL.md frontmatter */
  name: string
  title: string
  description: string
  category: Category
  ownerId: string
  teamIds: string[]
  stage: Stage
  version: string
  createdAt: string
  updatedAt: string
  triggers: string[]
  instructions: string
  examples: string[]
  tools: string[]
  /** weekly invocations for the last 12 weeks, oldest first */
  usage: number[]
  /** usage split per team for the last 12 weeks */
  usageByTeam: Record<string, number[]>
  rating: number
  /** minutes saved per run, self-reported by owner */
  minutesSaved: number
  reviewerIds: string[]
  approvals: string[]
  comments: Comment[]
  versions: Version[]
  hasEvals: boolean
}

export type AuditAction =
  | 'created'
  | 'updated'
  | 'submitted'
  | 'approved'
  | 'published'
  | 'deprecated'
  | 'commented'
  | 'access'
  | 'role'
  | 'policy'
  | 'restored'

export interface AuditEvent {
  id: string
  at: string
  actorId: string
  action: AuditAction
  skillId?: string
  detail: string
}

export interface Policy {
  id: string
  name: string
  description: string
  enabled: boolean
  severity: 'warning' | 'serious' | 'critical'
}
