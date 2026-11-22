-- Email notifications: what goes into the outbox, who may read it, and what email_due() hands out.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r7 (n serial, ok boolean, what text);
grant all on r7 to authenticated, anon, service_role; grant all on sequence r7_n_seq to authenticated, anon, service_role;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r7 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://mail.shop') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin)::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
create function pg_temp.pending() returns bigint language sql security definer as $$ select count(*) from public.email_outbox o join public.projects p on p.id = o.project_id where p.public_id = 'mail-shop-v01' and o.sent_at is null $$;
grant execute on function pg_temp.pending() to authenticated, service_role;

insert into auth.users values ('00000000-0000-0000-0000-0000000e0a01', 'owner@mail.test'), ('00000000-0000-0000-0000-0000000e0b01', null);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000e0a01');
insert into workspaces (name, created_by) values ('Mail', '00000000-0000-0000-0000-0000000e0a01');
insert into projects (workspace_id, public_id, name) select id, 'mail-shop-v01', 'Mail shop' from workspaces where name = 'Mail';
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"modules":{"comments":true},"audience":"reviewers","envs":[{"id":"e1","name":"Website","host":"mail.shop","on":true}]}',
  '00000000-0000-0000-0000-0000000e0a01' from projects where public_id = 'mail-shop-v01';
select pg_temp.check((select notify from projects where public_id = 'mail-shop-v01') = 'instant', 'new projects email each new comment by default');
select pg_temp.check(pg_temp.fails($$select count(*) from public.email_outbox$$) like 'permission denied%', 'members can’t read the outbox');
select pg_temp.check(pg_temp.fails($$select public.email_due(false)$$) like 'permission denied%', 'members can’t call email_due');
reset role;
insert into reviewers (project_id, user_id, name) select id, '00000000-0000-0000-0000-0000000e0b01', 'Ani' from projects where public_id = 'mail-shop-v01';

-- a reviewer comments and replies: two rows
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000e0b01', true);
select set_config('t.thread', public.post_thread('mail-shop-v01', '/checkout', '{"sel":"#pay"}', 'Pay button is hidden on my phone') ->> 'id', false);
select public.post_reply(current_setting('t.thread')::uuid, 'Still hidden after reload', null);
select pg_temp.check(pg_temp.fails($$select public.email_due(false)$$) like 'permission denied%', 'reviewers can’t call email_due');
select pg_temp.check(pg_temp.pending() = 2, 'a reviewer’s comment and reply go to the outbox');
reset role;
-- the team replying in the panel: no email to themselves
insert into replies (thread_id, author_name, author_id, text) values (current_setting('t.thread')::uuid, 'Owner', '00000000-0000-0000-0000-0000000e0a01', 'On it');
select pg_temp.check(pg_temp.pending() = 2, 'the team’s own replies don’t email the team');

set role service_role;
select set_config('t.due', public.email_due(false)::text, false);
select pg_temp.check(json_array_length(current_setting('t.due')::json) = 1, 'one email entry for the project');
select pg_temp.check((current_setting('t.due')::json -> 0 -> 'recipients')::text = '["owner@mail.test"]', 'sent to the project’s members, not to reviewers');
select pg_temp.check((current_setting('t.due')::json -> 0 ->> 'total')::int = 2 and json_array_length(current_setting('t.due')::json -> 0 -> 'items') = 2, 'both items listed');
select pg_temp.check((current_setting('t.due')::json -> 0 -> 'items' -> 0 ->> 'page') = '/checkout' and (current_setting('t.due')::json -> 0 -> 'items' -> 1 ->> 'type') = 'reply', 'items carry the page and whether it is a reply');
select pg_temp.check(json_array_length(public.email_due(true)) = 0, 'not in the daily summary of an instant project');
select public.email_done(array(select json_array_elements_text(current_setting('t.due')::json -> 0 -> 'outbox_ids')::bigint));
select pg_temp.check(pg_temp.pending() = 0, 'email_done marks them sent');
select pg_temp.check(json_array_length(public.email_due(false)) = 0, 'nothing to send twice');
reset role;

-- daily
update projects set notify = 'daily' where public_id = 'mail-shop-v01';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000e0b01', true);
select public.post_thread('mail-shop-v01', '/', '{"sel":"h1"}', 'Typo in the title');
set role service_role;
select pg_temp.check(json_array_length(public.email_due(false)) = 0 and json_array_length(public.email_due(true)) = 1, 'a daily project waits for the summary');
reset role;

-- off
update projects set notify = 'off' where public_id = 'mail-shop-v01';
set role service_role;
select pg_temp.check(json_array_length(public.email_due(true)) = 0 and pg_temp.pending() = 0, 'off: nothing sent, the outbox doesn’t pile up');
reset role;
select pg_temp.check(pg_temp.fails($$update projects set notify = 'hourly' where public_id = 'mail-shop-v01'$$) like '%check%', 'only instant, daily or off');

delete from workspaces where name = 'Mail';
delete from auth.users where id in ('00000000-0000-0000-0000-0000000e0a01', '00000000-0000-0000-0000-0000000e0b01');
\o
\set QUIET 0
select ok, what from r7 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r7;
