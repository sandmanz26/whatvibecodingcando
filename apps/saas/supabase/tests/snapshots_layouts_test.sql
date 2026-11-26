-- Eye tracking needs gaze; layout versions; page snapshots (claim once, private bucket, members read).
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r9 (n serial, ok boolean, what text);
grant all on r9 to authenticated, anon; grant all on sequence r9_n_seq to authenticated, anon;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r9 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://lime.shop', ip text default '203.0.113.7') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin, 'x-forwarded-for', ip)::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users values ('00000000-0000-0000-0000-00000000f1a1', 'lime@x.com'), ('00000000-0000-0000-0000-00000000f1b1', null),
  ('00000000-0000-0000-0000-00000000f1c1', null), ('00000000-0000-0000-0000-00000000f1d1', 'other@x.com');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000f1a1');
insert into workspaces (name, created_by) values ('Lime', '00000000-0000-0000-0000-00000000f1a1');
insert into projects (workspace_id, public_id, name, site_url) select id, 'lime-shop-sl01', 'Lime', 'https://lime.shop' from workspaces where name = 'Lime';
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"modules":{"comments":true,"heatmap":true,"gaze":true,"usability":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"lime.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000f1a1' from projects where public_id = 'lime-shop-sl01';
select set_config('t.eye', public.create_study_link((select id from studies where name = 'Eye tracking' and project_id = (select id from projects where public_id = 'lime-shop-sl01')), 30), false);
select set_config('t.use', public.create_study_link((select id from studies where name = 'Usability test' and project_id = (select id from projects where public_id = 'lime-shop-sl01')), 30), false);
reset role;
select pg_temp.check((select snapshots from projects where public_id = 'lime-shop-sl01'), 'a new project saves snapshots by default');
update studies set eye_tracking = true where name = 'Usability test' and project_id = (select id from projects where public_id = 'lime-shop-sl01');

-- ---- eye tracking needs gaze ----
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f1b1', true);
select set_config('t.r1', public.start_run('lime-shop-sl01', current_setting('t.eye'), 1280, 800) ->> 'run', false);
select public.discard_run(current_setting('t.r1')::uuid);
reset role;
select pg_temp.check(not exists (select 1 from runs where id = current_setting('t.r1')::uuid), 'declining the camera: the eye-tracking run is deleted');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f1b1', true);
select set_config('t.r2', public.start_run('lime-shop-sl01', current_setting('t.eye'), 1280, 800) ->> 'run', false);
select public.log_events(current_setting('t.r2')::uuid, '[{"t":5,"kind":"click","page":"/","x":10,"y":20,"vw":1280,"sel":"#buy"}]');
select public.finish_run(current_setting('t.r2')::uuid, '{"kind":"browse"}', null);
select set_config('t.r3', public.start_run('lime-shop-sl01', current_setting('t.eye'), 1280, 800) ->> 'run', false);
select public.log_events(current_setting('t.r3')::uuid, '[{"t":5,"kind":"gaze","page":"/","x":10,"y":20,"vw":1280}]');
select public.finish_run(current_setting('t.r3')::uuid, '{"kind":"browse"}', 90);
select set_config('t.r4', public.start_run('lime-shop-sl01', current_setting('t.use'), 1280, 800) ->> 'run', false);
select public.log_events(current_setting('t.r4')::uuid, '[{"t":5,"kind":"click","page":"/","x":10,"y":20,"vw":1280,"sel":"#buy"}]');
select public.finish_run(current_setting('t.r4')::uuid, '{"kind":"usability"}', null);
reset role;
select pg_temp.check((select excluded and excluded_reason = 'no_gaze' from runs where id = current_setting('t.r2')::uuid), 'an eye-tracking run finished without gaze is excluded');
select pg_temp.check((select not excluded from runs where id = current_setting('t.r3')::uuid), 'with gaze it counts');
select pg_temp.check((select not excluded from runs where id = current_setting('t.r4')::uuid), 'usability with optional eye tracking counts without gaze');
select pg_temp.check((public._heat_summary((select id from projects where public_id = 'lime-shop-sl01'), '/', (select study_id from runs where id = current_setting('t.r2')::uuid)) -> 'groups')::text = '[]', 'excluded runs are left out of results');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f1c1', true);
select pg_temp.check(pg_temp.fails(format($$select public.discard_run(%L)$$, current_setting('t.r3'))) = 'ok'
  and (select count(*) from runs) = 0, 'someone else''s run can''t be discarded (and isn''t visible)');
reset role;
select pg_temp.check(exists (select 1 from runs where id = current_setting('t.r3')::uuid), 'it is still there');

-- ---- layouts ----
insert into reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-00000000f1c1', 'Rev' from projects where public_id = 'lime-shop-sl01';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f1c1', true);
select set_config('t.rr', public.start_reviewer_run('lime-shop-sl01', 1280, 800) ->> 'run', false);
select set_config('t.l1', public.layout_seen(current_setting('t.rr')::uuid, '/product/:id', 'aaaaaaaaaaaa0001', '{"main>section":4,"main>h2":4,"header>nav":1,"main>button":6}')::text, false);
select set_config('t.l1b', public.layout_seen(current_setting('t.rr')::uuid, '/product/:id', 'aaaaaaaaaaaa0002', '{"main>section":4,"main>h2":4,"header>nav":1,"main>button":7}')::text, false);
select set_config('t.l2', public.layout_seen(current_setting('t.rr')::uuid, '/product/:id', 'aaaaaaaaaaaa0003', '{"main>article":2,"aside>ul":3,"footer>a":9,"main>form":1}')::text, false);
select pg_temp.check((current_setting('t.l1')::json ->> 'n') = '1' and (current_setting('t.l1')::json ->> 'new') = 'true', 'first fingerprint: layout 1');
select pg_temp.check((current_setting('t.l1b')::json ->> 'n') = '1' and (current_setting('t.l1b')::json ->> 'new') = 'false', 'a small change stays layout 1');
select pg_temp.check((current_setting('t.l2')::json ->> 'n') = '2', 'a redesign starts layout 2');
select pg_temp.check(pg_temp.fails($$select public.layout_seen(current_setting('t.rr')::uuid, '/x', 'nothex', '{}')$$) = 'bad_hash', 'bad hash refused');
select pg_temp.check(pg_temp.fails($$select public.layout_seen(current_setting('t.rr')::uuid, '/x', 'bbbbbbbbbbbb0001', '{"a":"text"}')$$) = 'bad_fingerprint', 'text in a fingerprint refused');
select public.log_events(current_setting('t.rr')::uuid, '[{"t":5,"kind":"click","page":"/product/:id","x":10,"y":20,"vw":1280,"sel":"#a","lh":"aaaaaaaaaaaa0001"},{"t":6,"kind":"click","page":"/product/:id","x":10,"y":20,"vw":1280,"sel":"#a","lh":"aaaaaaaaaaaa0003"},{"t":7,"kind":"click","page":"/product/:id","x":10,"y":20,"vw":1280,"sel":"#a"}]');
select pg_temp.check((select string_agg(p ->> 'lay', ',' order by (p ->> 'lay')) from json_array_elements(public.heatmap_points('lime-shop-sl01', '/product/:id') -> 'points') p) = '0,1,2', 'points carry their layout (0 = unknown, old data)');

