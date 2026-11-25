-- Heatmap v4: exposure and version on events, the pre-aggregated summary, who can read it.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r6 (n serial, ok boolean, what text);
grant all on r6 to authenticated, anon; grant all on sequence r6_n_seq to authenticated, anon;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r6 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://tea.shop') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin)::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users values ('00000000-0000-0000-0000-00000000d0a1', 'tea@x.com'), ('00000000-0000-0000-0000-00000000d0b1', null),
  ('00000000-0000-0000-0000-00000000d0c1', null), ('00000000-0000-0000-0000-00000000d0d1', 'stranger@x.com');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000d0a1');
insert into workspaces (name, created_by) values ('Tea', '00000000-0000-0000-0000-00000000d0a1');
insert into projects (workspace_id, public_id, name, site_url) select id, 'tea-shop-v401', 'Tea', 'https://tea.shop' from workspaces where name = 'Tea';
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"modules":{"comments":true,"usability":true,"heatmap":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"*.tea.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000d0a1' from projects where public_id = 'tea-shop-v401';
insert into studies (project_id, kind, name, config) select id, 'usability', 'Tea checkout', '{"tasks":[{"id":"t1","prompt":"Buy tea","limitSec":120}]}' from projects where public_id = 'tea-shop-v401';
select set_config('t.link', public.create_study_link((select id from studies where name = 'Tea checkout'), 30), false);

-- a participant records exposure and version
select pg_temp.as_user('00000000-0000-0000-0000-00000000d0b1', true);
select set_config('t.run', public.start_run('tea-shop-v401', current_setting('t.link'), 1280, 800) ->> 'run', false);
select pg_temp.check(public.log_events(current_setting('t.run')::uuid,
  '[{"t":10,"kind":"seen","page":"/","sel":"#buy","vw":1280,"version":"v2"},
    {"t":11,"kind":"seen","page":"/","sel":"","vw":1280},
    {"t":12,"kind":"depth","page":"/","y":1600,"doc_h":3200,"vw":1280,"version":"v2"},
    {"t":20,"kind":"click","page":"/","x":640,"y":400,"vw":1280,"sel":"#buy","label":"button “Buy”","version":"v2<script>"}]') = 3, 'seen, depth and versioned clicks are recorded; a seen without element is skipped');
reset role;
select pg_temp.check((select version from run_events where kind = 'click') = 'v2script', 'the version label is cleaned');
select pg_temp.check((select label from run_events where kind = 'seen') is null, 'exposure events keep no label');

-- 30 more participants, made directly: 20 on v1, 10 on v2; everyone sees the hero, 12 reach #buy
insert into auth.users select ('00000000-0000-0000-0000-0000000e' || lpad(g::text, 4, '0'))::uuid, null from generate_series(1, 30) g;
insert into runs (id, study_id, project_id, user_id, vw, vh, device)
  select ('00000000-0000-0000-0000-0000000f' || lpad(g::text, 4, '0'))::uuid, s.id, s.project_id, ('00000000-0000-0000-0000-0000000e' || lpad(g::text, 4, '0'))::uuid, 1280, 800, 'desktop'
  from studies s, generate_series(1, 30) g where s.name = 'Tea checkout';
insert into run_events (run_id, project_id, t, kind, page, sel, vw, version)
  select r.id, r.project_id, 1, 'seen', '/', '#hero', 1280, case when right(r.id::text, 4)::int <= 20 then 'v1' else 'v2' end
  from runs r where r.id::text like '00000000-0000-0000-0000-0000000f%';
insert into run_events (run_id, project_id, t, kind, page, sel, vw, version)
  select r.id, r.project_id, 2, 'seen', '/', '#buy', 1280, case when right(r.id::text, 4)::int <= 20 then 'v1' else 'v2' end
  from runs r where right(r.id::text, 4)::int between 1 and 12 and r.id::text like '00000000-0000-0000-0000-0000000f%';
-- 6 of the 12 who saw #buy click it, twice each; 3 v1 people click the hero
insert into run_events (run_id, project_id, t, kind, page, x, y, vw, sel, label, version)
  select r.id, r.project_id, 100 + k, 'click', '/', 650, 2400, 1280, '#buy', 'button “Buy”', 'v1'
  from runs r, generate_series(0, 1) k where right(r.id::text, 4)::int between 1 and 6 and r.id::text like '00000000-0000-0000-0000-0000000f%';
insert into run_events (run_id, project_id, t, kind, page, x, y, vw, sel, label, version)
  select r.id, r.project_id, 50, 'click', '/', 200, 100, 1280, '#hero', 'div “Hero”', 'v1'
  from runs r where right(r.id::text, 4)::int between 7 and 9 and r.id::text like '00000000-0000-0000-0000-0000000f%';
insert into run_events (run_id, project_id, t, kind, page, y, vw, doc_h, version)
  select r.id, r.project_id, 3, 'depth', '/', case when right(r.id::text, 4)::int <= 12 then 3200 else 800 end, 1280, 3200, 'v1'
  from runs r where right(r.id::text, 4)::int <= 20 and r.id::text like '00000000-0000-0000-0000-0000000f%';

-- members read the study's summary in the panel
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000d0a1');
select set_config('t.sid', (select id::text from studies where name = 'Tea checkout'), false);
select set_config('t.sum', public.study_heatmap(current_setting('t.sid')::uuid, '/')::text, false);
create temp table sm as select current_setting('t.sum')::json as j;
grant all on sm to authenticated;
select pg_temp.check((select (e ->> 'clicks')::int = 12 and (e ->> 'people')::int = 6 and (e ->> 'seen')::int = 12 and (e ->> 'first')::int = 6
  from sm, json_array_elements(j -> 'elements') e where e ->> 'sel' = '#buy' and e ->> 'ver' = 'v1'), 'element: clicks, distinct people, first clicks and exposures over all events');
select pg_temp.check((select (e ->> 'first')::int = 3 and (e ->> 'seen')::int = 20 from sm, json_array_elements(j -> 'elements') e where e ->> 'sel' = '#hero' and e ->> 'ver' = 'v1'), 'hero seen by all 20 v1 people');
select pg_temp.check((select (e ->> 'seen')::int = 10 and (e ->> 'clicks')::int = 0 from sm, json_array_elements(j -> 'elements') e where e ->> 'sel' = '#hero' and e ->> 'ver' = 'v2'), 'elements seen but never clicked are listed (0 clicks), per version');
select pg_temp.check((select (b ->> 'n')::int = 12 and (b ->> 'people')::int = 6 and (b ->> 'bx')::int = 40 and (b ->> 'by')::int = 150
  from sm, json_array_elements(j -> 'bins') b where b ->> 'ver' = 'v1' and (b ->> 'bx')::int = 40), 'bins: 1/80 of the width, counts and distinct people');
select pg_temp.check((select sum((g ->> 'people')::int) from sm, json_array_elements(j -> 'groups') g) = 32, 'groups split by device and version (the cleaned v2script is its own group)');
select pg_temp.check((select (d ->> 'people')::int from sm, json_array_elements(j -> 'depth') d where d ->> 'ver' = 'v1' and (d ->> 'frac')::numeric = 1) = 12
  and (select (d ->> 'row')::int from sm, json_array_elements(j -> 'depth') d where d ->> 'ver' = 'v1' and (d ->> 'frac')::numeric = 0.25) = 50, 'depth: deepest row and fraction per person');
select pg_temp.check(current_setting('t.sum') !~ '[0-9a-f]{8}-[0-9a-f]{4}-', 'no participant or run ids in the summary');
-- bounded: 30,000 distinct clicks still give at most 20,000 bins
reset role;
insert into run_events (run_id, project_id, t, kind, page, x, y, vw, version)
  select r.id, r.project_id, 1000 + g, 'click', '/big', (g % 80) * 16, (g / 80) * 16, 1280, 'v1'
  from runs r, generate_series(0, 999) g where right(r.id::text, 4)::int <= 30 and r.id::text like '00000000-0000-0000-0000-0000000f%';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000d0a1');
select pg_temp.check(json_array_length(public.study_heatmap(current_setting('t.sid')::uuid, '/big') -> 'bins') <= 20000, 'bins are bounded (30,000 clicks)');
select pg_temp.check((select sum((b ->> 'n')::int) from json_array_elements(public.study_heatmap(current_setting('t.sid')::uuid, '/big') -> 'bins') b) = 30000, 'every click counts: 30 runs × 1,000 clicks all in the bins');
-- a stranger, a participant, anon
select pg_temp.as_user('00000000-0000-0000-0000-00000000d0d1');
select pg_temp.check(pg_temp.fails(format($$select public.study_heatmap(%L, '/')$$, current_setting('t.sid'))) = 'not_allowed', 'another customer can''t read the summary');
select pg_temp.as_user('00000000-0000-0000-0000-00000000d0b1', true);
select pg_temp.check(pg_temp.fails(format($$select public.study_heatmap(%L, '/')$$, current_setting('t.sid'))) = 'not_allowed', 'a participant can''t read the summary');
select pg_temp.check(pg_temp.fails($$select public.heatmap_summary('tea-shop-v401', '/')$$) = 'not_invited', 'a participant (not a reviewer) can''t read the script summary');
select pg_temp.check(pg_temp.fails($$select public._heat_summary((select id from projects limit 1), '/', null)$$) <> 'ok', 'the internal aggregate isn''t callable');
reset role; set role anon;
select pg_temp.check(pg_temp.fails($$select public.heatmap_summary('tea-shop-v401', '/')$$) <> 'ok', 'anon can''t read the summary');
reset role;
-- an invited reviewer reads it from the site, not from another origin, and is rate limited
insert into reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-00000000d0c1', 'Rev' from projects where public_id = 'tea-shop-v401';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000d0c1', true);
select pg_temp.check(json_array_length(public.heatmap_summary('tea-shop-v401', '/') -> 'elements') >= 3, 'a reviewer reads the summary on the site');
select pg_temp.check(pg_temp.fails(format($$select public.heatmap_summary('tea-shop-v401', '/', %L)$$, gen_random_uuid())) = 'no_study', 'another project''s study is refused');
select pg_temp.as_user('00000000-0000-0000-0000-00000000d0c1', true, 'https://evil.example');
select pg_temp.check(pg_temp.fails($$select public.heatmap_summary('tea-shop-v401', '/')$$) = 'origin_not_allowed', 'another site can''t read the summary');
select pg_temp.as_user('00000000-0000-0000-0000-00000000d0c1', true);
-- points carry the version; gaze comes with the same people's clicks for drift correction
reset role;
insert into run_events (run_id, project_id, t, kind, page, x, y, vw, version) select r.id, r.project_id, 90 + k, 'gaze', '/', 600, 2380, 1280, 'v1'
  from runs r, generate_series(0, 4) k where right(r.id::text, 4)::int between 1 and 2 and r.id::text like '00000000-0000-0000-0000-0000000f%';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000d0c1', true);
select pg_temp.check((select bool_and(p ->> 'ver' <> '') from json_array_elements(public.heatmap_points('tea-shop-v401', '/') -> 'points') p), 'heatmap points carry their version');
select set_config('t.gz', public.heatmap_points('tea-shop-v401', '/', null, 'gaze')::text, false);
select pg_temp.check(json_array_length(current_setting('t.gz')::json -> 'points') = 10 and json_array_length(current_setting('t.gz')::json -> 'anchors') = 4, 'gaze points come with those two people''s clicks (anchors)');
select pg_temp.check((select count(distinct a ->> 'p') from json_array_elements(current_setting('t.gz')::json -> 'anchors') a) = 2
  and (select count(distinct p ->> 'p') from json_array_elements(current_setting('t.gz')::json -> 'points') p) = 2, 'anchors use the same participant numbers as the points');
select pg_temp.check((select count(*) from generate_series(1, 30) where pg_temp.fails($$select public.heatmap_summary('tea-shop-v401', '/')$$) = 'rate_limited') > 0, 'the summary is rate limited');
reset role;
delete from workspaces where name = 'Tea';
delete from auth.users where id::text like '00000000-0000-0000-0000-0000000e%' or id in ('00000000-0000-0000-0000-00000000d0a1', '00000000-0000-0000-0000-00000000d0b1', '00000000-0000-0000-0000-00000000d0c1', '00000000-0000-0000-0000-00000000d0d1');
\o
\set QUIET 0
select ok, what from r6 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r6;
