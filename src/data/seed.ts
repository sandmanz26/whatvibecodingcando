import type { AuditEvent, Member, Policy, Skill, Stage, Team, Category } from './types'

export const TEAMS: Team[] = [
  { id: 'eng', name: 'Engineering', slot: 1 },
  { id: 'des', name: 'Design', slot: 2 },
  { id: 'pro', name: 'Product', slot: 3 },
  { id: 'cs', name: 'Customer Success', slot: 4 },
]

export const MEMBERS: Member[] = [
  { id: 'u1', name: 'Rani Wijaya', title: 'Head of Operations', role: 'Admin', teamId: 'pro', email: 'rani@skillhouse.dev', joinedAt: '2025-11-03' },
  { id: 'u2', name: 'Dimas Pratama', title: 'Staff Engineer', role: 'Maintainer', teamId: 'eng', email: 'dimas@skillhouse.dev', joinedAt: '2025-11-03' },
  { id: 'u3', name: 'Sari Lestari', title: 'Design Lead', role: 'Maintainer', teamId: 'des', email: 'sari@skillhouse.dev', joinedAt: '2025-12-12' },
  { id: 'u4', name: 'Bayu Santoso', title: 'Backend Engineer', role: 'Member', teamId: 'eng', email: 'bayu@skillhouse.dev', joinedAt: '2026-01-20' },
  { id: 'u5', name: 'Nadia Putri', title: 'Product Manager', role: 'Maintainer', teamId: 'pro', email: 'nadia@skillhouse.dev', joinedAt: '2025-12-01' },
  { id: 'u6', name: 'Arif Hidayat', title: 'Support Lead', role: 'Maintainer', teamId: 'cs', email: 'arif@skillhouse.dev', joinedAt: '2026-02-02' },
  { id: 'u7', name: 'Maya Kusuma', title: 'Product Designer', role: 'Member', teamId: 'des', email: 'maya@skillhouse.dev', joinedAt: '2026-03-14' },
  { id: 'u8', name: 'Kevin Tan', title: 'Frontend Engineer', role: 'Member', teamId: 'eng', email: 'kevin@skillhouse.dev', joinedAt: '2026-04-07' },
  { id: 'u9', name: 'Laras Anjani', title: 'Support Specialist', role: 'Member', teamId: 'cs', email: 'laras@skillhouse.dev', joinedAt: '2026-05-19' },
  { id: 'u10', name: 'Fajar Nugroho', title: 'Data Analyst', role: 'Member', teamId: 'pro', email: 'fajar@skillhouse.dev', joinedAt: '2026-06-02' },
  { id: 'u11', name: 'Citra Dewi', title: 'Account Manager', role: 'Viewer', teamId: 'cs', email: 'citra@skillhouse.dev', joinedAt: '2026-08-11' },
  { id: 'u12', name: 'Reza Mahendra', title: 'Platform Engineer', role: 'Member', teamId: 'eng', email: 'reza@skillhouse.dev', joinedAt: '2026-09-01' },
]

export const POLICIES: Policy[] = [
  { id: 'p-owner', name: 'Every skill has an active owner', description: 'Published skills must be owned by a current Maintainer or Admin, so someone answers when it misbehaves.', enabled: true, severity: 'critical' },
  { id: 'p-evals', name: 'Evals before publishing', description: 'A published skill needs at least one eval suite attached. Catches regressions when the prompt changes.', enabled: true, severity: 'serious' },
  { id: 'p-two-approvals', name: 'Two approvals to publish', description: 'Skills that can run shell or write files need two reviewers, not one.', enabled: true, severity: 'serious' },
  { id: 'p-description', name: 'Descriptions say when to trigger', description: 'Claude picks skills by their description. Under 60 characters is usually too vague to trigger reliably.', enabled: true, severity: 'warning' },
  { id: 'p-stale', name: 'No stale skills', description: 'Flag published skills with zero runs in the last 4 weeks. Unused skills are noise in Claude’s context.', enabled: true, severity: 'warning' },
  { id: 'p-external', name: 'External skills are vetted and pinned', description: 'A skill imported from outside runs only after a security review, pinned to one version, so an upstream change can’t reach the team unreviewed.', enabled: true, severity: 'critical' },
  { id: 'p-access', name: 'Least-privilege access', description: 'Warn when a skill is shared with every team but only one team actually uses it.', enabled: false, severity: 'warning' },
]

