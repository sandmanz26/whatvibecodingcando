# AGENTS.md — guide for AI coding agents (and new developers)

Read this first, then `CLAUDE.md` (the full list of house rules — it applies to every agent, not only Claude). Keep both files in step when a rule changes.

**Handoff:** after every task, update `docs/HANDOFF.md` (change log + owner checklist + decisions, in Bahasa Indonesia). It is the first file to read for the current state.

## What this is

**ourhunch**: one script tag puts pinned comments, voice notes and user tests (usability tasks, 5-second tests, click heatmaps, webcam eye tracking marked Labs) on any website. Clients review from a one-time link without an account. Pricing: Free (1 site) and Pro at $4.80 per site per month, no seats, unlimited reviewers (founding price $2 per site, locked for the first 200 customers; free during the beta; no billing yet). Owner: a solo founder in Indonesia; talk to them in **Bahasa Indonesia**, keep all product UI and code in **English**.

Live: `https://whatvibecodingcando.vercel.app/` (website) · `/app` (sign-in and panel) · `/embed/vibe.js` (customers' snippet — never move it).

## Repository map

| Path | What | Docs |
|---|---|---|
| `apps/landing` | The website at `/` (React + Vite, prerendered at build for SEO, PostHog analytics) | `apps/landing/README.md` |
| `apps/saas` | The product: app at `/app` (`app.html`), the installable script (`src/core/embed`), the demo shop and research console | `apps/saas/README.md` |
| `apps/saas/supabase` | Backend: migrations (run in order), SQL tests, Edge Function `send-emails` | `apps/saas/supabase/README.md` |
| `apps/content` | A separate content site at `/content/` | `apps/content/README.md` |
| `docs/` | Product analysis, manual testing, security, marketing kit | `docs/README.md` |
| `vercel.json`, `package.json` (root) | One deployment for all apps: routes, redirects, headers, build | `README.md` ("Vercel") |

**Nothing is shared between apps:** each has its own code, `package.json`, lockfile and `node_modules`. Never add a shared package or a cross-app import.

## Commands

```bash
npm run install:all                 # each app's own dependencies
npm run typecheck && npm run build  # must pass before every push
npm run preview                     # dist at http://localhost:4173/ (website) and /app.html (app)
cd apps/saas/supabase && bash tests/run.sh   # SQL tests (needs a local PostgreSQL 16; see that README)
cd apps/saas && npx esbuild supabase/functions/send-emails/test.ts --bundle --platform=node --format=esm --outfile=/tmp/se.mjs && node /tmp/se.mjs
```

## Rules that matter most

- **Billing (SaaS):** ready but OFF (`docs/BILLING.md`): Paddle (merchant of record) behind the `BillingProvider` interface in `supabase/functions/billing/`; only the webhook writes `subscriptions`; limits apply only while `app_settings.billing_enabled` is on, and never delete data (sites beyond the plan stop collecting new comments). While off, the UI says "Free during the beta" and nothing claims billing exists.
1. **Security** (`docs/SECURITY.md`): never put the Supabase service role key, database password, Resend key, email cron secret or Turnstile secret in the code, the repository or a chat. Row level security on every table, no anon access; writes go through SQL functions that check origin, reviewer and rate limits. No source maps. Internal ops (`/app#/admin`): admins only via `platform_admins` (by hand in SQL), all data through admin-checked `security definer` `ops_*` functions, writes audited; own sign-in at `/app#/admin`, never linked from the panel.
2. **Database changes** = a new file in `apps/saas/supabase/migrations/` (timestamped, never edit an applied one) + a test in `supabase/tests/`. The owner runs migrations by hand in the Supabase SQL Editor: give them the SQL and say so.
3. **Scale:** Supabase returns at most 1,000 rows per request — read longer lists with `paged()` (`apps/saas/src/saas/cloud.ts`); bound lists in SQL; index every query filtered by project; poll only while the tab is visible.
4. **The embed script** runs on customers' sites: keep the loader (`src/core/embed/main.ts`) tiny with no React; keep the widget in its shadow root; never read form values; never add analytics to it; the snippet carries only `data-project`.
5. **Two areas in `/app`:** the demo shop and research console load only on their explicit paths (`isDemo` in `apps/saas/src/App.tsx`); the empty hash and unknown addresses open the hosted product (`#/app`). Never link the demo from the product.
6. **Two modes:** the app works with a Supabase project in the build (server) and without one (browser-only demo). Keep both working; text that mentions "no server" must depend on the mode.
7. **Honesty:** no invented customers, numbers, testimonials or ratings; never claim a feature that isn't built (product list: `apps/saas/src/saas/products.ts`).
8. **Analytics (PostHog):** website and `/app` only, named funnel events only, no autocapture or recordings, no names, emails or comment text; identify by account id, safe person/workspace-group properties only (`docs/POSTHOG.md`).
9. **Git:** push finished work to `main` (and the working branch if any). No pull requests unless the owner asks.

## Systems at a glance

- **Auth & data:** Supabase (Postgres + Auth + Storage). Sign-in: email + password, and Google when it is enabled in Supabase (the button appears by itself). Panel code in `apps/saas/src/saas/` (`cloud.ts`, `supabase.ts`), pages in `apps/saas/src/pages/saas/`.
- **Widget settings:** a versioned, validated file on Supabase Storage (CDN), edited in the panel's *Widget* page ("Update site"), with history and restore.
- **Email:** activity notifications via triggers → `email_outbox` → pg_cron → Edge Function `send-emails` → Resend; lifecycle emails (welcome, day 1/3/7, opt-out "Tips and product updates" with one-click unsubscribe) and a Monday summary from the same function. Auth emails via Supabase SMTP (Resend) with the templates in `apps/saas/supabase/email-templates/`. Previews: `docs/email-previews/`. Setup: `apps/saas/supabase/README.md` → "Email notifications".
- **Analytics:** PostHog, enabled by `VITE_POSTHOG_KEY` in Vercel.
- **SEO:** the website is prerendered (`apps/landing/prerender.mjs`); `VITE_SITE_URL` sets the canonical domain.

## Before you finish a task

- `npm run typecheck && npm run build` pass; SQL tests pass if you touched SQL.
- Docs updated where behaviour changed (the app's README, `docs/TESTING.md` for anything users can click, this file and `CLAUDE.md` for new rules).
- Tell the owner, in Bahasa Indonesia, what changed, what they must do (SQL to run, settings to change), and what you couldn't verify.
