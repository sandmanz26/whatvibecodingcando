-- Review rounds and approvals: who may do what, comments carry their round, approvals email the team.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r8 (n serial, ok boolean, what text);
grant all on r8 to authenticated, anon, service_role; grant all on sequence r8_n_seq to authenticated, anon, service_role;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r8 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://rounds.shop') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin)::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users values ('00000000-0000-0000-0000-0000000f0a01', 'owner@rounds.test'), ('00000000-0000-0000-0000-0000000f0b01', null),
  ('00000000-0000-0000-0000-0000000f0c01', null), ('00000000-0000-0000-0000-0000000f0d01', 'other@rounds.test');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0a01');
insert into workspaces (name, created_by) values ('Rounds', '00000000-0000-0000-0000-0000000f0a01');
insert into projects (workspace_id, public_id, name) select id, 'rounds-shop-v01', 'Rounds shop' from workspaces where name = 'Rounds';
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"version":"1.4","modules":{"comments":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"rounds.shop","on":true}]}',
  '00000000-0000-0000-0000-0000000f0a01' from projects where public_id = 'rounds-shop-v01';
select pg_temp.check((select not rounds_on and rounds_included = 2 from projects where public_id = 'rounds-shop-v01'), 'rounds are off by default, 2 included');
reset role;
select set_config('t.pid', (select id::text from projects where public_id = 'rounds-shop-v01'), false);
-- Ani: a client (invite); Tim: the team (opened through a member's one-time link)
insert into reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-0000000f0b01', 'Ani' from projects where public_id = 'rounds-shop-v01';
insert into reviewers (project_id, user_id, name, team) select id, '00000000-0000-0000-0000-0000000f0c01', 'Tim', true from projects where public_id = 'rounds-shop-v01';

-- rounds off: comments as before, no round
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0b01', true);
select pg_temp.check((public.current_round('rounds-shop-v01') ->> 'on')::boolean = false, 'rounds off: the widget hears so');
select set_config('t.c0', public.post_thread('rounds-shop-v01', '/', '{"sel":"h1"}', 'Before rounds') ->> 'id', false);
reset role;
select pg_temp.check((select round_id is null from threads where id = current_setting('t.c0')::uuid), 'rounds off: comments have no round');
set role authenticated;
select pg_temp.check(pg_temp.fails($$select public.approve_round('rounds-shop-v01', gen_random_uuid(), 'Ani', true)$$) like '%rounds_off%', 'rounds off: nothing to approve');

-- the owner turns rounds on; no round open yet
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0a01');
update projects set rounds_on = true where public_id = 'rounds-shop-v01';
select pg_temp.check(pg_temp.fails($$update projects set rounds_included = 21 where public_id = 'rounds-shop-v01'$$) like '%check%', 'included rounds: 1 to 20 or unlimited');
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0b01', true);
select pg_temp.check(pg_temp.fails($$select public.post_thread('rounds-shop-v01', '/', '{"sel":"h1"}', 'Between rounds')$$) like '%round_closed%', 'no round open: reviewers can’t add comments');
select pg_temp.check(pg_temp.fails($$select public.post_reply(current_setting('t.c0')::uuid, 'still a reply', null)$$) = 'ok', 'no round open: reviewers can still reply');
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0c01', true);
select pg_temp.check(pg_temp.fails($$select public.post_thread('rounds-shop-v01', '/', '{"sel":"h1"}', 'Team note')$$) = 'ok', 'no round open: the team can still comment');
select pg_temp.check((public.current_round('rounds-shop-v01') ->> 'team')::boolean, 'the widget knows a team browser');

-- the owner starts round 1
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0a01');
insert into review_rounds (project_id, n, name, note, due, created_by) select id, 1, 'Round 1', 'New checkout', '2026-11-28', '00000000-0000-0000-0000-0000000f0a01' from projects where public_id = 'rounds-shop-v01';
select pg_temp.check(pg_temp.fails($$insert into review_rounds (project_id, n, name) select id, 2, 'Round 2' from projects where public_id = 'rounds-shop-v01'$$) like '%duplicate%', 'only one round open at a time');
select pg_temp.check(pg_temp.fails($$update review_rounds set status = 'approved' where name = 'Round 1'$$) like '%approved_only_by_reviewer%', 'members can’t mark a round approved themselves');
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0d01');
select pg_temp.check((select count(*) from review_rounds where name = 'Round 1') = 0, 'outsiders don’t see the rounds');
select pg_temp.check(pg_temp.fails($$insert into review_rounds (project_id, n, name) values (current_setting('t.pid')::uuid, 9, 'Mine')$$) <> 'ok', 'outsiders can’t start rounds');

-- the reviewer comments in round 1, then approves
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0b01', true);
select pg_temp.check(pg_temp.fails($$select count(*) from review_rounds$$) = 'ok' and (select count(*) from review_rounds) = 0, 'reviewers don’t read the rounds table');
select pg_temp.check((public.current_round('rounds-shop-v01') -> 'round' ->> 'name') = 'Round 1' and (public.current_round('rounds-shop-v01') -> 'round' ->> 'note') = 'New checkout', 'the widget gets the open round and its note');
select set_config('t.c1', public.post_thread('rounds-shop-v01', '/pay', '{"sel":"#pay"}', 'Pay button too small') ->> 'id', false);
reset role;
select pg_temp.check((select r.name from threads t join review_rounds r on r.id = t.round_id where t.id = current_setting('t.c1')::uuid) = 'Round 1', 'new comments carry the open round');
set role authenticated;
select set_config('t.round', public.current_round('rounds-shop-v01') -> 'round' ->> 'id', false);
select pg_temp.check(pg_temp.fails($$select public.approve_round('rounds-shop-v01', current_setting('t.round')::uuid, 'Ani', false)$$) like '%not_confirmed%', 'approving needs the checkbox');
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0b01', true, 'https://evil.example');
select pg_temp.check(pg_temp.fails($$select public.approve_round('rounds-shop-v01', current_setting('t.round')::uuid, 'Ani', true)$$) like '%origin_not_allowed%', 'approving only from the project’s own site');
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0b01', true);
select set_config('t.appr', public.approve_round('rounds-shop-v01', current_setting('t.round')::uuid, 'Ani Wijaya', true)::text, false);
select pg_temp.check((current_setting('t.appr')::json -> 'round' ->> 'status') = 'approved', 'approving closes the round as approved');
select pg_temp.check(pg_temp.fails($$select public.approve_round('rounds-shop-v01', current_setting('t.round')::uuid, 'Ani', true)$$) like '%round_not_open%', 'a round is approved once');
select pg_temp.check(pg_temp.fails($$select count(*) from round_approvals$$) = 'ok' and (select count(*) from round_approvals) = 0, 'reviewers don’t read approvals');
select pg_temp.check(pg_temp.fails($$insert into round_approvals (round_id, project_id, name, statement) values (current_setting('t.round')::uuid, (select project_id from reviewers limit 1), 'Fake', 'x')$$) <> 'ok', 'nobody writes approvals directly');
select pg_temp.check(pg_temp.fails($$select public.post_thread('rounds-shop-v01', '/', '{"sel":"h1"}', 'After approval')$$) like '%round_closed%', 'after approval reviewers wait for the next round');

-- the owner sees the approval record
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0a01');
select pg_temp.check((select name = 'Ani Wijaya' and version = '1.4' and open_comments = 3 and jsonb_array_length(open_list) = 3 and origin = 'https://rounds.shop' from round_approvals), 'the record: name, version, origin and the open comments then');
select pg_temp.check(pg_temp.fails($$update round_approvals set name = 'Someone else'$$) <> 'ok' or (select name from round_approvals) = 'Ani Wijaya', 'members can’t change an approval');
select pg_temp.check(pg_temp.fails($$update review_rounds set status = 'open', closed_at = null where name = 'Round 1'$$) = 'ok', 'the owner can reopen the latest round');
update review_rounds set status = 'closed', closed_at = now() where name = 'Round 1';
reset role;

-- rate limit
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0a01');
insert into review_rounds (project_id, n, name) select id, 2, 'Round 2' from projects where public_id = 'rounds-shop-v01';
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0b01', true);
select set_config('t.r2', public.current_round('rounds-shop-v01') -> 'round' ->> 'id', false);
reset role;
insert into rate_hits (bucket, minute, hits) values ('approve:00000000-0000-0000-0000-0000000f0b01', date_trunc('minute', now()), 5)
  on conflict (bucket, minute) do update set hits = 5;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000f0b01', true);
select pg_temp.check(pg_temp.fails($$select public.approve_round('rounds-shop-v01', current_setting('t.r2')::uuid, 'Ani', true)$$) like '%rate_limited%', 'approvals are rate limited');
reset role;

-- the approval email
set role service_role;
select set_config('t.due', public.email_due(false)::text, false);
select pg_temp.check(exists (select 1 from json_array_elements(current_setting('t.due')::json -> 0 -> 'items') i where i ->> 'type' = 'approval' and i ->> 'author' = 'Ani Wijaya' and i ->> 'text' = 'Round 1' and i ->> 'version' = '1.4'), 'an approval goes to the outbox with name, round and version');
select pg_temp.check((current_setting('t.due')::json -> 0 -> 'recipients')::text = '["owner@rounds.test"]', 'the approval email goes to the members');
reset role;
update projects set notify = 'daily' where public_id = 'rounds-shop-v01';
set role service_role;
select pg_temp.check((select count(*) from json_array_elements(public.email_due(false) -> 0 -> 'items') i where i ->> 'type' <> 'approval') = 0
  and (select count(*) from json_array_elements(public.email_due(false) -> 0 -> 'items') i where i ->> 'type' = 'approval') = 1, 'daily projects: approvals go out at once, comments wait for the summary');
reset role;

delete from workspaces where name = 'Rounds';
delete from auth.users where id in ('00000000-0000-0000-0000-0000000f0a01', '00000000-0000-0000-0000-0000000f0b01', '00000000-0000-0000-0000-0000000f0c01', '00000000-0000-0000-0000-0000000f0d01');
\o
\set QUIET 0
select ok, what from r8 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r8;
