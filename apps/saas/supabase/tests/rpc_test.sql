-- Reviewer functions: review links, comments from customers' sites, the installation check, deleting
-- an account. Runs after rls_test.sql's setup is repeated here on its own data.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r2 (n serial, ok boolean, what text);
grant all on r2 to authenticated, anon; grant all on sequence r2_n_seq to authenticated, anon;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r2 (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text, anon boolean default false, origin text default 'https://tokobudi.com') returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated', 'is_anonymous', anon)::text, false),
         set_config('request.headers', json_build_object('origin', origin)::text, false)
$$;
-- raises → false
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1', 'owner@x.com'), ('00000000-0000-0000-0000-0000000000b1', null), ('00000000-0000-0000-0000-0000000000c1', null), ('00000000-0000-0000-0000-0000000000d1', null);
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into workspaces (name, created_by) values ('Studio', '00000000-0000-0000-0000-0000000000a1');
insert into projects (workspace_id, public_id, name, site_url) select id, 'toko-a1b2', 'Toko', 'https://tokobudi.com' from workspaces where name = 'Studio';
insert into releases (project_id, version, config, created_by) select id, 1,
  '{"v":1,"on":true,"modules":{"comments":true},"audience":"reviewers","envs":[{"id":"e1","name":"Production","host":"tokobudi.com","on":true},{"id":"e2","name":"Staging","host":"staging.tokobudi.com","on":false},{"id":"e3","name":"Previews","host":"toko-git-*.vercel.app","on":true}]}',
  '00000000-0000-0000-0000-0000000000a1' from projects where public_id = 'toko-a1b2';
-- the owner makes an invite link for Pak Budi (7 days)
select set_config('t.invite', public.create_review_link((select id from projects where public_id = 'toko-a1b2'), false, 'Pak Budi', 7), false);
select pg_temp.check(length(current_setting('t.invite')) = 64, 'owner creates an invite link');
reset role;
select pg_temp.check((select token_hash from handoffs limit 1) <> current_setting('t.invite') and (select kind from handoffs limit 1) = 'invite', 'only the hash of the token is stored');
set role authenticated;

