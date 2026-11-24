# ourhunch backend (Supabase)

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
- **`migrations/20261113000000_research.sql`**: research with participants who agreed.
  - **Tables:** `studies` (usability, 5-second, heatmap visit; a participant link stored as a SHA-256 only), `runs` (one participant, one study: per-task results, answers), `run_events` (clicks and pages: path without query, position, selector, a short label; rage and dead clicks). Members read and delete them; nobody else reads them.
  - **Participants** (anonymous sessions, after "I agree"): `study_info` (the consent screen, no session), `start_run`, `log_events` (200 per call, 5,000 per run, each value checked), `finish_run`. Each checks the link, that the study is open and not full, the Origin against the project's environments, and that the study's product is on (`_origin_ok`).
  - **Reviewers:** `heatmap_points` (clicks of a page, at most 20,000) for the script's Heatmap over the real page.
  - **Members:** `create_study_link` (a new link replaces the old) and `revoke_study_link`; members can't write a link hash themselves.
- **`migrations/20261114000000_review_kinds.sql`**: versions, component reviews and voice notes.
  - `threads` gains `kind` (comment, compare, voice), `version` (set by the server from the live settings when Versions is on) and `audio`.
  - A private bucket `narrations` (5 MB, audio only): only the project's reviewers upload, under `<public id>/<uuid>.<ext>`; members and reviewers listen; members and the author delete.
  - `post_thread` takes a kind and a voice note's audio (which must be the caller's own upload in the project); `versions_of` counts comments per version.
