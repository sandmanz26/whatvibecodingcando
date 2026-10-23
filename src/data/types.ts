export type Category = 'Engineering' | 'Design' | 'Product' | 'Support' | 'Operations' | 'Writing'

/** active: maintained and recommended · experimental: being tried · deprecated: replaced, should be removed */
export type Status = 'active' | 'experimental' | 'deprecated'

export interface Team {
  id: string
  name: string
  /** categorical slot 1–4, fixed per team so color follows the entity */
  slot: 1 | 2 | 3 | 4
  /** people on the team, for per-person intensity */
  size: number
}

export interface Member {
  id: string
  name: string
  title: string
  teamId: string
  /** false once the person has left the company */
  active: boolean
}

/** A repository where skills are installed, e.g. under .claude/skills/. */
export interface Project {
  id: string
  /** repository name */
  name: string
  teamId: string
  description: string
  /** when the inventory last read this repository */
  scannedAt: string
}

export interface Version {
  version: string
  at: string
  authorId: string
  note: string
}

/** Where a skill comes from when it was not written in this company. */
export interface ExternalSource {
  /** who publishes it, e.g. "Anthropic" */
  origin: string
  /** owner/repo on GitHub */
  repo: string
  url: string
  license: string
  /** newest version upstream, when it is ahead of ours */
  upstream?: string
  /** passed the security review for external code */
  vetted: boolean
}

export interface Skill {
  id: string
  /** kebab-case slug, the `name` in SKILL.md frontmatter */
  name: string
  title: string
  description: string
  category: Category
  /** the team that maintains it */
  teamId: string
  ownerId: string
  status: Status
  /** newest released version */
  version: string
  /** where the source of truth lives */
  home: string
  updatedAt: string
  triggers: string[]
  instructions: string
  tools: string[]
  versions: Version[]
  /** for deprecated skills: what to use instead */
  replacedBy?: string
  source?: ExternalSource
}

/** One copy of a skill inside one project. */
export interface Install {
  skillId: string
  projectId: string
  version: string
  /** runs per week for the last 12 weeks, oldest first */
  runs: number[]
  /** the copy was edited inside the project, so it no longer follows the source */
  edited?: boolean
}
