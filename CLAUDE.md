# Vibe coding monorepo — notes for Claude

`AGENTS.md` is the short version of these rules for any AI agent (Cursor, Codex, Copilot, Gemini…). Keep both in step when a rule changes.

- **Role (the owner asked for this, always):** work as head of design, head of product, head of engineering and head of marketing at once. Judge every change for UX, product value, engineering quality and how it sells; say so when a request has a better alternative, and give a recommendation, not only options.

- **Handoff (the owner asked for this, always):** after every task, update `docs/HANDOFF.md` (Bahasa Indonesia): add a dated entry to its change log, update the owner checklist (SQL files to run in order, settings, secrets, what is unverified) and the decisions. A task isn't finished until the handoff says what changed and what the owner must do.

- **Layout:** three separate systems, one Vercel deployment (root `vercel.json`, README "Vercel").
  - `apps/landing`: the website, the site's front page at `/` (built into `dist/landing`; the root build copies its `index.html` to `dist/index.html`, so its base is `/landing/`). Its page forwards old app addresses (`/#/…`, `/?code=…`) to `/app`. Every claim on it must match `apps/saas/src/saas/products.ts`.
  - `apps/saas`: ourhunch, the product. Its page is `app.html`, served at `/app` (panel at `/app#/app`); its public files stay at the root: `/embed/vibe.js` (customers' snippets: never move it), `/embed-demo.html`. Old `/saas/…` addresses redirect to the root.
  - `apps/content`: the content site at `/content/`.
  - Paths below are relative to an app (`src/...` means `apps/<app>/src/...`).
- **Nothing is shared.**
  - Code: each app has its own copy of everything, including `src/core` (the embed widget and its `Backend` interface, the heatmap renderer, the eye-movement analysis).
  - Dependencies: each app has its own `package.json`, lockfile and `node_modules`; there are no workspaces.
  - Data: the SaaS keeps its own browser data, with storage prefixed `saas:` by `src/storage-scope.ts` (it must stay main.tsx's first import), its script under `saas:vibe:`, and its own voice IndexedDB.
  - Never add a shared package or a cross-app import.
- When the owner asks for a change, make it in the system they mean; if unclear, ask. Bringing a feature to the other system is a separate, deliberate copy.
- Everything built before the split (embed, landing, panel, research tools) is part of the SaaS too; the owner wants it there.
- Before pushing: `npm run typecheck && npm run build` at the root must pass (after `npm run install:all`).
- **Scale rules (SaaS):** Supabase returns at most 1,000 rows per request: any list that can be longer is read with `paged()` in `src/saas/cloud.ts`, with a stable order. Lists sent to the widget are bounded in SQL (`list_threads`: the 1,000 newest). Polling only while the tab is visible. New tables get an index for every query that filters them by project.
- **Analytics:** PostHog on the website (`apps/landing/src/analytics.ts`) and the app at `/app` (`apps/saas/src/lib/analytics.ts`), only when `VITE_POSTHOG_KEY` is set. Never in the script on customers' sites, never autocapture or session recording, never comment text, field values, emails or names; named funnel events only (object_action, snake_case; list and PostHog setup in `docs/POSTHOG.md`). Identify by account id only, with safe person properties (plan, signup method, created_at, counts, product ids) and the `workspace` group by id.
- **Email (SaaS):** feedback notifications go triggers → `email_outbox` → pg_cron → Edge Function `supabase/functions/send-emails` (Resend). Lifecycle emails (welcome, day 1/3/7) and the weekly summary come from the same function (`email_lifecycle_due`, `email_weekly_due`, logged once per kind in `email_sent`); lifecycle only while the user's `email_prefs.marketing` is on, never to anonymous accounts, always with a one-click unsubscribe. The outbox, the prefs/sent tables and every `email_*` function except `email_prefs_get/set` are service-role only; secrets live in Supabase only; all copy is rendered in `send-emails/render.ts` (previews: `docs/email-previews/`). Setup in `apps/saas/supabase/README.md`.
- **Ops panel (SaaS, `/app#/admin`):** founder only; admins exist only in `platform_admins` (added by hand in SQL); every read/write goes through admin-checked `security definer` `ops_*` functions with a pinned search path, writes logged in `ops_audit`; its own sign-in page and session (sessionStorage), never linked from the panel; non-admins are refused like a wrong password; no comment text, no PostHog. Its widget state (none / installed / in use / inactive, 14 days) comes from `_ops_project_usage`.
- **Billing (SaaS):** ready but OFF (`docs/BILLING.md`): Paddle (merchant of record) behind the `BillingProvider` interface in `supabase/functions/billing/`; only the webhook writes `subscriptions`; limits apply only while `app_settings.billing_enabled` is on, and never delete data (sites beyond the plan stop collecting new comments). While off, the UI says "Free during the beta" and nothing claims billing exists.
- **Security:** `docs/SECURITY.md`. Every Vite config keeps `sourcemap: false`; never commit or paste secrets; the repository should be private (owner action).
- **Two download areas (SaaS):** `src/App.tsx` loads `HostedApp.tsx` (website pages, sign-in, panel) or `DemoApp.tsx` (demo shop, research console, its tools) by address. The demo loads only on its explicit paths (`isDemo`: `#/shop`, `#/search`, `#/product/…`, `#/cart`, `#/checkout`, `#/orders`, `#/console/…`), never linked from the product; the empty hash and unknown addresses go to the hosted product (`#/app`, whose guards send signed-out people to log in). Never import demo or console code into hosted pages.

## Each app

- Two parts, kept apart: the product (lo-fi grey-wireframe AI marketplace, buyer side only, `src/pages/shop`, `src/components/Layout.tsx`) and the UX research tools (`src/tools`, research console pages in `src/pages`, the dock). Never link research tools from the product's navigation.
- Third part: the installable collaboration script (`src/core/embed/`; install page `src/pages/Install.tsx`; demo `public/embed-demo.html`). In the SaaS it is two files: the small loader `dist/embed/vibe.js` (`main.ts`, `vite.embed.config.ts`, no React) and the widget `dist/embed/vibe-app.js` (`app.tsx`, `vite.embed-app.config.ts`), which the loader adds only for browsers that need it (README "Build"). Keep the loader small: no React and no UI in it. The content site keeps its single `vibe.js`. It runs on other people's sites: keep it in its shadow root, never read the host's field values, and store data only through the `Backend` interface in `src/core/embed/store.ts`.
- Fourth part (SaaS): the hosted product's pages (`/app`: sign-in, the user panel `#/app/*`, share links, guide and legal; `src/pages/saas/`, data in `src/saas/`; the website itself is `apps/landing`). Its own look (`src/saas/saas.css`, scoped under `.lp`/`.up`); research tools are not mounted there. No server yet: say so wherever it matters (account, invites, domains, inbox), and never claim a product runs in the script unless its status is 'script'.
  - Signing in, SaaS only (`src/pages/saas/Auth.tsx`, `AuthCloud.tsx`, `Onboarding.tsx`): register → onboarding → panel, plus login, forgot and reset password. "Continue with Google" (server mode only) shows only while Google is on in Supabase (`googleOn()` in `src/saas/supabase.ts`); setup in `apps/saas/supabase/README.md` step 4b.
  - It is local to the browser: passwords only as a PBKDF2 hash, no email sent (forgot password shows a labelled demo inbox).
  - The panel's guards: no account → register, signed out → login, not onboarded → onboarding.
  - The SaaS script's behaviour is the project's published widget configuration (`src/core/embed/config.ts`, built in `#/app/widget`): data only, validated, versioned, with rollback.
    - The snippet carries only `data-project`. Never add options back to the snippet.
    - Default audience is reviewers only (review link with a one-time token).
    - Anything that needs the server (review links or previews on a customer's own domain, install checks there) must say so in the UI.
- SaaS backend: Supabase, in `apps/saas/supabase` (migrations, row level security tests, setup in its README).
  - The panel uses it when the build has a project (`src/saas/supabase.ts`, `cloud.ts`, `AuthCloud.tsx`), otherwise the browser demo.
  - The script uses it too when its project has a published file on the CDN (`src/core/embed/server.ts`).
    - Reviewers: anonymous sessions after a review link.
    - Comments: through the database functions in `supabase/migrations/…_reviewers.sql`, which check origin, reviewer and rate limits.
  - Keep both modes working; text that says "no server" must depend on the mode.
  - Every table has row level security and no anon access.
  - The script's traffic goes through Edge Functions; widget configuration is a CDN file, never a database read per page view. That file is public: no site names (hashed by `publicConfig`), no people's names.
  - Keep `supabase/tests/run.sh` passing.
  - Never put the service role key or database password in the app, the repository or chat.
  - Dashboard (`#/app`, `Dashboard.tsx`): numbers from `project_stats` on the server, from this browser in the demo.
  - Share links for the comment list: `#/share/<token>`, read-only, no account; revocable on the server, the list inside the link in the demo.
  - Clearing data: Settings → Data, after typing the project id.
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
