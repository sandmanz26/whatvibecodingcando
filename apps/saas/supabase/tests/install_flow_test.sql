-- Install flow: local dev addresses not in the project are remembered apart (install_strays), nothing else.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r9 (n serial, ok boolean, what text);
grant all on r9 to public; grant all on sequence r9_n_seq to public;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r9 (ok, what) values (ok, what) $$;
insert into auth.users values ('00000000-0000-0000-0000-00000000b9f1', 'gi@x.com');
insert into auth.users values ('00000000-0000-0000-0000-00000000b9f2', 'out@x.com');
insert into workspaces (id, name, created_by) values ('00000000-0000-0000-0000-0000b9f0f000', 'Gi', '00000000-0000-0000-0000-00000000b9f1');
insert into workspace_members (workspace_id, user_id, role) values ('00000000-0000-0000-0000-0000b9f0f000', '00000000-0000-0000-0000-00000000b9f1', 'owner') on conflict do nothing;
insert into projects (id, workspace_id, public_id, name) values ('00000000-0000-0000-0000-0000b9f0f001', '00000000-0000-0000-0000-0000b9f0f000', 'gi-app-0001', 'Gi');
insert into releases (project_id, version, config, created_by) values ('00000000-0000-0000-0000-0000b9f0f001', 1,
  '{"v":1,"on":true,"modules":{"comments":true},"audience":"reviewers","envs":[{"id":"e1","name":"Local dev","host":"localhost:3000","on":true},{"id":"e2","name":"Loop","host":"127.0.0.1:5173","on":true}]}',
  '00000000-0000-0000-0000-00000000b9f1');
set role anon;
select set_config('request.headers', '{"origin":"http://localhost:3000"}', false); select public.report_seen('gi-app-0001', '0.3.0', false, 'reviewers');
select set_config('request.headers', '{"origin":"http://127.0.0.1:5173"}', false); select public.report_seen('gi-app-0001', '0.3.0', false, 'reviewers');
select set_config('request.headers', '{"origin":"http://localhost:3001"}', false); select public.report_seen('gi-app-0001', '0.3.0', false, 'not listed');
select set_config('request.headers', '{"origin":"https://evil.example"}', false); select public.report_seen('gi-app-0001', '0.3.0', true, '');
select set_config('request.headers', '{"origin":"http://localhost.evil.example"}', false); select public.report_seen('gi-app-0001', '0.3.0', true, '');
reset role;
select pg_temp.check((select count(*) from installs where project_id = '00000000-0000-0000-0000-0000b9f0f001') = 2, 'listed local addresses (localhost:3000, 127.0.0.1:5173) are installs');
select pg_temp.check((select array_agg(host) from install_strays where project_id = '00000000-0000-0000-0000-0000b9f0f001') = array['localhost:3001'], 'an unlisted local address is remembered apart; other hosts are not');
select pg_temp.check(not exists (select 1 from installs where host = 'localhost:3001'), 'a stray is not an install');
set role anon;
do $$ begin for i in 1..10 loop
  perform set_config('request.headers', json_build_object('origin', format('http://localhost:40%s', 10 + i))::text, false);
  perform public.report_seen('gi-app-0001', '0.3.0', false, '');
end loop; end $$;
reset role;
select pg_temp.check((select count(*) from install_strays where project_id = '00000000-0000-0000-0000-0000b9f0f001') = 5, 'at most 5 strays per project');
-- the address is added and the script reports again: the stray goes
insert into releases (project_id, version, config, created_by) values ('00000000-0000-0000-0000-0000b9f0f001', 2,
  '{"v":1,"on":true,"modules":{"comments":true},"audience":"reviewers","envs":[{"id":"e1","name":"Local dev","host":"localhost:3000","on":true},{"id":"e3","name":"localhost:3001","host":"localhost:3001","on":true}]}',
  '00000000-0000-0000-0000-00000000b9f1');
set role anon;
select set_config('request.headers', '{"origin":"http://localhost:3001"}', false); select public.report_seen('gi-app-0001', '0.3.0', false, '');
reset role;
select pg_temp.check(not exists (select 1 from install_strays where host = 'localhost:3001') and exists (select 1 from installs where host = 'localhost:3001'), 'once added, the address moves to installs');
-- row level security: members read and clear, others see nothing, anon has no access
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b9f2","role":"authenticated"}', false);
select pg_temp.check((select count(*) from install_strays) = 0, 'another account sees no strays');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000b9f1","role":"authenticated"}', false);
select pg_temp.check((select count(*) from install_strays) = 4, 'members read their project''s strays');
do $$ begin
  insert into install_strays (project_id, host) values ('00000000-0000-0000-0000-0000b9f0f001', 'localhost:9999');
  perform pg_temp.check(false, 'members cannot insert strays');
exception when insufficient_privilege then perform pg_temp.check(true, 'members cannot insert strays'); end $$;
delete from install_strays where host = 'localhost:4011';
select pg_temp.check((select count(*) from install_strays) = 3, 'members clear a stray');
reset role;
select pg_temp.check(not has_table_privilege('anon', 'public.install_strays', 'select'), 'anon cannot read strays');
delete from workspaces where id = '00000000-0000-0000-0000-0000b9f0f000';
delete from auth.users where id in ('00000000-0000-0000-0000-00000000b9f1', '00000000-0000-0000-0000-00000000b9f2');
\o
\set QUIET 0
select ok, what from r9 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r9;
