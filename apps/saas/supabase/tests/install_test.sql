-- Installation reports: only from the project's own sites, at most 20, never from made-up origins.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r4 (n serial, ok boolean, what text);
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r4 (ok, what) values (ok, what) $$;
insert into auth.users values ('00000000-0000-0000-0000-00000000a9f1', 'fi@x.com');
insert into workspaces (id, name, created_by) values ('00000000-0000-0000-0000-0000a9f0f000', 'Fi', '00000000-0000-0000-0000-00000000a9f1');
insert into workspace_members (workspace_id, user_id, role) values ('00000000-0000-0000-0000-0000a9f0f000', '00000000-0000-0000-0000-00000000a9f1', 'owner') on conflict do nothing;
insert into projects (id, workspace_id, public_id, name) values ('00000000-0000-0000-0000-0000a9f0f001', '00000000-0000-0000-0000-0000a9f0f000', 'fi-shop-0001', 'Fi');
insert into releases (project_id, version, config, created_by) values ('00000000-0000-0000-0000-0000a9f0f001', 1,
  '{"v":1,"on":true,"modules":{"comments":true},"audience":"reviewers","envs":[{"id":"e1","name":"Production","host":"fi.shop","on":true},{"id":"e2","name":"Staging","host":"staging.fi.shop","on":false},{"id":"e3","name":"Previews","host":"fi-git-*.vercel.app","on":true}]}',
  '00000000-0000-0000-0000-00000000a9f1');
set role anon;
select set_config('request.headers', '{"origin":"https://fi.shop"}', false); select public.report_seen('fi-shop-0001', '0.3.0', true, '');
select set_config('request.headers', '{"origin":"https://staging.fi.shop"}', false); select public.report_seen('fi-shop-0001', '0.3.0', false, 'off here');
select set_config('request.headers', '{"origin":"https://fi-git-main.vercel.app"}', false); select public.report_seen('fi-shop-0001', '0.3.0', true, '');
select set_config('request.headers', '{"origin":"https://evil.example"}', false); select public.report_seen('fi-shop-0001', '0.3.0', true, '');
select set_config('request.headers', '{"origin":"https://fi.shop.evil.example"}', false); select public.report_seen('fi-shop-0001', '0.3.0', true, '');
select set_config('request.headers', '{}', false); select public.report_seen('fi-shop-0001', '0.3.0', true, '');
reset role;
select pg_temp.check((select count(*) from installs where project_id = '00000000-0000-0000-0000-0000a9f0f001') = 3, 'own sites recorded (production, staging even while off, a preview)');
select pg_temp.check(not exists (select 1 from installs where host like '%evil%'), 'made-up origins are not recorded');
-- at most 20 sites: a wildcard environment, 30 previews
set role anon;
do $$ begin for i in 1..30 loop
  perform set_config('request.headers', json_build_object('origin', format('https://fi-git-b%s.vercel.app', i))::text, false);
  perform public.report_seen('fi-shop-0001', '0.3.0', true, '');
end loop; end $$;
reset role;
select pg_temp.check((select count(*) from installs where project_id = '00000000-0000-0000-0000-0000a9f0f001') = 20, 'at most 20 sites per project');
-- leave nothing behind for the other test files
delete from workspaces where id = '00000000-0000-0000-0000-0000a9f0f000';
delete from auth.users where id = '00000000-0000-0000-0000-00000000a9f1';
\o
\set QUIET 0
select ok, what from r4 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r4;
