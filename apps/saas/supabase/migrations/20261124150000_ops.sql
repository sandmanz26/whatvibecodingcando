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
