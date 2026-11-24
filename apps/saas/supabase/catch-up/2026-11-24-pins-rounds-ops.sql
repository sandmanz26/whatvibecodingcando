-- One paste for the three migrations of 24 Nov 2026: pins that survive redeploys, review rounds, internal ops panel.
-- Run once in the Supabase SQL Editor. All or nothing: if any part fails, nothing is changed.
begin;

-- ===== migrations/20261124000000_anchor_state.sql =====
-- Pins that survive redeploys.
--
-- New comments carry a fingerprint of their element inside the anchor JSON (anchor.fp: no new
-- column). When the site changes, the widget finds the element again or marks the pin "Moved?" or
-- gone; it reports that state, and a reviewer can confirm or re-pick the element. Both go through
-- set_anchor: any reviewer of the project (same checks as replies), its own rate limit, small JSON.
--
-- anchor.st = {s: 'ok'|'moved'|'gone', v: site version, at}: v and at are set here, and kept while
-- the state stays the same, so the panel can say "not found since v2.3".

create or replace function public.set_anchor(p_thread uuid, p_anchor jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  x record;
  st text := p_anchor -> 'st' ->> 's';
  old jsonb;
  next jsonb;
begin
  select * into x from public._thread_for(p_thread);
  if not public.take_rate('anchor:' || auth.uid(), 60) then raise exception 'rate_limited'; end if;
  if p_anchor is null or jsonb_typeof(p_anchor) <> 'object' or length(p_anchor::text) > 4000 then raise exception 'bad_anchor'; end if;
  if jsonb_typeof(p_anchor -> 'sel') is distinct from 'string' or char_length(p_anchor ->> 'sel') > 400 then raise exception 'bad_anchor'; end if;
  if p_anchor -> 'fp' is not null and jsonb_typeof(p_anchor -> 'fp') <> 'object' then raise exception 'bad_anchor'; end if;
  if st is not null and st not in ('ok', 'moved', 'gone') then raise exception 'bad_state'; end if;
  old := (x.t).anchor;
  -- The comparison's second element and the commenter's device stay as they were.
  next := (old - 'st') || (p_anchor - 'b' - 'device' - 'st');
  if st is not null then
    next := next || jsonb_build_object('st', case
      when old -> 'st' ->> 's' = st then old -> 'st'
      else jsonb_strip_nulls(jsonb_build_object('s', st, 'v', left(nullif(btrim(public._live_config((x.t).project_id) ->> 'version'), ''), 20), 'at', now()))
    end);
  elsif old -> 'st' is not null then
    next := next || jsonb_build_object('st', old -> 'st');
  end if;
  if length(next::text) > 4000 then raise exception 'bad_anchor'; end if;
  update public.threads set anchor = next where id = p_thread;
  return public._thread_json((select t from public.threads t where t.id = p_thread), (x.r).id);
end $$;
revoke all on function public.set_anchor(uuid, jsonb) from public, anon;
grant execute on function public.set_anchor(uuid, jsonb) to authenticated;

-- ===== migrations/20261124100000_review_rounds.sql =====
-- Vibe Collab: review rounds, managed by the site owner, and "Approve this version".
--
-- 1. Projects choose whether they work in rounds (projects.rounds_on, off by default so existing
--    projects behave as before) and how many rounds their quote includes (rounds_included, 1..20,
--    null = unlimited). ourhunch never bills: the number only labels extra rounds.
-- 2. review_rounds: the owner's rounds (one open at a time per project). Members read and write
--    them under row level security; reviewers only read the current one through current_round().
-- 3. round_approvals: a reviewer's "I've reviewed this version and approve it", with the time, the
--    round, the site version and the open comments at that moment. A record of approval, not a legal
--    signature. Written only by approve_round() (reviewer, project, origin and rate limit checked);
--    members read them; nobody edits them.
-- 4. Every new comment carries the open round (threads.round_id, set by a trigger; null when rounds
--    are off). With rounds on and no round open, reviewers can't add comments (they still read and
--    reply); the team can (reviewers.team: browsers that came in through a member's own one-time link).
-- 5. An approval emails the project's members through the email outbox (a new kind of row).

-- ---------- settings ----------

alter table public.projects
  add column if not exists rounds_on boolean not null default false,
  add column if not exists rounds_included int default 2 check (rounds_included is null or rounds_included between 1 and 20);

-- Browsers that came in through a member's own one-time link (the panel's "Open my site", "Open on site").
alter table public.reviewers add column if not exists team boolean not null default false;

