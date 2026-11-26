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
- **`migrations/20261124000000_anchor_state.sql`**: pins that survive redeploys. `set_anchor(thread, anchor)` lets a reviewer of the project re-pin a comment or report its pin as moved/gone; the comparison's second element and the device stay, the version comes from the published settings. Tested in `tests/anchor_test.sql`.
- **`migrations/20261124100000_review_rounds.sql`**: review rounds and approvals. `projects.rounds_on` / `rounds_included`, `review_rounds` (one open per project; members only), `round_approvals` (written only by `approve_round`, read by members), `threads.round_id` (set by a trigger; with rounds on and no round open, reviewers can't add comments, the team can: `reviewers.team`, set by `start_review` for one-time links), `current_round` / `approve_round` for the script, and approval emails (`email_outbox.approval_id`, `email_due` sends them with the next instant run unless notifications are off). Redeploy the Edge Function `send-emails` after it (new email). Tested in `tests/rounds_test.sql`.
- **`migrations/20261124150000_ops.sql`**: the internal ops panel (`/app#/admin`, founder only). `platform_admins` (written by hand only), `is_platform_admin()`, `account_plans` (plan labels, no billing; a user reads only their own row), `ops_audit`, and the admin-only functions `ops_overview`, `ops_signups_daily`, `ops_funnel`, `ops_users`, `ops_user_detail`, `ops_audit_recent`, `ops_set_plan`. Tested in `tests/ops_test.sql`. See "Internal ops panel" below.
- **`migrations/20261126200000_billing.sql`**: billing, ready but OFF: `app_settings.billing_enabled` (false), `subscriptions` (members read, only the webhook writes), `billing_events` (once per provider event, minimal payload), `founding_seats` (200, held 1 h at checkout, under a lock), the effective plan and the site limits (only while on). Tested in `tests/billing_test.sql`. Setup, in Bahasa Indonesia: `docs/BILLING.md`.
- **`functions/billing/`**: the Edge Function for checkout, customer portal and the provider's webhook (`index.ts`, `handler.ts`, `paddle.ts`, `provider.ts`; mocked tests in `test.ts`). Deploy with JWT verification off.
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
6b. **Sign-in with a one-time code (email users).** Login and register send a 6-digit code (`signInWithOtp`, then `verifyOtp` type `email`); Google stays one click and passwords stay as "Use a password instead". In Supabase:
   - Authentication → Sign In / Providers → **Email**: enabled, "Confirm email" on, **Email OTP Length = 6**, **Email OTP Expiration = 600** seconds.
   - The **Magic Link** and **Confirm signup** templates must show `{{ .Token }}` (the files in `email-templates/` do; the link stays as a fallback). Without it people get a link but no code.
   - Attack Protection / Rate Limits: emails per hour (raise it with your own SMTP, e.g. 100+), "OTP / magic link" minimum interval 60 s (the page waits 60 s before "Send a new code"), token verifications per 5 min (default 30 is fine). Too many tries shows "Too many tries".
   - Login uses `shouldCreateUser: false`, and the page shows the same "If this email has an account…" answer for unknown addresses.
7. **Auth → Email Templates.** Use the branded files in `email-templates/` (subjects and steps: "Email notifications" step 8). Their links use the `token_hash` form, so they work on any device (the default links only work in the browser that asked):
   - **Confirm signup:** `https://ourhunch.com/app#/app/confirm?token_hash={{ .TokenHash }}&type=email`
   - **Reset Password:** `https://ourhunch.com/app#/app/confirm?token_hash={{ .TokenHash }}&type=recovery`
   - Magic link, change email and invite use `type=magiclink`, `email_change` and `invite`.
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

Every email ourhunch sends itself goes through the Edge Function `send-emails` and Resend. Sign-up and password emails are separate: Supabase Auth sends them through SMTP (step 6 above), with the templates in `email-templates/`.

| Email | Sent when | To | How often |
|---|---|---|---|
| New comment / reply | a reviewer comments or replies (not the team's own replies) | the project's team | grouped per project: every 5 min (*instant*), in the daily summary (*daily*) or never (*off*) |
| New research results | a participant finishes a study run; grouped per study, with the task success rate so far | team | as above |
| Round approved | a reviewer approves a round | team | next 5-minute run, even for *daily* projects; never for *off* |
| Your client started reviewing | the first time a (non-team) reviewer opens the current round | team | once per round, as above |
| Round due tomorrow | an open round is due tomorrow (UTC) and has no approval | team | once per round, as above |
| ourhunch is live on <site> | the script reports from one of the project's sites for the first time | team | once per project, as above |
| Weekly summary | Mondays, for account owners with activity in the last 7 days | the account owner | once a week; projects set to *off* are left out |
| Welcome | right after sign-up (confirmed email or first sign-in) | the person who signed up | once, within 5 minutes |
| Day 1: Add ourhunch in 2 minutes | ≥ 24 h after sign-up, no install detected | the person who signed up | once, only while not installed |
| Day 3: Invite your first client | ≥ 3 days, installed, no review link or reviewer yet | the person who signed up | once, only while not done |
| Day 7: Test with real users | ≥ 7 days, has comments, no study yet | the person who signed up | once, only while not done |

The last four are lifecycle emails ("Tips and product updates", Settings → Notifications): on by default for new accounts, off for accounts that existed before them (those get no onboarding series), at most one a day, each kind once, never to anonymous reviewers or participants. They carry a one-click unsubscribe (link to `/app#/unsubscribe?t=…` and `List-Unsubscribe` / `List-Unsubscribe-Post` headers pointing at the function); the token is random per user and only turns tips off. Activity emails link to the notification settings instead.

Every email: 600px table layout with inline styles, preheader, one button, plain-text part, footer with why it was sent, the settings link and the postal address (when `EMAIL_POSTAL_ADDRESS` is set). Pictures of all of them: `docs/email-previews/`. Regenerate them (and the Auth templates) from `apps/saas`:
`npx esbuild supabase/functions/send-emails/preview.ts --bundle --platform=node --format=esm --outfile=/tmp/se-preview.mjs && node /tmp/se-preview.mjs /tmp/email-previews`.

1. **Resend:** create an account at resend.com → **Domains → Add domain** (`ourhunch.com`) → add the DNS records it shows (SPF, DKIM, and a DMARC record such as `v=DMARC1; p=none;`) at your domain registrar → wait for *Verified*. Without your own domain Resend only sends to your own address.
2. **Resend → API Keys → Create** (permission: Sending access). Keep it in Resend and Supabase only.
3. **Run the migrations** in the SQL Editor, in order: `migrations/20261122000000_email.sql`, then (after the others) `migrations/20261125000000_emails_complete.sql`. A database that already has everything up to `…_ops.sql` can run the one-paste file **`catch-up/2026-11-25-emails.sql`** instead. Then **`catch-up/2026-11-25-ops-usage.sql`** (or `migrations/20261125120000_ops_usage.sql`): the ops panel's Widget column, and the welcome email only after the first sign-in (email confirmed, email code entered, or Google).

**Install flow (2026-11-27).** Run **`catch-up/2026-11-27-install-flow.sql`** once (after `2026-11-26-security.sql`; safe to run again), or `migrations/20261127000000_install_flow.sql`: the panel can then say "ourhunch saw your script on localhost:3001, which isn't in this project — Add it". Without it the panel works as before, just without that banner.

**Default studies and visitors under Everyone (2026-11-29).** Run **`catch-up/2026-11-29-default-studies.sql`** once (after `2026-11-28-demo-origin.sql`; safe to run again), or `migrations/20261129000000_default_studies.sql`. Every research module that is on (Heatmap, Eye tracking, 5-second test, Usability test) gets one default (★) study; `make_default_study` moves the ★; with the widget open to everyone, visitors who press OK record into the module's ★ study (`visitor_modules`, `start_visitor_run`: origin, module on, ★ open, rate limits per session/address/project, 2,000 visitor runs per study per day), and people who only joined an open widget (`reviewers.visitor`) can't read heatmaps or invite links. Existing audiences, studies, links and data are unchanged. Test: `tests/default_studies_test.sql`.
4. **Deploy the function** — either:
   - CLI, from `apps/saas`: `npx supabase login`, `npx supabase link --project-ref <ref>`, `npx supabase functions deploy send-emails --no-verify-jwt`; or
   - Dashboard: **Edge Functions → Deploy a new function → Via editor**, name `send-emails`, add the files `index.ts` and `render.ts` from `functions/send-emails/` (not `test.ts` or `preview.ts`), deploy, then in its settings turn **Enforce JWT verification off** (the function checks its own secret; the unsubscribe request is checked by its token).
5. **Edge Functions → Secrets** (never in the repository, the app or a chat):
   - `RESEND_API_KEY` = the key from step 2
   - `EMAIL_FROM` = `ourhunch <hello@ourhunch.com>` (an address on the verified domain)
   - `EMAIL_CRON_SECRET` = a long random string (e.g. from a password manager)
   - `APP_URL` = `https://ourhunch.com` (every link in the emails starts here; the app also works on `https://whatvibecodingcando.vercel.app`)
   - `EMAIL_REPLY_TO` (optional) = where replies to the welcome email go, e.g. your own inbox
   - `EMAIL_FOUNDER_NAME` (optional) = signs the welcome email; otherwise "The ourhunch team"
   - `EMAIL_POSTAL_ADDRESS` (optional, recommended before sending tips widely) = your business postal address, shown in every footer; leave it unset and the line is left out
6. **Database → Extensions:** enable `pg_cron` and `pg_net`.
7. **Schedule it** (SQL Editor; replace the two values in angle brackets — the secret is the same as `EMAIL_CRON_SECRET`, not a Supabase key). If you already scheduled the first two, run only the vault lines you haven't and the two new jobs:
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co/functions/v1/send-emails', 'email_function_url');
   select vault.create_secret('<EMAIL_CRON_SECRET>', 'email_cron_secret');
   -- activity emails + welcome emails, every 5 minutes
   select cron.schedule('vibe-collab-email-instant', '*/5 * * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'email_function_url'),
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret')),
       body := '{"mode":"instant"}'::jsonb)
   $$);
   -- daily summary, 01:00 UTC = 08:00 WIB
   select cron.schedule('vibe-collab-email-daily', '0 1 * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'email_function_url'),
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret')),
       body := '{"mode":"daily"}'::jsonb)
   $$);
   -- lifecycle (day 1 / day 3 / day 7), 02:17 UTC = 09:17 WIB
   select cron.schedule('ourhunch-email-lifecycle', '17 2 * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'email_function_url'),
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret')),
       body := '{"mode":"lifecycle"}'::jsonb)
   $$);
   -- weekly summary, Mondays 01:43 UTC = 08:43 WIB
   select cron.schedule('ourhunch-email-weekly', '43 1 * * 1', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'email_function_url'),
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'email_cron_secret')),
       body := '{"mode":"weekly"}'::jsonb)
   $$);
   ```
8. **Auth emails (Supabase → Authentication):**
   - **SMTP** (step 6 above): host `smtp.resend.com`, port `465`, username `resend`, password = a Resend API key, sender `ourhunch <hello@ourhunch.com>`.
   - **Email Templates:** paste each file's HTML (everything after the first comment line) and set the subject:

     | Template | File | Subject |
     |---|---|---|
     | Confirm signup | `email-templates/confirm-signup.html` | Your ourhunch code: {{ .Token }} |
     | Reset Password | `email-templates/reset-password.html` | Set a new password for ourhunch |
     | Magic Link | `email-templates/magic-link.html` | Your ourhunch code: {{ .Token }} |
     | Change Email Address | `email-templates/change-email.html` | Confirm your new email for ourhunch |
     | Invite user | `email-templates/invite.html` | You’re invited to ourhunch |

     Their links use the `token_hash` form (`https://ourhunch.com/app#/app/confirm?token_hash={{ .TokenHash }}&type=…`), so they work on any device. On another domain, replace `https://ourhunch.com` in the files. They have no postal-address line (Supabase can't read the function's secrets); add it by hand if you want it there too.
