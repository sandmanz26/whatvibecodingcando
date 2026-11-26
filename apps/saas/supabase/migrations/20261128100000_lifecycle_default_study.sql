-- The automatic "Site heatmap" study (is_default) isn't a study the user made: the day-7 email
-- ("test with real users") still goes to people who haven't created one themselves.
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
               bool_or(exists (select 1 from public.studies st where st.project_id = p.id and not st.is_default)) as studied
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
