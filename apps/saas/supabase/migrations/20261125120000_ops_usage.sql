-- Ops panel: does each user actually use the widget? And the welcome email on the first sign-in.
--
-- 1. Usage per project (_ops_project_usage): is the script installed on a real site (installs outside
--    the demo origins), when it was last seen, comments (7 days / total), reviewers, studies and their
--    results, rounds on, and the last activity (a comment, a reviewer's reply or visit, a study, a run).
--    A user's widget state comes from their projects (the best one wins):
--      none       not installed: the script never reported from a real site and there is no activity
--      installed  the script reported, but no reviewer or study activity yet
--      in_use     reviewer or study activity in the last 14 days
--      inactive   was in use, nothing in 14 days or more
--    ops_users gains the state, a filter by state and sorting by last activity; ops_user_detail lists the
--    usage per project; ops_overview counts "sites in use (14 days)". Same rules as before: admin only,
--    security definer, empty search path, capped limits, never comment text.
-- 2. Welcome email: only after the first real sign-in (an email signup after its confirmation, an email
--    code after it was entered, a Google sign-in: last_sign_in_at or email_confirmed_at set), and within
--    7 days of that confirmation rather than of the signup. Still at most once (email_sent).

-- ---------- usage per project ----------

create index if not exists reviewers_project_seen_idx on public.reviewers (project_id, last_seen desc);
create index if not exists installs_project_seen_idx on public.installs (project_id, last_seen desc);

create or replace function public._ops_project_usage(p_project uuid)
returns table (installed boolean, last_seen timestamptz, comments bigint, comments_7d bigint, last_comment_at timestamptz,
               reviewers bigint, studies bigint, results bigint, rounds_on boolean, last_activity timestamptz, state text)
language sql stable security definer set search_path = '' as $$
  with i as (
    select max(x.last_seen) as seen from public.installs x
     where x.project_id = p_project and not public._is_demo_host(x.host)
  ), t as (
    select count(*) as n, count(*) filter (where x.created_at > now() - interval '7 days') as n7, max(x.created_at) as last
      from public.threads x where x.project_id = p_project
  ), rp as (
    select max(r.created_at) as last from public.replies r join public.threads x on x.id = r.thread_id
     where x.project_id = p_project and r.author_id is null
  ), rv as (
    select count(*) filter (where not r.team) as n, max(r.last_seen) as last from public.reviewers r where r.project_id = p_project
  ), st as (
    select count(*) as n, max(s.created_at) as last from public.studies s where s.project_id = p_project
  ), ru as (
    select count(*) filter (where r.finished_at is not null) as n, max(r.started_at) as last from public.runs r where r.project_id = p_project
  ), a as (
    select greatest(t.last, rp.last, rv.last, st.last, ru.last) as last from t, rp, rv, st, ru
  )
  select i.seen is not null, i.seen, t.n, t.n7, t.last, rv.n, st.n, ru.n,
         coalesce((select p.rounds_on from public.projects p where p.id = p_project), false),
         a.last,
         case when a.last > now() - interval '14 days' then 'in_use'
              when a.last is not null then 'inactive'
              when i.seen is not null then 'installed'
              else 'none' end
    from i, t, rp, rv, st, ru, a
$$;
revoke all on function public._ops_project_usage(uuid) from public, anon, authenticated;

-- A user's usage over all their projects: the best state wins (in_use > inactive > installed > none).
create or replace function public._ops_user_usage(p_user uuid)
returns table (state text, last_seen timestamptz, last_comment_at timestamptz, comments bigint, comments_7d bigint,
               reviewers bigint, studies bigint, results bigint, rounds_on boolean, last_activity timestamptz, sites_installed bigint)
language sql stable security definer set search_path = '' as $$
  select coalesce((array['none', 'installed', 'inactive', 'in_use'])[max(case u.state when 'in_use' then 4 when 'inactive' then 3 when 'installed' then 2 else 1 end)], 'none'),
         max(u.last_seen), max(u.last_comment_at), coalesce(sum(u.comments), 0)::bigint, coalesce(sum(u.comments_7d), 0)::bigint,
         coalesce(sum(u.reviewers), 0)::bigint, coalesce(sum(u.studies), 0)::bigint, coalesce(sum(u.results), 0)::bigint,
         coalesce(bool_or(u.rounds_on), false), max(u.last_activity), count(*) filter (where u.installed)
    from public._ops_user_projects(p_user) pid cross join lateral public._ops_project_usage(pid) u
$$;
revoke all on function public._ops_user_usage(uuid) from public, anon, authenticated;

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
    'sites_in_use', (select count(*) from public.projects p cross join lateral public._ops_project_usage(p.id) x where p.deleted_at is null and x.state = 'in_use'),
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

drop function if exists public.ops_users(text, int, int);
create or replace function public.ops_users(p_search text default null, p_limit int default 50, p_offset int default 0,
                                            p_state text default null, p_sort text default 'created') returns json
language plpgsql stable security definer set search_path = '' as $$
declare
  lim int := least(greatest(coalesce(p_limit, 50), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  q text := nullif(btrim(left(coalesce(p_search, ''), 200)), '');
  st text := case when p_state in ('none', 'installed', 'in_use', 'inactive') then p_state end;
  by_activity boolean := coalesce(p_sort = 'activity', false);
  r json;
begin
  perform public._ops_guard();
  with base as (
    select u.id, u.email, u.created_at, u.last_sign_in_at,
           coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider
    from auth.users u
    where not coalesce(u.is_anonymous, false)
      and (q is null or u.email ilike '%' || replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_') || '%' or u.id::text = q)
  ), used as (
    select base.*, x.state, x.last_seen, x.last_comment_at, x.comments, x.comments_7d, x.reviewers, x.studies,
           x.results, x.rounds_on, x.last_activity
      from base cross join lateral public._ops_user_usage(base.id) x
  ), filtered as (
    select * from used where st is null or used.state = st
  ), page as (
    select filtered.*, case when by_activity then coalesce(filtered.last_activity, filtered.last_seen) end as sort_at
      from filtered
     order by sort_at desc nulls last, filtered.created_at desc, filtered.id
     limit lim offset off
  )
  select json_build_object(
    'total', (select count(*) from filtered),
    'states', (select coalesce(json_object_agg(s.state, s.n), '{}'::json) from (select used.state, count(*) n from used group by used.state) s),
    'rows', coalesce((select json_agg(json_build_object(
      'id', page.id, 'email', page.email, 'created_at', page.created_at, 'last_sign_in_at', page.last_sign_in_at,
      'provider', page.provider,
      'projects', (select count(*) from public._ops_user_projects(page.id)),
      'comments', page.comments, 'comments_7d', page.comments_7d, 'last_comment_at', page.last_comment_at,
      'widget', page.state, 'last_seen', page.last_seen, 'last_activity', page.last_activity,
      'reviewers', page.reviewers, 'studies', page.studies, 'results', page.results, 'rounds_on', page.rounds_on,
      'plan', coalesce((select a.plan from public.account_plans a where a.user_id = page.id), 'free')
    ) order by page.sort_at desc nulls last, page.created_at desc, page.id) from page), '[]'::json)
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
        'installed', x.installed, 'last_seen', x.last_seen, 'comments', x.comments, 'comments_7d', x.comments_7d,
        'reviewers', x.reviewers, 'studies', x.studies, 'results', x.results, 'rounds_on', x.rounds_on,
        'last_activity', x.last_activity, 'widget', x.state
      ) order by p.created_at) from public.projects p cross join lateral public._ops_project_usage(p.id) x
        where p.workspace_id = w.id and p.deleted_at is null), '[]'::json)
    ) order by w.created_at) from public.workspace_members m join public.workspaces w on w.id = m.workspace_id where m.user_id = u.id), '[]'::json)
  ) into r
  from auth.users u where u.id = p_user;
  return r;
