import type { Category, ExternalSource, Install, Member, Project, Skill, Status, Team, Version } from './types'

/*
 * Sample data. In a real deployment the inventory comes from scanning each
 * repository's .claude/skills/ folder, and runs come from Claude Code usage
 * logs. Nothing here is measured; it is shaped to look like a 34-person company.
 */

export const TEAMS: Team[] = [
  { id: 'eng', name: 'Engineering', slot: 1, size: 14 },
  { id: 'des', name: 'Design', slot: 2, size: 5 },
  { id: 'pro', name: 'Product', slot: 3, size: 6 },
  { id: 'cs', name: 'Customer Success', slot: 4, size: 9 },
]

export const MEMBERS: Member[] = [
  { id: 'u1', name: 'Rani Wijaya', title: 'Head of Operations', teamId: 'pro', active: true },
  { id: 'u2', name: 'Dimas Pratama', title: 'Staff Engineer', teamId: 'eng', active: true },
  { id: 'u3', name: 'Sari Lestari', title: 'Design Lead', teamId: 'des', active: true },
  { id: 'u4', name: 'Bayu Santoso', title: 'Mobile Engineer', teamId: 'eng', active: true },
  { id: 'u5', name: 'Nadia Putri', title: 'Product Manager', teamId: 'pro', active: true },
  { id: 'u6', name: 'Arif Hidayat', title: 'Support Lead', teamId: 'cs', active: true },
  { id: 'u7', name: 'Maya Kusuma', title: 'Product Designer', teamId: 'des', active: true },
  { id: 'u8', name: 'Kevin Tan', title: 'Frontend Engineer', teamId: 'eng', active: true },
  { id: 'u9', name: 'Laras Anjani', title: 'Support Specialist', teamId: 'cs', active: true },
  { id: 'u10', name: 'Fajar Nugroho', title: 'Data Analyst', teamId: 'pro', active: true },
  { id: 'u11', name: 'Citra Dewi', title: 'Account Manager', teamId: 'cs', active: false },
  { id: 'u12', name: 'Reza Mahendra', title: 'Platform Engineer', teamId: 'eng', active: true },
]

/** "Today" in the sample — keeps relative dates stable whenever it is opened. */
export const DEMO_NOW = new Date('2026-10-22T09:00:00')

export const PROJECTS: Project[] = [
  { id: 'checkout', name: 'checkout-web', teamId: 'eng', description: 'Web checkout and cart', scannedAt: '2026-10-22T06:00:00' },
  { id: 'payments', name: 'payments-api', teamId: 'eng', description: 'Payment service and ledger', scannedAt: '2026-10-22T06:00:00' },
  { id: 'mobile', name: 'mobile-app', teamId: 'eng', description: 'iOS and Android app', scannedAt: '2026-10-22T06:00:00' },
  { id: 'infra', name: 'platform-infra', teamId: 'eng', description: 'Infrastructure, on-call and incidents', scannedAt: '2026-10-22T06:00:00' },
  { id: 'ds', name: 'design-system', teamId: 'des', description: 'Components, tokens and design docs', scannedAt: '2026-10-22T06:00:00' },
  { id: 'site', name: 'marketing-site', teamId: 'des', description: 'Public website', scannedAt: '2026-10-22T06:00:00' },
  { id: 'specs', name: 'product-specs', teamId: 'pro', description: 'PRDs, research notes and status updates', scannedAt: '2026-10-22T06:00:00' },
  { id: 'analytics', name: 'analytics-queries', teamId: 'pro', description: 'Saved queries and dashboards', scannedAt: '2026-10-22T06:00:00' },
  { id: 'support', name: 'support-playbooks', teamId: 'cs', description: 'Macros, policies and reply templates', scannedAt: '2026-10-22T06:00:00' },
  { id: 'csops', name: 'cs-ops', teamId: 'cs', description: 'Account health, renewals and call notes', scannedAt: '2026-10-22T06:00:00' },
]

// Deterministic pseudo-random so the sample looks the same on every load.
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

