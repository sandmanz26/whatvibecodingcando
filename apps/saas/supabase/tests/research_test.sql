-- Research: studies, participant links, runs and events, the reviewer's heatmap.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r5 (n serial, ok boolean, what text);
grant all on r5 to authenticated, anon; grant all on sequence r5_n_seq to authenticated, anon;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r5 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://kopi.shop') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin)::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users values ('00000000-0000-0000-0000-00000000b0a1', 'k@x.com'), ('00000000-0000-0000-0000-00000000b0b1', null),
  ('00000000-0000-0000-0000-00000000b0c1', null), ('00000000-0000-0000-0000-00000000b0d1', 'other@x.com');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000b0a1');
insert into workspaces (name, created_by) values ('Kopi', '00000000-0000-0000-0000-00000000b0a1');
insert into projects (workspace_id, public_id, name, site_url) select id, 'kopi-shop-r001', 'Kopi', 'https://kopi.shop' from workspaces where name = 'Kopi';
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"modules":{"comments":true,"usability":true,"heatmap":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"*.kopi.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000b0a1' from projects where public_id = 'kopi-shop-r001';
insert into studies (project_id, kind, name, config) select id, 'usability', 'Checkout', '{"tasks":[{"id":"t1","prompt":"Buy a coffee","limitSec":120}]}' from projects where public_id = 'kopi-shop-r001';
insert into studies (project_id, kind, name, config) select id, 'fivesec', 'Home', '{"page":"/","seconds":5}' from projects where public_id = 'kopi-shop-r001';
select pg_temp.check(pg_temp.fails($$update studies set link_hash = repeat('a', 64)$$) <> 'ok', 'members can''t set a link hash of their choice');
select set_config('t.link', public.create_study_link((select id from studies where name = 'Checkout'), 30), false);
select set_config('t.link5', public.create_study_link((select id from studies where name = 'Home'), 30), false);
select pg_temp.check(length(current_setting('t.link')) = 64, 'owner makes a participant link');
-- a stranger can't see or link the study
select pg_temp.as_user('00000000-0000-0000-0000-00000000b0d1');
select pg_temp.check((select count(*) from studies) = 0, 'another customer sees no studies');
select pg_temp.check(pg_temp.fails(format($$select public.create_study_link(%L)$$, (select id from projects limit 1))) <> 'ok', 'another customer can''t make links');
reset role;
select pg_temp.check((select link_hash from studies where name = 'Checkout') <> current_setting('t.link'), 'only the hash of the link is stored');

-- the consent screen: no session needed
set role anon; select set_config('request.headers', '{"origin":"https://kopi.shop"}', false);
select pg_temp.check((public.study_info('kopi-shop-r001', current_setting('t.link')) ->> 'name') = 'Checkout', 'consent screen reads the study (no session)');
select pg_temp.check(pg_temp.fails($$select public.study_info('kopi-shop-r001', 'nope')$$) = 'link_expired', 'a made-up link is refused');
select set_config('request.headers', '{"origin":"https://evil.example"}', false);
select pg_temp.check(pg_temp.fails(format($$select public.study_info('kopi-shop-r001', %L)$$, current_setting('t.link'))) = 'origin_not_allowed', 'another site can''t use the link');
select set_config('request.headers', '{"origin":"https://kopi.shop"}', false);
select pg_temp.check(pg_temp.fails(format($$select public.study_info('kopi-shop-r001', %L)$$, current_setting('t.link5'))) = 'origin_not_allowed', '5-second study: its product isn''t on, refused');
select pg_temp.check(pg_temp.fails(format($$select public.start_run('kopi-shop-r001', %L, 1200, 800)$$, current_setting('t.link'))) <> 'ok', 'anon role can''t start a run');
reset role; set role authenticated;

-- the participant agrees: a run
select pg_temp.as_user('00000000-0000-0000-0000-00000000b0b1', true, 'https://www.kopi.shop');
select set_config('t.run', public.start_run('kopi-shop-r001', current_setting('t.link'), 1280, 800) ->> 'run', false);
select pg_temp.check(current_setting('t.run') <> '', 'participant starts a run (www subdomain allowed)');
select pg_temp.check((public.start_run('kopi-shop-r001', current_setting('t.link'), 1280, 800) ->> 'run') = current_setting('t.run'), 'opening the link again carries on the same run');
select pg_temp.check(public.log_events(current_setting('t.run')::uuid,
  '[{"t":100,"task":"t1","kind":"click","page":"/","x":10,"y":20,"vw":1280,"doc_h":2000,"sel":"#buy","ex":0.5,"ey":0.5,"hit":true},
    {"t":200,"kind":"page","page":"/checkout"},
    {"t":300,"kind":"click","page":"//evil.com","x":1,"y":1},
    {"t":"x","kind":"click","page":"/"},
    {"t":400,"kind":"keys","page":"/"}]') = 2, 'events recorded; bad pages, times and kinds skipped');
select pg_temp.check(pg_temp.fails(format($$select public.log_events(%L, (select jsonb_agg(jsonb_build_object('t', g, 'kind', 'click', 'page', '/')) from generate_series(1, 201) g))$$, current_setting('t.run'))) = 'bad_events', 'at most 200 events per call');
-- someone else can't write to the run
select pg_temp.as_user('00000000-0000-0000-0000-00000000b0c1', true);
select pg_temp.check(pg_temp.fails(format($$select public.log_events(%L, '[]')$$, current_setting('t.run'))) = 'no_run', 'another browser can''t write to the run');
select pg_temp.check(pg_temp.fails(format($$select public.finish_run(%L, '{}')$$, current_setting('t.run'))) = 'no_run', 'another browser can''t finish the run');
select pg_temp.check((select count(*) from runs) = 0 and (select count(*) from run_events) = 0, 'participants can''t read runs or events');
select pg_temp.check(pg_temp.fails($$select public.heatmap_points('kopi-shop-r001', '/')$$) = 'not_invited', 'a participant (not a reviewer) can''t read the heatmap');
-- finish
select pg_temp.as_user('00000000-0000-0000-0000-00000000b0b1', true);
select public.finish_run(current_setting('t.run')::uuid, '{"tasks":[{"id":"t1","outcome":"success","ms":42000}]}', 120);
reset role;
select pg_temp.check((select result -> 'tasks' -> 0 ->> 'outcome' from runs) = 'success' and (select finished_at is not null from runs) and (select events from runs) = 2, 'run finished with its result');
-- the owner sees results
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000b0a1');
select pg_temp.check((select count(*) from runs) = 1 and (select count(*) from run_events) = 2, 'the owner reads runs and events');
-- a reviewer sees the heatmap
reset role;
insert into reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-00000000b0c1', 'Rev' from projects where public_id = 'kopi-shop-r001';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000b0c1', true);
select pg_temp.check(json_array_length(public.heatmap_points('kopi-shop-r001', '/') -> 'points') = 1, 'a reviewer reads the clicks of a page');
-- closing the study stops new runs
select pg_temp.as_user('00000000-0000-0000-0000-00000000b0a1');
update studies set status = 'closed' where name = 'Checkout';
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0c1', true);
reset role;
insert into auth.users values ('00000000-0000-0000-0000-00000000c0c1', null);
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000c0c1', true);
select pg_temp.check(pg_temp.fails(format($$select public.start_run('kopi-shop-r001', %L, 1, 1)$$, current_setting('t.link'))) = 'study_closed', 'a closed study takes no new runs');
-- revoking the link
select pg_temp.as_user('00000000-0000-0000-0000-00000000b0a1');
update studies set status = 'open' where name = 'Checkout';
select public.revoke_study_link((select id from studies where name = 'Checkout'));
select pg_temp.as_user('00000000-0000-0000-0000-00000000c0c1', true);
select pg_temp.check(pg_temp.fails(format($$select public.start_run('kopi-shop-r001', %L, 1, 1)$$, current_setting('t.link'))) = 'link_expired', 'a revoked link stops working');
-- deleting the study deletes its runs and events
select pg_temp.as_user('00000000-0000-0000-0000-00000000b0a1');
delete from studies where name = 'Checkout';
reset role;
select pg_temp.check((select count(*) from runs) = 0 and (select count(*) from run_events) = 0, 'deleting a study deletes its runs and events');
delete from workspaces where name = 'Kopi';
delete from auth.users where id in ('00000000-0000-0000-0000-00000000b0a1', '00000000-0000-0000-0000-00000000b0b1', '00000000-0000-0000-0000-00000000b0c1', '00000000-0000-0000-0000-00000000b0d1', '00000000-0000-0000-0000-00000000c0c1');
\o
\set QUIET 0
select ok, what from r5 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r5;
