-- The rest of the email system: new activity kinds, the weekly summary, lifecycle emails and their preference.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r9 (n serial, ok boolean, what text);
grant all on r9 to authenticated, anon, service_role; grant all on sequence r9_n_seq to authenticated, anon, service_role;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r9 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://life.shop') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin)::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
-- the items of this test's project in an email_due() answer
create function pg_temp.items(due json) returns json language sql as $$
  select coalesce((select e -> 'items' from json_array_elements(due) e where e ->> 'project_id' = 'life-shop-v01'), '[]'::json) $$;
create function pg_temp.mine(due json) returns json language sql as $$
  select coalesce(json_agg(e), '[]'::json) from json_array_elements(due) e where e ->> 'email' like '%@life.test' $$;

-- owner signed up 2 days ago (confirmed); a reviewer (anonymous); a participant (anonymous); a legacy account
insert into auth.users (id, email, created_at, email_confirmed_at, is_anonymous) values
  ('00000000-0000-0000-0000-000000100a01', 'owner@life.test', now() - interval '2 days', now() - interval '2 days', false),
  ('00000000-0000-0000-0000-000000100b01', null, now(), null, true),
  ('00000000-0000-0000-0000-000000100c01', null, now(), null, true),
  ('00000000-0000-0000-0000-000000100d01', 'old@life.test', now() - interval '2 days', now() - interval '2 days', false),
  ('00000000-0000-0000-0000-000000100e01', 'unconfirmed@life.test', now(), null, false);
insert into email_prefs (user_id, marketing, legacy) values ('00000000-0000-0000-0000-000000100d01', false, true);

-- ---------- preferences ----------
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000100a01');
select pg_temp.check((public.email_prefs_get() ->> 'marketing')::boolean, 'new accounts: tips and product updates are on by default');
select pg_temp.check(pg_temp.fails($$select count(*) from public.email_prefs$$) like 'permission denied%', 'users can’t read the preference table directly (or anyone’s token)');
select pg_temp.check(pg_temp.fails($$select count(*) from public.email_sent$$) like 'permission denied%', 'users can’t read the sent log');
select pg_temp.check(pg_temp.fails($$select public.email_lifecycle_due(false)$$) like 'permission denied%', 'users can’t call email_lifecycle_due');
select pg_temp.check(pg_temp.fails($$select public.email_unsubscribe('x')$$) like 'permission denied%', 'users can’t call email_unsubscribe');
select pg_temp.check(pg_temp.fails($$select public.email_weekly_due()$$) like 'permission denied%', 'users can’t call email_weekly_due');
select public.email_prefs_set(false);
select pg_temp.check((public.email_prefs_get() ->> 'marketing')::boolean = false, 'a user can turn tips off…');
select public.email_prefs_set(true);
select pg_temp.check((public.email_prefs_get() ->> 'marketing')::boolean, '…and on again');
select pg_temp.as_user('00000000-0000-0000-0000-000000100b01', true);
select pg_temp.check(pg_temp.fails($$select public.email_prefs_get()$$) like '%not_signed_in%', 'anonymous reviewers have no email preference');
reset role;
set role anon;
select pg_temp.check(pg_temp.fails($$select public.email_prefs_get()$$) like 'permission denied%', 'anon can’t call email_prefs_get');
reset role;

-- ---------- lifecycle ----------
set role service_role;
select set_config('t.l', pg_temp.mine(public.email_lifecycle_due(true))::text, false);
select pg_temp.check(json_array_length(current_setting('t.l')::json) = 1 and current_setting('t.l')::json -> 0 ->> 'kind' = 'welcome'
  and current_setting('t.l')::json -> 0 ->> 'email' = 'owner@life.test', 'welcome goes to the new confirmed owner only (not legacy, unconfirmed or anonymous)');
select pg_temp.check((current_setting('t.l')::json -> 0 ->> 'has_project')::boolean = false and length(current_setting('t.l')::json -> 0 ->> 'token') = 64, 'carries whether they have a project and their unsubscribe token');
select public.email_sent_mark(json_build_array(json_build_object('user_id', '00000000-0000-0000-0000-000000100a01', 'kind', 'welcome')));
select pg_temp.check(json_array_length(pg_temp.mine(public.email_lifecycle_due(false))) = 0, 'at most one lifecycle email a day');
reset role;
update email_sent set sent_at = now() - interval '1 day' where user_id = '00000000-0000-0000-0000-000000100a01';
set role service_role;
select set_config('t.l', pg_temp.mine(public.email_lifecycle_due(false))::text, false);
select pg_temp.check(current_setting('t.l')::json -> 0 ->> 'kind' = 'day1', 'day 1: no install yet → “Add ourhunch in 2 minutes”');
select pg_temp.check(json_array_length(pg_temp.mine(public.email_lifecycle_due(true))) = 0, 'the 5-minute run sends welcomes only');
reset role;