export const WEEKS = 12

function series(seed: number, base: number, growth: number, startWeek: number): number[] {
  const r = rng(seed)
  return Array.from({ length: WEEKS }, (_, i) => {
    if (i < startWeek || base === 0) return 0
    const t = i - (WEEKS - 1)
    const v = base * Math.pow(1 + growth, t) * (1 + (r() - 0.5) * 0.4)
    return Math.max(0, Math.round(v))
  })
}

/** [project, version, runs per week now, weekly growth, first week, edited copy] */
type I = [string, string, number, number?, number?, boolean?]

interface SkillSeed {
  id: string
  title: string
  category: Category
  teamId: string
  ownerId: string
  status: Status
  version: string
  home?: string
  updatedAt: string
  description: string
  triggers: string[]
  instructions: string
  tools: string[]
  installs: I[]
  history?: Version[]
  replacedBy?: string
  source?: ExternalSource
}

const REGISTRY = 'arunika/claude-skills'

const RAW: SkillSeed[] = [
  {
    id: 'code-review', title: 'Code review checklist', category: 'Engineering', teamId: 'eng', ownerId: 'u2', status: 'active', version: '2.3.0', updatedAt: '2026-10-14',
    description: 'Reviews a pull request diff against our engineering standards: naming, error handling, test coverage and migration safety. Use when someone asks for a code review.',
    triggers: ['review this PR', 'code review', 'check my diff'],
    instructions: '1. Read the diff top to bottom before commenting.\n2. Flag correctness issues first, style last.\n3. For every migration, check it is reversible and safe on a live table.\n4. End with a verdict: approve, approve with nits, or request changes.',
    tools: ['Read', 'Grep', 'Bash(git diff:*)'],
    installs: [['checkout', '2.3.0', 30, 0.02], ['payments', '2.3.0', 22, 0.02], ['mobile', '2.1.0', 14, 0.01], ['infra', '2.3.0', 10, 0.03]],
    history: [
      { version: '2.3.0', at: '2026-10-14', authorId: 'u2', note: 'Added migration safety after the September incident.' },
      { version: '2.2.1', at: '2026-08-02', authorId: 'u8', note: 'Tightened wording on test coverage.' },
      { version: '2.1.0', at: '2026-06-11', authorId: 'u2', note: 'Severity labels on every finding.' },
      { version: '2.0.0', at: '2026-04-18', authorId: 'u2', note: 'Rewrote around severity ordering.' },
    ],
  },
  {
    id: 'pr-review', title: 'PR review', category: 'Engineering', teamId: 'eng', ownerId: 'u4', status: 'active', version: '0.4.0', home: 'mobile-app · .claude/skills/pr-review', updatedAt: '2026-07-30',
    description: 'Reviews a pull request diff for bugs, naming, error handling and missing tests, then gives a verdict. Use when asked to review a PR or code review a diff.',
    triggers: ['review my PR', 'code review this'],
    instructions: 'Look for bugs first. Then naming and error handling. Ask for tests when a branch is not covered. Finish with approve or request changes.',
    tools: ['Read', 'Bash(git diff:*)'],
    installs: [['mobile', '0.4.0', 11, 0.01]],
  },
  {
    id: 'pr-description', title: 'PR description writer', category: 'Engineering', teamId: 'eng', ownerId: 'u8', status: 'active', version: '1.4.0', updatedAt: '2026-09-22',
    description: 'Drafts a pull request description from the branch diff with a summary, risk notes and a test plan. Use when opening a pull request.',
    triggers: ['write PR description', 'describe my changes', 'open a pull request'],
    instructions: 'Summarise the why before the what. Keep the summary under five lines. Always include a Test plan section with checkboxes.',
    tools: ['Bash(git log:*)', 'Bash(git diff:*)'],
    installs: [['checkout', '1.4.0', 18, 0.03], ['payments', '1.4.0', 12, 0.02], ['mobile', '1.4.0', 9, 0.02]],
  },
  {
    id: 'postmortem', title: 'Incident postmortem', category: 'Engineering', teamId: 'eng', ownerId: 'u12', status: 'active', version: '1.1.0', updatedAt: '2026-09-30',
    description: 'Turns an incident thread and timeline into a blameless postmortem with impact, root cause and follow-ups. Use after an incident is resolved.',
    triggers: ['postmortem', 'incident report', 'write up the outage'],
    instructions: 'Use blameless language. Separate trigger from root cause. Every follow-up needs an owner and a due date.',
    tools: ['Read'],
    installs: [['infra', '1.1.0', 3, 0], ['payments', '1.0.0', 1, 0], ['csops', '1.0.0', 2, 0.04, 0, true]],
    history: [
      { version: '1.1.0', at: '2026-09-30', authorId: 'u12', note: 'Customer impact section.' },
      { version: '1.0.0', at: '2026-03-02', authorId: 'u12', note: 'First version.' },
    ],
  },
  {
    id: 'sprint-summary', title: 'Sprint summary', category: 'Engineering', teamId: 'eng', ownerId: 'u4', status: 'active', version: '1.0.0', home: 'checkout-web · .claude/skills/sprint-summary', updatedAt: '2026-06-20',
    description: 'Compiles a weekly status update from merged PRs, tickets and notes into wins, risks and next steps. Use at the end of the week for the status update.',
    triggers: ['sprint summary', 'weekly update', 'what did we ship'],
    instructions: 'Wins, risks, next week. Link every PR. Keep it to one screen.',
    tools: ['Bash(git log:*)', 'Read'],
    installs: [['checkout', '1.0.0', 4, 0], ['mobile', '1.0.0', 3, 0]],
  },
  {
    id: 'critique', title: 'Design critique', category: 'Design', teamId: 'des', ownerId: 'u3', status: 'active', version: '3.0.1', updatedAt: '2026-10-05',
    description: 'Gives structured feedback on a screen or flow: first impression, usability, hierarchy, consistency and accessibility. Use when sharing a mockup for review.',
    triggers: ['critique this design', 'review my mockup', 'design feedback'],
    instructions: 'Lead with what works. Rate each finding by severity. Suggest a concrete alternative for every problem you name.',
    tools: ['Read'],
    installs: [['ds', '3.0.1', 16, 0.02], ['site', '3.0.1', 6, 0.01], ['specs', '3.0.1', 3, 0.03]],
  },
  {
    id: 'handoff', title: 'Figma handoff spec', category: 'Design', teamId: 'des', ownerId: 'u3', status: 'experimental', version: '0.9.0', updatedAt: '2026-10-19',
    description: 'Generates a developer handoff spec from a design: tokens, states, breakpoints and edge cases. Use when a design is ready for engineering.',
    triggers: ['handoff spec', 'ready for dev', 'design handoff'],
    instructions: 'List every interactive state. Reference tokens by name, never raw hex. Call out empty, loading and error states.',
    tools: ['Read'],
    installs: [['ds', '0.9.0', 7, 0.08, 4], ['checkout', '0.8.0', 5, 0.06, 5]],
    history: [
      { version: '0.9.0', at: '2026-10-19', authorId: 'u3', note: 'Breakpoints per component.' },
      { version: '0.8.0', at: '2026-09-20', authorId: 'u3', note: 'First version tried with checkout.' },
    ],
  },
  {
    id: 'ux-copy', title: 'UX copy in our voice', category: 'Design', teamId: 'des', ownerId: 'u7', status: 'active', version: '1.2.0', updatedAt: '2026-09-11',
    description: 'Writes and reviews interface microcopy for buttons, errors and empty states in our product voice: plain, warm, specific. Use when naming a button or wording an error.',
    triggers: ['write copy for', 'what should this button say', 'error message'],
    instructions: 'Verb-first buttons. Errors say what happened and what to do next. Never blame the user.',
    tools: [],
    installs: [['ds', '1.2.0', 9, 0.03], ['site', '1.2.0', 5, 0.02], ['checkout', '1.1.0', 4, 0.02]],
    history: [
      { version: '1.2.0', at: '2026-09-11', authorId: 'u7', note: 'Empty states.' },
      { version: '1.1.0', at: '2026-06-01', authorId: 'u7', note: 'Error message rules.' },
    ],
  },
  {
    id: 'brand-voice', title: 'Brand voice (legacy)', category: 'Writing', teamId: 'des', ownerId: 'u11', status: 'deprecated', version: '0.8.0', updatedAt: '2026-04-02', replacedBy: 'ux-copy',
    description: 'Old brand voice guide for marketing and support writing. Replaced by UX copy in our voice.',
    triggers: ['brand voice'],
    instructions: 'Deprecated — use ux-copy-in-our-voice instead.',
    tools: [],
    installs: [['support', '0.8.0', 2, -0.05], ['site', '0.8.0', 0]],
  },
  {
    id: 'taste', title: 'Design taste', category: 'Design', teamId: 'des', ownerId: 'u3', status: 'experimental', version: '2.0.0', home: 'github.com/Leonxlnx/taste-skill', updatedAt: '2026-10-20',
    description: 'Art direction for web pages and app screens: picks a direction, bans generic ornaments and checks the result in a real browser. Use when a page looks generic.',
    triggers: ['make it look designed', 'this looks generic', 'design direction'],
    instructions: 'Maintained upstream. Runs its own scripts (draw, lint, inspect) with Node and a local Chrome.',
    tools: ['Read', 'Write', 'Bash(node:*)'],
    installs: [['site', '2.0.0', 3, 0, 10]],
    source: { origin: 'Leonxlnx (community)', repo: 'Leonxlnx/taste-skill', url: 'https://github.com/Leonxlnx/taste-skill', license: 'MIT', vetted: false },
  },
  {
    id: 'prd', title: 'PRD writer', category: 'Product', teamId: 'pro', ownerId: 'u5', status: 'active', version: '2.0.0', updatedAt: '2026-08-28',
    description: 'Drafts a product requirements doc from rough notes: problem, goals, non-goals, user stories, open questions. Use when starting a new feature.',
    triggers: ['write a PRD', 'product spec', 'requirements doc'],
    instructions: 'Problem first, solution second. Non-goals are mandatory. Flag every assumption as an open question.',
    tools: ['Read'],
    installs: [['specs', '2.0.0', 12, 0.01], ['ds', '2.0.0', 2, 0], ['checkout', '2.0.0', 0]],
  },
  {
    id: 'interviews', title: 'Interview synthesis', category: 'Product', teamId: 'pro', ownerId: 'u10', status: 'experimental', version: '0.3.0', updatedAt: '2026-10-20',
    description: 'Synthesizes user interview transcripts into themes, quotes and prioritized insights. Use when you have two or more transcripts to analyze.',
    triggers: ['synthesize interviews', 'research themes', 'analyze transcripts'],
    instructions: 'Group by theme, not by participant. Every insight needs at least two supporting quotes and a confidence level.',
    tools: ['Read'],
    installs: [['specs', '0.3.0', 3, 0.1, 8]],
  },
  {
    id: 'release-notes', title: 'Release notes', category: 'Writing', teamId: 'pro', ownerId: 'u5', status: 'active', version: '1.3.2', updatedAt: '2026-10-01',
    description: 'Writes customer-facing release notes from merged PRs, grouped by what changed for the user. Use before each release.',
    triggers: ['release notes', 'changelog', 'what shipped'],
    instructions: 'Write for customers, not engineers. Group by benefit. Skip internal refactors.',
    tools: ['Bash(git log:*)'],
    installs: [['specs', '1.3.2', 5, 0.01], ['payments', '1.3.2', 3, 0], ['support', '1.2.0', 2, 0]],
    history: [
      { version: '1.3.2', at: '2026-10-01', authorId: 'u5', note: 'Groups fixes under “Smaller things”.' },
      { version: '1.2.0', at: '2026-05-12', authorId: 'u5', note: 'Customer-facing tone.' },
    ],
  },
  {
    id: 'status-report', title: 'Weekly status report', category: 'Operations', teamId: 'pro', ownerId: 'u1', status: 'active', version: '1.5.0', updatedAt: '2026-09-05',
    description: 'Compiles a weekly status update from tickets, PRs and notes into wins, risks and next steps. Use on Fridays or when asked for a status update.',
    triggers: ['weekly update', 'status report', 'what did we do this week'],
    instructions: 'Three sections only: wins, risks, next week. Max five bullets each. Link sources.',
    tools: ['Read'],
    installs: [['specs', '1.5.0', 6, 0.01], ['csops', '1.5.0', 3, 0], ['ds', '1.5.0', 2, 0]],
  },
  {
    id: 'meeting-actions', title: 'Meeting notes to actions', category: 'Operations', teamId: 'pro', ownerId: 'u11', status: 'active', version: '1.0.0', updatedAt: '2026-02-10',
    description: 'Extracts decisions and action items with owners from meeting or call notes. Use after a meeting to list who does what.',
    triggers: ['action items', 'meeting notes', 'who does what'],
    instructions: 'Decisions and action items only. Every action has an owner and a date.',
    tools: [],
    installs: [['specs', '1.0.0', 5, 0], ['ds', '1.0.0', 3, 0], ['csops', '1.0.0', 3, -0.02]],
  },
  {
    id: 'sql', title: 'SQL query helper', category: 'Product', teamId: 'pro', ownerId: 'u10', status: 'active', version: '1.1.0', updatedAt: '2026-07-14',
    description: 'Writes read-only SQL against our analytics warehouse schema and explains the result. Use for ad-hoc data questions.',
    triggers: ['write a query', 'how many users', 'SQL'],
    instructions: 'SELECT only. Always add a LIMIT. Explain joins in one sentence each.',
    tools: ['Read'],
    installs: [['analytics', '1.1.0', 9, -0.03], ['csops', '1.0.0', 2, 0.05, 0, true]],
    history: [
      { version: '1.1.0', at: '2026-07-14', authorId: 'u10', note: 'New warehouse schema.' },
      { version: '1.0.0', at: '2026-03-20', authorId: 'u10', note: 'First version.' },
    ],
  },
  {
    id: 'reply-tone', title: 'Support reply tone', category: 'Support', teamId: 'cs', ownerId: 'u6', status: 'active', version: '2.1.0', updatedAt: '2026-10-10',
    description: 'Rewrites a support reply to be empathetic, clear and on-policy, and checks it against refund rules. Use before sending any customer reply.',
    triggers: ['rewrite this reply', 'check my response', 'customer email'],
    instructions: 'Acknowledge first. One clear next step. Never promise refunds outside policy section 4.',
    tools: [],
    installs: [['support', '2.1.0', 70, 0.02]],
  },
  {
    id: 'triage', title: 'Ticket triage', category: 'Support', teamId: 'cs', ownerId: 'u9', status: 'active', version: '1.0.4', updatedAt: '2026-09-17',
    description: 'Classifies an incoming ticket by product area, severity and whether it is a bug, and drafts the routing note. Use on new tickets.',
    triggers: ['triage', 'classify ticket', 'route this'],
    instructions: 'Severity follows the matrix in the support handbook. If unsure between two areas, pick the one with customer data impact.',
    tools: ['Read'],
    installs: [['support', '1.0.4', 35, 0.03], ['infra', '1.0.4', 6, 0.02]],
  },
  {
    id: 'churn', title: 'Churn risk summary', category: 'Support', teamId: 'cs', ownerId: 'u6', status: 'experimental', version: '0.5.0', updatedAt: '2026-10-21',
    description: 'Summarizes an account’s recent tickets, usage dips and sentiment into a churn-risk brief for the account manager. Use before a renewal call.',
    triggers: ['churn risk', 'account health'],
    instructions: 'Lead with the risk level. Cite the three strongest signals. Suggest one save action.',
    tools: ['Read', 'Bash(curl:*)'],
    installs: [['csops', '0.5.0', 4, 0.06, 6]],
  },
  {
    id: 'call-notes', title: 'Call notes summary', category: 'Support', teamId: 'cs', ownerId: 'u9', status: 'active', version: '1.0.0', home: 'cs-ops · .claude/skills/call-notes', updatedAt: '2026-08-08',
    description: 'Extracts decisions and action items with owners from customer call notes. Use after a call to list who does what next.',
    triggers: ['summarize this call', 'call notes', 'next steps'],
    instructions: 'Decisions, action items with owners, and anything the customer promised.',
    tools: [],
    installs: [['csops', '1.0.0', 8, 0.02]],
  },
  {
    id: 'docx', title: 'Word documents', category: 'Writing', teamId: 'pro', ownerId: 'u5', status: 'active', version: '1.2.0', home: 'github.com/anthropics/skills · skills/docx', updatedAt: '2026-09-02',
    description: 'Creates, reads and edits Word (.docx) files, including tracked changes and templates. Use when someone asks for a Word document or attaches one.',
    triggers: ['make a word doc', 'edit this docx', 'tracked changes'],
    instructions: 'Maintained upstream. Changes arrive as new versions and are reviewed before projects update.',
    tools: ['Read', 'Write', 'Bash(python:*)'],
    installs: [['specs', '1.2.0', 4, 0.02], ['csops', '1.2.0', 3, 0.02], ['support', '1.1.0', 1, 0]],
    source: { origin: 'Anthropic', repo: 'anthropics/skills', url: 'https://github.com/anthropics/skills', license: 'See repository', upstream: '1.3.0', vetted: true },
  },
  {
    id: 'pdf', title: 'PDF toolkit', category: 'Operations', teamId: 'cs', ownerId: 'u6', status: 'active', version: '1.1.0', home: 'github.com/anthropics/skills · skills/pdf', updatedAt: '2026-08-14',
    description: 'Reads, fills, merges and splits PDF files, and extracts tables from them. Use when a PDF is attached or asked for.',
    triggers: ['merge these pdfs', 'fill this form', 'extract the table'],
    instructions: 'Maintained upstream. Changes arrive as new versions and are reviewed before projects update.',
    tools: ['Read', 'Bash(python:*)'],
    installs: [['csops', '1.1.0', 4, 0.01], ['analytics', '1.1.0', 2, 0]],
    source: { origin: 'Anthropic', repo: 'anthropics/skills', url: 'https://github.com/anthropics/skills', license: 'See repository', vetted: true },
  },
]

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export function buildSkills(): Skill[] {
  return RAW.map((r) => {
    const name = slugify(r.title.replace(/\s*\(.*\)/, ''))
    return {
      id: r.id, name, title: r.title, description: r.description, category: r.category,
      teamId: r.teamId, ownerId: r.ownerId, status: r.status, version: r.version,
      home: r.home ?? `${REGISTRY} · skills/${name}`,
      updatedAt: r.updatedAt, triggers: r.triggers, instructions: r.instructions, tools: r.tools,
      versions: r.history ?? [{ version: r.version, at: r.updatedAt, authorId: r.ownerId, note: 'Current version.' }],
      ...(r.replacedBy ? { replacedBy: r.replacedBy } : {}),
      ...(r.source ? { source: r.source } : {}),
    }
  })
}

export function buildInstalls(): Install[] {
  return RAW.flatMap((r, i) => r.installs.map(([projectId, version, base, growth = 0.02, start = 0, edited], j) => ({
    skillId: r.id, projectId, version,
    runs: series(i * 97 + j * 13 + 7, base, growth, start),
    ...(edited ? { edited: true } : {}),
  })))
}

export const WEEK_LABELS = Array.from({ length: WEEKS }, (_, i) => {
  const d = new Date(DEMO_NOW)
  d.setDate(d.getDate() - (WEEKS - 1 - i) * 7)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})
