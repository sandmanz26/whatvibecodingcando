# Vibe coding: content site and SaaS, in one repository

Two apps and one shared package (npm workspaces):

| Path | What it is | Run / build |
|---|---|---|
| `apps/content` | **The content site.** The AI marketplace prototype, with the research dock and console used to show what vibe coding can do. It keeps a copy of the SaaS website, panel and script. | `npm run dev` · `npm run build` → **`dist/`** at the root |
| `apps/saas` | **Vibe Collab, the SaaS.** It opens on the website (`#/landingpage`), with sign-up, the user panel, the install page and the script. Every research tool built so far comes with it. React + Vite for now; backend later. | `npm run dev:saas` · `npm run build:saas` → `apps/saas/dist` |
| `packages/core` | **Code both apps use** (`@vibe/core`): the installable collaboration widget and its `Backend` storage interface, the heatmap renderer, and the eye-movement analysis (I-DT fixations, saccades, AOIs, One-Euro filter). A fix here reaches both apps. | used by both apps' builds |

The two apps are copies that grow apart on purpose: change a tool in one, then decide whether the other needs it too. Anything that should stay identical belongs in `packages/core`.

- **Everything:** `npm install` once, then `npm run typecheck` (core, content, saas) and `npm run build:all`.
- **Deployment:** `npm run build` at the root still builds the content site into `dist/`, as before the split.
- **Claude Code plugin:** the `ux-research-kit` plugin stays at the root (`.claude-plugin/`, `plugins/`).

Each app's own documentation is in its README (`apps/content/README.md`, `apps/saas/README.md`).
