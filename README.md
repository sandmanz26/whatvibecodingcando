# Vibe coding: content site and SaaS, in one repository

Two apps and one shared package (npm workspaces):

| Path | What it is | Run / build |
|---|---|---|
| `apps/content` | **The content site.** The AI marketplace prototype, with the research dock and console used to show what vibe coding can do. It keeps a copy of the SaaS website, panel and script. | `npm run dev` · `npm run build:content` → `dist/content` (served at `/content/`) |
| `apps/saas` | **Vibe Collab, the SaaS.** It opens on the website (`#/landingpage`), with sign-up, the user panel, the install page and the script. Every research tool built so far comes with it. React + Vite for now; backend later. | `npm run dev:saas` · `npm run build:saas` → `dist/saas` (served at `/saas/`) |
| `packages/core` | **Code both apps use** (`@vibe/core`): the installable collaboration widget and its `Backend` storage interface, the heatmap renderer, and the eye-movement analysis (I-DT fixations, saccades, AOIs, One-Euro filter). A fix here reaches both apps. | used by both apps' builds |

The two apps are copies that grow apart on purpose: change a tool in one, then decide whether the other needs it too. Anything that should stay identical belongs in `packages/core`.

- **Everything:** `npm install` once, then `npm run typecheck` (core, content, saas) and `npm run build` (both apps).
- **Claude Code plugin:** the `ux-research-kit` plugin stays at the root (`.claude-plugin/`, `plugins/`).

Each app's own documentation is in its README (`apps/content/README.md`, `apps/saas/README.md`).

## Vercel: one deployment, two paths

One Vercel project serves both apps. `vercel.json` at the root sets the install (`npm install`), the build (`npm run build`, which builds both apps) and the output (`dist`), so nothing needs configuring in Vercel.

| URL | App | Built into |
|---|---|---|
| `/content/` | the content site | `dist/content` |
| `/saas/` | the SaaS (opens on its website) | `dist/saas` |
| `/` | redirects to `/content/` (a hash such as `#/console/...` is kept) | — |

`/content` and `/saas` without the slash redirect to the version with it, so the relative asset paths resolve. Locally, `npm run build && npm run preview` serves the same layout at `http://localhost:4173/content/` and `/saas/`.

Both apps are on one domain, so they would share the browser's storage. The SaaS app prefixes its keys with `saas:` (`apps/saas/src/storage-scope.ts`), so comments, tests, versions and the demo account stay apart. The script's own `vibe:` keys are left as they are, because they are per project and the panel's inbox must read what the script writes.
