-- Dashboard numbers, clearing data, and share links for the comment list.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r3 (n serial, ok boolean, what text);
grant all on r3 to authenticated, anon; grant all on sequence r3_n_seq to authenticated, anon;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r3 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users values ('00000000-0000-0000-0000-0000000000e1', 'eka@x.com'), ('00000000-0000-0000-0000-0000000000f1', 'fajar@x.com');
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
insert into workspaces (name, created_by) values ('Eka', '00000000-0000-0000-0000-0000000000e1');
insert into projects (workspace_id, public_id, name) select id, 'eka-shop-0001', 'Eka Shop' from workspaces where name = 'Eka';
reset role;
insert into threads (project_id, page, anchor, author_name, text, resolved_at, resolved_by, created_at)
select p.id, pg, '{"sel":"h1"}', 'Ana', txt, res, case when res is not null then 'Eka' end, now() - make_interval(days => d)
from projects p, (values ('/', 'Logo blur', null::timestamptz, 0), ('/', 'Warna kurang kontras', now(), 1), ('/cart', 'Tombol checkout hilang', null, 3), ('/cart', 'Harga salah', null, 20)) v(pg, txt, res, d)
where p.public_id = 'eka-shop-0001';
insert into replies (thread_id, author_name, text) select id, 'Eka', 'Siap' from threads where text = 'Tombol checkout hilang';
insert into installs (project_id, host, version, shown) select id, 'eka.shop', '0.3.0', true from projects where public_id = 'eka-shop-0001';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select set_config('t.st', public.project_stats((select id from projects where public_id = 'eka-shop-0001'))::text, false);
select pg_temp.check((current_setting('t.st')::json ->> 'open')::int = 2 and (current_setting('t.st')::json ->> 'ongoing')::int = 1 and (current_setting('t.st')::json ->> 'completed')::int = 1, 'stats: open 2, ongoing 1, completed 1');
select pg_temp.check(json_array_length(current_setting('t.st')::json -> 'per_day') = 14, 'stats: 14 days of activity, empty days included');
select pg_temp.check((select sum((x ->> 'n')::int) from json_array_elements(current_setting('t.st')::json -> 'per_day') x) = 3, 'stats: the 20-day-old comment is outside the 14 days');
select pg_temp.check((current_setting('t.st')::json -> 'pages' -> 0 ->> 'total')::int = 2 and json_array_length(current_setting('t.st')::json -> 'sites') = 1, 'stats: per page and per site');
-- another customer can't read the numbers
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check(pg_temp.fails($$select public.project_stats((select id from projects limit 1))$$) <> 'ok', 'another customer cannot see the numbers');
select pg_temp.check(pg_temp.fails(format($$select public.project_stats(%L)$$, (select id from (select id from projects) q limit 1))) <> 'ok', 'not even with the project id');
reset role;
select set_config('t.pid', (select id::text from projects where public_id = 'eka-shop-0001'), false);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
select pg_temp.check(pg_temp.fails(format($$select public.project_stats(%L)$$, current_setting('t.pid'))) = 'not_allowed', 'not even with the real project id');
select pg_temp.check(pg_temp.fails(format($$select public.create_share(%L)$$, current_setting('t.pid'))) = 'not_allowed', 'another customer cannot make share links');
-- share links
select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
select set_config('t.all', public.create_share(current_setting('t.pid')::uuid, 'For the team', 'all', 7), false);
select set_config('t.open', public.create_share(current_setting('t.pid')::uuid, null, 'open', null), false);
reset role; set role anon; select set_config('request.jwt.claims', '{"role":"anon"}', false);
select pg_temp.check(json_array_length(public.get_share(current_setting('t.all')) -> 'threads') = 4 and (public.get_share(current_setting('t.all')) ->> 'project') = 'Eka Shop', 'share link (all): 4 comments, no account needed');
select pg_temp.check(json_array_length(public.get_share(current_setting('t.open')) -> 'threads') = 3, 'share link (open only): 3 comments');
select pg_temp.check(json_array_length(public.get_share(current_setting('t.all')) -> 'threads' -> 1 -> 'replies') = 1, 'replies included (oldest first: the 3-day-old one has the reply)');
select pg_temp.check(pg_temp.fails($$select public.get_share('nope')$$) = 'share_unavailable', 'a made-up token shows nothing');
select pg_temp.check(pg_temp.fails($$select * from shares$$) <> 'ok' and pg_temp.fails($$select * from threads$$) <> 'ok', 'anon still cannot read tables');
reset role;
select pg_temp.check((select views from shares where label = 'For the team') = 3, 'views counted');
-- revoke, expire
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
update shares set revoked_at = now() where label = 'For the team';
reset role; set role anon;
select pg_temp.check(pg_temp.fails(format($$select public.get_share(%L)$$, current_setting('t.all'))) = 'share_unavailable', 'revoked link stops working');
reset role; update shares set expires_at = now() - interval '1 minute' where status_filter = 'open'; set role anon;
select pg_temp.check(pg_temp.fails(format($$select public.get_share(%L)$$, current_setting('t.open'))) = 'share_unavailable', 'expired link stops working');
reset role;
-- clearing data (as the panel does it)
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000f1');
delete from threads; delete from installs;
reset role;
select pg_temp.check((select count(*) from threads where project_id = current_setting('t.pid')::uuid) = 4 and (select count(*) from installs where project_id = current_setting('t.pid')::uuid) = 1, 'another customer cannot clear the data');
set role authenticated; select pg_temp.as_user('00000000-0000-0000-0000-0000000000e1');
delete from threads where project_id = current_setting('t.pid')::uuid;
delete from installs where project_id = current_setting('t.pid')::uuid;
select pg_temp.check(public.revoke_review_links(current_setting('t.pid')::uuid) >= 0, 'review links revoked');
reset role;
select pg_temp.check((select count(*) from threads where project_id = current_setting('t.pid')::uuid) = 0 and (select count(*) from replies r join threads t on t.id = r.thread_id where t.project_id = current_setting('t.pid')::uuid) = 0 and (select count(*) from installs where project_id = current_setting('t.pid')::uuid) = 0 and (select count(*) from threads) > 0, 'clear data: this project''s comments, replies and reports gone, others'' untouched');

\o
\set QUIET 0
select ok, what from r3 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r3;