-- ---- snapshots ----
select set_config('t.path', coalesce(public.snapshot_claim(current_setting('t.rr')::uuid, '/product/:id', 'aaaaaaaaaaaa0001', 'desktop', 'webp', 1280, 3000, 4200, 1280, '{"#a":[1,2,3,4]}'), ''), false);
select pg_temp.check(current_setting('t.path') ~ '/desktop\.webp$', 'a reviewer claims the snapshot of layout 1 on desktop');
select pg_temp.check(public.snapshot_claim(current_setting('t.rr')::uuid, '/product/:id', 'aaaaaaaaaaaa0002', 'desktop', 'webp', 1280, 3000, 4200, 1280, '{}') is null, 'one per page, layout and device (same layout, other hash)');
select pg_temp.check(public.snapshot_claim(current_setting('t.rr')::uuid, '/product/:id', 'ffffffffffff0001', 'desktop', 'webp', 1280, 3000, 4200, 1280, '{}') is null, 'unknown layout: nothing');
select pg_temp.check(pg_temp.fails($$insert into storage.objects (bucket_id, name) values ('snapshots', 'aaaaaaaa-0000-0000-0000-000000000000/0000000000000000/aaaaaaaa-0000-0000-0000-000000000000/desktop.webp')$$) <> 'ok', 'uploading an unclaimed path is refused');
select pg_temp.check(pg_temp.fails(format($$insert into storage.objects (bucket_id, name) values ('snapshots', %L)$$, current_setting('t.path'))) = 'ok', 'uploading the claimed path works');
select pg_temp.check(public.snapshot_done(current_setting('t.path')), 'and marks it taken');
select pg_temp.check(pg_temp.fails(format($$insert into storage.objects (bucket_id, name) values ('snapshots', %L || 'x')$$, current_setting('t.path'))) <> 'ok', 'no second upload');
select pg_temp.check((select count(*) from page_snapshots) = 0, 'a reviewer can''t list snapshots');
reset role;
select pg_temp.check((select public from storage.buckets where id = 'snapshots') = false, 'the bucket is private');
-- a visitor run never takes snapshots, and a project with snapshots off neither
update projects set snapshots = false where public_id = 'lime-shop-sl01';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f1c1', true);
select pg_temp.check(public.snapshot_claim(current_setting('t.rr')::uuid, '/product/:id', 'aaaaaaaaaaaa0003', 'desktop', 'webp', 1280, 3000, 4200, 1280, '{}') is null, 'snapshots off: nothing claimed');
reset role;
-- members read; others don't
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000f1a1');
select pg_temp.check((select count(*) from page_snapshots) = 1 and (select count(*) from storage.objects where bucket_id = 'snapshots') = 1, 'members see the snapshot and its file');
select pg_temp.check((select count(*) from page_layouts) = 2, 'members see the layouts');
select pg_temp.as_user('00000000-0000-0000-0000-00000000f1d1');
select pg_temp.check((select count(*) from page_snapshots) = 0 and (select count(*) from storage.objects where bucket_id = 'snapshots') = 0, 'outsiders see nothing');
set role anon;
select pg_temp.check(pg_temp.fails($$select count(*) from page_snapshots$$) <> 'ok', 'anon can''t read snapshots');
reset role;
-- deleting the project deletes its snapshots and layouts
delete from workspaces where name = 'Lime';
select pg_temp.check((select count(*) from page_snapshots) = 0 and (select count(*) from page_layouts) = 0, 'deleted with the project');
delete from storage.objects where bucket_id = 'snapshots';
delete from auth.users where id::text like '00000000-0000-0000-0000-00000000f1%';
\o
\set QUIET 0
select ok, what from r9 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r9;