// Deterministic pseudo-random so the demo looks the same on every load.
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const WEEKS = 12
const USAGE_SCALE = 0.15

function series(seed: number, base: number, growth: number, noise = 0.18, startWeek = 0): number[] {
  const r = rng(seed)
  return Array.from({ length: WEEKS }, (_, i) => {
    if (i < startWeek) return 0
    const t = i - startWeek
    const v = base * Math.pow(1 + growth, t) * (1 + (r() - 0.5) * 2 * noise)
    return Math.max(0, Math.round(v))
  })
}

function splitByTeam(total: number[], weights: Record<string, number>, seed: number) {
  const r = rng(seed)
  const ids = Object.keys(weights)
  const out: Record<string, number[]> = {}
  ids.forEach((id) => (out[id] = []))
  total.forEach((v) => {
    let remaining = v
    const jitter = ids.map((id) => weights[id] * (0.85 + r() * 0.3))
    const sum = jitter.reduce((a, b) => a + b, 0)
    ids.forEach((id, i) => {
      const part = i === ids.length - 1 ? remaining : Math.round((v * jitter[i]) / sum)
      out[id].push(part)
      remaining -= part
    })
  })
  return out
}

interface SkillSeed {
  id: string
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
  usage: [number, number, number, number?] // base, growth, noise, startWeek
  weights: Record<string, number>
  rating: number
  minutesSaved: number
  reviewerIds?: string[]
  approvals?: string[]
  hasEvals: boolean
  source?: import('./types').ExternalSource
  comments?: { authorId: string; text: string; at: string }[]
  history?: { version: string; at: string; authorId: string; note: string }[]
}

