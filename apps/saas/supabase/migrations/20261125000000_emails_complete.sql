-- ourhunch: the rest of the email system.
--
-- Activity emails (to a project's team, under projects.notify: instant, daily or off), as before plus:
--   'result'     a participant finished a study run (trigger on runs)
--   'due'        an open round is due tomorrow and has no approval (once per round; enqueued by email_due)
--   'reviewing'  a reviewer opened the current round for the first time (once per round; trigger on reviewers)
--   'live'       the script reported from one of the project's sites for the first time (once per project)
-- Comments carry more context for the email: the element, the reviewer's device, the round.
-- Weekly summary (Mondays) to account owners with activity, unless their project's notify is 'off'.
--
-- Lifecycle emails (welcome, day 1, day 3, day 7) to the person who signed up, only while their
-- "Tips and product updates" preference (email_prefs.marketing) is on: each kind at most once
-- (email_sent, unique), at most one a day, never to anonymous reviewer accounts, and an onboarding
-- nudge stops once the step it pushes is done. Accounts that existed before this migration are
-- marked legacy: they get no onboarding emails and their preference starts off.
--
-- email_prefs, email_sent and email_once have row level security and no policy: only the service
-- role reads them. Signed-in users read and change their own preference through email_prefs_get()
-- and email_prefs_set(); the unsubscribe link goes through the Edge Function (email_unsubscribe(),
-- service role only), with a random token per user kept here.

-- ---------- outbox: new kinds of rows ----------

alter table public.email_outbox
  add column if not exists event text check (event in ('result', 'due', 'reviewing', 'live')),
  add column if not exists run_id uuid references public.runs (id) on delete cascade,
  add column if not exists round_id uuid references public.review_rounds (id) on delete cascade,
  add column if not exists actor text check (char_length(actor) <= 80),
  add column if not exists host text check (char_length(host) <= 255);
create index if not exists email_outbox_run_idx on public.email_outbox (run_id);
create index if not exists email_outbox_round_idx on public.email_outbox (round_id);

-- Things that are emailed once ever: 'due:<round>', 'reviewing:<round>', 'live:<project>'.
create table if not exists public.email_once (
  key text primary key check (char_length(key) <= 80),
  at  timestamptz not null default now()
);
alter table public.email_once enable row level security;
revoke all on public.email_once from public, anon, authenticated;

-- Indexes for the queries below that filter by project.
create index if not exists runs_project_finished_idx on public.runs (project_id, finished_at);
create index if not exists handoffs_project_idx on public.handoffs (project_id);
create index if not exists threads_project_resolved_idx on public.threads (project_id, resolved_at);
create index if not exists workspaces_created_by_idx on public.workspaces (created_by);

-- The hosted demo site (allowed_origins) doesn't count as a customer's install.
create or replace function public._is_demo_host(h text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.allowed_origins a where regexp_replace(a.origin, '^https?://', '') = h)
$$;
revoke all on function public._is_demo_host(text) from public, anon, authenticated;

create or replace function public._email_on_run() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.finished_at is null and new.finished_at is not null then
    insert into public.email_outbox (project_id, run_id, event) values (new.project_id, new.id, 'result');
  end if;
  return new;
end $$;
drop trigger if exists email_on_run on public.runs;
create trigger email_on_run after update of finished_at on public.runs for each row execute function public._email_on_run();

create or replace function public._email_on_install() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public._is_demo_host(new.host) then return new; end if;
  insert into public.email_once (key) values ('live:' || new.project_id) on conflict do nothing;
  if found then
    insert into public.email_outbox (project_id, event, host) values (new.project_id, 'live', new.host);
  end if;
  return new;
end $$;
drop trigger if exists email_on_install on public.installs;
create trigger email_on_install after insert on public.installs for each row execute function public._email_on_install();

-- A reviewer (not the team's own browser) opening the project while a round is open.
create or replace function public._email_on_reviewer() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if new.team then return new; end if;
  select x.id into rid from public.review_rounds x join public.projects p on p.id = x.project_id
   where x.project_id = new.project_id and x.status = 'open' and p.rounds_on;
  if rid is null or exists (select 1 from public.email_once where key = 'reviewing:' || rid) then return new; end if;
  insert into public.email_once (key) values ('reviewing:' || rid) on conflict do nothing;
  if found then
    insert into public.email_outbox (project_id, round_id, event, actor) values (new.project_id, rid, 'reviewing', left(new.name, 80));
  end if;
  return new;
end $$;
drop trigger if exists email_on_reviewer on public.reviewers;
create trigger email_on_reviewer after insert or update of last_seen on public.reviewers for each row execute function public._email_on_reviewer();

revoke all on function public._email_on_run(), public._email_on_install(), public._email_on_reviewer() from public, anon, authenticated;

-- ---------- what to send now (activity) ----------

-- As before (…_review_rounds.sql), plus the new kinds and more context per item. Due-tomorrow
-- reminders are enqueued here first (once per round).
create or replace function public.email_due(p_daily boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  with due as (
    insert into public.email_once (key)
    select 'due:' || x.id from public.review_rounds x join public.projects p on p.id = x.project_id
     where x.status = 'open' and x.due = (now() at time zone 'utc')::date + 1 and p.rounds_on and p.deleted_at is null
       and not exists (select 1 from public.round_approvals a where a.round_id = x.id)
    on conflict do nothing returning key)
  insert into public.email_outbox (project_id, round_id, event)
  select x.project_id, x.id, 'due' from due join public.review_rounds x on 'due:' || x.id = due.key;

  update public.email_outbox o set sent_at = now()
    from public.projects p where p.id = o.project_id and o.sent_at is null and (p.notify = 'off' or p.deleted_at is not null);
  return coalesce((
    select json_agg(x order by x->>'project_name') from (
      select json_build_object(
        'project_id', p.public_id,
        'project_name', p.name,
        'site_url', p.site_url,
        'outbox_ids', (select json_agg(o.id order by o.id) from public.email_outbox o where o.project_id = p.id and o.sent_at is null
                         and (p.notify = case when p_daily then 'daily' else 'instant' end or (not p_daily and o.approval_id is not null))),
        'total', (select count(*) from public.email_outbox o where o.project_id = p.id and o.sent_at is null
                    and (p.notify = case when p_daily then 'daily' else 'instant' end or (not p_daily and o.approval_id is not null))),
        'recipients', (select coalesce(json_agg(distinct u.email), '[]'::json) from public.workspace_members m join auth.users u on u.id = m.user_id
                       where m.workspace_id = p.workspace_id and u.email is not null),
        'items', (select coalesce(json_agg(i order by i.at), '[]'::json) from (
          select o.id, o.created_at as at,
                 case when o.approval_id is not null then 'approval' when o.event is not null then o.event
                      when o.reply_id is null then 'comment' else 'reply' end as type,
                 t.kind, coalesce(t.page, '') as page, t.id as thread_id,
                 coalesce(a.name, r.author_name, t.author_name, o.actor, '') as author,
                 left(coalesce(rr.name, r.text, t.text, st.name, xr.name, o.host, ''), 500) as text,
                 a.version, a.open_comments, a.id as approval_id,
                 coalesce(rr.n, xr.n, tr.n) as round_n, coalesce(rr.name, xr.name, tr.name) as round_name,
                 xr.due, o.host,
                 case when t.id is not null and o.reply_id is null then json_build_object(
                   'sel', left(t.anchor ->> 'sel', 120), 'tag', left(t.anchor -> 'fp' ->> 't', 20),
                   'text', left(t.anchor -> 'fp' ->> 'x', 80), 'label', left(t.anchor -> 'fp' -> 'a' ->> 'aria-label', 80)) end as element,
                 case when t.id is not null and o.reply_id is null and jsonb_typeof(t.anchor -> 'device') = 'object' then json_build_object(
                   'browser', left(t.anchor -> 'device' ->> 'browser', 40), 'os', left(t.anchor -> 'device' ->> 'os', 40),
                   'w', t.anchor -> 'device' -> 'w', 'h', t.anchor -> 'device' -> 'h') end as device,
                 st.id as study_id,
                 case when st.id is not null then (select count(*) from public.runs z where z.study_id = st.id and z.finished_at is not null) end as results_total,
                 case when st.id is not null then (select json_build_object('ok', count(*) filter (where e ->> 'outcome' = 'success'), 'all', count(*))
                   from (select z.result from public.runs z where z.study_id = st.id and z.finished_at is not null order by z.finished_at desc limit 1000) z,
                        jsonb_array_elements(case when jsonb_typeof(z.result -> 'tasks') = 'array' then z.result -> 'tasks' else '[]'::jsonb end) e) end as tasks
            from public.email_outbox o
            left join public.threads t on t.id = o.thread_id
            left join public.replies r on r.id = o.reply_id
            left join public.round_approvals a on a.id = o.approval_id
            left join public.review_rounds rr on rr.id = a.round_id
            left join public.review_rounds tr on tr.id = t.round_id
            left join public.review_rounds xr on xr.id = o.round_id
            left join public.runs ru on ru.id = o.run_id
            left join public.studies st on st.id = ru.study_id
           where o.project_id = p.id and o.sent_at is null
             and (t.id is not null or a.id is not null or st.id is not null or xr.id is not null or o.event = 'live')
             and (p.notify = case when p_daily then 'daily' else 'instant' end or (not p_daily and o.approval_id is not null))
           order by o.id desc limit 20) i)
      ) as x
      from public.projects p
      where p.deleted_at is null
        and exists (select 1 from public.email_outbox o where o.project_id = p.id and o.sent_at is null
                      and (p.notify = case when p_daily then 'daily' else 'instant' end or (not p_daily and o.approval_id is not null)))
      limit 200
    ) q), '[]'::json);
end $$;

-- ---------- preferences, lifecycle log ----------

create table if not exists public.email_prefs (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  marketing   boolean not null default true,
  -- accounts from before lifecycle emails existed: no onboarding emails
  legacy      boolean not null default false,
  unsub_token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') check (unsub_token ~ '^[0-9a-f]{64}$'),
  updated_at  timestamptz not null default now()
);
alter table public.email_prefs enable row level security;
revoke all on public.email_prefs from public, anon, authenticated;

-- Lifecycle emails sent ('welcome', 'day1', 'day3', 'day7') and weekly summaries ('weekly-<ISO week>').
create table if not exists public.email_sent (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    text not null check (char_length(kind) <= 40),
  sent_at timestamptz not null default now(),
  primary key (user_id, kind)
);
create index if not exists email_sent_user_at_idx on public.email_sent (user_id, sent_at desc);
alter table public.email_sent enable row level security;
revoke all on public.email_sent from public, anon, authenticated;

-- Everyone already signed up: no onboarding series, tips off until they turn them on.
insert into public.email_prefs (user_id, marketing, legacy)
select id, false, true from auth.users where email is not null and not coalesce(is_anonymous, false)
on conflict do nothing;

create or replace function public._email_prefs_row(uid uuid) returns public.email_prefs
language plpgsql security definer set search_path = public as $$
declare x public.email_prefs;
begin
  insert into public.email_prefs (user_id) values (uid) on conflict do nothing;
  select * into x from public.email_prefs where user_id = uid;
  return x;
end $$;
revoke all on function public._email_prefs_row(uuid) from public, anon, authenticated;

create or replace function public.email_prefs_get() returns json
language plpgsql security definer set search_path = public as $$
declare x public.email_prefs;
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'not_signed_in'; end if;
  x := public._email_prefs_row(auth.uid());
  return json_build_object('marketing', x.marketing);
end $$;

create or replace function public.email_prefs_set(p_marketing boolean) returns json
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then raise exception 'not_signed_in'; end if;
  if p_marketing is null then raise exception 'bad_value'; end if;
  perform public._email_prefs_row(auth.uid());
  update public.email_prefs set marketing = p_marketing, updated_at = now() where user_id = auth.uid();
  return json_build_object('marketing', p_marketing);
end $$;
revoke all on function public.email_prefs_get(), public.email_prefs_set(boolean) from public, anon;
grant execute on function public.email_prefs_get(), public.email_prefs_set(boolean) to authenticated;

-- The unsubscribe link (through the Edge Function): turns tips off for that token's user.
create or replace function public.email_unsubscribe(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return false; end if;
  update public.email_prefs set marketing = false, updated_at = now() where unsub_token = p_token;
  return found;
end $$;

-- ---------- lifecycle: who gets which email now ----------

-- p_welcome_only: the 5-minute run sends welcomes only; the daily run sends every kind.
create or replace function public.email_lifecycle_due(p_welcome_only boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  -- New, confirmed accounts get their preference row (tips on).
  insert into public.email_prefs (user_id)
  select u.id from auth.users u
   where u.email is not null and not coalesce(u.is_anonymous, false)
     and coalesce(u.email_confirmed_at, u.last_sign_in_at) is not null
     and u.created_at > now() - interval '30 days'
     and not exists (select 1 from public.email_prefs e where e.user_id = u.id)
   limit 5000
  on conflict do nothing;

  return coalesce((select json_agg(z) from (
    select u.id as user_id, u.email, e.unsub_token as token, k.kind,
           s.projects > 0 as has_project, s.installed, s.project_name, s.project_id
      from auth.users u
      join public.email_prefs e on e.user_id = u.id and e.marketing and not e.legacy
      cross join lateral (
        select count(*) as projects,
               min(p.name) as project_name, min(p.public_id) as project_id,
               bool_or(exists (select 1 from public.installs i where i.project_id = p.id and not public._is_demo_host(i.host))) as installed,
               bool_or(exists (select 1 from public.handoffs h where h.project_id = p.id and h.kind = 'invite')
                       or exists (select 1 from public.reviewers r where r.project_id = p.id and not r.team)) as invited,
               bool_or(exists (select 1 from public.threads t where t.project_id = p.id)) as commented,
               bool_or(exists (select 1 from public.studies st where st.project_id = p.id)) as studied
          from public.workspaces w join public.projects p on p.workspace_id = w.id and p.deleted_at is null
         where w.created_by = u.id) s
      cross join lateral (
        select c.kind from (values
          (1, 'welcome', u.created_at > now() - interval '7 days'),
          (2, 'day1', not p_welcome_only and u.created_at <= now() - interval '1 day' and u.created_at > now() - interval '14 days'
                      and not coalesce(s.installed, false)),
          (3, 'day3', not p_welcome_only and u.created_at <= now() - interval '3 days' and u.created_at > now() - interval '21 days'
                      and coalesce(s.installed, false) and not coalesce(s.invited, false)),
          (4, 'day7', not p_welcome_only and u.created_at <= now() - interval '7 days' and u.created_at > now() - interval '30 days'
                      and coalesce(s.commented, false) and not coalesce(s.studied, false))
        ) c (n, kind, ok)
        where c.ok and not exists (select 1 from public.email_sent x where x.user_id = u.id and x.kind = c.kind)
        order by c.n limit 1) k
     where u.email is not null and not coalesce(u.is_anonymous, false)
       and not exists (select 1 from public.email_sent x where x.user_id = u.id and x.kind not like 'weekly-%' and x.sent_at > now() - interval '20 hours')
     limit 500) z), '[]'::json);
end $$;

-- What was sent: [{"user_id": "…", "kind": "welcome"}, …]. Each kind is recorded once.
create or replace function public.email_sent_mark(p_items json) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.email_sent (user_id, kind)
  select (j ->> 'user_id')::uuid, left(j ->> 'kind', 40) from json_array_elements(p_items) j
   where exists (select 1 from auth.users u where u.id = (j ->> 'user_id')::uuid)
  on conflict do nothing;
end $$;

-- ---------- weekly summary (Mondays) ----------

-- Account owners whose projects (not set to 'off') had activity in the last 7 days, once per ISO week.
create or replace function public.email_weekly_due() returns json
language plpgsql security definer set search_path = public as $$
declare wk text := 'weekly-' || to_char(now() at time zone 'utc', 'IYYY-IW');
begin
  return coalesce((select json_agg(z) from (
    select u.id as user_id, u.email, wk as kind, json_agg(s order by s.project_name) as projects
      from auth.users u
      join public.workspaces w on w.created_by = u.id
      cross join lateral (
        select p.public_id as project_id, p.name as project_name,
               (select count(*) from public.threads t where t.project_id = p.id and t.created_at > now() - interval '7 days') as comments,
               (select count(*) from public.threads t where t.project_id = p.id and t.resolved_at > now() - interval '7 days') as resolved,
               (select count(*) from public.runs r where r.project_id = p.id and r.finished_at > now() - interval '7 days') as results,
               (select count(*) from public.round_approvals a where a.project_id = p.id and a.created_at > now() - interval '7 days') as approvals
          from public.projects p where p.workspace_id = w.id and p.deleted_at is null and p.notify <> 'off') s
     where u.email is not null and not coalesce(u.is_anonymous, false)
       and (s.comments + s.resolved + s.results + s.approvals) > 0
       and not exists (select 1 from public.email_sent x where x.user_id = u.id and x.kind = wk)
     group by u.id, u.email
     limit 1000) z), '[]'::json);
end $$;

-- ---------- access ----------

revoke all on function public.email_due(boolean), public.email_unsubscribe(text), public.email_lifecycle_due(boolean),
  public.email_sent_mark(json), public.email_weekly_due() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.email_due(boolean), public.email_unsubscribe(text), public.email_lifecycle_due(boolean),
      public.email_sent_mark(json), public.email_weekly_due() to service_role;
    grant select, insert, update, delete on public.email_prefs, public.email_sent, public.email_once to service_role;
  end if;
end $$;
revoke all on all tables in schema public from anon;
