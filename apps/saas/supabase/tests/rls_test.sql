-- Row level security tests: two customers (Rina, Sari) and a stranger must never see or change each
-- other's data. Run on a fresh database: supabase_stub.sql, the migrations, then this file.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table results (n serial, ok boolean, what text);
grant all on results to authenticated, anon; grant all on sequence results_n_seq to authenticated, anon;

insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'rina@x.com'), ('00000000-0000-0000-0000-00000000000b', 'sari@x.com'), ('00000000-0000-0000-0000-00000000000c', 'tono@x.com');

create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false)
$$;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into results (ok, what) values (ok, what) $$;

-- Rina sets up a workspace and a project, as the panel will.
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
-- as the panel does it (supabase-js insert().select()): insert and read back in one statement
with w as (insert into workspaces (name, created_by) values ('Rina Studio', '00000000-0000-0000-0000-00000000000a') returning name) select pg_temp.check((select count(*) from w) = 1, 'create a workspace and read it back in one call');
select pg_temp.check((select count(*) from workspace_members where role = 'owner') = 1, 'creator becomes owner');
insert into projects (workspace_id, public_id, name, site_url) select id, 'toko-budi-x7k2', 'Toko Budi', 'https://tokobudi.com' from workspaces;
select pg_temp.check((select count(*) from projects) = 1, 'owner sees own project');

-- Sari, another customer.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
insert into workspaces (name, created_by) values ('Sari Co', '00000000-0000-0000-0000-00000000000b');
insert into projects (workspace_id, public_id, name) select id, 'sari-shop-a1b2', 'Sari Shop' from workspaces where name = 'Sari Co';
select pg_temp.check((select count(*) from workspaces) = 1, 'sari sees only her workspace');
select pg_temp.check((select count(*) from projects) = 1 and (select public_id from projects) = 'sari-shop-a1b2', 'sari sees only her project');
reset role;
-- comments made through the Edge Function (service role)
insert into threads (project_id, page, anchor, author_name, text) select id, '/', '{"sel":"#buy"}', 'Pak Budi', 'Tombol kurang kelihatan' from projects where public_id = 'toko-budi-x7k2';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
select pg_temp.check((select count(*) from threads) = 0, 'sari cannot read rina''s comments');
update threads set text = 'hacked';
delete from threads;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
select pg_temp.check((select text from threads) = 'Tombol kurang kelihatan', 'sari''s update and delete did nothing');
-- Sari can't put a project into Rina's workspace, nor join it.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  insert into projects (workspace_id, public_id, name) select id, 'sneaky-0001', 'x' from workspaces where name = 'Rina Studio';
  perform pg_temp.check((select count(*) from projects where public_id = 'sneaky-0001') = 0, 'cannot see rina''s workspace to add a project');
exception when insufficient_privilege then perform pg_temp.check(true, 'cannot add a project to rina''s workspace');
end $$;
do $$ declare rina_ws uuid; begin
  reset role; select id into rina_ws from workspaces where name = 'Rina Studio'; set role authenticated;
  perform pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
  insert into workspace_members (workspace_id, user_id, role) values (rina_ws, '00000000-0000-0000-0000-00000000000b', 'member');
  perform pg_temp.check(false, 'joined rina''s workspace by id');
exception when insufficient_privilege then perform pg_temp.check(true, 'cannot join rina''s workspace even knowing its id');
end $$;
-- Releases: a member publishes for their own project, as themselves; nobody else can.
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
insert into releases (project_id, version, config, created_by) select id, 1, '{"v":1}', '00000000-0000-0000-0000-00000000000a' from projects where public_id = 'toko-budi-x7k2';
select pg_temp.check((select count(*) from releases) = 1, 'owner publishes a release for her project');
do $$ begin
  insert into releases (project_id, version, config, created_by) select id, 2, '{}', '00000000-0000-0000-0000-00000000000b' from projects;
  perform pg_temp.check(false, 'published in someone else''s name');
exception when insufficient_privilege then perform pg_temp.check(true, 'cannot publish in someone else''s name');
end $$;
do $$ begin
  update releases set config = '{"hacked":1}';
  perform pg_temp.check((select config->>'hacked' from releases limit 1) is null, 'releases cannot be edited');