- **`migrations/20261115000000_heatmap_quality.sql`**: `heatmap_points` also returns, per point, a participant number (within the answer, no ids), the time in their run, their device and eye-tracking accuracy, for a better heatmap.
- **`migrations/20261116000000_comment_context.sql`**: `post_thread` records the site version whenever the published settings have one (no Versions module needed), and refuses an anchor that isn't a JSON object or is over 4,000 characters (it now carries the reviewer's browser and window size).
- **`migrations/20261120000000_scale.sql`**: indexes for large projects (participant paths, heatmaps, rate-limit cleanup), housekeeping without pg_cron (`take_rate` now and then clears old rate-limit rows and expired one-time links, in bounded batches), and `list_threads` returns the newest 1,000 comments.
- **`migrations/20261122000000_email.sql`**: email notifications. `projects.notify` ('instant' | 'daily' | 'off'), the `email_outbox` (filled by triggers on new comments and reviewers' replies; no access for anon or members), `email_due()` and `email_done()` for the service role only. Tested in `tests/email_test.sql`.
- **`migrations/20261124000000_review_rounds.sql`**: review rounds and approvals. `projects.rounds_on` / `rounds_included`, `review_rounds` (one open per project; members only), `round_approvals` (written only by `approve_round`, read by members), `threads.round_id` (set by a trigger; with rounds on and no round open, reviewers can't add comments, the team can: `reviewers.team`, set by `start_review` for one-time links), `current_round` / `approve_round` for the script, and approval emails (`email_outbox.approval_id`, `email_due` sends them with the next instant run unless notifications are off). Redeploy the Edge Function `send-emails` after it (new email). Tested in `tests/rounds_test.sql`.
- **`migrations/20261124150000_ops.sql`**: the internal ops panel (`/app#/ops`, founder only). `platform_admins` (written by hand only), `is_platform_admin()`, `account_plans` (plan labels, no billing; a user reads only their own row), `ops_audit`, and the admin-only functions `ops_overview`, `ops_signups_daily`, `ops_funnel`, `ops_users`, `ops_user_detail`, `ops_audit_recent`, `ops_set_plan`. Tested in `tests/ops_test.sql`. See "Internal ops panel" below.
- **`functions/send-emails/`**: the Edge Function that sends them with Resend (`index.ts`; templates in `render.ts`; mocked tests in `test.ts`).
- **`tests/`**: the row level security tests. Two customers and a stranger try to read, change, join or take over each other's data; anon tries to read; bad data is refused.
  - Run them on any local Postgres: `PGHOST=… PGPORT=… PGUSER=… tests/run.sh`.
  - `supabase_stub.sql` stands in for Supabase's `auth` schema and roles.

## Setting up the Supabase project (owner, once)

1. **Plan and region.** Pro (Free pauses when idle and has no daily backups). Region Southeast Asia (Singapore) for users in Indonesia.
2. **Run the migrations, in order.** SQL Editor → paste each file in `migrations/` (oldest first) → Run. Or with the Supabase CLI: `supabase link --project-ref <ref>`, then `supabase db push`.
3. **Auth → URL Configuration.**
   - Site URL: `https://whatvibecodingcando.vercel.app/app` (the app lives at `/app`; the website at `/` forwards old links there).
   - Redirect URLs: `https://whatvibecodingcando.vercel.app/**` and `http://localhost:5174/**` for development.
4. **Auth → Sign In / Providers → allow anonymous sign-ins.** Reviewers on customers' sites need it (they have no account). Also set **Auth → Rate Limits** for anonymous sign-ins (for example 30 an hour per IP).
   - **CAPTCHA (Cloudflare Turnstile), when you are ready.** It works for both the panel and reviewers, because reviewers sign in through our session frame (`/embed/session.html`) on our own domain, never on customers' sites. In this order:
     1. Cloudflare dashboard → Turnstile → Add widget. Hostname: `whatvibecodingcando.vercel.app` (and `localhost` for development). Mode: Managed. You get a **site key** (public) and a **secret key** (private).
     2. Vercel → the project → Settings → Environment Variables: `VITE_TURNSTILE_SITE_KEY` = the site key. Redeploy, and check the build log says `[captcha] Turnstile site key set`.
     3. Only then: Supabase → Authentication → Attack Protection → CAPTCHA protection → Turnstile, and paste the **secret key** there (only there: never in Vercel, the repository or a chat).
     - The other way round (CAPTCHA on in Supabase before the deployment sends tokens) locks out every sign-up, login and reviewer.
4b. **Continue with Google (optional).** The button on the login and register pages appears by itself once Google is on in Supabase (it reads the project's public Auth settings), so no new build is needed. Turn it off and the button disappears.
   1. Google Cloud Console → create a project → **Google Auth Platform** (OAuth consent screen): app name `ourhunch`, support email, logo, home page `https://ourhunch.com`, privacy policy `https://ourhunch.com/app#/privacy`, terms `https://ourhunch.com/app#/terms`, authorised domain `ourhunch.com`. Scopes: only `openid`, `email`, `profile` (no verification review needed for these). Audience: External; press **Publish app** so anyone can sign in (in Testing, only the test users you list can).
   2. **Clients → Create client → Web application.** Authorised JavaScript origins: `https://ourhunch.com`. Authorised redirect URI: the one Supabase shows on its Google provider page, `https://<project-ref>.supabase.co/auth/v1/callback`.
   3. Supabase → Authentication → Sign In / Providers → **Google** → enable, paste the **Client ID** and **Client secret** (the secret only there: never in Vercel, the repository or a chat) → Save.
   4. Auth → URL Configuration → Redirect URLs must include every address the app runs on (`https://ourhunch.com/**`, `https://whatvibecodingcando.vercel.app/**`): Google sends people back to the page they started on, as `/app?auth=oauth&code=…`.
   - A Google account with the same email as an existing email-and-password account is linked to it automatically (Google has verified the address). Someone who joined with Google can set a password later in Settings → Password.
5. **Database → Extensions → pg_cron** (optional, before running the third migration): enables the hourly cleanup.
6. **Auth → SMTP.** Use your own provider (Resend, Postmark, SES). With Resend: host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key, sender = an address on a domain verified in Resend. Supabase's built-in email is limited to a few messages an hour, which isn't enough for sign-up, invites and password resets.
7. **Auth → Email Templates.** So links work on any device (the default links only work in the browser that asked), set the link in two templates. Keep the rest of the text as you like.
   - **Confirm signup:** `<a href="https://whatvibecodingcando.vercel.app/app#/app/confirm?token_hash={{ .TokenHash }}&type=email">Confirm your email</a>`
   - **Reset Password:** `<a href="https://whatvibecodingcando.vercel.app/app#/app/confirm?token_hash={{ .TokenHash }}&type=recovery">Set a new password</a>`
   - The default `{{ .ConfirmationURL }}` links also work, but only when opened in the same browser (they come back as `/app?auth=…&code=…`; links already sent to `/` still work, the website forwards them).
8. **Keys.**
   - The project URL and the anon (publishable) key are public by design and go into the app's build.
     - Set them as `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in Vercel, or connect Vercel's Supabase integration: the build also reads its `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_…` names (`apps/saas/vite.config.ts`).
     - The build log says `[supabase] connected: <url>` or `not configured`.
     - The build refuses to run if the browser key is a service role or secret key.
   - The service role key and the database password never go into the app, the repository or a chat. Only the Edge Functions use the service role.

## Catching up a database that missed a migration

If the SQL Editor says `relation "public.runs" does not exist` (or `studies`, `run_events`), the research migration never ran there. Run **`catch-up/2026-11-22-research-scale-email.sql`** once (all of it, one Run): it applies, in order, research → heatmap_quality (restores the newer `heatmap_points`) → scale → email. It was tested on a copy of a database in exactly that state, and the result is identical to running every migration in order. Check afterwards:

```sql
select to_regclass('public.studies') is not null as studies, to_regclass('public.runs') is not null as runs,
       to_regclass('public.email_outbox') is not null as email_outbox,
       exists (select 1 from pg_indexes where indexname = 'runs_project_started_idx') as scale_index;
```

All four must be `true`. To see which migrations a database has, compare its tables and functions with `migrations/` (the newest file names the newest objects).

## Email notifications (owner, once)

Who gets what: everyone on a project's team (their sign-in email) hears about new comments and reviewers' replies, grouped (at most one email per project every 5 minutes), as a daily summary at 08:00 WIB, or not at all (Settings → Project → *Email me about new feedback*). Reviewers and participants never get these emails. Sign-up and password emails are separate: they go through Auth → SMTP (step 6).

1. **Resend:** create an account at resend.com → **Domains → Add domain** → add the DNS records it shows at your domain registrar → wait for *Verified*. Without your own domain Resend only sends to your own address (fine for a first test, not for customers).
2. **Resend → API Keys → Create** (permission: Sending access). Keep it in Resend and Supabase only.
3. **Run the migration** `migrations/20261122000000_email.sql` in the SQL Editor.
4. **Deploy the function** — either:
   - CLI, from `apps/saas`: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase functions deploy send-emails --no-verify-jwt`; or
   - Dashboard: **Edge Functions → Deploy a new function → Via editor**, name `send-emails`, add the files `index.ts` and `render.ts` from `functions/send-emails/`, deploy, then in its settings turn **Enforce JWT verification off** (the function checks its own secret).
5. **Edge Functions → Secrets** (never in the repository, the app or a chat):
   - `RESEND_API_KEY` = the key from step 2
   - `EMAIL_FROM` = `ourhunch <notify@yourdomain.com>`
   - `EMAIL_CRON_SECRET` = a long random string (e.g. from a password manager)
   - `APP_URL` = `https://whatvibecodingcando.vercel.app` (your domain later)
6. **Database → Extensions:** enable `pg_cron` and `pg_net`.
7. **Schedule it** (SQL Editor; replace the two values in angle brackets — the secret is the same as `EMAIL_CRON_SECRET`, not a Supabase key):
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-emails', 'email_function_url');
   select vault.create_secret('<EMAIL_CRON_SECRET>', 'email_cron_secret');
   select cron.schedule('vibe-collab-email-instant', '*/5 * * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'email_function_url'),
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret')),
       body := '{"mode":"instant"}'::jsonb)
   $$);
   select cron.schedule('vibe-collab-email-daily', '0 1 * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'email_function_url'),
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret')),
       body := '{"mode":"daily"}'::jsonb)
   $$);
   ```
   `0 1 * * *` is 01:00 UTC = 08:00 WIB.
8. **Check it:** leave a comment as a reviewer; within 5 minutes the team gets an email. If not:
   - `select * from cron.job_run_details order by start_time desc limit 5;` (did the job run?)
   - `select status_code, content from net._http_response order by created desc limit 5;` (401 = the two secrets differ; 500 "missing secret" = step 5)
   - `select count(*) from email_outbox where sent_at is null;` (waiting emails)
   - Edge Functions → send-emails → **Logs** (Resend errors, e.g. an unverified domain).

To stop all notification emails at once: `select cron.unschedule('vibe-collab-email-instant'); select cron.unschedule('vibe-collab-email-daily');`

## Internal ops panel

`/app#/ops` shows signups, sites, the funnel, users (with plan labels) and the admin action log. It is not linked for normal users; anyone who is not a platform admin sees "Not found". Every read and write goes through `security definer` functions that refuse non-admins; anon can't call them; plan changes are logged in `ops_audit`. No passwords, tokens or comment text are returned.

1. Run `migrations/20261124150000_ops.sql` in the SQL Editor (once, after the earlier migrations).
2. Make yourself admin (SQL Editor, with your own sign-in email):
   ```sql
   insert into public.platform_admins (user_id) select id from auth.users where email = '<your email>';
   ```
3. Reload the panel: an **Ops** link appears in the side menu (or open `/app#/ops`).

Remove an admin: `delete from public.platform_admins where user_id = (select id from auth.users where email = '<their email>');`. List admins: `select a.user_id, u.email, a.added_at from public.platform_admins a join auth.users u on u.id = a.user_id;`. There is no way to add an admin from the app, on purpose.

## Tests

- `tests/run.sh` runs every `*_test.sql` on a fresh database: `rls_test.sql` (row level security), `rpc_test.sql` (review links, comments, origins, rate limits, deleting an account), `share_test.sql` (dashboard, clearing data, share links), `install_test.sql` (installation reports), `research_test.sql` (studies, participants, events, heatmap) and `review_kinds_test.sql` (versions, A vs B, voice notes and their bucket), `email_test.sql` (outbox, who may read it, instant/daily/off), `ops_test.sql` (ops functions refuse non-admins and anon, plan changes are audited, users can't write their plan).
- The full path (panel → invite link → reviewer on another domain → comment in the database → panel inbox, plus kill switch, preview and delete account) was checked in a browser against these migrations on Postgres 16. It is not in CI yet.

## Not done yet (before a public launch)

- **Emails:** invite emails to reviewers (today the owner copies the review link and sends it). Notifications of new feedback are built ("Email notifications" above) and need the owner's setup.
- **CAPTCHA:** ready in the code, off until the Turnstile keys are set (step 4 above).
- **CI** running these tests on every push.

## Rules for later migrations

- Enable row level security on every new table, and add policies for the panel only.
- Repeat `revoke all on all tables in schema public from anon`: Supabase grants new tables to anon by default.
- Add the new table's cases to `tests/rls_test.sql` and keep `tests/run.sh` passing.