-- an anonymous browser (the reviewer) can't create workspaces
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', true);
select pg_temp.check(pg_temp.fails($$insert into workspaces (name, created_by) values ('spam', '00000000-0000-0000-0000-0000000000b1')$$) <> 'ok', 'anonymous browsers cannot create workspaces');
select pg_temp.check(pg_temp.fails($$select public.create_review_link((select id from projects limit 1))$$) <> 'ok', 'reviewers cannot make review links');
-- without the link: not a reviewer
select pg_temp.check(pg_temp.fails($$select public.list_threads('toko-a1b2')$$) = 'not_invited', 'no link: not a reviewer');
select pg_temp.check(pg_temp.fails($$select public.start_review('toko-a1b2')$$) = 'not_invited', 'no link: cannot start reviewing');
-- a wrong site can't use the link
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', true, 'https://evil.com');
select pg_temp.check(pg_temp.fails(format($$select public.start_review('toko-a1b2', %L)$$, current_setting('t.invite'))) = 'origin_not_allowed', 'another site cannot use the link');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', true, 'https://staging.tokobudi.com');
select pg_temp.check(pg_temp.fails(format($$select public.start_review('toko-a1b2', %L)$$, current_setting('t.invite'))) = 'origin_not_allowed', 'an environment switched off refuses');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', true, 'https://toko-git-feature-x.vercel.app');
select pg_temp.check(pg_temp.fails($$select public.start_review('toko-a1b2', 'nope')$$) = 'link_expired', 'a made-up token is refused');
-- the real link on a preview environment (pattern)
select pg_temp.check((public.start_review('toko-a1b2', current_setting('t.invite')) ->> 'name') = 'Pak Budi', 'invite link signs Pak Budi in (preview environment pattern)');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', true);
select pg_temp.check((public.start_review('toko-a1b2') ->> 'name') = 'Pak Budi', 'the same browser comes back without the link');
-- comments
select set_config('t.th', (public.post_thread('toko-a1b2', '/produk/kopi', '{"sel":"#buy","rx":0.5,"ry":0.5,"x":1,"y":2,"vw":1200}', 'Tombol kurang kelihatan') ->> 'id'), false);
select pg_temp.check(json_array_length(public.list_threads('toko-a1b2')) = 1, 'reviewer posts and lists a comment');
select pg_temp.check((public.list_threads('toko-a1b2') -> 0 ->> 'mine')::boolean and (public.list_threads('toko-a1b2') -> 0 ->> 'author') = 'Pak Budi', 'comment is his, under his name');
select set_config('t.my', public.post_thread('toko-a1b2', '/', '{"sel":"h1"}', 'Judul terlalu kecil', 'aaaaaaaa-0000-4000-8000-000000000001') ->> 'id', false);
select pg_temp.check(current_setting('t.my') = 'aaaaaaaa-0000-4000-8000-000000000001', 'the script''s own id is kept');
select pg_temp.check(pg_temp.fails($$select public.post_thread('toko-a1b2', '/', '{"sel":"h1"}', 'again', 'aaaaaaaa-0000-4000-8000-000000000001')$$) <> 'ok', 'an id cannot be reused');
select pg_temp.check((public.post_reply(current_setting('t.my')::uuid, 'tambahan', 'bbbbbbbb-0000-4000-8000-000000000001') -> 'replies' -> 0 ->> 'mine')::boolean, 'reply posted, marked as his');
select pg_temp.check(json_array_length(public.delete_reply('bbbbbbbb-0000-4000-8000-000000000001') -> 'replies') = 0, 'he deletes his own reply');
select public.delete_thread(current_setting('t.my')::uuid);
select pg_temp.check(pg_temp.fails($$select public.post_thread('toko-a1b2', '//evil.com', '{"sel":"a"}', 'x')$$) <> 'ok', 'a page that leaves the site is refused');
select pg_temp.check(pg_temp.fails($$select public.post_thread('toko-a1b2', '/', '{"sel":"a"}', '   ')$$) = 'empty', 'an empty comment is refused');
-- the owner sees it in the panel (row level security, not the functions)
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.check((select count(*) from threads) = 1 and (select author_name from threads) = 'Pak Budi', 'the owner sees it in the inbox');
insert into replies (thread_id, author_name, author_id, text) values (current_setting('t.th')::uuid, 'Rina', '00000000-0000-0000-0000-0000000000a1', 'Siap, saya perbesar');
-- a second reviewer (link for the owner herself: 2 minutes, one use)
select set_config('t.link', public.create_review_link((select id from projects where public_id = 'toko-a1b2'), true, 'Rina'), false);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', true);
select pg_temp.check((public.start_review('toko-a1b2', current_setting('t.link')) ->> 'preview')::boolean, 'preview link: previewing, with the draft');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000d1', true);
select pg_temp.check(pg_temp.fails(format($$select public.start_review('toko-a1b2', %L)$$, current_setting('t.link'))) = 'link_expired', 'a one-time link works once');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1', true);
select pg_temp.check(json_array_length((public.list_threads('toko-a1b2') -> 0 -> 'replies')) = 1, 'reviewers see the owner''s reply');
select pg_temp.check(pg_temp.fails(format($$select public.edit_thread(%L, 'hacked')$$, current_setting('t.th'))) = 'not_yours', 'cannot edit someone else''s comment');
select pg_temp.check(pg_temp.fails(format($$select public.delete_thread(%L)$$, current_setting('t.th'))) = 'not_yours', 'cannot delete someone else''s comment');
select pg_temp.check(pg_temp.fails(format($$select public.delete_reply(%L)$$, (select id::text from (select (json_array_elements(public.list_threads('toko-a1b2') -> 0 -> 'replies') ->> 'id')::uuid as id) q limit 1))) = 'not_yours', 'cannot delete someone else''s reply');
select pg_temp.check((public.set_resolved(current_setting('t.th')::uuid, true) -> 'resolved' ->> 'by') = 'Rina', 'any reviewer completes a comment');
select pg_temp.check((select count(*) from threads) = 0, 'reviewers cannot read the tables directly');
-- the kill switch: published off → nothing works, from anywhere
reset role;
insert into releases (project_id, version, config, created_by) select id, 2, '{"v":1,"on":false,"modules":{"comments":true},"audience":"reviewers","envs":[{"id":"e1","name":"Production","host":"tokobudi.com","on":true}]}', '00000000-0000-0000-0000-0000000000a1' from projects where public_id = 'toko-a1b2';
set role authenticated;
select pg_temp.check(pg_temp.fails($$select public.list_threads('toko-a1b2')$$) = 'origin_not_allowed', 'widget switched off: comments closed');
-- rate limit on writes
reset role;
insert into releases (project_id, version, config, created_by) select id, 3, (select config from releases where version = 1 and project_id = p.id), '00000000-0000-0000-0000-0000000000a1' from projects p where public_id = 'toko-a1b2';
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', true);
do $$ declare i int; n int := 0; begin
  for i in 1..25 loop
    begin perform public.post_thread('toko-a1b2', '/', '{"sel":"a"}', 'spam ' || i); n := n + 1; exception when others then null; end;
  end loop;
  perform pg_temp.check(n < 25 and n >= 15, format('writes are rate limited (%s of 25 went through)', n));
end $$;
-- installation check: anyone, throttled
reset role; set role anon; select set_config('request.headers', '{"origin":"https://tokobudi.com"}', false);
select public.report_seen('toko-a1b2', '0.3.0', false, 'Only reviewers');
select public.report_seen('toko-a1b2', '0.3.0', false, 'again');
reset role;
select pg_temp.check((select count(*) from installs) = 1 and (select why from installs) = 'Only reviewers', 'installation check recorded, repeats throttled');
set role anon;
select pg_temp.check(pg_temp.fails($$select public.list_threads('toko-a1b2')$$) <> 'ok', 'anon cannot call reviewer functions');
reset role;
-- deleting the account removes the workspace and the login
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.delete_my_account();
reset role;
select pg_temp.check(not exists (select 1 from auth.users where id = '00000000-0000-0000-0000-0000000000a1') and not exists (select 1 from projects where public_id = 'toko-a1b2'), 'delete my account: login, workspace, projects and comments gone');

\o
\set QUIET 0
select ok, what from r2 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r2;
