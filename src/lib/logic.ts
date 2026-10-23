import type { Install, Member, Project, Skill, Team } from '../data/types'
import { DEMO_NOW } from '../data/seed'

/* ---------- numbers ---------- */

export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)
/** runs in the last four weeks */
export const recent = (runs: number[]) => sum(runs.slice(-4))

export function addSeries(list: number[][], weeks = 12): number[] {
  const out = Array(weeks).fill(0)
  list.forEach((r) => r.forEach((v, i) => (out[i] += v)))
  return out
}

export function cmpVersion(a: string, b: string) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0)
  return 0
}

/* ---------- the inventory, indexed ---------- */

export interface Inventory {
  skills: Skill[]
  installs: Install[]
  projects: Project[]
  teams: Team[]
  members: Member[]
}

export const projectOf = (inv: Inventory, id: string) => inv.projects.find((p) => p.id === id)
export const installsOf = (inv: Inventory, skillId: string) => inv.installs.filter((i) => i.skillId === skillId)
export const installsIn = (inv: Inventory, projectId: string) => inv.installs.filter((i) => i.projectId === projectId)
export const teamOfInstall = (inv: Inventory, i: Install) => projectOf(inv, i.projectId)?.teamId ?? ''

export const skillWeekly = (inv: Inventory, skillId: string) => addSeries(installsOf(inv, skillId).map((i) => i.runs))

/** Weekly runs of one skill, split by the team whose project ran it. */
export function skillByTeam(inv: Inventory, skillId: string): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const i of installsOf(inv, skillId)) {
    const t = teamOfInstall(inv, i)
    out[t] = addSeries([out[t] ?? Array(12).fill(0), i.runs])
  }
  return out
}

/** Teams that have the skill installed in at least one of their projects. */
export const teamsUsing = (inv: Inventory, skillId: string) =>
  inv.teams.map((t) => t.id).filter((t) => installsOf(inv, skillId).some((i) => teamOfInstall(inv, i) === t))

/** Shared: installed in more than one team's projects. */
export const isShared = (inv: Inventory, skillId: string) => teamsUsing(inv, skillId).length > 1

export const teamWeekly = (inv: Inventory, teamId: string) =>
  addSeries(inv.installs.filter((i) => teamOfInstall(inv, i) === teamId).map((i) => i.runs))

/** Runs per person per week over the last four weeks. */
export const intensity = (inv: Inventory, team: Team) => recent(teamWeekly(inv, team.id)) / 4 / Math.max(1, team.size)

/** Skills a team runs, with last-four-week runs, busiest first. */
export function teamSkills(inv: Inventory, teamId: string) {
  return inv.skills
    .map((s) => ({ skill: s, runs: recent(skillByTeam(inv, s.id)[teamId] ?? []) , installed: installsOf(inv, s.id).some((i) => teamOfInstall(inv, i) === teamId) }))
    .filter((x) => x.installed)
    .sort((a, b) => b.runs - a.runs)
}

/* ---------- overlap: skills that say they do the same job ---------- */

const STOP = new Set('a an the to for of on in my this that is it and or with me can you please i we our be how what do use when from into by any as at its their them then are has have each every one two who'.split(' '))
const stem = (w: string) => (w.length > 5 ? w.slice(0, 5) : w)
const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map(stem))

/** 0–1: how much two skills' descriptions and trigger phrases share. */
export function similarity(a: Skill, b: Skill) {
  const A = words(`${a.description} ${a.triggers.join(' ')}`), B = words(`${b.description} ${b.triggers.join(' ')}`)
  const both = [...A].filter((w) => B.has(w)).length
  return both / (A.size + B.size - both || 1)
}

export const OVERLAP_AT = 0.3

export function overlaps(inv: Inventory) {
  const live = inv.skills.filter((s) => s.status !== 'deprecated')
  const out: { a: Skill; b: Skill; score: number }[] = []
  live.forEach((a, i) => live.slice(i + 1).forEach((b) => {
    const score = similarity(a, b)
    if (score >= OVERLAP_AT) out.push({ a, b, score })
  }))
  return out.sort((x, y) => y.score - x.score)
}

export function similarTo(inv: Inventory, s: Skill) {
  return inv.skills.filter((o) => o.id !== s.id).map((o) => ({ skill: o, score: similarity(s, o) }))
    .filter((x) => x.score >= OVERLAP_AT).sort((a, b) => b.score - a.score)
}

/* ---------- health: what makes the skill landscape messy ---------- */

export type IssueKind = 'duplicate' | 'copy' | 'owner' | 'deprecated' | 'drift' | 'external' | 'unused'
export type Severity = 'high' | 'medium' | 'low'

export const KIND_LABEL: Record<IssueKind, string> = {
  duplicate: 'Duplicate',
  copy: 'Edited copy',
  owner: 'No owner',
  deprecated: 'Retired, still installed',
  drift: 'Version drift',
  external: 'From outside',
  unused: 'Unused install',
}

export interface Issue {
  id: string
  kind: IssueKind
  severity: Severity
  skillId: string
  otherId?: string
  projectIds: string[]
  title: string
  detail: string
  action: string
}

const list = (xs: string[]) => xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

