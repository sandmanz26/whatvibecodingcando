-- Every research module that is on keeps one study: the last ★ can't be deleted, deleting a ★ moves it.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r9 (n serial, ok boolean, what text);
grant all on r9 to authenticated, anon; grant all on sequence r9_n_seq to authenticated, anon;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r9 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false),
         set_config('request.headers', json_build_object('origin', 'https://kopi.shop')::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users values ('00000000-0000-0000-0000-00000000e0a1', 'g@x.com'), ('00000000-0000-0000-0000-00000000e0b1', 'other@x.com');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0a1');
insert into workspaces (name, created_by) values ('Guard', '00000000-0000-0000-0000-00000000e0a1');
insert into projects (workspace_id, public_id, name, site_url) select id, 'guard-sg01', 'Guard', 'https://kopi.shop' from workspaces where name = 'Guard';
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"modules":{"comments":true,"heatmap":true,"gaze":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"kopi.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000e0a1' from projects where public_id = 'guard-sg01';
select pg_temp.check((select count(*) from studies where project_id = (select id from projects where public_id = 'guard-sg01') and is_default) = 2, 'two modules on: two ★ studies');
-- the only study of an enabled module
select pg_temp.check(pg_temp.fails($$delete from studies where name = 'Eye tracking'$$) like '%last_study%', 'the only ★ of an enabled module can''t be deleted (direct delete)');
select pg_temp.check(pg_temp.fails($$select public.delete_study((select id from studies where name = 'Eye tracking'))$$) like '%last_study%', 'nor through delete_study');
select pg_temp.check((select count(*) from studies where name = 'Eye tracking') = 1, 'it is still there');
-- pausing is allowed
update studies set status = 'closed' where name = 'Eye tracking';
select pg_temp.check((select status from studies where name = 'Eye tracking') = 'closed', 'pausing it works');
-- two more gaze studies; deleting the ★ with a chosen next ★
insert into studies (project_id, kind, name, config, eye_tracking) select id, 'browse', 'Gaze round A', '{"minutes":3}', true from projects where public_id = 'guard-sg01';
insert into studies (project_id, kind, name, config, eye_tracking) select id, 'browse', 'Gaze round B', '{"minutes":3}', true from projects where public_id = 'guard-sg01';
select public.delete_study((select id from studies where name = 'Eye tracking'), (select id from studies where name = 'Gaze round A'));
select pg_temp.check((select is_default from studies where name = 'Gaze round A'), 'deleting the ★: the chosen study becomes ★');
select pg_temp.check((select link_hash is not null and link_expires is null from studies where name = 'Gaze round A'), 'the new ★ has a link that never expires');
-- deleting the ★ without a choice: the newest remaining
reset role; update studies set created_at = now() - interval '1 day' where name = 'Gaze round A'; set role authenticated;
insert into studies (project_id, kind, name, config, eye_tracking) select id, 'browse', 'Gaze round C', '{"minutes":3}', true from projects where public_id = 'guard-sg01';
delete from studies where name = 'Gaze round A';
select pg_temp.check((select is_default from studies where name = 'Gaze round C'), 'no choice: the newest becomes ★');
select pg_temp.check((select count(*) from studies where module = 'gaze' and is_default and project_id = (select id from projects where public_id = 'guard-sg01')) = 1, 'still exactly one ★');
-- a non-default study is deleted freely
delete from studies where name = 'Gaze round B';
select pg_temp.check((select count(*) from studies where name = 'Gaze round B') = 0, 'a non-★ study deletes as before');
-- someone outside the workspace
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0b1');
select pg_temp.check(pg_temp.fails($$select public.delete_study((select id from studies where name = 'Gaze round C'))$$) <> 'ok', 'an outsider can''t delete');
select pg_temp.as_user('00000000-0000-0000-0000-00000000e0a1');
-- a module turned off: its last study may go
insert into releases (project_id, version, config, created_by) select id, 2,
  '{"v":1,"on":true,"modules":{"comments":true,"heatmap":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"kopi.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000e0a1' from projects where public_id = 'guard-sg01';
select pg_temp.check(pg_temp.fails($$delete from studies where name = 'Gaze round C'$$) = 'ok', 'module off: its last study can be deleted');
-- turned on again: the default is made again (the idempotent path)
insert into releases (project_id, version, config, created_by) select id, 3,
  '{"v":1,"on":true,"modules":{"comments":true,"heatmap":true,"gaze":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"kopi.shop","on":true}]}',
  '00000000-0000-0000-0000-00000000e0a1' from projects where public_id = 'guard-sg01';
select pg_temp.check((select count(*) from studies where module = 'gaze' and is_default and project_id = (select id from projects where public_id = 'guard-sg01')) = 1, 'module on again: its ★ is back');
reset role;
-- if one ever goes missing anyway (by hand), the backfill path restores it, once
update studies set is_default = false where name = 'Site heatmap' and project_id = (select id from projects where public_id = 'guard-sg01');
select public._ensure_default_studies(id) from projects where public_id = 'guard-sg01';
select public._ensure_default_studies(id) from projects where public_id = 'guard-sg01';
select pg_temp.check((select count(*) from studies where module = 'heatmap' and is_default and project_id = (select id from projects where public_id = 'guard-sg01')) = 1, 'a missing ★ is recreated, idempotently');
-- deleting the workspace is never blocked
select pg_temp.check(pg_temp.fails($$delete from workspaces where name = 'Guard'$$) = 'ok', 'deleting the workspace (and its projects) is never blocked');
select pg_temp.check((select count(*) from studies s where not exists (select 1 from projects p where p.id = s.project_id)) = 0, 'no orphan studies left');
delete from auth.users where id::text like '00000000-0000-0000-0000-00000000e0%';
\o
\set QUIET 0
select ok, what from r9 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r9;
