# Vibe coding monorepo — notes for Claude

- **Layout:** two separate systems. `apps/content` (the content site, served at `/content/`) and `apps/saas` (Vibe Collab, the SaaS, served at `/saas/`, opening on its website). One Vercel deployment builds both into `dist/content` and `dist/saas` (root `vercel.json`). Paths below are relative to an app (`src/...` means `apps/<app>/src/...`).
- **Nothing is shared.**
  - Code: each app has its own copy of everything, including `src/core` (the embed widget and its `Backend` interface, the heatmap renderer, the eye-movement analysis).
  - Dependencies: each app has its own `package.json`, lockfile and `node_modules`; there are no workspaces.
  - Data: the SaaS keeps its own browser data, with storage prefixed `saas:` by `src/storage-scope.ts` (it must stay main.tsx's first import), its script under `saas:vibe:`, and its own voice IndexedDB.
  - Never add a shared package or a cross-app import.
- When the owner asks for a change, make it in the system they mean; if unclear, ask. Bringing a feature to the other system is a separate, deliberate copy.
- Everything built before the split (embed, landing, panel, research tools) is part of the SaaS too; the owner wants it there.
- Before pushing: `npm run typecheck && npm run build` at the root must pass (after `npm run install:all`).

## Each app

- Two parts, kept apart: the product (lo-fi grey-wireframe AI marketplace, buyer side only, `src/pages/shop`, `src/components/Layout.tsx`) and the UX research tools (`src/tools`, research console pages in `src/pages`, the dock). Never link research tools from the product's navigation.
- Third part: the installable collaboration script (`src/core/embed/`, built to `dist/embed/vibe.js` by the app's `vite.embed.config.ts`; install page `src/pages/Install.tsx`; demo `public/embed-demo.html`). It runs on other people's sites: keep it in its shadow root, never read the host's field values, and store data only through the `Backend` interface in `src/core/embed/store.ts`.
- Fourth part: the hosted product's website (`#/landingpage`, `src/pages/saas/Landing.tsx`) and user panel (`#/app/*`, `src/pages/saas/`, data in `src/saas/`). Its own look (`src/saas/saas.css`, scoped under `.lp`/`.up`); research tools are not mounted there. No server yet: say so wherever it matters (account, invites, domains, inbox), and never claim a product runs in the script unless its status is 'script'.
  - Signing in, SaaS only (`src/pages/saas/Auth.tsx`, `Onboarding.tsx`): register → onboarding → panel, plus login, forgot and reset password.
  - It is local to the browser: passwords only as a PBKDF2 hash, no email sent (forgot password shows a labelled demo inbox).
  - The panel's guards: no account → register, signed out → login, not onboarded → onboarding.
  - The SaaS script's behaviour is the project's published widget configuration (`src/core/embed/config.ts`, built in `#/app/widget`): data only, validated, versioned, with rollback.
    - The snippet carries only `data-project`. Never add options back to the snippet.
    - Default audience is reviewers only (review link with a one-time token).
    - Anything that needs the server (review links or previews on a customer's own domain, install checks there) must say so in the UI.
- Content only: `__reset` (`/content/__reset` or `#/__reset`, `src/reset.tsx`) clears the content site's browser data, never `saas:` keys. Keep it unlinked.
- Frontend only (React + TypeScript + Vite). No backend: catalogue in `src/data/shop.ts`, simulated AI in `src/lib/ai.ts`, cart/orders in localStorage via `src/store/store.tsx`.
- **Git: always push finished work to `main`** (the owner asked for this explicitly). Push the working branch too if one is in use.
- The dock is what visitors see: Comment, All comments, Version, Compare, Design tokens, Inspect, Sessions, Heatmap (README "The dock"). Narration, theme, Prompts and console buttons are hidden on purpose; reach those pages by URL. Shop features ship per version in `src/lib/version.ts`; mark a feature's element with `featureMark()` so "what changed" can outline it. Comments carry the version they were made on.
- Eye tracking (webcam) belongs to usability tests: gaze samples carry the test run and task; fixations come from I-DT in `src/core/gaze-analysis.ts`. Video never leaves the browser and is never stored; only gaze points are kept.
- Start things from the dock on the shop's pages (heatmap tests, session recording, compare submit/review); result pages (`#/console/heatmap`, `/sessions`, `/compare`) only show and manage results — keep recording controls off them.
- The dock's Sessions and Heatmap menus show the latest 3 results, **See all** (opens in a new tab) and Start buttons, with no checkboxes.
  - Once a recording or task has started, the only action is **Stop**: the dock collapses to the recording bar, or is hidden behind the task bar.
  - Other tools and their shortcuts wait until it stops. Compare reviews have a status (pending/done), annotations and a decision; the dock badge counts pending ones.
- Research tools: read the README section "Research tools" before changing them. Never record typed text or field values; default for session recording stays OFF (dev and production) until the owner decides on consent; it only starts from the dock's Start.