const RAW: SkillSeed[] = [
  {
    id: 's1', title: 'Code review checklist', category: 'Engineering', ownerId: 'u2', teamIds: ['eng'], stage: 'published', version: '2.3.0',
    createdAt: '2025-11-10', updatedAt: '2026-10-14',
    description: 'Reviews a diff against our engineering standards: naming, error handling, test coverage and migration safety. Use when someone asks for a code review or pastes a PR diff.',
    triggers: ['review this PR', 'code review', 'check my diff'],
    instructions: '1. Read the diff top to bottom before commenting.\n2. Flag correctness issues first, style last.\n3. For every migration, check it is reversible and safe to run on a live table.\n4. End with a one-line verdict: approve, approve with nits, or request changes.',
    examples: ['Review this diff for the payments refactor', 'Is this migration safe to run during business hours?'],
    tools: ['Read', 'Grep', 'Bash(git diff:*)'],
    usage: [180, 0.035, 0.12], weights: { eng: 1 }, rating: 4.8, minutesSaved: 18, hasEvals: true,
    reviewerIds: ['u4', 'u8'], approvals: ['u4', 'u8'],
    history: [
      { version: '2.3.0', at: '2026-10-14', authorId: 'u2', note: 'Added migration-safety section after the September incident.' },
      { version: '2.2.1', at: '2026-08-02', authorId: 'u8', note: 'Tightened wording on test coverage expectations.' },
      { version: '2.0.0', at: '2026-04-18', authorId: 'u2', note: 'Rewrote around severity ordering. Breaking: verdict line is now mandatory.' },
      { version: '1.0.0', at: '2025-11-10', authorId: 'u2', note: 'First version.' },
    ],
  },
  {
    id: 's2', title: 'PR description writer', category: 'Engineering', ownerId: 'u8', teamIds: ['eng', 'pro'], stage: 'published', version: '1.4.0',
    createdAt: '2026-01-08', updatedAt: '2026-09-22',
    description: 'Drafts a pull request description from a branch diff with summary, risk notes and a test plan. Use when opening a PR or when asked to describe changes.',
    triggers: ['write PR description', 'describe my changes', 'open a pull request'],
    instructions: 'Summarise the why before the what. Keep the summary under five lines. Always include a Test plan section with checkboxes.',
    examples: ['Write the PR description for this branch'], tools: ['Bash(git log:*)', 'Bash(git diff:*)'],
    usage: [140, 0.04, 0.15], weights: { eng: 0.85, pro: 0.15 }, rating: 4.6, minutesSaved: 9, hasEvals: true,
    reviewerIds: ['u2'], approvals: ['u2'],
  },
  {
    id: 's3', title: 'Incident postmortem', category: 'Engineering', ownerId: 'u12', teamIds: ['eng', 'cs'], stage: 'published', version: '1.1.0',
    createdAt: '2026-03-02', updatedAt: '2026-09-30',
    description: 'Turns an incident Slack thread and timeline into a blameless postmortem with impact, root cause and follow-ups. Use after an incident is resolved.',
    triggers: ['postmortem', 'incident report', 'write up the outage'],
    instructions: 'Use blameless language. Separate trigger from root cause. Every follow-up needs an owner and a due date.',
    examples: ['Write the postmortem for yesterday’s checkout outage'], tools: ['Read'],
    usage: [22, 0.02, 0.45], weights: { eng: 0.7, cs: 0.3 }, rating: 4.7, minutesSaved: 75, hasEvals: false,
    reviewerIds: ['u2'], approvals: ['u2'],
  },
  {
    id: 's4', title: 'Design critique', category: 'Design', ownerId: 'u3', teamIds: ['des', 'pro'], stage: 'published', version: '3.0.1',
    createdAt: '2025-12-15', updatedAt: '2026-10-05',
    description: 'Gives structured feedback on a screen or flow: first impression, usability, hierarchy, consistency and accessibility. Use when sharing a mockup or screenshot for review.',
    triggers: ['critique this design', 'review my mockup', 'design feedback'],
    instructions: 'Lead with what works. Rate each finding by severity. Suggest a concrete alternative for every problem you name.',
    examples: ['What do you think of this onboarding screen?'], tools: ['Read'],
    usage: [95, 0.03, 0.14], weights: { des: 0.8, pro: 0.2 }, rating: 4.9, minutesSaved: 25, hasEvals: true,
    reviewerIds: ['u7'], approvals: ['u7'],
  },
  {
    id: 's5', title: 'UX copy in our voice', category: 'Design', ownerId: 'u7', teamIds: ['des', 'pro', 'cs'], stage: 'published', version: '1.2.0',
    createdAt: '2026-04-01', updatedAt: '2026-09-11',
    description: 'Writes and reviews microcopy (buttons, errors, empty states) in our product voice: plain, warm, specific. Use when naming a CTA or wording an error.',
    triggers: ['write copy for', 'what should this button say', 'error message'],
    instructions: 'Verb-first buttons. Errors say what happened and what to do next. Never blame the user.',
    examples: ['Write an empty state for the invoices page'], tools: [],
    usage: [60, 0.05, 0.2], weights: { des: 0.45, pro: 0.3, cs: 0.25 }, rating: 4.5, minutesSaved: 8, hasEvals: true,
    reviewerIds: ['u3'], approvals: ['u3'],
  },
  {
    id: 's6', title: 'Figma handoff spec', category: 'Design', ownerId: 'u3', teamIds: ['des', 'eng'], stage: 'approved', version: '0.9.0',
    createdAt: '2026-09-20', updatedAt: '2026-10-19',
    description: 'Generates a developer handoff spec from a design: tokens, states, breakpoints and edge cases. Use when a design is ready for engineering.',
    triggers: ['handoff spec', 'ready for dev', 'design handoff'],
    instructions: 'List every interactive state. Reference tokens by name, never raw hex. Call out empty, loading and error states explicitly.',
    examples: ['Prepare the handoff for the new settings page'], tools: ['Read'],
    usage: [8, 0.2, 0.3, 8], weights: { des: 0.6, eng: 0.4 }, rating: 4.4, minutesSaved: 40, hasEvals: true,
    reviewerIds: ['u2', 'u7'], approvals: ['u2', 'u7'],
  },
  {
    id: 's7', title: 'PRD writer', category: 'Product', ownerId: 'u5', teamIds: ['pro', 'eng', 'des'], stage: 'published', version: '2.0.0',
    createdAt: '2025-11-20', updatedAt: '2026-08-28',
    description: 'Drafts a product requirements doc from rough notes: problem, goals, non-goals, user stories, open questions. Use when starting a new feature.',
    triggers: ['write a PRD', 'product spec', 'requirements doc'],
    instructions: 'Problem first, solution second. Non-goals are mandatory. Flag every assumption as an open question.',
    examples: ['Turn these notes into a PRD for bulk export'], tools: ['Read'],
    usage: [70, 0.02, 0.2], weights: { pro: 0.7, eng: 0.15, des: 0.15 }, rating: 4.6, minutesSaved: 55, hasEvals: true,
    reviewerIds: ['u1'], approvals: ['u1'],
  },
  {
    id: 's8', title: 'Interview synthesis', category: 'Product', ownerId: 'u10', teamIds: ['pro', 'des'], stage: 'review', version: '0.3.0',
    createdAt: '2026-10-02', updatedAt: '2026-10-20',
    description: 'Synthesizes user interview transcripts into themes, quotes and prioritized insights. Use when you have two or more transcripts to analyze.',
    triggers: ['synthesize interviews', 'research themes', 'analyze transcripts'],
    instructions: 'Group by theme, not by participant. Every insight needs at least two supporting quotes.',
    examples: ['Find the themes across these six interviews'], tools: ['Read'],
    usage: [0, 0, 0, 12], weights: { pro: 1 }, rating: 0, minutesSaved: 90, hasEvals: false,
    reviewerIds: ['u5', 'u3'], approvals: ['u5'],
    comments: [
      { authorId: 'u5', text: 'Love the quote requirement. Can we add a confidence level per insight?', at: '2026-10-18T09:12:00' },
      { authorId: 'u10', text: 'Added in 0.3.0 — high / medium / low based on quote count.', at: '2026-10-20T14:40:00' },
    ],
  },
  {
    id: 's9', title: 'Release notes', category: 'Writing', ownerId: 'u5', teamIds: ['pro', 'cs', 'eng'], stage: 'published', version: '1.3.2',
    createdAt: '2026-01-15', updatedAt: '2026-10-01',
    description: 'Writes customer-facing release notes from merged PRs, grouped by what changed for the user. Use before each release.',
    triggers: ['release notes', 'changelog', 'what shipped'],
    instructions: 'Write for customers, not engineers. Group by benefit. Skip internal refactors.',
    examples: ['Draft release notes for v4.12'], tools: ['Bash(git log:*)'],
    usage: [30, 0.03, 0.35], weights: { pro: 0.5, cs: 0.3, eng: 0.2 }, rating: 4.3, minutesSaved: 35, hasEvals: false,
    reviewerIds: ['u6'], approvals: ['u6'],
  },
  {
    id: 's10', title: 'Support reply tone', category: 'Support', ownerId: 'u6', teamIds: ['cs'], stage: 'published', version: '2.1.0',
    createdAt: '2025-12-05', updatedAt: '2026-10-10',
    description: 'Rewrites a support reply to be empathetic, clear and on-policy, and checks it against refund rules. Use before sending any customer reply.',
    triggers: ['rewrite this reply', 'check my response', 'customer email'],
    instructions: 'Acknowledge first. One clear next step. Never promise refunds outside policy section 4.',
    examples: ['Make this reply to an angry customer kinder'], tools: [],
    usage: [210, 0.03, 0.1], weights: { cs: 1 }, rating: 4.7, minutesSaved: 6, hasEvals: true,
    reviewerIds: ['u9'], approvals: ['u9'],
  },
  {
    id: 's11', title: 'Ticket triage', category: 'Support', ownerId: 'u9', teamIds: ['cs', 'eng'], stage: 'published', version: '1.0.4',
    createdAt: '2026-05-25', updatedAt: '2026-09-17',
    description: 'Classifies an incoming ticket by product area, severity and whether it is a bug, and drafts the routing note. Use on new tickets.',
    triggers: ['triage', 'classify ticket', 'route this'],
    instructions: 'Severity follows the matrix in the support handbook. If unsure between two areas, pick the one with customer data impact.',
    examples: ['Triage these five tickets'], tools: ['Read'],
    usage: [110, 0.06, 0.15, 2], weights: { cs: 0.8, eng: 0.2 }, rating: 4.4, minutesSaved: 4, hasEvals: true,
    reviewerIds: ['u6'], approvals: ['u6'],
  },
  {
    id: 's12', title: 'Churn risk summary', category: 'Support', ownerId: 'u6', teamIds: ['cs', 'pro'], stage: 'review', version: '0.5.0',
    createdAt: '2026-09-28', updatedAt: '2026-10-21',
    description: 'Summarizes an account’s recent tickets, usage dips and sentiment into a churn-risk brief for the account manager.',
    triggers: ['churn risk', 'account health'],
    instructions: 'Lead with the risk level. Cite the three strongest signals. Suggest one save action.',
    examples: ['How at-risk is Sinar Retail?'], tools: ['Read', 'Bash(curl:*)'],
    usage: [0, 0, 0, 12], weights: { cs: 1 }, rating: 0, minutesSaved: 20, hasEvals: true,
    reviewerIds: ['u1', 'u5'], approvals: [],
    comments: [{ authorId: 'u1', text: 'Needs a second reviewer — it calls curl, so two-approval policy applies.', at: '2026-10-21T10:05:00' }],
  },
  {
    id: 's13', title: 'Weekly status report', category: 'Operations', ownerId: 'u1', teamIds: ['eng', 'des', 'pro', 'cs'], stage: 'published', version: '1.5.0',
    createdAt: '2025-11-05', updatedAt: '2026-09-05',
    description: 'Compiles a weekly status update from tickets, PRs and notes into wins, risks and next steps. Use on Fridays or when asked for a status update.',
    triggers: ['weekly update', 'status report', 'what did we do this week'],
    instructions: 'Three sections only: wins, risks, next week. Max five bullets each. Link sources.',
    examples: ['Write this week’s update for the design team'], tools: ['Read'],
    usage: [85, 0.025, 0.25], weights: { eng: 0.3, des: 0.2, pro: 0.3, cs: 0.2 }, rating: 4.5, minutesSaved: 30, hasEvals: true,
    reviewerIds: ['u5'], approvals: ['u5'],
  },
  {
    id: 's14', title: 'Meeting notes to actions', category: 'Operations', ownerId: 'u11', teamIds: ['eng', 'des', 'pro', 'cs'], stage: 'published', version: '1.0.0',
    createdAt: '2026-02-10', updatedAt: '2026-02-10',
    description: 'Extracts decisions and action items with owners from meeting notes.',
    triggers: ['action items', 'meeting notes'],
    instructions: 'Decisions and action items only. Every action has an owner.',
    examples: ['Pull the actions from this sync'], tools: [],
    usage: [120, 0.02, 0.2], weights: { eng: 0.25, des: 0.25, pro: 0.3, cs: 0.2 }, rating: 4.2, minutesSaved: 10, hasEvals: false,
    reviewerIds: ['u5'], approvals: ['u5'],
  },
  {
    id: 's15', title: 'SQL query helper', category: 'Product', ownerId: 'u4', teamIds: ['pro', 'eng', 'cs', 'des'], stage: 'published', version: '1.1.0',
    createdAt: '2026-03-20', updatedAt: '2026-07-14',
    description: 'Writes read-only SQL against our analytics warehouse schema and explains the result. Use for ad-hoc data questions.',
    triggers: ['write a query', 'how many users', 'SQL'],
    instructions: 'SELECT only. Always add a LIMIT. Explain joins in one sentence each.',
    examples: ['How many teams activated last month?'], tools: ['Read'],
    usage: [40, -0.12, 0.3], weights: { pro: 0.9, eng: 0.1 }, rating: 3.9, minutesSaved: 15, hasEvals: true,
    reviewerIds: ['u2'], approvals: ['u2'],
  },
  {
    id: 's16', title: 'Brand voice (legacy)', category: 'Writing', ownerId: 'u11', teamIds: ['des', 'cs'], stage: 'deprecated', version: '0.8.0',
    createdAt: '2025-11-12', updatedAt: '2026-04-02',
    description: 'Old brand voice guide. Replaced by UX copy in our voice.',
    triggers: ['brand voice'],
    instructions: 'Deprecated — use ux-copy-in-our-voice instead.',
    examples: [], tools: [],
    usage: [25, -0.35, 0.2], weights: { des: 0.5, cs: 0.5 }, rating: 3.6, minutesSaved: 5, hasEvals: false,
    reviewerIds: [], approvals: [],
  },
  {
    id: 's17', title: 'Onboarding buddy', category: 'Operations', ownerId: 'u1', teamIds: ['eng', 'des', 'pro', 'cs'], stage: 'draft', version: '0.1.0',
    createdAt: '2026-10-18', updatedAt: '2026-10-21',
    description: 'Answers new-hire questions from the handbook.',
    triggers: ['how do I', 'where is'],
    instructions: 'Answer from the handbook only. Link the page. If unsure, point to the #ask-ops channel.',
    examples: ['How do I request a laptop?'], tools: ['Read'],
    usage: [0, 0, 0, 12], weights: { eng: 1 }, rating: 0, minutesSaved: 12, hasEvals: false,
  },
  {
    id: 's18', title: 'Contract clause check', category: 'Operations', ownerId: 'u5', teamIds: ['pro', 'cs'], stage: 'draft', version: '0.2.0',
    createdAt: '2026-10-12', updatedAt: '2026-10-16',
    description: 'Flags non-standard clauses in customer contracts against our standard terms, with a plain-language explanation of each deviation. Use when reviewing an MSA or order form.',
    triggers: ['review this contract', 'check the MSA', 'non-standard clause'],
    instructions: 'Compare clause by clause. Explain risk in plain language. You are not a lawyer — always recommend legal sign-off for liability changes.',
    examples: ['Check this order form for anything unusual'], tools: ['Read'],
    usage: [0, 0, 0, 12], weights: { pro: 1 }, rating: 0, minutesSaved: 45, hasEvals: false,
  },
  {
    id: 'e1', title: 'Word documents', category: 'Writing', ownerId: 'u5', teamIds: ['pro', 'cs', 'des', 'eng'], stage: 'published', version: '1.2.0',
    createdAt: '2026-06-03', updatedAt: '2026-09-02',
    description: 'Creates, reads and edits Word (.docx) files, including tracked changes and templates. Use when someone asks for a Word document or attaches one.',
    triggers: ['make a word doc', 'edit this docx', 'tracked changes'],
    instructions: 'Imported from anthropics/skills. Instructions are maintained upstream; changes arrive as new versions and go through review here.',
    examples: ['Turn these notes into a Word document with headings'], tools: ['Read', 'Write', 'Bash(python:*)'],
    usage: [60, 0.04, 0.2], weights: { pro: 0.4, cs: 0.3, des: 0.1, eng: 0.2 }, rating: 4.6, minutesSaved: 20, hasEvals: true,
    reviewerIds: ['u2', 'u1'], approvals: ['u2', 'u1'],
    source: { kind: 'external', origin: 'Anthropic', repo: 'anthropics/skills', path: 'skills/docx', url: 'https://github.com/anthropics/skills', license: 'See repository', pinned: '1.2.0', latest: '1.3.0', syncedAt: '2026-09-02', vetted: true },
  },
  {
    id: 'e2', title: 'PDF toolkit', category: 'Operations', ownerId: 'u1', teamIds: ['pro', 'cs'], stage: 'published', version: '1.1.0',
    createdAt: '2026-06-03', updatedAt: '2026-08-14',
    description: 'Reads, fills, merges and splits PDF files, and extracts tables from them. Use when a PDF is attached or asked for.',
    triggers: ['merge these pdfs', 'fill this form', 'extract the table'],
    instructions: 'Imported from anthropics/skills. Instructions are maintained upstream; changes arrive as new versions and go through review here.',
    examples: ['Merge the signed contract pages into one PDF'], tools: ['Read', 'Bash(python:*)'],
    usage: [35, 0.02, 0.25], weights: { pro: 0.5, cs: 0.5 }, rating: 4.4, minutesSaved: 12, hasEvals: true,
    reviewerIds: ['u2', 'u6'], approvals: ['u2', 'u6'],
    source: { kind: 'external', origin: 'Anthropic', repo: 'anthropics/skills', path: 'skills/pdf', url: 'https://github.com/anthropics/skills', license: 'See repository', pinned: '1.1.0', syncedAt: '2026-08-14', vetted: true },
  },
  {
    id: 'e3', title: 'Design taste', category: 'Design', ownerId: 'u3', teamIds: ['des'], stage: 'review', version: '2.0.0',
    createdAt: '2026-10-20', updatedAt: '2026-10-21',
    description: 'Art direction for web pages and app screens: deals a researched direction, bans generated-looking ornaments and checks the result in a real browser. Use when a page looks generic.',
    triggers: ['make it look designed', 'this looks generic', 'design direction'],
    instructions: 'Imported from Leonxlnx/taste-skill. Runs its own scripts (draw, lint, inspect) with Node and a local Chrome; review them before approving.',
    examples: ['Redesign the settings screen so it stops looking like a template'], tools: ['Read', 'Write', 'Bash(node:*)'],
    usage: [0, 0, 0, 12], weights: { des: 1 }, rating: 0, minutesSaved: 40, hasEvals: false,
    reviewerIds: ['u2'], approvals: [],
    comments: [{ authorId: 'u3', text: 'Used it on Skillhouse v2. It runs node scripts and launches Chrome — needs a security look before we lend it out.', at: '2026-10-21T11:20:00' }],
    source: { kind: 'external', origin: 'Leonxlnx (community)', repo: 'Leonxlnx/taste-skill', path: 'skills/taste-skill', url: 'https://github.com/Leonxlnx/taste-skill', license: 'MIT', pinned: '2.0.0', syncedAt: '2026-10-20', vetted: false },
  },
]