end $$;

revoke all on function public.ops_overview() from public, anon;
grant execute on function public.ops_overview() to authenticated;
revoke all on function public.ops_users(text, int, int, text, text) from public, anon;
grant execute on function public.ops_users(text, int, int, text, text) to authenticated;
revoke all on function public.ops_user_detail(uuid) from public, anon;
grant execute on function public.ops_user_detail(uuid) to authenticated;

-- ---------- welcome email on the first sign-in ----------

create or replace function public.email_lifecycle_due(p_welcome_only boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  -- Accounts that have signed in (or confirmed their email) get their preference row (tips on).
  -- Google: signed in at once. Email link or email code: once confirmed. Never before.
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
          (1, 'welcome', greatest(u.created_at, coalesce(u.email_confirmed_at, u.created_at)) > now() - interval '7 days'),
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
       -- the first sign-in has happened (a preference row alone, e.g. from an unfinished sign-up, is not enough)
       and coalesce(u.email_confirmed_at, u.last_sign_in_at) is not null
       and not exists (select 1 from public.email_sent x where x.user_id = u.id and x.kind not like 'weekly-%' and x.sent_at > now() - interval '20 hours')
     limit 500) z), '[]'::json);
end $$;
revoke all on function public.email_lifecycle_due(boolean) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.email_lifecycle_due(boolean) to service_role;
  end if;
end $$;