-- ---------- rounds ----------

create table if not exists public.review_rounds (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  n           int not null check (n between 1 and 1000),
  name        text not null check (char_length(name) between 1 and 80),
  note        text not null default '' check (char_length(note) <= 2000),
  due         date,
  status      text not null default 'open' check (status in ('open', 'closed', 'approved')),
  started_at  timestamptz not null default now(),
  closed_at   timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  unique (project_id, n)
);
-- One open round per project; the list is read by project, newest first.
create unique index if not exists review_rounds_one_open_idx on public.review_rounds (project_id) where status = 'open';
create index if not exists review_rounds_project_n_idx on public.review_rounds (project_id, n desc);
alter table public.review_rounds enable row level security;
create policy "members read rounds" on public.review_rounds for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members start rounds" on public.review_rounds for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members edit rounds" on public.review_rounds for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members delete rounds" on public.review_rounds for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
revoke all on public.review_rounds from anon;

-- Members may close and reopen rounds, but "approved" comes only from an approval (approve_round).
create or replace function public._round_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_setting('vc.approving', true) = '1' then return new; end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then raise exception 'approved_only_by_reviewer'; end if;
  if tg_op = 'UPDATE' and (new.project_id <> old.project_id or new.n <> old.n) then raise exception 'not_allowed'; end if;
  return new;
end $$;
drop trigger if exists round_guard on public.review_rounds;
create trigger round_guard before insert or update on public.review_rounds for each row execute function public._round_guard();
revoke all on function public._round_guard() from public, anon, authenticated;

-- ---------- approvals ----------

