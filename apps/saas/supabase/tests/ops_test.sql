-- Internal ops panel: only platform admins may call the ops functions; anon never; writes are audited.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r8 (n serial, ok boolean, what text);
grant all on r8 to authenticated, anon, service_role; grant all on sequence r8_n_seq to authenticated, anon, service_role;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r8 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users (id, email, last_sign_in_at, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000ad01', 'admin@ops.test', now(), '{"provider":"email"}'),
  ('00000000-0000-0000-0000-00000000ad02', 'user@ops.test', now() - interval '20 days', '{"provider":"google"}');
insert into auth.users (id, email, is_anonymous) values ('00000000-0000-0000-0000-00000000ad03', null, true);
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000ad01');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000ad02');
insert into workspaces (name, created_by) values ('OpsWs', '00000000-0000-0000-0000-00000000ad02');
insert into projects (workspace_id, public_id, name) select id, 'ops-shop-v01', 'Ops shop' from workspaces where name = 'OpsWs';

-- a normal signed-in user
select pg_temp.check(not public.is_platform_admin(), 'a normal user is not an admin');
select pg_temp.check((select count(*) from public.platform_admins) = 0, 'a normal user sees no admin rows');
select pg_temp.check(pg_temp.fails($$select public.ops_overview()$$) = 'not allowed', 'non-admin: ops_overview refused');
select pg_temp.check(pg_temp.fails($$select public.ops_signups_daily(30)$$) = 'not allowed', 'non-admin: ops_signups_daily refused');
select pg_temp.check(pg_temp.fails($$select public.ops_funnel(30)$$) = 'not allowed', 'non-admin: ops_funnel refused');
select pg_temp.check(pg_temp.fails($$select public.ops_users(null, 50, 0)$$) = 'not allowed', 'non-admin: ops_users refused');
select pg_temp.check(pg_temp.fails($$select public.ops_user_detail('00000000-0000-0000-0000-00000000ad02')$$) = 'not allowed', 'non-admin: ops_user_detail refused');
select pg_temp.check(pg_temp.fails($$select public.ops_audit_recent(10)$$) = 'not allowed', 'non-admin: ops_audit_recent refused');
select pg_temp.check(pg_temp.fails($$select public.ops_set_plan('00000000-0000-0000-0000-00000000ad02', 'pro', null)$$) = 'not allowed', 'non-admin: ops_set_plan refused');
select pg_temp.check(pg_temp.fails($$insert into public.account_plans (user_id, plan) values ('00000000-0000-0000-0000-00000000ad02', 'pro')$$) like 'permission denied%', 'users can’t write account_plans');
select pg_temp.check(pg_temp.fails($$insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000ad02')$$) like 'permission denied%', 'users can’t make themselves admin');
select pg_temp.check(pg_temp.fails($$select count(*) from public.ops_audit$$) like 'permission denied%', 'users can’t read the audit log');

-- anon
set role anon;
select pg_temp.as_user('');
select pg_temp.check(pg_temp.fails($$select public.ops_overview()$$) like 'permission denied%', 'anon can’t execute ops_overview');
select pg_temp.check(pg_temp.fails($$select public.ops_set_plan('00000000-0000-0000-0000-00000000ad02', 'pro', null)$$) like 'permission denied%', 'anon can’t execute ops_set_plan');
select pg_temp.check(pg_temp.fails($$select count(*) from public.account_plans$$) like 'permission denied%', 'anon can’t read account_plans');
select pg_temp.check(pg_temp.fails($$select count(*) from public.platform_admins$$) like 'permission denied%', 'anon can’t read platform_admins');

-- usage: the script on a real site, a reviewer and a comment in the last days
reset role;
insert into public.installs (project_id, host, version, shown) select id, 'real-ops.example', '1', true from projects where public_id = 'ops-shop-v01';
insert into auth.users (id, email, is_anonymous) values ('00000000-0000-0000-0000-00000000ad09', null, true);
insert into public.reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-00000000ad09', 'Rina' from projects where public_id = 'ops-shop-v01';
insert into public.threads (project_id, page, anchor, author_name, text) select id, '/', '{"sel":"h1"}', 'Rina', 'x' from projects where public_id = 'ops-shop-v01';

-- the admin
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000ad01');
select pg_temp.check(public.is_platform_admin() and (select count(*) from public.platform_admins) = 1, 'the admin sees their own row');
select pg_temp.check((public.ops_overview() ->> 'users_total')::int >= 2 and (public.ops_overview() ->> 'projects_total')::int >= 1, 'admin gets the overview');
select pg_temp.check(json_array_length(public.ops_signups_daily(30)) = 30 and json_array_length(public.ops_signups_daily(9999)) = 180, 'signups per day are zero-filled and capped at 180');
select pg_temp.check((public.ops_funnel(30) ->> 'onboarded')::int >= 1, 'funnel counts onboarded users');
select pg_temp.check((public.ops_users('user@ops', 500, 0) ->> 'total')::int = 1
  and (public.ops_users('user@ops', 500, 0) -> 'rows' -> 0 ->> 'provider') = 'google'
  and (public.ops_users('user@ops', 500, 0) -> 'rows' -> 0 ->> 'projects')::int = 1, 'users list: search, provider, project count');
select pg_temp.check(not exists (select 1 from json_array_elements(public.ops_users(null, 100, 0) -> 'rows') e where e ->> 'id' = '00000000-0000-0000-0000-00000000ad03'), 'anonymous reviewers are not listed as users');
select pg_temp.check(json_array_length(public.ops_user_detail('00000000-0000-0000-0000-00000000ad02') -> 'workspaces' -> 0 -> 'projects') = 1, 'user detail lists projects');
select pg_temp.check((public.ops_users('user@ops', 10, 0) -> 'rows' -> 0 ->> 'widget') = 'in_use'
  and (public.ops_users('user@ops', 10, 0) -> 'rows' -> 0 ->> 'reviewers')::int = 1
  and (public.ops_users('user@ops', 10, 0) -> 'rows' -> 0 ->> 'comments_7d')::int = 1
  and (public.ops_users('user@ops', 10, 0) -> 'rows' -> 0 ->> 'last_seen') is not null, 'users list: widget in use, reviewers, comments 7d, last script seen');
select pg_temp.check((public.ops_users(null, 100, 0, 'in_use') ->> 'total')::int >= 1
  and not exists (select 1 from json_array_elements(public.ops_users(null, 100, 0, 'none') -> 'rows') e where e ->> 'id' = '00000000-0000-0000-0000-00000000ad02')
  and exists (select 1 from json_array_elements(public.ops_users(null, 100, 0, 'none') -> 'rows') e where e ->> 'id' = '00000000-0000-0000-0000-00000000ad01'), 'filter by widget state');
select pg_temp.check((public.ops_users(null, 100, 0, null, 'activity') -> 'rows' -> 0 ->> 'last_activity') is not null, 'sort by last activity puts active users first');
select pg_temp.check((public.ops_overview() ->> 'sites_in_use')::int >= 1, 'overview counts sites in use');
select pg_temp.check((public.ops_user_detail('00000000-0000-0000-0000-00000000ad02') -> 'workspaces' -> 0 -> 'projects' -> 0 ->> 'widget') = 'in_use'
  and (public.ops_user_detail('00000000-0000-0000-0000-00000000ad02') -> 'workspaces' -> 0 -> 'projects' -> 0 ->> 'installed')::boolean, 'user detail: usage per project');
select pg_temp.check(json_array_length(public.ops_users(null, 9999, 0) -> 'rows') <= 100, 'users list capped at 100');
reset role;
update public.threads set created_at = now() - interval '30 days' where project_id = (select id from projects where public_id = 'ops-shop-v01');
update public.reviewers set last_seen = now() - interval '30 days' where user_id = '00000000-0000-0000-0000-00000000ad09';
set role authenticated;
select pg_temp.check((public.ops_users('user@ops', 10, 0) -> 'rows' -> 0 ->> 'widget') = 'inactive', 'nothing in 14 days: inactive');
reset role;
delete from public.threads where project_id = (select id from projects where public_id = 'ops-shop-v01');
delete from public.reviewers where user_id = '00000000-0000-0000-0000-00000000ad09';
set role authenticated;
select pg_temp.check((public.ops_users('user@ops', 10, 0) -> 'rows' -> 0 ->> 'widget') = 'installed', 'script seen, no activity: installed');
select pg_temp.check(pg_temp.fails($$select public._ops_project_usage(null)$$) like 'permission denied%', 'helpers are not callable by users');
select public.ops_set_plan('00000000-0000-0000-0000-00000000ad02', 'founding', 'early friend');
select pg_temp.check((public.ops_users('user@ops', 10, 0) -> 'rows' -> 0 ->> 'plan') = 'founding', 'ops_set_plan sets the plan');
select pg_temp.check((public.ops_audit_recent(10) -> 0 ->> 'action') = 'set_plan' and (public.ops_audit_recent(10) -> 0 -> 'detail' ->> 'to') = 'founding', 'ops_set_plan writes the audit log');
select pg_temp.check(pg_temp.fails($$select public.ops_set_plan('00000000-0000-0000-0000-00000000ad02', 'gold', null)$$) = 'unknown plan', 'unknown plans refused');
select pg_temp.check((public.ops_overview() -> 'plans' ->> 'founding')::int = 1, 'overview counts founding plans');

-- the user sees their own plan, not others'
select pg_temp.as_user('00000000-0000-0000-0000-00000000ad02');
select pg_temp.check((select plan from public.account_plans) = 'founding' and (select count(*) from public.account_plans) = 1, 'a user reads their own plan');
select pg_temp.check(pg_temp.fails($$update public.account_plans set plan = 'pro'$$) like 'permission denied%', 'users can’t change their plan');
reset role;

delete from workspaces where name = 'OpsWs';
delete from public.ops_audit;
delete from auth.users where id in ('00000000-0000-0000-0000-00000000ad01', '00000000-0000-0000-0000-00000000ad02', '00000000-0000-0000-0000-00000000ad03', '00000000-0000-0000-0000-00000000ad09');
\o
\set QUIET 0
select ok, what from r8 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r8;
