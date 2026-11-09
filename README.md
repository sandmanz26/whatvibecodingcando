# Vibe coding: two separate systems in one repository

| Path | System | Run / build |
|---|---|---|
| `apps/content` | **The content site.** The AI marketplace prototype, with the research dock and console used to show what vibe coding can do. It also has a copy of the SaaS website, panel and script. | `npm run dev` · `npm run build:content` → `dist/content` (served at `/content/`) |
| `apps/saas` | **Vibe Collab, the SaaS.** It opens on its website (`#/landingpage`), with sign-up, the user panel, the install page, the script and every research tool built so far. React + Vite for now; backend later. | `npm run dev:saas` · `npm run build:saas` → the root of `dist` (served at `/`) |

**The two are separate systems.**
- **Code.** Each has its own code (including its own copy of the script, the heatmap renderer and the eye-movement analysis, in `src/core`).
- **Dependencies.** Each has its own `package.json`, lockfile and `node_modules`.
- **Data.** Each keeps its own browser data.

A change in one never reaches the other. To bring something across, copy it on purpose.

- **First time:** `npm run install:all`, which installs each app's own dependencies.
- **Checks:** `npm run typecheck` and `npm run build` (both apps).
- **Claude Code plugin:** the `ux-research-kit` plugin stays at the root (`.claude-plugin/`, `plugins/`).

Each app's documentation is in its own README (`apps/content/README.md`, `apps/saas/README.md`).

## Vercel: one deployment, two paths

One Vercel project serves both apps. `vercel.json` at the root sets the install (`npm run install:all`: each app installs its own dependencies), the build (`npm run build`, which builds both apps) and the output (`dist`), so nothing needs configuring in Vercel.

| URL | App | Built into |
|---|---|---|
| `/` | the SaaS (opens on its website, `#/landingpage`) | the root of `dist` |
| `/content/` | the content site | `dist/content` |
| `/saas/…` | old addresses: redirect to the same path at the root. This includes `/saas/embed/vibe.js`, so snippets installed before the move keep working; the hash, such as `#/app`, is kept. | — |
| `/content/__reset` (and `/__reset`) | the content site's hidden "reset everything" page; `/content/__reset` is rewritten to the content app | `dist/content` |

Live at `https://whatvibecodingcando.vercel.app/`.
- **Build.** `npm run build` empties `dist` once, then builds the content site into `dist/content` and the SaaS into the root of `dist` (its build doesn't empty `dist`, so the two don't erase each other).
- **Locally.** `npm run build && npm run preview` serves the same layout at `http://localhost:4173/` (SaaS) and `/content/`.
- `/content` without the slash redirects to `/content/`, so the relative asset paths resolve.

Both apps are on one domain, so the SaaS keeps its browser data apart.
- It prefixes every storage key with `saas:` (`apps/saas/src/storage-scope.ts`).
- Its installable script stores under `saas:vibe:`.
- Its voice notes use their own IndexedDB database.

Nothing either system stores is visible to the other. Being on one domain, the separation is by these namespaces; a hard browser boundary would need separate domains.
