-- Pins that survive redeploys: set_anchor (re-pin, and the state the widget saw).
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r7 (n serial, ok boolean, what text);
grant all on r7 to authenticated, anon; grant all on sequence r7_n_seq to authenticated, anon;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r7 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://pin.shop') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin)::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
insert into auth.users values ('00000000-0000-0000-0000-00000000e0a1', 'p@x.com'), ('00000000-0000-0000-0000-00000000e0b1', null), ('00000000-0000-0000-0000-00000000e0c1', null), ('00000000-0000-0000-0000-00000000e0d1', null);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0a1');
insert into workspaces (name, created_by) values ('Pin', '00000000-0000-0000-0000-00000000e0a1');
insert into projects (workspace_id, public_id, name) select id, 'pin-shop-v001', 'Pin' from workspaces where name = 'Pin';
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"version":"3.1","modules":{"comments":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"pin.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000e0a1' from projects where public_id = 'pin-shop-v001';
reset role;
insert into reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-00000000e0b1', 'Ani' from projects where public_id = 'pin-shop-v001';
insert into reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-00000000e0c1', 'Budi' from projects where public_id = 'pin-shop-v001';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0b1', true);
\o /dev/null
create temp table ids (id uuid);
grant all on ids to authenticated;
insert into ids select (public.post_thread('pin-shop-v001', '/', '{"sel":"#buy","rx":0.5,"ry":0.5,"x":1,"y":1,"vw":1000,"fp":{"t":"button","x":"Buy now"},"device":{"browser":"Chrome"}}', 'Price unclear') ->> 'id')::uuid;
select pg_temp.check((select (public.post_thread('pin-shop-v001', '/', '{"sel":"#a","rx":0,"ry":0,"x":0,"y":0,"vw":1}', 'Old style') ->> 'id') is not null), 'a comment without a fingerprint is still accepted');
-- another reviewer reports the pin as gone: the version is set by the server
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0c1', true);
select pg_temp.check((public.set_anchor((select id from ids), '{"sel":"#buy","rx":0.5,"ry":0.5,"x":1,"y":1,"vw":1000,"fp":{"t":"button","x":"Buy now"},"st":{"s":"gone","v":"9.9"}}') -> 'anchor' -> 'st' ->> 'v') = '3.1', 'a reviewer reports a lost pin; the version comes from the published settings');
reset role;
update releases set config = jsonb_set(config, '{version}', '"3.2"') where project_id = (select id from projects where public_id = 'pin-shop-v001');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000e0b1', true);
select pg_temp.check((public.set_anchor((select id from ids), '{"sel":"#buy","rx":0.5,"ry":0.5,"x":1,"y":1,"vw":1000,"st":{"s":"gone"}}') -> 'anchor' -> 'st' ->> 'v') = '3.1', 'the same state keeps the version it was first seen in');
-- re-pin: new selector, state ok, device kept
select pg_temp.check((public.set_anchor((select id from ids), '{"sel":"#buy-now","rx":0.2,"ry":0.4,"x":5,"y":6,"vw":1000,"fp":{"t":"button","x":"Buy now"},"device":{"browser":"Evil"},"st":{"s":"ok"}}') -> 'anchor')::jsonb @> '{"sel":"#buy-now","device":{"browser":"Chrome"},"st":{"s":"ok","v":"3.2"}}', 'a re-pin moves the anchor, keeps the device and records ok in the current version');
select pg_temp.check(pg_temp.fails($$select public.set_anchor((select id from ids), '{"sel":"#x","st":{"s":"weird"}}')$$) = 'bad_state', 'unknown states are refused');
select pg_temp.check(pg_temp.fails($$select public.set_anchor((select id from ids), '"text"')$$) = 'bad_anchor', 'an anchor must be an object');
select pg_temp.check(pg_temp.fails($$select public.set_anchor((select id from ids), '{"rx":1}')$$) = 'bad_anchor', 'an anchor needs a selector');
select pg_temp.check(pg_temp.fails($$select public.set_anchor((select id from ids), ('{"sel":"h1","fp":{"t":"' || repeat('x', 5000) || '"}}')::jsonb)$$) = 'bad_anchor', 'an oversized anchor is refused');
-- a stranger (not a reviewer) can't touch it
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0d1', true);
select pg_temp.check(pg_temp.fails($$select public.set_anchor((select id from ids), '{"sel":"#evil","st":{"s":"gone"}}')$$) <> 'ok', 'a stranger can''t move a pin');
reset role;
select pg_temp.check((select anchor ->> 'sel' from threads where id = (select id from ids)) = '#buy-now', 'the re-pinned selector is stored');
select pg_temp.check(has_function_privilege('anon', 'public.set_anchor(uuid, jsonb)', 'execute') = false, 'anon can''t call set_anchor');
delete from workspaces where name = 'Pin';
delete from auth.users where id in ('00000000-0000-0000-0000-00000000e0a1', '00000000-0000-0000-0000-00000000e0b1', '00000000-0000-0000-0000-00000000e0c1', '00000000-0000-0000-0000-00000000e0d1');
\o
\set QUIET 0
select ok, what from r7 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r7;