export const slugify = (s: string) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export function buildSkills(): Skill[] {
  return RAW.map((r, i) => {
    const [base, growth, noise, start] = r.usage
    // Bases above are per-org; scale to a 12-person workspace so per-person numbers stay believable.
    const usage = base === 0 ? Array(WEEKS).fill(0) : series(i * 97 + 13, base * USAGE_SCALE, growth, noise, start ?? 0)
    return {
      id: r.id,
      name: slugify(r.title),
      title: r.title,
      description: r.description,
      category: r.category,
      ownerId: r.ownerId,
      teamIds: r.teamIds,
      stage: r.stage,
      version: r.version,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      triggers: r.triggers,
      instructions: r.instructions,
      examples: r.examples,
      tools: r.tools,
      usage,
      usageByTeam: splitByTeam(usage, r.weights, i * 31 + 7),
      rating: r.rating,
      minutesSaved: r.minutesSaved,
      reviewerIds: r.reviewerIds ?? [],
      approvals: r.approvals ?? [],
      hasEvals: r.hasEvals,
      ...(r.source ? { source: r.source } : {}),
      comments: (r.comments ?? []).map((c, j) => ({ id: `${r.id}-c${j}`, ...c })),
      versions: r.history ?? [{ version: r.version, at: r.updatedAt, authorId: r.ownerId, note: r.version === '0.1.0' ? 'First draft.' : 'Current version.' }],
    }
  })
}

