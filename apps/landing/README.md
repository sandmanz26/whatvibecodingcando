# Landing page (apps/landing)

Folder for the marketing landing page of Vibe Collab. Scaffold only: the brief is still to come.

## Rules from the repository (CLAUDE.md)

- Nothing is shared: this folder gets its own code, `package.json`, lockfile and `node_modules` when it needs them. No imports from `apps/saas` or `apps/content`, no workspaces.
- Not wired into the root `build`, `typecheck`, `install:all` or `vercel.json` yet. Decide where it is served first (see below).
- Never claim a product runs in the script unless its status is `script`; say "no server" only where it is true.

## Reference (read, do not import)

- Current website: `apps/saas/src/pages/saas/Landing.tsx` (`#/landingpage`), styles in `apps/saas/src/saas/saas.css` (scoped under `.lp`).
- Look today: warm paper `#f6f2ea`, ink `#16130f`, accent orange `#e8590c`, Inter, 1.5px ink borders with hard offset shadows, lo-fi wireframe hero.
- Products and honest status: `apps/saas/src/saas/products.ts`. Pricing: Free, Pro $2 / site / month (Rp 29.000 in Indonesia), free during the beta.