-- the owner installs the script: day 1 stops
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000100a01');
insert into workspaces (name, created_by) values ('Life', '00000000-0000-0000-0000-000000100a01');
insert into projects (workspace_id, public_id, name) select id, 'life-shop-v01', 'Life shop' from workspaces where name = 'Life';
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"modules":{"comments":true,"usability":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"life.shop","on":true}]}',
  '00000000-0000-0000-0000-000000100a01' from projects where public_id = 'life-shop-v01';
reset role;
select set_config('t.pid', (select id::text from projects where public_id = 'life-shop-v01'), false);
set role anon;
select pg_temp.as_user('', false);
select public.report_seen('life-shop-v01', '1', true, '');
reset role;
select pg_temp.check((select count(*) from email_outbox where project_id = current_setting('t.pid')::uuid and event = 'live' and host = 'life.shop') = 1, 'first install report: one “live” email row');
update installs set last_seen = now() - interval '1 hour' where project_id = current_setting('t.pid')::uuid;
insert into installs (project_id, host, version, shown) values (current_setting('t.pid')::uuid, 'staging.life.shop', '1', true);
select pg_temp.check((select count(*) from email_outbox where project_id = current_setting('t.pid')::uuid and event = 'live') = 1, '“live” is sent once per project, not per site');
set role service_role;
select pg_temp.check(json_array_length(pg_temp.mine(public.email_lifecycle_due(false))) = 0, 'day 1 stops once the script is installed (and day 3 waits until day 3)');
reset role;
update auth.users set created_at = now() - interval '4 days' where id = '00000000-0000-0000-0000-000000100a01';
set role service_role;
select set_config('t.l', pg_temp.mine(public.email_lifecycle_due(false))::text, false);
select pg_temp.check(current_setting('t.l')::json -> 0 ->> 'kind' = 'day3' and (current_setting('t.l')::json -> 0 ->> 'installed')::boolean, 'day 3: installed, no reviewer yet → “Invite your first client”');
reset role;
-- a client comes in: day 3 stops; tips off stops everything
insert into reviewers (project_id, user_id, name) values (current_setting('t.pid')::uuid, '00000000-0000-0000-0000-000000100b01', 'Ani');
set role service_role;
select pg_temp.check(json_array_length(pg_temp.mine(public.email_lifecycle_due(false))) = 0, 'day 3 stops once a reviewer exists');
reset role;
update auth.users set created_at = now() - interval '8 days' where id = '00000000-0000-0000-0000-000000100a01';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-000000100b01', true);
select set_config('t.thread', public.post_thread('life-shop-v01', '/checkout', '{"sel":"#pay","fp":{"t":"button","x":"Pay now"},"device":{"browser":"Chrome 131","os":"macOS","w":1280,"h":800,"dpr":2}}', 'The pay button is hidden on my phone') ->> 'id', false);
reset role;
set role service_role;
select pg_temp.check(pg_temp.mine(public.email_lifecycle_due(false)) -> 0 ->> 'kind' = 'day7', 'day 7: comments but no study → “Test with real users”');
reset role;
update email_prefs set marketing = false where user_id = '00000000-0000-0000-0000-000000100a01';
set role service_role;
select pg_temp.check(json_array_length(pg_temp.mine(public.email_lifecycle_due(false))) = 0, 'tips off: no lifecycle email at all');
select pg_temp.check(public.email_unsubscribe('0000000000000000000000000000000000000000000000000000000000000000') = false, 'an unknown token unsubscribes nobody');
reset role;
update email_prefs set marketing = true where user_id = '00000000-0000-0000-0000-000000100a01';
set role service_role;
select public.email_unsubscribe((select unsub_token from email_prefs where user_id = '00000000-0000-0000-0000-000000100a01'));
reset role;
select pg_temp.check((select not marketing from email_prefs where user_id = '00000000-0000-0000-0000-000000100a01'), 'the unsubscribe token turns tips off');
update email_prefs set marketing = true where user_id = '00000000-0000-0000-0000-000000100a01';
set role service_role;
select public.email_sent_mark(json_build_array(json_build_object('user_id', '00000000-0000-0000-0000-000000100a01', 'kind', 'day7')));
select public.email_sent_mark(json_build_array(json_build_object('user_id', '00000000-0000-0000-0000-000000100a01', 'kind', 'day7')));
reset role;
select pg_temp.check((select count(*) from email_sent where user_id = '00000000-0000-0000-0000-000000100a01' and kind = 'day7') = 1, 'each kind is recorded once');

-- ---------- activity: comment context, results, rounds ----------
set role service_role;
select set_config('t.i', pg_temp.items(public.email_due(false))::text, false);
reset role;
select pg_temp.check(exists (select 1 from json_array_elements(current_setting('t.i')::json) e where e ->> 'type' = 'live' and e ->> 'host' = 'life.shop'), 'the instant email carries “live on life.shop”');
select pg_temp.check(exists (select 1 from json_array_elements(current_setting('t.i')::json) e where e ->> 'type' = 'comment'
  and e -> 'element' ->> 'tag' = 'button' and e -> 'element' ->> 'text' = 'Pay now' and e -> 'device' ->> 'browser' = 'Chrome 131'), 'a comment carries its element and device');
update email_outbox set sent_at = now() where project_id = current_setting('t.pid')::uuid;

