# Skillhouse

A front-end-only React demo of a **Claude skill management system for teams** — built to show what vibe coding can do for *management*: dashboards, approval workflows, role-based permissions, live policy checks and ROI models.

No backend. All data is fictional seed data stored in your browser (`localStorage`); use the reset button in the sidebar to start over.

## Run it

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # static build in dist/ (hash routing, works on any static host)
```

## What's inside

| Page | Management pattern it demonstrates |
|---|---|
| Overview | Executive dashboard — hours saved, adoption by team, personal action inbox, activity feed |
| Skill library | Searchable catalog with filters stored in the URL, grid / table views |
| Skill detail | Single source of truth — SKILL.md export, version history, per-team access, discussion |
| New / edit skill | Guided authoring — live quality score, trigger simulator, auto-generated SKILL.md, auto versioning |
| Review pipeline | Drag-and-drop approval workflow that enforces approvals, evals and role permissions |
| Team & access | RBAC, editable roles, team × skill access matrix, permission table |
| Governance | Policy engine re-evaluating the catalog live, one-click fixes, audit log |
| Insights | ROI what-if calculator, adoption heatmap, funnel |
| Playbook | The demo script and ideas to explore next |

Try **“Viewing as”** in the sidebar (or ⌘K → “view as”) to switch between Admin, Maintainer, Member and Viewer and watch permissions change everywhere. The **Lens** toggle shows/hides the per-page notes explaining what each screen demonstrates.

## Stack

React 19 · TypeScript · Vite · React Router (hash) · lucide-react · hand-rolled SVG charts · plain CSS with light/dark tokens.

```
src/
  data/      seed data, types, lens copy
  lib/       permissions, policy engine, quality checks, trigger matcher, formatting
  store/     React context + reducer, persisted to localStorage, toasts
  components/ layout, command palette, charts, UI primitives
  pages/     one file per screen
```
