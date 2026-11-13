-- Versions on comments, component reviews (A vs B), voice notes and their private bucket.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r6 (n serial, ok boolean, what text);
grant all on r6 to authenticated, anon; grant all on sequence r6_n_seq to authenticated, anon;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r6 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://teh.shop') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin)::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
insert into auth.users values ('00000000-0000-0000-0000-00000000d0a1', 't@x.com'), ('00000000-0000-0000-0000-00000000d0b1', null), ('00000000-0000-0000-0000-00000000d0c1', null);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000d0a1');
insert into workspaces (name, created_by) values ('Teh', '00000000-0000-0000-0000-00000000d0a1');
insert into projects (workspace_id, public_id, name) select id, 'teh-shop-v001', 'Teh' from workspaces where name = 'Teh';
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"version":"2.3","modules":{"comments":true,"versions":true,"compare":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"teh.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000d0a1' from projects where public_id = 'teh-shop-v001';
reset role;
insert into reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-00000000d0b1', 'Ani' from projects where public_id = 'teh-shop-v001';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000d0b1', true);
select pg_temp.check((public.post_thread('teh-shop-v001', '/', '{"sel":"h1"}', 'Title too small') ->> 'version') = '2.3', 'a comment carries the published version (set by the server)');
select pg_temp.check(pg_temp.fails($$select public.post_thread('teh-shop-v001', '/', '{"sel":"h1"}', 'A vs ?', null, 'compare')$$) = 'bad_anchor', 'a comparison needs two elements');
select pg_temp.check((public.post_thread('teh-shop-v001', '/', '{"sel":"#a","b":{"sel":"#b"}}', 'B reads better', null, 'compare') ->> 'kind') = 'compare', 'a reviewer posts a comparison (A vs B)');
select pg_temp.check(pg_temp.fails($$select public.post_thread('teh-shop-v001', '/', '{"sel":"h1"}', 'x', null, 'shout')$$) = 'bad_kind', 'unknown kinds are refused');
-- voice: the product is off
select pg_temp.check(pg_temp.fails($$select public.post_thread('teh-shop-v001', '/', '{"sel":"h1"}', '', '11111111-1111-4111-8111-111111111111', 'voice', 'teh-shop-v001/11111111-1111-4111-8111-111111111111.webm')$$) = 'origin_not_allowed', 'voice notes refused while Narration is off');
reset role;
update releases set config = jsonb_set(config, '{modules,narration}', 'true') where project_id = (select id from projects where public_id = 'teh-shop-v001');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-00000000d0b1', true);
select pg_temp.check(pg_temp.fails($$select public.post_thread('teh-shop-v001', '/', '{"sel":"h1"}', '', '11111111-1111-4111-8111-111111111111', 'voice', 'teh-shop-v001/11111111-1111-4111-8111-111111111111.webm')$$) = 'no_audio', 'a voice note needs its uploaded audio');
-- upload: own project yes, another project no
insert into storage.objects (bucket_id, name, owner) values ('narrations', 'teh-shop-v001/11111111-1111-4111-8111-111111111111.webm', '00000000-0000-0000-0000-00000000d0b1');
select pg_temp.check(pg_temp.fails($$insert into storage.objects (bucket_id, name, owner) values ('narrations', 'other-proj/22222222-2222-4222-8222-222222222222.webm', '00000000-0000-0000-0000-00000000d0b1')$$) <> 'ok', 'a reviewer can''t upload into another project');
select pg_temp.check(pg_temp.fails($$insert into storage.objects (bucket_id, name, owner) values ('narrations', 'teh-shop-v001/evil.exe', '00000000-0000-0000-0000-00000000d0b1')$$) <> 'ok', 'only audio file names are accepted');
select pg_temp.check((public.post_thread('teh-shop-v001', '/', '{"sel":"h1"}', '', '11111111-1111-4111-8111-111111111111', 'voice', 'teh-shop-v001/11111111-1111-4111-8111-111111111111.webm') ->> 'text') = 'Voice note', 'a reviewer posts a voice note with their upload');
-- another anonymous browser (not a reviewer) can't upload or listen
select pg_temp.as_user('00000000-0000-0000-0000-00000000d0c1', true);
select pg_temp.check(pg_temp.fails($$insert into storage.objects (bucket_id, name, owner) values ('narrations', 'teh-shop-v001/33333333-3333-4333-8333-333333333333.webm', '00000000-0000-0000-0000-00000000d0c1')$$) <> 'ok', 'a stranger can''t upload');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'narrations') = 0, 'a stranger can''t list or play voice notes');
-- members
select pg_temp.as_user('00000000-0000-0000-0000-00000000d0a1');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'narrations') = 1, 'members can play voice notes');
select pg_temp.check(json_array_length(public.versions_of((select id from projects where public_id = 'teh-shop-v001'))) = 1 and (public.versions_of((select id from projects where public_id = 'teh-shop-v001')) -> 0 ->> 'version') = '2.3', 'comments by version');
reset role;
select pg_temp.check((select count(*) from threads t join projects p on p.id = t.project_id where p.public_id = 'teh-shop-v001') = 3, 'three threads stored');
delete from storage.objects where bucket_id = 'narrations';
delete from workspaces where name = 'Teh';
delete from auth.users where id in ('00000000-0000-0000-0000-00000000d0a1', '00000000-0000-0000-0000-00000000d0b1', '00000000-0000-0000-0000-00000000d0c1');
\o
\set QUIET 0
select ok, what from r6 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r6;
