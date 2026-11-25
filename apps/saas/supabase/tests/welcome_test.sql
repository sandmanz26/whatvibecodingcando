-- Welcome email on the first sign-in: Google, email link after confirmation, email code (OTP) once entered; once.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table r10 (n serial, ok boolean, what text);
grant all on r10 to service_role; grant all on sequence r10_n_seq to service_role;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into r10 (ok, what) values (ok, what) $$;
create function pg_temp.kinds(due json, mail text) returns text language sql as $$
  select coalesce(string_agg(e ->> 'kind', ','), '') from json_array_elements(due) e where e ->> 'email' = mail $$;
insert into auth.users (id, email, created_at, last_sign_in_at, email_confirmed_at, raw_app_meta_data) values
  ('00000000-0000-0000-0000-00000000e001', 'google@wel.test', now() - interval '1 minute', now() - interval '1 minute', now() - interval '1 minute', '{"provider":"google"}'),
  ('00000000-0000-0000-0000-00000000e002', 'link@wel.test', now() - interval '3 days', now() - interval '2 minutes', now() - interval '2 minutes', '{"provider":"email"}'),
  ('00000000-0000-0000-0000-00000000e003', 'otp@wel.test', now() - interval '1 minute', null, null, '{"provider":"email"}'),
  ('00000000-0000-0000-0000-00000000e004', 'late@wel.test', now() - interval '10 days', now() - interval '1 minute', now() - interval '1 minute', '{"provider":"email"}');
-- an unfinished sign-up that still got a preference row must not be welcomed
insert into public.email_prefs (user_id) values ('00000000-0000-0000-0000-00000000e003');
set role service_role;
select set_config('t.w', public.email_lifecycle_due(true)::text, false);
select pg_temp.check(pg_temp.kinds(current_setting('t.w')::json, 'google@wel.test') = 'welcome', 'Google: welcome on the first sign-in, in the 5-minute run');
select pg_temp.check(pg_temp.kinds(current_setting('t.w')::json, 'link@wel.test') = 'welcome', 'email link: welcome once confirmed');
select pg_temp.check(pg_temp.kinds(current_setting('t.w')::json, 'otp@wel.test') = '', 'email code not yet entered: no welcome');
select pg_temp.check(pg_temp.kinds(current_setting('t.w')::json, 'late@wel.test') = 'welcome', 'a late confirmation (10 days after sign-up) still gets the welcome');
reset role;
update auth.users set last_sign_in_at = now(), email_confirmed_at = now() where id = '00000000-0000-0000-0000-00000000e003';
set role service_role;
select pg_temp.check(pg_temp.kinds(public.email_lifecycle_due(true), 'otp@wel.test') = 'welcome', 'email code entered: welcome');
select public.email_sent_mark(json_build_array(json_build_object('user_id', '00000000-0000-0000-0000-00000000e001', 'kind', 'welcome')));
select pg_temp.check(pg_temp.kinds(public.email_lifecycle_due(true), 'google@wel.test') = '', 'the welcome is sent once');
reset role;
delete from public.email_sent where user_id::text like '00000000-0000-0000-0000-00000000e00%';
delete from public.email_prefs where user_id::text like '00000000-0000-0000-0000-00000000e00%';
delete from auth.users where id::text like '00000000-0000-0000-0000-00000000e00%';
\o
\set QUIET 0
select ok, what from r10 order by n;
select case when bool_and(ok) then 'ALL PASS' else 'FAILED: ' || count(*) filter (where not ok) end as result from r10;
