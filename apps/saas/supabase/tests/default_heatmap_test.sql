-- Heatmaps by default: the auto-made "Site heatmap" study, reviewers' clicks, the invite link.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r7 (n serial, ok boolean, what text);
grant all on r7 to authenticated, anon; grant all on sequence r7_n_seq to authenticated, anon;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r7 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://mint.shop') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin)::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users values ('00000000-0000-0000-0000-00000000e0a1', 'mint@x.com'), ('00000000-0000-0000-0000-00000000e0b1', null),
  ('00000000-0000-0000-0000-00000000e0c1', null), ('00000000-0000-0000-0000-00000000e0d1', null);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0a1');
insert into workspaces (name, created_by) values ('Mint', '00000000-0000-0000-0000-00000000e0a1');
insert into projects (workspace_id, public_id, name, site_url) select id, 'mint-shop-dh01', 'Mint', 'https://mint.shop' from workspaces where name = 'Mint';
insert into projects (workspace_id, public_id, name, site_url) select id, 'mint-shop-dh02', 'Mint comments', 'https://mint.shop' from workspaces where name = 'Mint';
-- comments only: no default study
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"modules":{"comments":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"mint.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000e0a1' from projects where public_id = 'mint-shop-dh01';
select pg_temp.check((select count(*) from studies s join projects p on p.id = s.project_id where p.public_id = 'mint-shop-dh01') = 0, 'no default study while Heatmap is off');
-- turning Heatmap on (a new release) makes one; publishing again doesn't make another
insert into releases (project_id, version, config, created_by) select id, v,
  '{"v":1,"on":true,"modules":{"comments":true,"heatmap":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"mint.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000e0a1' from projects, generate_series(2, 3) v where public_id = 'mint-shop-dh01';
select pg_temp.check((select count(*) from studies s join projects p on p.id = s.project_id where p.public_id = 'mint-shop-dh01' and s.is_default) = 1, 'turning Heatmap on makes exactly one default study');
select pg_temp.check((select name = 'Site heatmap' and kind = 'browse' and status = 'open' and link_expires is null and link_hash is not null from studies where is_default), 'it is an open Heatmap visit with a link that never expires');
select pg_temp.check((select count(*) from studies where project_id = (select id from projects where public_id = 'mint-shop-dh02')) = 0, 'other projects are untouched');
reset role;
select pg_temp.check(public._ensure_default_study((select id from projects where public_id = 'mint-shop-dh01')) = (select id from studies where is_default), 'ensuring again returns the same study');
select pg_temp.check(pg_temp.fails($$insert into studies (project_id, kind, name, is_default) select id, 'browse', 'Second', true from projects where public_id = 'mint-shop-dh01'$$) <> 'ok', 'a second default study is refused');
-- members can rename and pause it, but can't read the kept token
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000e0a1');
update studies set name = 'Homepage heatmap' where is_default;
select pg_temp.check((select name from studies where is_default) = 'Homepage heatmap', 'members rename the default study');
select pg_temp.check(pg_temp.fails($$select token from study_invites$$) <> 'ok', 'members can''t read the token table directly');
reset role;

-- a team member (Open my site) and a reviewer record clicks without a study link
insert into reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-00000000e0b1', 'Rev' from projects where public_id = 'mint-shop-dh01';
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000e0b1', true);
select set_config('t.run', public.start_reviewer_run('mint-shop-dh01', 1280, 800) ->> 'run', false);
select pg_temp.check(public.start_reviewer_run('mint-shop-dh01', 1280, 800) ->> 'run' = current_setting('t.run'), 'the same reviewer session reuses its run');
select pg_temp.check(public.log_events(current_setting('t.run')::uuid,
  '[{"t":5,"kind":"page","page":"/"},{"t":10,"kind":"click","page":"/","x":100,"y":200,"vw":1280,"sel":"#buy","label":"button “Buy”"}]') = 2, 'a reviewer''s clicks are logged');
select pg_temp.check((select count(*) from json_array_elements(public.heatmap_points('mint-shop-dh01', '/') -> 'points')) = 1, 'and show on the heatmap at once');
select set_config('t.inv', public.default_study_invite('mint-shop-dh01')::text, false);
select pg_temp.check(current_setting('t.inv')::json ->> 'token' ~ '^[0-9a-f]{64}$' and (current_setting('t.inv')::json ->> 'people')::int = 1, 'a reviewer gets the invite token and the count');
-- the copied link works for a participant: consent info and a run
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0c1', true);
select pg_temp.check((public.study_info('mint-shop-dh01', current_setting('t.inv')::json ->> 'token') ->> 'kind') = 'browse', 'the invite link opens the consent screen');
select pg_temp.check(public.start_run('mint-shop-dh01', current_setting('t.inv')::json ->> 'token', 390, 800) ->> 'run' is not null, 'and starts a participant run');
select pg_temp.check(pg_temp.fails($$select public.start_reviewer_run('mint-shop-dh01', 1280, 800)$$) = 'not_invited', 'a participant who isn''t a reviewer can''t start a reviewer run');
select pg_temp.check(pg_temp.fails($$select public.default_study_invite('mint-shop-dh01')$$) = 'not_invited', 'nor read the invite link');
reset role;
select pg_temp.check((select count(*) filter (where source = 'reviewer') = 1 and count(*) filter (where source = 'participant') = 1 from runs), 'runs are marked reviewer or participant');
-- reviewer runs never fill the study
update studies set max_runs = 1 where is_default;
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1', true);
select pg_temp.check(pg_temp.fails($$select public.start_run('mint-shop-dh01', current_setting('t.inv')::json ->> 'token', 390, 800)$$) = 'study_full', 'max_runs counts participants only');
reset role;
-- checks: origin, a stranger, anon, rate limit, paused
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000e0b1', true, 'https://evil.example');
select pg_temp.check(pg_temp.fails($$select public.start_reviewer_run('mint-shop-dh01', 1280, 800)$$) = 'origin_not_allowed', 'another site can''t start a reviewer run');
select pg_temp.check(pg_temp.fails(format($$select public.log_events(%L, '[{"t":1,"kind":"click","page":"/","x":1,"y":1,"vw":1280}]')$$, current_setting('t.run'))) = 'origin_not_allowed', 'nor log into one');
select pg_temp.check(pg_temp.fails($$select public.default_study_invite('mint-shop-dh01')$$) = 'origin_not_allowed', 'nor read the invite link');
reset role; set role anon;
select pg_temp.check(pg_temp.fails($$select public.start_reviewer_run('mint-shop-dh01', 1280, 800)$$) <> 'ok', 'anon can''t start a reviewer run');
select pg_temp.check(pg_temp.fails($$select public.default_study_invite('mint-shop-dh01')$$) <> 'ok', 'anon can''t read the invite link');
reset role;
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000e0b1', true);
select pg_temp.check((select count(*) from generate_series(1, 12) where pg_temp.fails($$select public.start_reviewer_run('mint-shop-dh01', 1280, 800)$$) = 'rate_limited') > 0, 'reviewer runs are rate limited');
reset role;
update studies set status = 'closed' where is_default;
delete from rate_hits where true;
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000e0b1', true);
select pg_temp.check(pg_temp.fails($$select public.start_reviewer_run('mint-shop-dh01', 1280, 800)$$) = 'study_closed', 'a paused default study records nothing');
select pg_temp.check(public.default_study_invite('mint-shop-dh01') ->> 'token' is null, 'and gives no invite link');
reset role;
-- a new panel link replaces the kept token; revoking removes it
update studies set status = 'open' where is_default;
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000e0a1');
select set_config('t.new', public.create_study_link((select id from studies where is_default), 30), false);
reset role;
select pg_temp.check((select token from study_invites) = current_setting('t.new') and (select link_expires is null from studies where is_default), 'a new link replaces the kept token and still never expires');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000e0a1');
select public.revoke_study_link((select id from studies where is_default));
reset role;
select pg_temp.check(not exists (select 1 from study_invites), 'revoking removes the kept token');
reset role;
delete from workspaces where name = 'Mint';
delete from auth.users where id::text like '00000000-0000-0000-0000-00000000e0%';
\o
\set QUIET 0
select ok, what from r7 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r7;