export function findIssues(inv: Inventory): Issue[] {
  const out: Issue[] = []
  const team = (id: string) => inv.teams.find((t) => t.id === id)?.name ?? id
  const pname = (id: string) => projectOf(inv, id)?.name ?? id
  const title = (id: string) => inv.skills.find((s) => s.id === id)?.title ?? id

  for (const { a, b, score } of overlaps(inv)) {
    const pa = installsOf(inv, a.id), pb = installsOf(inv, b.id)
    const [keep, drop] = recent(addSeries(pa.map((i) => i.runs))) >= recent(addSeries(pb.map((i) => i.runs))) ? [a, b] : [b, a]
    out.push({
      id: `dup:${a.id}:${b.id}`, kind: 'duplicate', severity: 'high', skillId: a.id, otherId: b.id,
      projectIds: [...new Set([...pa, ...pb].map((i) => i.projectId))],
      title: `${a.title} and ${b.title} do the same job`,
      detail: `${a.teamId === b.teamId ? `Two ${team(a.teamId)} skills` : `${team(a.teamId)}’s and ${team(b.teamId)}’s skills`} share ${Math.round(score * 100)}% of what they say they do. Claude may pick either, and fixes land in one but not the other.`,
      action: `Keep ${keep.title} as the shared one, move what’s missing from ${drop.title} into it, then remove ${drop.title}.`,
    })
  }

  for (const s of inv.skills) {
    const ins = installsOf(inv, s.id)
    const owner = inv.members.find((m) => m.id === s.ownerId)

    for (const i of ins.filter((i) => i.edited)) {
      const t = teamOfInstall(inv, i)
      out.push({
        id: `copy:${s.id}:${i.projectId}`, kind: 'copy', severity: 'medium', skillId: s.id, projectIds: [i.projectId],
        title: `${pname(i.projectId)} runs an edited copy of ${s.title}`,
        detail: `${team(t)} changed their copy (from v${i.version}), so it no longer gets ${team(s.teamId)}’s updates. ${team(t)} clearly needs this skill too.`,
        action: `Fold their changes into ${s.title}, share it with ${team(t)}, and replace the copy.`,
      })
    }

    if (s.status === 'deprecated') {
      if (ins.length) out.push({
        id: `dep:${s.id}`, kind: 'deprecated', severity: 'medium', skillId: s.id, projectIds: ins.map((i) => i.projectId),
        title: `${s.title} is retired but still installed in ${ins.length} project${ins.length > 1 ? 's' : ''}`,
        detail: `${list(ins.map((i) => pname(i.projectId)))} still ${ins.length > 1 ? 'have' : 'has'} it.`,
        action: s.replacedBy ? `Replace it with ${title(s.replacedBy)} and remove the old copy.` : 'Remove it from these projects.',
      })
      continue
    }

    if (!owner?.active) {
      const ts = teamsUsing(inv, s.id)
      out.push({
        id: `own:${s.id}`, kind: 'owner', severity: 'high', skillId: s.id, projectIds: ins.map((i) => i.projectId),
        title: `${s.title} has no active owner`,
        detail: `${owner ? `${owner.name} left the company.` : 'Nobody owns it.'} ${ins.length} project${ins.length === 1 ? '' : 's'} in ${ts.length} team${ts.length === 1 ? '' : 's'} depend on it, and nobody answers when it misbehaves.`,
        action: `Assign an owner in ${team(s.teamId)}.`,
      })
    }

    const behind = ins.filter((i) => !i.edited && cmpVersion(i.version, s.version) < 0)
    if (behind.length) {
      const versions = new Set(ins.filter((i) => !i.edited).map((i) => i.version))
      const major = behind.some((i) => i.version.split('.')[0] !== s.version.split('.')[0] || Number(i.version.split('.')[1]) < Number(s.version.split('.')[1]) - 1)
      out.push({
        id: `drift:${s.id}`, kind: 'drift', severity: major ? 'medium' : 'low', skillId: s.id, projectIds: behind.map((i) => i.projectId),
        title: `${s.title} runs on ${versions.size} versions`,
        detail: `${list(behind.map((i) => `${pname(i.projectId)} is on v${i.version}`))}; the latest is v${s.version}. Teams get different answers from the same skill.`,
        action: `Update ${list(behind.map((i) => pname(i.projectId)))} to v${s.version}.`,
      })
    }

    if (s.source && !s.source.vetted) out.push({
      id: `ext:${s.id}`, kind: 'external', severity: 'high', skillId: s.id, projectIds: ins.map((i) => i.projectId),
      title: `${s.title} came from outside and hasn’t had a security review`,
      detail: `It comes from ${s.source.repo} and runs ${s.tools.filter((t) => /^(Bash|Write)/.test(t)).join(', ') || 'tools'} on people’s machines.`,
      action: 'Review its scripts before more projects install it.',
    })
    else if (s.source?.upstream && cmpVersion(s.source.upstream, s.version) > 0) out.push({
      id: `up:${s.id}`, kind: 'external', severity: 'low', skillId: s.id, projectIds: ins.map((i) => i.projectId),
      title: `${s.title} v${s.source.upstream} is out upstream`,
      detail: `We run v${s.version} from ${s.source.repo}.`,
      action: 'Read the upstream changes, then decide whether to update.',
    })

    for (const i of ins.filter((i) => recent(i.runs) === 0)) out.push({
      id: `unused:${s.id}:${i.projectId}`, kind: 'unused', severity: 'low', skillId: s.id, projectIds: [i.projectId],
      title: `${s.title} sits unused in ${pname(i.projectId)}`,
      detail: 'No runs in the last four weeks. Every installed skill competes for Claude’s attention.',
      action: `Remove it from ${pname(i.projectId)}.`,
    })
  }

  const rank: Record<Severity, number> = { high: 0, medium: 1, low: 2 }
  return out.sort((a, b) => rank[a.severity] - rank[b.severity])
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

export const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
