# Vibe Collab backend (Supabase)

The SaaS's backend, in this app only (`apps/saas/supabase`). It is not connected to the app yet: the panel and the script still use this browser's storage until the next steps below are done.

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
- **`tests/`**: the row level security tests. Two customers and a stranger try to read, change, join or take over each other's data; anon tries to read; bad data is refused.
  - Run them on any local Postgres: `PGHOST=… PGPORT=… PGUSER=… tests/run.sh`.
  - `supabase_stub.sql` stands in for Supabase's `auth` schema and roles.

## Setting up the Supabase project (owner, once)

1. **Plan and region.** Pro (Free pauses when idle and has no daily backups). Region Southeast Asia (Singapore) for users in Indonesia.
2. **Run the migration.** SQL Editor → paste `migrations/20261109000000_init.sql` → Run. Or the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.
3. **Auth → URL Configuration.**
   - Site URL: `https://whatvibecodingcando.vercel.app/`.
   - Redirect URLs: `https://whatvibecodingcando.vercel.app/**` and `http://localhost:5174/**` for development.
4. **Auth → SMTP.** Use your own provider (Resend, Postmark, SES). Supabase's built-in email is limited to a few messages an hour, which isn't enough for sign-up, invites and password resets.
5. **Keys.**
   - The project URL and the anon (publishable) key are public by design and go into the app's build (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in Vercel).
   - The service role key and the database password never go into the app, the repository or a chat. Only the Edge Functions use the service role.

## Next steps (in order)

1. **Edge Functions.**
   - `handoff`: the panel asks for a review link; it returns a token and stores its hash.
   - `redeem`: a token becomes a short-lived reviewer session.
   - `comments`: list, post, reply and resolve, with an origin check against the project's environments and rate limits.
   - `publish`: validates the configuration, writes the release, and writes `widget-config/<public_id>.json` to Storage, cached on the CDN.
   - `ping`: the installation check, at most once per host per hour.
2. **Panel on Supabase Auth.** Register, login, forgot and reset password, and workspaces and projects through the client with row level security.
3. **The script.**
   - A `SupabaseBackend` behind the existing `Backend` interface, through the `comments` function.
   - The configuration read from the CDN file instead of browser storage.
   - Review links through `redeem`.

## Rules for later migrations

- Enable row level security on every new table, and add policies for the panel only.
- Repeat `revoke all on all tables in schema public from anon`: Supabase grants new tables to anon by default.
- Add the new table's cases to `tests/rls_test.sql` and keep `tests/run.sh` passing.