9. **Check it:** leave a comment as a reviewer; within 5 minutes the team gets an email. Sign up a new account: the welcome email comes within 5 minutes. If not:
   - `select * from cron.job_run_details order by start_time desc limit 5;` (did the job run?)
   - `select status_code, content from net._http_response order by created desc limit 5;` (401 = the two secrets differ; 500 "missing secret" = step 5)
   - `select count(*) from email_outbox where sent_at is null;` (waiting emails)
   - `select kind, count(*) from email_sent group by 1;` (lifecycle and weekly emails sent)
   - Edge Functions → send-emails → **Logs** (Resend errors, e.g. an unverified domain).

To stop all emails at once: `select cron.unschedule('vibe-collab-email-instant'); select cron.unschedule('vibe-collab-email-daily'); select cron.unschedule('ourhunch-email-lifecycle'); select cron.unschedule('ourhunch-email-weekly');`

## Internal ops panel

`/app#/admin` shows signups, sites, the funnel, users (with plan labels) and the admin action log. It has its own sign-in page and is not linked from the panel; a sign-in from an account that is not a platform admin gets the same answer as a wrong password. Every read and write goes through `security definer` functions that refuse non-admins; anon can't call them; plan changes are logged in `ops_audit`. No passwords, tokens or comment text are returned.

