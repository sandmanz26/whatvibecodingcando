# Vibe coding: three separate systems in one repository

| Path | System | Run / build |
|---|---|---|
| `apps/content` | **The content site.** The AI marketplace prototype, with the research dock and console used to show what vibe coding can do. It also has a copy of the SaaS website, panel and script. | `npm run dev` · `npm run build:content` → `dist/content` (served at `/content/`) |
| `apps/saas` | **ourhunch, the SaaS.** Its page is `app.html`, served at `/app`: with sign-up, the user panel, the install page, the script and every research tool built so far. React + Vite for now; backend later. | `npm run dev:saas` · `npm run build:saas` → the root of `dist` (served at `/`) |
| `apps/landing` | **The website**, the site's front page at `/`. Standalone, front end only, English. It explains the problem ourhunch solves and links to the product at `/app`. | `npm run dev:landing` · `npm run build:landing` → `dist/landing` (served at `/landing/`) |

**The three are separate systems.**
- **Code.** Each has its own code (including its own copy of the script, the heatmap renderer and the eye-movement analysis, in `src/core`).
- **Dependencies.** Each has its own `package.json`, lockfile and `node_modules`.
- **Data.** Each keeps its own browser data.

A change in one never reaches the other. To bring something across, copy it on purpose.

- **First time:** `npm run install:all`, which installs each app's own dependencies.
- **Checks:** `npm run typecheck` and `npm run build` (all three apps).
- **Claude Code plugin:** the `ux-research-kit` plugin stays at the root (`.claude-plugin/`, `plugins/`).

AI agents: start with `AGENTS.md`. Product, testing, security and marketing documents: `docs/`.

Each app's documentation is in its own README (`apps/content/README.md`, `apps/saas/README.md`, `apps/landing/README.md`).

## Vercel: one deployment, three apps

Only `main` is built: `ignoreCommand` in `vercel.json` skips every other branch, so working branches never use the Hobby plan's daily deployment quota. If a push to `main` doesn't show up in Vercel, create the deployment by hand (Deployments → ⋯ → Create Deployment → `main`).

One Vercel project serves all three apps. `vercel.json` at the root sets the install (`npm run install:all`: each app installs its own dependencies), the build (`npm run build`, which builds both apps) and the output (`dist`), so nothing needs configuring in Vercel.

| URL | App | Built into |
|---|---|---|
| `/` | the website (`apps/landing`) | `dist/landing`; the root build copies its `index.html` to `dist/index.html` |
| `/app` | the SaaS: sign-up, the user panel (`/app#/app`), share links, guide and legal pages, and the demo shop and console | `dist/app.html` and `dist/assets`, rewritten from `/app` |
| `/embed/…`, `/embed-demo.html` | the SaaS's installable script and its demo site (unchanged addresses: customers' snippets point here) | the root of `dist` |
| `/#/…`, `/?code=…` | old SaaS addresses (panel, share links, sign-in returns from emails): the website's page forwards them to `/app` with the hash and query | — |
| `/landing/`, `/app/`, `/app.html` | redirect to `/`, `/app`, `/app` | — |
| `/content/` | the content site | `dist/content` |
| `/saas/…` | old addresses: redirect to the same path at the root. This includes `/saas/embed/vibe.js`, so snippets installed before the move keep working; the hash, such as `#/app`, is kept. | — |
| `/content/__reset` (and `/__reset`) | the content site's hidden "reset everything" page; `/content/__reset` is rewritten to the content app | `dist/content` |

Live at `https://whatvibecodingcando.vercel.app/`.
- **Build.** `npm run build` empties `dist` once, builds the content site into `dist/content`, the SaaS into the root of `dist` (its build doesn't empty `dist`) and the website into `dist/landing`, then copies the website's page to `dist/index.html`.
- **Headers** (`vercel.json`): HSTS, `nosniff`, a referrer policy everywhere; pages can't be framed by other sites (`frame-ancestors 'self'`), except `/embed/*`, which customers' sites load (CORS, short cache); hashed assets are cached for a year.
- **Locally.** `npm run build && npm run preview` serves `dist` at `http://localhost:4173/`: the website at `/`, the SaaS at `/app.html` (the `/app` rewrite is Vercel's), the content site at `/content/`.
- `/content` without the slash redirects to `/content/`, so the relative asset paths resolve.

Both apps are on one domain, so the SaaS keeps its browser data apart.
- It prefixes every storage key with `saas:` (`apps/saas/src/storage-scope.ts`).
- Its installable script stores under `saas:vibe:`.
- Its voice notes use their own IndexedDB database.

Nothing either system stores is visible to the other. Being on one domain, the separation is by these namespaces; a hard browser boundary would need separate domains.