end $$;
-- Widget files on Storage: only the project's own file, only by its members.
insert into storage.objects (bucket_id, name) values ('widget-config', 'toko-budi-x7k2.json');
select pg_temp.check(true, 'owner writes her project''s widget file');
do $$ begin
  insert into storage.objects (bucket_id, name) values ('widget-config', 'sari-shop-a1b2.json');
  perform pg_temp.check(false, 'wrote another customer''s widget file');
exception when insufficient_privilege then perform pg_temp.check(true, 'cannot write another customer''s widget file');
end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('widget-config', 'made-up-name.json');
  perform pg_temp.check(false, 'wrote a file for no project');
exception when insufficient_privilege then perform pg_temp.check(true, 'cannot write a file that is no project''s');
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
do $$ begin
  insert into releases (project_id, version, config, created_by) select p.id, 9, '{}', '00000000-0000-0000-0000-00000000000b' from projects p;
  reset role;
  perform pg_temp.check((select count(*) from releases where version = 9) = 1, 'sari publishes only for her own project');
  set role authenticated;
end $$;
update storage.objects set name = 'x.json' where name = 'toko-budi-x7k2.json';
reset role;
select pg_temp.check(exists (select 1 from storage.objects where name = 'toko-budi-x7k2.json'), 'sari cannot replace rina''s widget file');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
do $$ begin
  insert into handoffs (token_hash, project_id, expires_at) select repeat('a', 64), id, now() + interval '1 minute' from projects;
  perform pg_temp.check(false, 'panel wrote a review token directly');
exception when insufficient_privilege then perform pg_temp.check(true, 'review tokens only through the function');
end $$;
select pg_temp.check((select count(*) from handoffs) = 0, 'no one reads review tokens from the panel');
-- The snippet's id never changes.
do $$ begin
  update projects set public_id = 'stolen-name-0001';
  perform pg_temp.check(false, 'public_id changed');
exception when raise_exception then perform pg_temp.check(true, 'public_id is fixed');
end $$;
-- An admin can't remove the owner; a member can't promote themselves.
reset role;
insert into workspace_members (workspace_id, user_id, role) select id, '00000000-0000-0000-0000-00000000000c', 'admin' from workspaces where name = 'Rina Studio';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
delete from workspace_members where role = 'owner';
reset role;
select pg_temp.check((select count(*) from workspace_members where role = 'owner' and user_id = '00000000-0000-0000-0000-00000000000a') = 1, 'admin cannot remove the owner');
set role authenticated;
do $$ begin
  update workspace_members set role = 'owner' where user_id = '00000000-0000-0000-0000-00000000000c';
  perform pg_temp.check(not exists (select 1 from workspace_members where user_id = '00000000-0000-0000-0000-00000000000c' and role = 'owner'), 'admin did not become owner');
exception when insufficient_privilege then perform pg_temp.check(true, 'admin cannot make themselves owner');
end $$;
-- Anonymous (the public anon key) sees nothing at all.
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
do $$ begin
  perform 1 from projects;
  perform pg_temp.check(false, 'anon read projects');
exception when insufficient_privilege then perform pg_temp.check(true, 'anon cannot read projects');
end $$;
do $$ begin
  perform 1 from threads;
  perform pg_temp.check(false, 'anon read comments');
exception when insufficient_privilege then perform pg_temp.check(true, 'anon cannot read comments');
end $$;
reset role;
-- Data checks: a page that leaves the site, a huge selector.
do $$ begin
  insert into threads (project_id, page, anchor, author_name, text) select id, '//evil.com', '{"sel":"a"}', 'x', 'y' from projects limit 1;
  perform pg_temp.check(false, 'stored a page that leaves the site');
exception when check_violation then perform pg_temp.check(true, 'page //evil.com refused');
end $$;
do $$ begin
  insert into threads (project_id, page, anchor, author_name, text) select id, '/', json_build_object('sel', repeat('div ', 200))::jsonb, 'x', 'y' from projects limit 1;
  perform pg_temp.check(false, 'stored a huge selector');
exception when check_violation then perform pg_temp.check(true, 'selector over 400 characters refused');
end $$;
-- Rate limit
select pg_temp.check((select bool_and(public.take_rate('r1', 3)) from generate_series(1, 3)) and not public.take_rate('r1', 3), 'rate limit: 4th hit in a minute refused');

\o
\set QUIET 0
select ok, what from results order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from results;