1. Run `migrations/20261124150000_ops.sql` in the SQL Editor (once, after the earlier migrations).
2. Make yourself admin (SQL Editor, with your own sign-in email):
   ```sql
   insert into public.platform_admins (user_id) select id from auth.users where email = '<your email>';
   ```
3. Open `/app#/admin` and sign in there with that account's email and password. Ops has its own sign-in and session, apart from the customer panel (the session lasts until the tab closes), and is never linked from the panel. An account that signed up with Google sets a password first in the panel's Settings → Password.

Remove an admin: `delete from public.platform_admins where user_id = (select id from auth.users where email = '<their email>');`. List admins: `select a.user_id, u.email, a.added_at from public.platform_admins a join auth.users u on u.id = a.user_id;`. There is no way to add an admin from the app, on purpose.

## Tests

- `tests/run.sh` runs every `*_test.sql` on a fresh database: `rls_test.sql` (row level security), `rpc_test.sql` (review links, comments, origins, rate limits, deleting an account), `share_test.sql` (dashboard, clearing data, share links), `install_test.sql` (installation reports), `research_test.sql` (studies, participants, events, heatmap) and `review_kinds_test.sql` (versions, A vs B, voice notes and their bucket), `email_test.sql` (outbox, who may read it, instant/daily/off), `ops_test.sql` (ops functions refuse non-admins and anon, plan changes are audited, users can't write their plan), `anchor_test.sql` (re-pinning and pin states), `install_flow_test.sql` (local dev addresses seen outside a project: `install_strays`).
- The full path (panel → invite link → reviewer on another domain → comment in the database → panel inbox, plus kill switch, preview and delete account) was checked in a browser against these migrations on Postgres 16. It is not in CI yet.

## Not done yet (before a public launch)

- **Emails:** invite emails to reviewers (today the owner copies the review link and sends it). Notifications of new feedback are built ("Email notifications" above) and need the owner's setup.
- **CAPTCHA:** ready in the code, off until the Turnstile keys are set (step 4 above).
- **CI** running these tests on every push.

## Rules for later migrations

- Enable row level security on every new table, and add policies for the panel only.
- Repeat `revoke all on all tables in schema public from anon`: Supabase grants new tables to anon by default.
- Add the new table's cases to `tests/rls_test.sql` and keep `tests/run.sh` passing.


## Page snapshots (2026-12-01-snapshots-layouts.sql)

The SQL file creates the private bucket `snapshots` (600 KB, WebP/JPEG) and its storage policies. If the SQL editor refuses the `insert into storage.buckets` line, create the bucket by hand in Storage → New bucket: name `snapshots`, **private**, file size limit 600 KB, allowed types `image/webp, image/jpeg`, then run the file again (the policies need the bucket). No Edge Function is needed: the widget uploads with its own session to the one path `snapshot_claim` reserved.
