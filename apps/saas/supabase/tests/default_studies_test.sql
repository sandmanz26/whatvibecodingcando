-- One default (★) study per research module; visitors under "Everyone"; nothing changes for existing installs.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r8 (n serial, ok boolean, what text);
grant all on r8 to authenticated, anon; grant all on sequence r8_n_seq to authenticated, anon;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r8 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://kopi.shop', ip text default '203.0.113.7') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin, 'x-forwarded-for', ip)::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users values ('00000000-0000-0000-0000-00000000f0a1', 'kopi@x.com'), ('00000000-0000-0000-0000-00000000f0b1', null),
  ('00000000-0000-0000-0000-00000000f0c1', null), ('00000000-0000-0000-0000-00000000f0d1', null);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000f0a1');
insert into workspaces (name, created_by) values ('Kopi', '00000000-0000-0000-0000-00000000f0a1');
insert into projects (workspace_id, public_id, name, site_url) select id, 'kopi-old-ds01', 'Old install', 'https://kopi.shop' from workspaces where name = 'Kopi';
insert into projects (workspace_id, public_id, name, site_url) select id, 'kopi-new-ds02', 'New install', 'https://kopi.shop' from workspaces where name = 'Kopi';

-- ---- an existing install: published with Heatmap only, audience reviewers, plus a study of its own with a link ----
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"modules":{"comments":true,"heatmap":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"kopi.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000f0a1' from projects where public_id = 'kopi-old-ds01';
insert into studies (project_id, kind, name, config) select id, 'browse', 'Pricing visit', '{"minutes":3}' from projects where public_id = 'kopi-old-ds01';
select set_config('t.own', public.create_study_link((select id from studies where name = 'Pricing visit'), 30), false);
reset role;
select set_config('t.before', (select json_agg(row_to_json(x) order by id)::text from (select id, name, kind, status, is_default, link_hash, config from studies where project_id = (select id from projects where public_id = 'kopi-old-ds01')) x), false);
-- the migration's backfill, run again (it is idempotent)
select public._ensure_default_studies(id) from projects where deleted_at is null;
select public._ensure_default_studies(id) from projects where deleted_at is null;
select pg_temp.check(current_setting('t.before') = (select json_agg(row_to_json(x) order by id)::text from (select id, name, kind, status, is_default, link_hash, config from studies where project_id = (select id from projects where public_id = 'kopi-old-ds01')) x), 'existing install: studies unchanged by the backfill (heatmap only → just its Site heatmap)');
select pg_temp.check((select public._live_config(id) ->> 'audience' from projects where public_id = 'kopi-old-ds01') = 'reviewers', 'existing install: audience stays reviewers');
select pg_temp.check((select count(*) from studies s join projects p on p.id = s.project_id where p.public_id = 'kopi-old-ds01' and s.is_default) = 1, 'existing install: one default (Site heatmap)');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0c1', true);
select pg_temp.check((public.study_info('kopi-old-ds01', current_setting('t.own')) ->> 'name') = 'Pricing visit', 'existing study link still opens its own study');
select pg_temp.check(public.start_run('kopi-old-ds01', current_setting('t.own'), 1280, 800) ->> 'run' is not null, 'and starts a participant run');
select pg_temp.check(pg_temp.fails($$select public.start_visitor_run('kopi-old-ds01', 'heatmap', 1280, 800)$$) = 'not_invited', 'audience reviewers: no visitor runs');
select pg_temp.check(public.visitor_modules('kopi-old-ds01')::text = '[]', 'audience reviewers: nothing offered to visitors');
reset role;
-- an old config file without any new fields still parses as a live config
select pg_temp.check(public._live_config((select id from projects where public_id = 'kopi-old-ds01')) -> 'modules' ->> 'heatmap' = 'true', 'old config shape still read');

-- ---- a new install: onboarding publishes Heatmap, 5-second and Usability, audience Everyone ----
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0a1');
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"modules":{"comments":true,"heatmap":true,"fivesec":true,"usability":true},"audience":"everyone","envs":[{"id":"e1","name":"Website","host":"kopi.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000f0a1' from projects where public_id = 'kopi-new-ds02';
reset role;
select pg_temp.check((select string_agg(s.module || ':' || s.name, ',' order by s.module) from studies s join projects p on p.id = s.project_id where p.public_id = 'kopi-new-ds02' and s.is_default)
  = 'fivesec:First impression,heatmap:Site heatmap,usability:Usability test', 'one default per module that is on');
select pg_temp.check((select config -> 'tasks' -> 0 ->> 'prompt' from studies where name = 'Usability test') = 'Explore the site and find what you came for', 'usability default has its built-in task');
select pg_temp.check((select config -> 'questions' ->> 0 from studies where name = 'First impression') = 'What is this page about?', '5-second default asks what the page is about');
-- turning Eye tracking on later adds its default; publishing again adds nothing else
insert into releases (project_id, version, config, created_by) select id, 2,
  '{"v":1,"on":true,"modules":{"comments":true,"heatmap":true,"fivesec":true,"usability":true,"gaze":true},"audience":"everyone","envs":[{"id":"e1","name":"Website","host":"kopi.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000f0a1' from projects where public_id = 'kopi-new-ds02';
insert into releases (project_id, version, config, created_by) select project_id, 3, config, created_by from releases where version = 2 and project_id = (select id from projects where public_id = 'kopi-new-ds02');
select pg_temp.check((select count(*) from studies s join projects p on p.id = s.project_id where p.public_id = 'kopi-new-ds02' and s.is_default) = 4
  and (select eye_tracking and kind = 'browse' from studies where name = 'Eye tracking'), 'eye tracking default added once (browse with eye tracking)');
select pg_temp.check(pg_temp.fails($$insert into studies (project_id, kind, name, is_default) select id, 'fivesec', 'Second', true from projects where public_id = 'kopi-new-ds02'$$) <> 'ok', 'a second default for one module is refused');

-- ---- visitors (Everyone) ----
set role anon; select set_config('request.headers', '{"origin":"https://kopi.shop","x-forwarded-for":"203.0.113.9"}', false);
select pg_temp.check((select string_agg((m ->> 'module') || '=' || (m ->> 'state'), ',') from json_array_elements(public.visitor_modules('kopi-new-ds02')) m) = 'heatmap=open,gaze=open,fivesec=open,usability=open', 'visitor_modules lists every module that is on');
reset role;
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0d1', true);
-- the visitor joined the open widget for comments (no link)
select public.start_review('kopi-new-ds02', null, null);
select set_config('t.vrun', public.start_visitor_run('kopi-new-ds02', 'heatmap', 1280, 800) ->> 'run', false);
select pg_temp.check(public.start_visitor_run('kopi-new-ds02', 'heatmap', 1280, 800) ->> 'run' = current_setting('t.vrun'), 'a visitor reuses their run');
select pg_temp.check(public.log_events(current_setting('t.vrun')::uuid, '[{"t":5,"kind":"click","page":"/","x":10,"y":20,"vw":1280,"sel":"#buy","label":"button"}]') = 1, 'a visitor''s clicks are recorded');
select pg_temp.check(pg_temp.fails($$select public.heatmap_points('kopi-new-ds02', '/')$$) = 'not_invited', 'visitors can''t read the heatmap');
select pg_temp.check(pg_temp.fails($$select public.heatmap_summary('kopi-new-ds02', '/')$$) = 'not_invited', 'nor its summary');
select pg_temp.check(pg_temp.fails($$select public.default_study_invite('kopi-new-ds02')$$) = 'not_invited', 'nor the invite link');
select pg_temp.check(pg_temp.fails($$select public.start_reviewer_run('kopi-new-ds02', 1280, 800)$$) = 'not_invited', 'nor start a reviewer run');
select pg_temp.check(pg_temp.fails($$select count(*) from run_events$$) = 'ok' and (select count(*) from run_events) = 0, 'nor read events directly (row level security)');
select pg_temp.check((public.start_visitor_run('kopi-new-ds02', 'usability', 1280, 800) -> 'config' -> 'tasks' -> 0 ->> 'prompt') is not null, 'a usability visitor run gets the default''s tasks');
reset role;
select pg_temp.check((select source from runs where id = current_setting('t.vrun')::uuid) = 'visitor'
  and (select study_id from runs where id = current_setting('t.vrun')::uuid) = (select id from studies where name = 'Site heatmap' and project_id = (select id from projects where public_id = 'kopi-new-ds02')), 'the visitor run is in the heatmap default study');
-- a team member or reviewer (link) still reads results
insert into reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-00000000f0b1', 'Rev' from projects where public_id = 'kopi-new-ds02';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0b1', true);
select pg_temp.check((select count(*) from json_array_elements(public.heatmap_points('kopi-new-ds02', '/') -> 'points')) = 1, 'a reviewer sees the visitor''s click on the heatmap');
select pg_temp.check(public.module_study_invite('kopi-new-ds02', 'usability') ->> 'token' ~ '^[0-9a-f]{64}$', 'reviewers get each module''s ★ invite link');
reset role;
-- origin, module off, other site
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0d1', true, 'https://evil.example');
select pg_temp.check(pg_temp.fails($$select public.start_visitor_run('kopi-new-ds02', 'heatmap', 1280, 800)$$) = 'origin_not_allowed', 'another site can''t start a visitor run');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f0d1', true);
select pg_temp.check(pg_temp.fails($$select public.start_visitor_run('kopi-new-ds02', 'doors', 1280, 800)$$) = 'bad_module', 'only research modules');
reset role; set role anon;
select pg_temp.check(pg_temp.fails($$select public.start_visitor_run('kopi-new-ds02', 'heatmap', 1280, 800)$$) <> 'ok', 'anon (no session) can''t start a visitor run');
reset role;
-- pause: the ★ study closed → nothing recorded, module shows as paused
update studies set status = 'closed' where name = 'First impression';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0d1', true);
select pg_temp.check(pg_temp.fails($$select public.start_visitor_run('kopi-new-ds02', 'fivesec', 1280, 800)$$) = 'study_closed', 'paused ★ study: nothing recorded');
select pg_temp.check((select m ->> 'state' from json_array_elements(public.visitor_modules('kopi-new-ds02')) m where m ->> 'module' = 'fivesec') = 'paused', 'and visitor_modules says paused');
reset role;
-- rate limit per session
delete from rate_hits where true;
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0c1', true);
select pg_temp.check((select count(*) from generate_series(1, 8) g where pg_temp.fails(format($$select public.start_visitor_run('kopi-new-ds02', 'gaze', %s, 800)$$, g)) = 'rate_limited') = 0, 'reusing a run isn''t rate limited');
reset role;
-- ---- Make default: the ★ moves within the module; data and links stay with each study ----
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0a1');
insert into studies (project_id, kind, name, config) select id, 'browse', 'Spring heatmap', '{"minutes":3}' from projects where public_id = 'kopi-new-ds02';
select pg_temp.check((select module from studies where name = 'Spring heatmap') = 'heatmap' and not (select is_default from studies where name = 'Spring heatmap'), 'an added study is link-only');
select public.make_default_study((select id from studies where name = 'Spring heatmap'));
reset role;
select pg_temp.check((select is_default and link_hash is not null and link_expires is null from studies where name = 'Spring heatmap')
  and not (select is_default from studies where name = 'Site heatmap' and project_id = (select id from projects where public_id = 'kopi-new-ds02')), 'Make default moves the ★ and gives it a lasting link');
select pg_temp.check((select study_id from runs where id = current_setting('t.vrun')::uuid) = (select id from studies where name = 'Site heatmap' and project_id = (select id from projects where public_id = 'kopi-new-ds02')), 'earlier data stays with the old study');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0d1', true, 'https://kopi.shop', '198.51.100.1');
delete from rate_hits where true;
reset role; delete from rate_hits where true;
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0d1', true, 'https://kopi.shop', '198.51.100.1');
select set_config('t.vrun2', public.start_visitor_run('kopi-new-ds02', 'heatmap', 1280, 800) ->> 'run', false);
reset role;
select pg_temp.check((select study_id from runs where id = current_setting('t.vrun2')::uuid) = (select id from studies where name = 'Spring heatmap'), 'new visitor traffic goes to the new ★');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f0d1', true);
select pg_temp.check(pg_temp.fails($$select public.make_default_study((select id from studies where name = 'Spring heatmap'))$$) <> 'ok', 'a visitor can''t move the ★');
reset role;

delete from workspaces where name = 'Kopi';
delete from auth.users where id::text like '00000000-0000-0000-0000-00000000f0%';
\o
\set QUIET 0
select ok, what from r8 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r8;