create table if not exists public.round_approvals (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references public.review_rounds (id) on delete cascade,
  project_id     uuid not null references public.projects (id) on delete cascade,
  reviewer_id    uuid references public.reviewers (id) on delete set null,
  name           text not null check (char_length(name) between 1 and 80),
  version        text check (char_length(version) <= 20),
  statement      text not null check (char_length(statement) <= 300),
  origin         text not null default '' check (char_length(origin) <= 255),
  -- the open comments at that moment: up to 200 of them, page, author and the start of the text
  open_comments  int not null default 0,
  open_list      jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists round_approvals_project_idx on public.round_approvals (project_id, created_at desc);
create index if not exists round_approvals_round_idx on public.round_approvals (round_id);
create index if not exists round_approvals_reviewer_idx on public.round_approvals (reviewer_id);
alter table public.round_approvals enable row level security;
create policy "members read approvals" on public.round_approvals for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
revoke all on public.round_approvals from anon;
revoke insert, update, delete on public.round_approvals from authenticated;

-- ---------- comments carry their round ----------

alter table public.threads add column if not exists round_id uuid references public.review_rounds (id) on delete set null;
create index if not exists threads_project_round_idx on public.threads (project_id, round_id);

create or replace function public._thread_round() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rounds boolean;
  rid uuid;
begin
  select rounds_on into rounds from public.projects where id = new.project_id;
  if rounds is not true then new.round_id := null; return new; end if;
  select id into rid from public.review_rounds where project_id = new.project_id and status = 'open';
  new.round_id := rid;
  -- Between rounds the team keeps commenting; reviewers wait for the next round.
  if rid is null and new.reviewer is not null
     and not exists (select 1 from public.reviewers r where r.id::text = new.reviewer and r.team) then
    raise exception 'round_closed';
  end if;
  return new;
end $$;
drop trigger if exists thread_round on public.threads;
create trigger thread_round before insert on public.threads for each row execute function public._thread_round();
revoke all on function public._thread_round() from public, anon, authenticated;

-- ---------- start_review: remembers browsers opened by the team ----------

-- As before (…_reviewers.sql), plus: a one-time link (no days) is what members make for themselves,
-- so the browser that uses it is the team's.
create or replace function public.start_review(p_public_id text, p_token text default null, p_name text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  pdraft jsonb;
  uid uuid := auth.uid();
  t public.handoffs;
  nm text := public._clean(p_name, 80);
  prev boolean := false;
  own boolean := false;
  r public.reviewers;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not public.take_rate('start:' || uid, 10) then raise exception 'rate_limited'; end if;
  select id, draft into pid, pdraft from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_allowed(pid) then raise exception 'origin_not_allowed'; end if;
  if p_token is not null then
    select * into t from public.handoffs
      where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') and project_id = pid for update;
    if t.token_hash is null or t.expires_at < now() or t.uses >= t.max_uses then raise exception 'link_expired'; end if;
    update public.handoffs set uses = uses + 1, used_at = now() where token_hash = t.token_hash;
    nm := coalesce(nm, t.reviewer_name);
    prev := t.preview;
    own := t.kind = 'link';
  elsif not exists (select 1 from public.reviewers where project_id = pid and user_id = uid)
        and coalesce(public._live_config(pid) ->> 'audience', 'reviewers') <> 'everyone' then
    raise exception 'not_invited';
  end if;
  insert into public.reviewers (project_id, user_id, name, preview_until, team)
  values (pid, uid, coalesce(nm, 'Guest'), case when prev then now() + interval '1 hour' end, own)
  on conflict (project_id, user_id) do update
    set name = coalesce(nm, public.reviewers.name),
        preview_until = case when prev then now() + interval '1 hour' else public.reviewers.preview_until end,
        team = public.reviewers.team or excluded.team,
        last_seen = now()
  returning * into r;
  return json_build_object('name', r.name, 'preview', coalesce(r.preview_until > now(), false),
                           'draft', case when r.preview_until > now() then pdraft end);
end $$;
revoke all on function public.start_review(text, text, text) from public, anon;
grant execute on function public.start_review(text, text, text) to authenticated;

-- ---------- the script: the current round, and approving it ----------

create or replace function public._round_json(x public.review_rounds) returns json
language sql stable as $$
  select case when x.id is null then null else json_build_object(
    'id', x.id, 'n', x.n, 'name', x.name, 'note', x.note, 'due', x.due, 'status', x.status,
    'startedAt', x.started_at, 'closedAt', x.closed_at) end
$$;

-- What the widget shows: rounds on or off, the latest round, whether this browser may comment now.
create or replace function public.current_round(p_public_id text) returns json
language plpgsql security definer set search_path = public as $$
declare
  r public.reviewers := public._reviewer_for(p_public_id);
  p public.projects;
  x public.review_rounds;
begin
  if not public.take_rate('read:' || auth.uid(), 120) then raise exception 'rate_limited'; end if;
  select * into p from public.projects where id = r.project_id;
  if not p.rounds_on then return json_build_object('on', false); end if;
  select * into x from public.review_rounds where project_id = p.id order by n desc limit 1;
  return json_build_object(
    'on', true, 'included', p.rounds_included, 'team', r.team,
    'round', public._round_json(x),
    'open', (select count(*) from (select 1 from public.threads t where t.project_id = p.id and t.resolved_at is null limit 1000) c));
end $$;

create or replace function public.approve_round(p_public_id text, p_round uuid, p_name text, p_confirm boolean) returns json
language plpgsql security definer set search_path = public as $$
declare
  r public.reviewers := public._reviewer_for(p_public_id);
  p public.projects;
  x public.review_rounds;
  nm text := coalesce(public._clean(p_name, 80), r.name);
  a public.round_approvals;
begin
  if not public.take_rate('approve:' || auth.uid(), 5) then raise exception 'rate_limited'; end if;
  if p_confirm is not true then raise exception 'not_confirmed'; end if;
  select * into p from public.projects where id = r.project_id;
  if not p.rounds_on then raise exception 'rounds_off'; end if;
  select * into x from public.review_rounds where id = p_round and project_id = p.id for update;
  if x.id is null or x.status <> 'open' then raise exception 'round_not_open'; end if;
  insert into public.round_approvals (round_id, project_id, reviewer_id, name, version, statement, origin, open_comments, open_list)
  values (x.id, p.id, r.id, nm, left(nullif(btrim(public._live_config(p.id) ->> 'version'), ''), 20),
          'I''ve reviewed this version and approve it.', left(public._request_origin(), 255),
          (select count(*) from public.threads t where t.project_id = p.id and t.resolved_at is null),
          coalesce((select json_agg(json_build_object('page', t.page, 'author', t.author_name, 'text', left(t.text, 300), 'at', t.created_at) order by t.created_at)
                    from (select * from public.threads t where t.project_id = p.id and t.resolved_at is null order by t.created_at desc limit 200) t), '[]'::json)::jsonb)
  returning * into a;
  perform set_config('vc.approving', '1', true);
  update public.review_rounds set status = 'approved', closed_at = now() where id = x.id;
  perform set_config('vc.approving', '', true);
  insert into public.email_outbox (project_id, approval_id) values (p.id, a.id);
  return json_build_object('id', a.id, 'name', a.name, 'at', a.created_at, 'version', a.version, 'round', public._round_json((select y from public.review_rounds y where y.id = x.id)));
end $$;

revoke all on function public._round_json(public.review_rounds) from public, anon, authenticated;
revoke all on function public.current_round(text), public.approve_round(text, uuid, text, boolean) from public, anon;
grant execute on function public.current_round(text), public.approve_round(text, uuid, text, boolean) to authenticated;

-- ---------- email: approvals ----------

alter table public.email_outbox add column if not exists approval_id uuid references public.round_approvals (id) on delete cascade;
create index if not exists email_outbox_approval_idx on public.email_outbox (approval_id);

-- As before (…_email.sql), plus approvals: they go out with the next instant run whether the project
-- is on 'instant' or 'daily' (an approval is a milestone, not a comment); 'off' still sends nothing.
create or replace function public.email_due(p_daily boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
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
                 case when o.approval_id is not null then 'approval' when o.reply_id is null then 'comment' else 'reply' end as type,
                 t.kind, coalesce(t.page, '') as page, t.id as thread_id,
                 coalesce(a.name, r.author_name, t.author_name) as author,
                 left(coalesce(rr.name, r.text, t.text), 500) as text,
                 a.version, a.open_comments, rr.n as round_n
            from public.email_outbox o
            left join public.threads t on t.id = o.thread_id
            left join public.replies r on r.id = o.reply_id
            left join public.round_approvals a on a.id = o.approval_id
            left join public.review_rounds rr on rr.id = a.round_id
           where o.project_id = p.id and o.sent_at is null and (t.id is not null or a.id is not null)
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
revoke all on function public.email_due(boolean) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.email_due(boolean) to service_role;
  end if;
end $$;

revoke all on all tables in schema public from anon;

-- ===== migrations/20261124150000_ops.sql =====
-- Internal ops panel (founder only, /app#/ops).
--
-- Who is a platform admin lives in platform_admins, written only by hand in the SQL Editor (no insert,
-- update or delete policy). Every ops read and write goes through a security definer function that
-- refuses anyone who is not an admin, is callable by signed-in users only, and logs writes to ops_audit.
-- Nothing here returns passwords, tokens or comment text; emails are shown to the admin only.

-- ---------- who is an admin ----------

create table if not exists public.platform_admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public, anon, authenticated;
grant select on public.platform_admins to authenticated;
create policy "see own admin row" on public.platform_admins for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins a where a.user_id = auth.uid())
$$;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

create or replace function public._ops_guard() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_platform_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end $$;
revoke all on function public._ops_guard() from public, anon, authenticated;

-- ---------- audit log ----------

create table if not exists public.ops_audit (
  id       bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action   text not null check (char_length(action) <= 60),
  target   text check (char_length(target) <= 200),
  detail   jsonb not null default '{}'::jsonb,
  at       timestamptz not null default now()
);
create index if not exists ops_audit_at_idx on public.ops_audit (at desc);
alter table public.ops_audit enable row level security;
revoke all on public.ops_audit from public, anon, authenticated;

-- ---------- plan overrides ----------

create table if not exists public.account_plans (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  plan       text not null default 'free' check (plan in ('free', 'pro_beta', 'founding', 'pro')),
  note       text check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);
create index if not exists account_plans_plan_idx on public.account_plans (plan);
alter table public.account_plans enable row level security;
revoke all on public.account_plans from public, anon, authenticated;
grant select on public.account_plans to authenticated;
create policy "see own plan" on public.account_plans for select to authenticated
  using (user_id = auth.uid());

-- Indexes for the ops queries (signups by day, projects by day).
create index if not exists projects_created_idx on public.projects (created_at);
create index if not exists threads_created_idx on public.threads (created_at);

-- ---------- helpers: a user's projects and their comments ----------

create or replace function public._ops_user_projects(p_user uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.projects p
  join public.workspace_members m on m.workspace_id = p.workspace_id
  where m.user_id = p_user and p.deleted_at is null
$$;
revoke all on function public._ops_user_projects(uuid) from public, anon, authenticated;

-- ---------- reads ----------

create or replace function public.ops_overview() returns json
language plpgsql stable security definer set search_path = '' as $$
declare r json;
begin
  perform public._ops_guard();
  with u as (select * from auth.users where not coalesce(is_anonymous, false))
  select json_build_object(
    'users_total', (select count(*) from u),
    'users_24h', (select count(*) from u where created_at > now() - interval '24 hours'),
    'users_7d', (select count(*) from u where created_at > now() - interval '7 days'),
    'users_30d', (select count(*) from u where created_at > now() - interval '30 days'),
    'active_7d', (select count(*) from u where last_sign_in_at > now() - interval '7 days'),
    'projects_total', (select count(*) from public.projects where deleted_at is null),
    'sites_seen', (select count(distinct i.project_id) from public.installs i join public.projects p on p.id = i.project_id where p.deleted_at is null),
    'sites_shown', (select count(distinct i.project_id) from public.installs i join public.projects p on p.id = i.project_id where p.deleted_at is null and i.shown),
    'comments_total', (select count(*) from public.threads),
    'comments_7d', (select count(*) from public.threads where created_at > now() - interval '7 days'),
    'studies_7d', (select count(*) from public.studies where created_at > now() - interval '7 days'),
    'runs_7d', (select count(*) from public.runs where started_at > now() - interval '7 days'),
    'reviewers_total', (select count(*) from public.reviewers),
    'email_pending', (select count(*) from public.email_outbox where sent_at is null),
    'email_stuck', (select count(*) from public.email_outbox where sent_at is null and created_at < now() - interval '1 hour'),
    'plans', (select coalesce(json_object_agg(plan, n), '{}'::json) from (select plan, count(*) n from public.account_plans group by plan) x),
    'founding_limit', 200
  ) into r;
  return r;
end $$;

create or replace function public.ops_signups_daily(p_days int default 30) returns json
language plpgsql stable security definer set search_path = '' as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 180); r json;
begin
  perform public._ops_guard();
  with days as (
    select generate_series((current_date - (d - 1))::timestamp, current_date::timestamp, interval '1 day')::date as day
  )
  select coalesce(json_agg(json_build_object(
    'day', days.day,
    'signups', (select count(*) from auth.users u where not coalesce(u.is_anonymous, false) and u.created_at >= days.day and u.created_at < days.day + 1),
    'projects', (select count(*) from public.projects p where p.created_at >= days.day and p.created_at < days.day + 1)
  ) order by days.day), '[]'::json) into r from days;
  return r;
end $$;

create or replace function public.ops_funnel(p_days int default 30) returns json
language plpgsql stable security definer set search_path = '' as $$
declare d int := least(greatest(coalesce(p_days, 30), 1), 365); r json;
begin
  perform public._ops_guard();
  with u as (
    select id from auth.users where not coalesce(is_anonymous, false) and created_at > now() - make_interval(days => d)
  ), up as (
    select u.id as user_id, p.id as project_id from u
    join public.workspace_members m on m.user_id = u.id
    join public.projects p on p.workspace_id = m.workspace_id and p.deleted_at is null
  )
  select json_build_object(
    'days', d,
    'signed_up', (select count(*) from u),
    'onboarded', (select count(distinct user_id) from up),
    'installed', (select count(distinct up.user_id) from up where exists (select 1 from public.installs i where i.project_id = up.project_id)),
    'commented', (select count(distinct up.user_id) from up where exists (select 1 from public.threads t where t.project_id = up.project_id))
  ) into r;
  return r;
end $$;

create or replace function public.ops_users(p_search text default null, p_limit int default 50, p_offset int default 0) returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  lim int := least(greatest(coalesce(p_limit, 50), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := nullif(btrim(left(coalesce(p_search, ''), 200)), '');
  r json;
begin
  perform public._ops_guard();
  with base as (
    select u.id, u.email, u.created_at, u.last_sign_in_at,
           coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider
    from auth.users u
    where not coalesce(u.is_anonymous, false)
      and (q is null or u.email ilike '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' or u.id::text = q)
  ), page as (
    select * from base order by created_at desc, id limit lim offset off
  )
  select json_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((select json_agg(json_build_object(
      'id', page.id, 'email', page.email, 'created_at', page.created_at, 'last_sign_in_at', page.last_sign_in_at,
      'provider', page.provider,
      'projects', (select count(*) from public._ops_user_projects(page.id)),
      'comments', (select count(*) from public.threads t where t.project_id in (select public._ops_user_projects(page.id))),
      'plan', coalesce((select a.plan from public.account_plans a where a.user_id = page.id), 'free')
    ) order by page.created_at desc, page.id) from page), '[]'::json)
  ) into r;
  return r;
end $$;

create or replace function public.ops_user_detail(p_user uuid) returns json
language plpgsql stable security definer set search_path = '' as $$
declare r json;
begin
  perform public._ops_guard();
  select json_build_object(
    'id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
    'provider', coalesce(u.raw_app_meta_data ->> 'provider', 'email'),
    'plan', (select json_build_object('plan', a.plan, 'note', a.note, 'updated_at', a.updated_at) from public.account_plans a where a.user_id = u.id),
    'workspaces', coalesce((select json_agg(json_build_object(
      'id', w.id, 'name', w.name, 'role', m.role, 'created_at', w.created_at,
      'projects', coalesce((select json_agg(json_build_object(
        'id', p.id, 'name', p.name, 'origin', p.site_url, 'public_id', p.public_id, 'created_at', p.created_at,
        'installed', exists (select 1 from public.installs i where i.project_id = p.id),
        'comments', (select count(*) from public.threads t where t.project_id = p.id)
      ) order by p.created_at) from public.projects p where p.workspace_id = w.id and p.deleted_at is null), '[]'::json)
    ) order by w.created_at) from public.workspace_members m join public.workspaces w on w.id = m.workspace_id where m.user_id = u.id), '[]'::json)
  ) into r
  from auth.users u where u.id = p_user;
  return r;
end $$;

create or replace function public.ops_audit_recent(p_limit int default 50) returns json
language plpgsql stable security definer set search_path = '' as $$
declare r json;
begin
  perform public._ops_guard();
  select coalesce(json_agg(json_build_object(
    'id', x.id, 'admin', x.email, 'action', x.action, 'target', x.target, 'detail', x.detail, 'at', x.at
  ) order by x.at desc, x.id desc), '[]'::json) into r
  from (select a.*, u.email from public.ops_audit a left join auth.users u on u.id = a.admin_id
        order by a.at desc, a.id desc limit least(greatest(coalesce(p_limit, 50), 1), 200)) x;
  return r;
end $$;

-- ---------- writes ----------

create or replace function public.ops_set_plan(p_user uuid, p_plan text, p_note text default null) returns json
language plpgsql security definer set search_path = '' as $$
declare old text; n text := nullif(btrim(left(coalesce(p_note, ''), 500)), '');
begin
  perform public._ops_guard();
  if p_plan not in ('free', 'pro_beta', 'founding', 'pro') then raise exception 'unknown plan'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'no such user'; end if;
  select plan into old from public.account_plans where user_id = p_user;
  if p_plan = 'founding' and coalesce(old, '') <> 'founding'
     and (select count(*) from public.account_plans where plan = 'founding') >= 200 then
    raise exception 'founding seats are full (200)';
  end if;
  insert into public.account_plans (user_id, plan, note, updated_at, updated_by)
  values (p_user, p_plan, n, now(), auth.uid())
  on conflict (user_id) do update set plan = excluded.plan, note = excluded.note, updated_at = now(), updated_by = auth.uid();
  insert into public.ops_audit (admin_id, action, target, detail)
  values (auth.uid(), 'set_plan', p_user::text, jsonb_build_object('from', coalesce(old, 'free'), 'to', p_plan, 'note', n));
  return json_build_object('user_id', p_user, 'plan', p_plan);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.ops_overview()', 'public.ops_signups_daily(int)', 'public.ops_funnel(int)',
    'public.ops_users(text, int, int)', 'public.ops_user_detail(uuid)', 'public.ops_audit_recent(int)',
    'public.ops_set_plan(uuid, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

commit;
