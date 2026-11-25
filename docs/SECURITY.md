# Security & protection against reverse engineering

*For the owner and for any AI or developer working on this repository. Last reviewed 26 November 2026 (full audit: `docs/SECURITY-AUDIT-2026-11.md`).*

## The honest rule

Code that runs in a browser can always be read: the browser has to receive it to run it. Minifying or obfuscating only slows people down. So protection here is in layers, strongest first:

1. **Nothing secret or decisive runs in the browser.** Access rules, limits and every write live on the server (Postgres row level security and SQL functions). Copying the front end gives someone a UI that can't do anything without our server.
2. **The repository is private** (see "Owner actions" — it is public today).
3. **Legal protection:** `LICENSE` (all rights reserved, no reverse engineering) and the terms of use.
4. **Builds publish as little as possible:** minified bundles, no source maps, no secrets, no internal notes.
5. **Abuse limits:** rate limits in SQL, CAPTCHA (Turnstile) once its keys are set, one-time review links.

## What is public on purpose (and why that's fine)

| Public | Why it's safe |
|---|---|
| The JavaScript bundles (website, app, `/embed/vibe.js`, `/embed/vibe-app.js`) | Minified, no source maps; they hold no secrets and no rules that matter — the server enforces everything. |
| The Supabase URL and **publishable (anon) key** in the app | Designed to be public. They only reach what row level security and granted SQL functions allow; anon has no table access at all. The build refuses a service-role or secret key. |
| The widget's settings file on the CDN (`widget-config/<project>.json`) | Read by every page view, so it's public by necessity: no site names (hosts are hashed) and no people's names. |
| SQL function names visible in network requests | Every function checks the caller, the project's origin, the reviewer and rate limits; tests in `apps/saas/supabase/tests` try to break them. |

## What must never be public

- The Supabase **service role key**, the **database password**, the **Resend API key**, **`EMAIL_CRON_SECRET`**, the Turnstile **secret** key, a PostHog **personal** API key (`phx_…`). They live only in Supabase (Edge Function secrets, Auth settings) or Vercel environment variables — never in the repository, the app, a chat or a screenshot.
- Source maps (`*.map`). Every Vite config pins `build.sourcemap: false`.

## Already in place

- Row level security on every table, no anon access; writes through SQL functions that check origin, reviewer and rate limits; tests in `supabase/tests/run.sh`.
- Review links are one-time tokens in the URL hash (never sent to servers in requests, removed from the address at once).
- The widget lives in a shadow root, never reads form values, scrubs emails/phone numbers from labels, honours `data-private`.
- Security headers (`vercel.json`): HSTS, `nosniff`, referrer policy, permissions policy, `X-Frame-Options: SAMEORIGIN` and `Cross-Origin-Opener-Policy` on our pages (not on `/embed/`, which customers load), `X-Robots-Tag: noindex` on `/app`.
- **Content-Security-Policy** on every page of ours: `default-src 'self'`, scripts only from us, Turnstile and PostHog's assets, inline scripts only by SHA-256 hash, `connect-src` only our Supabase project, PostHog and the MediaPipe model, `frame-ancestors 'self'`, `object-src 'none'`. `/embed/session.html` has its own strict policy (`default-src 'none'`). Changing an inline `<script>` changes its hash: `scripts/check-csp.mjs` (end of `npm run build`) fails the build and prints the new hash to put in `vercel.json`. A new Supabase project or PostHog host must be added to `connect-src` there.
- Builds: no source maps, `debugger` and `console.log/debug/info` dropped, no licence banners (`esbuild` options in every Vite config), lazy chunks of `/app` named by hash only.
- Database privileges: `anon`/`authenticated` never hold `TRUNCATE`/`TRIGGER`/`REFERENCES`, anon holds no table rights (also by default for new objects), trigger functions aren't callable; `supabase/tests/security_hardening_test.sql` enforces this plus RLS on every table and a pinned search path on every `security definer` function.
- URLs from stored data reach `href`/`window.open` only if they are `http(s)` (`src/saas/safe-url.ts`; the database also checks `site_url`).
- CSV exports keep cells that start with `= + - @` as text (no spreadsheet formula injection).
- Internal ops panel: admins only in `platform_admins` (added by hand in the SQL Editor), every ops function is `security definer` with a pinned search path, refuses non-admins, is not callable by anon, and plan changes are logged in `ops_audit`.
- Email notifications: the outbox, `email_prefs`, `email_sent`, `email_once` and their functions (`email_due`, `email_done`, `email_lifecycle_due`, `email_weekly_due`, `email_sent_mark`, `email_unsubscribe`) are for the service role only; the Edge Function checks its own secret in constant time. Users change only their own tips preference through `email_prefs_get`/`email_prefs_set` (anonymous reviewers refused). The unsubscribe link carries a random 64-hex token per user that can only turn tips off. Email secrets (`RESEND_API_KEY`, `EMAIL_CRON_SECRET`, `EMAIL_POSTAL_ADDRESS`, …) live only in Supabase.
- Dependency audit: `npm audit --omit=dev` in each app.

## Owner actions (only the owner can do these)

1. **Make the GitHub repository private.** GitHub → the repository → **Settings → General → Danger Zone → Change repository visibility → Make private**. Vercel keeps deploying (its GitHub app has access); nothing in the product changes. *Today the repository is public: all source code, SQL and the business documents in `docs/` can be read by anyone.*
2. **Turn on CAPTCHA** (Turnstile) — `apps/saas/supabase/README.md` step 4, in the order written there.
3. **Rotate any key that was ever pasted into a chat, a screenshot or a commit.**
4. Optional: turn on GitHub **secret scanning** and **Dependabot alerts** (Settings → Code security).

## Not recommended

- **Obfuscating the bundles** (e.g. javascript-obfuscator): bigger and slower code (it would hurt customers' sites through `/embed/`), harder debugging, and it still doesn't stop a determined person. The server-side rules above are the real protection.
- **Blocking right-click / devtools:** annoys users, stops no one.

## Reporting a security problem

Email the owner (address in the privacy policy) with the steps to reproduce. Don't test against other people's projects.