export function buildAudit(): AuditEvent[] {
  const rows: [string, string, AuditEvent['action'], string | undefined, string][] = [
    ['2026-10-21T10:05:00', 'u1', 'commented', 's12', 'Asked for a second reviewer (two-approval policy)'],
    ['2026-10-21T08:30:00', 'u6', 'submitted', 's12', 'Submitted v0.5.0 for review'],
    ['2026-10-21T08:02:00', 'u1', 'updated', 's17', 'Edited instructions'],
    ['2026-10-20T14:40:00', 'u10', 'updated', 's8', 'Published draft v0.3.0 with confidence levels'],
    ['2026-10-19T16:12:00', 'u7', 'approved', 's6', 'Approved v0.9.0'],
    ['2026-10-19T11:48:00', 'u2', 'approved', 's6', 'Approved v0.9.0'],
    ['2026-10-18T09:12:00', 'u5', 'commented', 's8', 'Requested confidence levels per insight'],
    ['2026-10-18T09:00:00', 'u1', 'created', 's17', 'Created draft'],
    ['2026-10-16T15:20:00', 'u1', 'role', undefined, 'Changed Reza Mahendra from Viewer to Member'],
    ['2026-10-14T13:00:00', 'u2', 'published', 's1', 'Published v2.3.0'],
    ['2026-10-12T10:41:00', 'u5', 'created', 's18', 'Created draft'],
    ['2026-10-10T17:05:00', 'u6', 'published', 's10', 'Published v2.1.0'],
    ['2026-10-05T09:30:00', 'u3', 'published', 's4', 'Published v3.0.1'],
    ['2026-10-02T12:10:00', 'u10', 'created', 's8', 'Created draft'],
    ['2026-10-01T16:00:00', 'u1', 'policy', undefined, 'Enabled “Two approvals to publish”'],
    ['2026-09-30T11:00:00', 'u12', 'published', 's3', 'Published v1.1.0'],
    ['2026-09-22T10:15:00', 'u8', 'published', 's2', 'Published v1.4.0'],
    ['2026-09-17T14:22:00', 'u2', 'access', 's11', 'Shared with Engineering'],
  ]
  return rows.map(([at, actorId, action, skillId, detail], i) => ({ id: `a${i}`, at, actorId, action, skillId, detail }))
}

/** "Today" in the demo — keeps relative dates stable regardless of when it is opened. */
export const DEMO_NOW = new Date('2026-10-22T09:00:00')

export const WEEK_LABELS = Array.from({ length: WEEKS }, (_, i) => {
  const d = new Date(DEMO_NOW)
  d.setDate(d.getDate() - (WEEKS - 1 - i) * 7)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
})