-- a study and two finished runs
insert into studies (project_id, kind, name) values (current_setting('t.pid')::uuid, 'usability', 'Checkout test');
insert into runs (study_id, project_id, user_id) select id, project_id, '00000000-0000-0000-0000-000000100c01' from studies where name = 'Checkout test';
insert into runs (study_id, project_id, user_id) select id, project_id, '00000000-0000-0000-0000-000000100c01' from studies where name = 'Checkout test';
select pg_temp.check((select count(*) from email_outbox where project_id = current_setting('t.pid')::uuid and event = 'result') = 0, 'a run in progress emails nobody');
update runs set finished_at = now(), result = '{"tasks":[{"id":"a","outcome":"success"},{"id":"b","outcome":"gave_up"}]}' where project_id = current_setting('t.pid')::uuid;
update runs set result = '{}' where project_id = current_setting('t.pid')::uuid;
update runs set finished_at = now() + interval '1 minute', result = '{"tasks":[{"id":"a","outcome":"success"},{"id":"b","outcome":"success"}]}' where project_id = current_setting('t.pid')::uuid;
select pg_temp.check((select count(*) from email_outbox where project_id = current_setting('t.pid')::uuid and event = 'result') = 2, 'each finished run is one “result” row, once');
set role service_role;
select set_config('t.i', pg_temp.items(public.email_due(false))::text, false);
reset role;
select pg_temp.check((select bool_and(e ->> 'type' = 'result' and e ->> 'text' = 'Checkout test' and (e ->> 'results_total')::int = 2
  and (e -> 'tasks' ->> 'ok')::int = 4 and (e -> 'tasks' ->> 'all')::int = 4) from json_array_elements(current_setting('t.i')::json) e), 'results carry the study, how many so far and task success');
update email_outbox set sent_at = now() where project_id = current_setting('t.pid')::uuid;

-- rounds: due tomorrow (once), a client opening the round (once)
update projects set rounds_on = true where id = current_setting('t.pid')::uuid;
insert into review_rounds (project_id, n, name, due) values (current_setting('t.pid')::uuid, 1, 'Round 1', (now() at time zone 'utc')::date + 1);
update reviewers set last_seen = now() where project_id = current_setting('t.pid')::uuid;
update reviewers set last_seen = now() where project_id = current_setting('t.pid')::uuid;
insert into reviewers (project_id, user_id, name, team) values (current_setting('t.pid')::uuid, '00000000-0000-0000-0000-000000100c01', 'Tim', true);
select pg_temp.check((select count(*) from email_outbox where project_id = current_setting('t.pid')::uuid and event = 'reviewing' and actor = 'Ani') = 1, '“your client started reviewing”: once per round, not for the team');
set role service_role;
select set_config('t.i', pg_temp.items(public.email_due(false))::text, false);
select public.email_due(false);
reset role;
select pg_temp.check(exists (select 1 from json_array_elements(current_setting('t.i')::json) e where e ->> 'type' = 'due' and e ->> 'round_name' = 'Round 1'), 'the round due tomorrow is in the instant email');
select pg_temp.check((select count(*) from email_outbox where project_id = current_setting('t.pid')::uuid and event = 'due') = 1, 'the due reminder is enqueued once per round');

-- daily projects: the new kinds wait for the summary
update projects set notify = 'daily' where id = current_setting('t.pid')::uuid;
update email_outbox set sent_at = null where project_id = current_setting('t.pid')::uuid and event = 'due';
set role service_role;
select pg_temp.check(json_array_length(pg_temp.items(public.email_due(false))) = 0 and json_array_length(pg_temp.items(public.email_due(true))) > 0, 'daily: new kinds go into the daily summary');
reset role;

-- ---------- weekly ----------
set role service_role;
select set_config('t.w', pg_temp.mine(public.email_weekly_due())::text, false);
select pg_temp.check(json_array_length(current_setting('t.w')::json) = 1 and (current_setting('t.w')::json -> 0 -> 'projects' -> 0 ->> 'comments')::int = 1
  and (current_setting('t.w')::json -> 0 -> 'projects' -> 0 ->> 'results')::int = 2, 'weekly: one summary per owner with this week’s numbers');
select public.email_sent_mark(json_build_array(json_build_object('user_id', current_setting('t.w')::json -> 0 ->> 'user_id', 'kind', current_setting('t.w')::json -> 0 ->> 'kind')));
select pg_temp.check(json_array_length(pg_temp.mine(public.email_weekly_due())) = 0, 'weekly: once a week');
reset role;
delete from email_sent where kind like 'weekly-%' and user_id = '00000000-0000-0000-0000-000000100a01';
update projects set notify = 'off' where id = current_setting('t.pid')::uuid;
set role service_role;
select pg_temp.check(json_array_length(pg_temp.mine(public.email_weekly_due())) = 0, 'weekly: not for projects set to off');
reset role;

delete from workspaces where name = 'Life';
delete from auth.users where email like '%@life.test' or id in ('00000000-0000-0000-0000-000000100b01', '00000000-0000-0000-0000-000000100c01');
\o
\set QUIET 0
select ok, what from r9 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r9;
