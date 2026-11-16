# Landing page (apps/landing)

The standalone landing page for Vibe Collab, made for the proposal. React + Vite, front end only, no backend, English only. Served at `/landing/` (built into `dist/landing`).

- **Run:** `npm run dev:landing` at the root, or `npm run dev` here.
- **Nothing is shared.** Own `package.json`, lockfile and `node_modules`; no imports from `apps/saas` or `apps/content`. Links to the product are absolute (`LINKS` in `src/content.ts`).

## The story, top to bottom

| Sheet | What the visitor learns |
|---|---|
| Start | The thesis: AI output always *looks* finished. The headline is reviewed live to show the product in five seconds. |
| The problem | Six problems, each named by the sentence people say when it happens, with what it costs. One cause: the review happens somewhere other than the product. |
| The layer | One script tag. Three layers over the live site (Feedback, Research, Design QA); each says which problems it answers and which tools it has. |
| The loop | Paste, send a link, review, copy the fix as a prompt, ship again. |
| Try it | The page itself can be commented on (press C). Notes stay in memory; nothing is stored or sent. |
| The spec | Why it is safe on a real site, as facts. |
| Pricing | Free, and Pro at $2 a site; free during the beta. |

## Rules

- All copy is in `src/content.ts`. No invented customers, numbers or testimonials. A product claim must match `apps/saas/src/saas/products.ts` and the SaaS README.
- Look (`src/styles.css`): cobalt blueprint = the product, marker yellow = the review, heat orange only for pins and heatmaps. Type: Archivo (wide, heavy) for display and body, Shantell Sans for what people say, Martian Mono for labels.
- Keep it working at phone width, with keyboard focus visible and reduced motion respected.
