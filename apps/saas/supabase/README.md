# Vibe Collab backend (Supabase)

The SaaS's backend, in this app only (`apps/saas/supabase`).

- **The panel** uses it for:
  - accounts: register with email confirmation, login, forgot and reset password;
  - workspaces, projects, invites and reviewers;
  - widget settings: draft, publish and releases, and the published file on Storage;
  - the comment inbox and the installation check.
- **The script** on customers' sites uses it for:
  - settings: the published file on Storage (CDN), cached in the browser five minutes;
  - reviewer sessions: anonymous sign-in, only after a review link;
  - comments, through database functions;
  - the installation check, sampled.

## What is here

- **`migrations/20261109000000_init.sql`**: the first schema.
  - **Tables:**
    - workspaces and members (roles owner/admin/member);
    - projects (`public_id` is the snippet's `data-project`, unique and fixed);
    - widget releases;
    - invites;
    - one-time review tokens (stored as SHA-256 only);
    - comment threads and replies;
    - installation reports;
    - rate-limit counters.
  - **Row level security:** on every table.
    - The panel's signed-in users reach only their own workspace's rows.
    - Anonymous access (the public anon key) is refused everywhere.
    - Releases and review tokens are written only by Edge Functions (service role).
  - **Data checks repeat the script's own rules:** pages must stay on the site, selectors are at most 400 characters, text at most 4,000.
- **`migrations/20261109010000_publish.sql`**: publishing from the panel.
  - Members insert releases for their own projects (never edit them).
  - A public Storage bucket `widget-config`, holding small JSON files only.
  - Only a project's members may write its file `widget-config/<public_id>.json`.
- **`migrations/20261110000000_reviewers.sql`**: reviewers and comments from customers' sites.
  - **Review links:** `create_review_link`, members only. One-time links last 2 minutes; invites last 1–30 days and work on up to 5 devices. Only a SHA-256 of the token is stored.
  - **Reviewers:** an anonymous Supabase session per browser, traded for a `reviewers` row by `start_review`.
  - **Functions for the script:** `list_threads`, `post_thread`, `post_reply`, `edit_thread`, `set_resolved`, `delete_thread`, `delete_reply`, `set_reviewer_name`, `get_draft` (preview only) and `report_seen`.
  - **Every function checks**, in order:
    - the project exists;
    - the request's `Origin` is one of the project's environments that are switched on (or `allowed_origins`, the hosted demo);
    - the widget is on;
    - the caller is a reviewer;
    - a per-person rate limit.
  - **Rights:** only authors edit or delete their comments and replies; any reviewer completes or reopens.
  - **Anonymous sessions** can't create workspaces.
  - **`delete_my_account`** removes the login, the workspaces it owns, their projects and comments.
  - **Housekeeping:** an hourly `pg_cron` job clears old rate-limit counters and expired links, when the extension is available.
- **`migrations/20261111000000_dashboard_share.sql`**: the dashboard, clearing data, and share links.
  - **`project_stats`** returns the dashboard's numbers in one call: status counts, replies, reviewers, 14 days of activity, top pages, sites.
  - **Clearing data:** members may delete installation reports; `revoke_review_links` revokes the project's review links.
  - **Share links (`shares`):** `create_share` is for members; only a SHA-256 of the token is stored, with a filter (all, open, completed), an expiry and a revoke date. `get_share` works without an account, is read-only and rate limited, and counts views.
- **`migrations/20261112000000_install_reports.sql`**: installation reports only from a project's own sites.
  - `report_seen` records a site only when the request comes from one of the project's environments (on or off) or the hosted demo site; made-up origins are dropped.
  - At most 20 sites per project, and 120 reports a minute per project. Reports already recorded from other places are deleted.
- **`tests/`**: the row level security tests. Two customers and a stranger try to read, change, join or take over each other's data; anon tries to read; bad data is refused.
  - Run them on any local Postgres: `PGHOST=… PGPORT=… PGUSER=… tests/run.sh`.
  - `supabase_stub.sql` stands in for Supabase's `auth` schema and roles.

## Setting up the Supabase project (owner, once)

1. **Plan and region.** Pro (Free pauses when idle and has no daily backups). Region Southeast Asia (Singapore) for users in Indonesia.
2. **Run the migrations, in order.** SQL Editor → paste each file in `migrations/` (oldest first) → Run. Or with the Supabase CLI: `supabase link --project-ref <ref>`, then `supabase db push`.
3. **Auth → URL Configuration.**
   - Site URL: `https://whatvibecodingcando.vercel.app/`.
   - Redirect URLs: `https://whatvibecodingcando.vercel.app/**` and `http://localhost:5174/**` for development.
4. **Auth → Sign In / Providers → allow anonymous sign-ins.** Reviewers on customers' sites need it (they have no account). Turning on CAPTCHA protection (Turnstile) as well is recommended before opening to the public.
5. **Database → Extensions → pg_cron** (optional, before running the third migration): enables the hourly cleanup.
6. **Auth → SMTP.** Use your own provider (Resend, Postmark, SES). Supabase's built-in email is limited to a few messages an hour, which isn't enough for sign-up, invites and password resets.
7. **Auth → Email Templates.** So links work on any device (the default links only work in the browser that asked), set the link in two templates. Keep the rest of the text as you like.
   - **Confirm signup:** `<a href="https://whatvibecodingcando.vercel.app/#/app/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>`
   - **Reset Password:** `<a href="https://whatvibecodingcando.vercel.app/#/app/confirm?token_hash={{ .TokenHash }}&type=recovery">Set a new password</a>`
   - The default `{{ .ConfirmationURL }}` links also work, but only when opened in the same browser (they come back as `/?auth=…&code=…`).
8. **Keys.**
   - The project URL and the anon (publishable) key are public by design and go into the app's build.
     - Set them as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Vercel, or connect Vercel's Supabase integration: the build also reads its `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_…` names (`apps/saas/vite.config.ts`).
     - The build log says `[supabase] connected: <url>` or `not configured`.
     - The build refuses to run if the browser key is a service role or secret key.
   - The service role key and the database password never go into the app, the repository or a chat. Only the Edge Functions use the service role.

## Tests

- `tests/run.sh` runs every `*_test.sql` on a fresh database: `rls_test.sql` (row level security), `rpc_test.sql` (review links, comments, origins, rate limits, deleting an account), `share_test.sql` (dashboard, clearing data, share links) and `install_test.sql` (installation reports).
- The full path (panel → invite link → reviewer on another domain → comment in the database → panel inbox, plus kill switch, preview and delete account) was checked in a browser against these migrations on Postgres 16. It is not in CI yet.

## Not done yet (before a public launch)

- **Emails:** invite emails to reviewers and notifications of new comments. Today the owner copies the link and sends it.
- **CAPTCHA** on anonymous sign-ins and sign-up.
- **Reviewer sessions** are kept in the customer site's storage. Move them into an iframe on our domain before "everyone" mode is used widely.
- **CI** running these tests on every push.

## Rules for later migrations

- Enable row level security on every new table, and add policies for the panel only.
- Repeat `revoke all on all tables in schema public from anon`: Supabase grants new tables to anon by default.
- Add the new table's cases to `tests/rls_test.sql` and keep `tests/run.sh` passing.
