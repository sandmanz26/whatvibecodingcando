import type { LensInfo } from '../components/ui'

/**
 * "Vibe coding lens" copy — each page explains which management capability it
 * demonstrates, so the app doubles as a guided demo.
 */
export const LENS: Record<string, LensInfo> = {
  overview: {
    title: 'Executive dashboard',
    text: 'A one-glance view a manager would otherwise assemble by hand from spreadsheets: impact in hours saved, adoption per team, and the few things that need a decision today.',
    tags: ['KPI tiles', 'Trend chart', 'Action inbox', 'Activity feed'],
  },
  library: {
    title: 'Knowledge catalog',
    text: 'Turn tribal know-how into a searchable, owned asset. Filter by team, stage and category — the same pattern works for SOPs, templates or vendor lists.',
    tags: ['Search & filters', 'Grid / table views', 'Ownership', 'Lifecycle stages'],
  },
  detail: {
    title: 'Single source of truth',
    text: 'Every asset has an owner, a version history, an access list and a discussion thread. Managers can answer “who changed what, and why” without a meeting.',
    tags: ['Versioning', 'Comments', 'Per-team access', 'Usage analytics'],
  },
  editor: {
    title: 'Guided authoring',
    text: 'Quality rules are built into the form instead of a style guide nobody reads. The live score and trigger simulator show how vibe-coded tools can coach people as they work.',
    tags: ['Live preview', 'Quality score', 'Trigger simulator', 'Auto versioning'],
  },
  pipeline: {
    title: 'Approval workflow',
    text: 'A drag-and-drop review board that enforces rules: you can’t publish without enough approvals or evals, and the reason is shown when a move is blocked. Switch “Viewing as” to see it change per role.',
    tags: ['Kanban', 'Role-based gates', 'Policy enforcement', 'Audit trail'],
  },
  team: {
    title: 'People & permissions',
    text: 'Roles, team membership and who can use what — all editable in place. A permission matrix makes access reviews a 5-minute job instead of a ticket queue.',
    tags: ['RBAC', 'Access matrix', 'Contribution stats', 'Role changes logged'],
  },
  governance: {
    title: 'Policy as code',
    text: 'Write a rule once, see every violation instantly, fix it in one click. Toggling a policy re-evaluates the whole catalog live — compliance becomes a dashboard, not an audit.',
    tags: ['Live policy engine', 'Severity levels', 'One-click fixes', 'Audit log'],
  },
  insights: {
    title: 'ROI & adoption',
    text: 'Make the business case with your own assumptions. Sliders recalculate value in real time; the heatmap shows where adoption is strong and where to coach.',
    tags: ['ROI calculator', 'Adoption heatmap', 'Funnel', 'What-if analysis'],
  },
}
