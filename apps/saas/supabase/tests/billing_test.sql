-- Billing: off by default (nothing changes), row level security, effective plan, founding cap, idempotent events, limits.
\set ON_ERROR_STOP 1
\set QUIET 1
\o /dev/null
create temp table rb (n serial, ok boolean, what text);
grant all on rb to authenticated, anon, service_role; grant all on sequence rb_n_seq to authenticated, anon, service_role;
create function pg_temp.check(ok boolean, what text) returns void language sql as $$ insert into rb (ok, what) values (ok, what) $$;
create function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, false)
$$;
create function pg_temp.fails(q text) returns text language plpgsql as $$
begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000b1101', 'owner@bill.test'),
  ('00000000-0000-0000-0000-0000000b1102', 'stranger@bill.test'),
  ('00000000-0000-0000-0000-0000000b1103', 'member@bill.test');
insert into workspaces (id, name, created_by) values ('00000000-0000-0000-0000-0000000b1a01', 'BillWs', '00000000-0000-0000-0000-0000000b1101');
insert into workspace_members (workspace_id, user_id, role) values ('00000000-0000-0000-0000-0000000b1a01', '00000000-0000-0000-0000-0000000b1103', 'member');
insert into projects (id, workspace_id, public_id, name, created_at) values
  ('00000000-0000-0000-0000-0000000b1b01', '00000000-0000-0000-0000-0000000b1a01', 'bill-one-v01', 'One', now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000b1b02', '00000000-0000-0000-0000-0000000b1a01', 'bill-two-v01', 'Two', now() - interval '2 days');

-- off by default: no limits at all
select pg_temp.check(not public.billing_enabled(), 'billing is off by default');
select pg_temp.check(public.site_in_plan('00000000-0000-0000-0000-0000000b1b02'), 'billing off: every site collects comments');
insert into projects (workspace_id, public_id, name) values ('00000000-0000-0000-0000-0000000b1a01', 'bill-three-v01', 'Three');
select pg_temp.check(true, 'billing off: a third site can be created on Free');
delete from projects where public_id = 'bill-three-v01';

-- row level security
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000b1103');
select pg_temp.check((public.billing_status('00000000-0000-0000-0000-0000000b1a01') ->> 'plan') = 'free', 'a member gets the workspace’s billing status');
select pg_temp.check(not (public.billing_status('00000000-0000-0000-0000-0000000b1a01') ->> 'can_manage')::boolean, 'a plain member can’t manage billing');
select pg_temp.check(pg_temp.fails($$insert into public.subscriptions (workspace_id, provider, provider_customer_id, provider_subscription_id, status, price_tier, quantity) values ('00000000-0000-0000-0000-0000000b1a01', 'paddle', 'c', 's', 'active', 'founding', 9)$$) like 'permission denied%', 'users can’t write subscriptions');
select pg_temp.check(pg_temp.fails($$update public.app_settings set value = 'true' where key = 'billing_enabled'$$) like 'permission denied%', 'users can’t turn billing on');
select pg_temp.check(pg_temp.fails($$select public.billing_reserve_tier('00000000-0000-0000-0000-0000000b1a01')$$) like 'permission denied%', 'users can’t reserve founding seats');
select pg_temp.check(pg_temp.fails($$select public.billing_apply_event('paddle', 'x', 'x', null, null, null)$$) like 'permission denied%', 'users can’t apply webhook events');
select pg_temp.check(pg_temp.fails($$select count(*) from public.billing_events$$) like 'permission denied%', 'users can’t read billing events');
select pg_temp.check(pg_temp.fails($$select count(*) from public.founding_seats$$) like 'permission denied%', 'users can’t read founding seats');
select pg_temp.as_user('00000000-0000-0000-0000-0000000b1102');
select pg_temp.check(pg_temp.fails($$select public.billing_status('00000000-0000-0000-0000-0000000b1a01')$$) = 'not allowed', 'a stranger can’t read another workspace’s billing');
set role anon;
select pg_temp.as_user('');
select pg_temp.check(pg_temp.fails($$select count(*) from public.subscriptions$$) like 'permission denied%', 'anon can’t read subscriptions');
select pg_temp.check(pg_temp.fails($$select public.billing_status('00000000-0000-0000-0000-0000000b1a01')$$) like 'permission denied%', 'anon can’t call billing_status');

-- effective plan: override > free
reset role;
insert into account_plans (user_id, plan) values ('00000000-0000-0000-0000-0000000b1101', 'pro_beta');
select pg_temp.check((public._workspace_plan('00000000-0000-0000-0000-0000000b1a01') ->> 'source') = 'override'
  and (public._workspace_plan('00000000-0000-0000-0000-0000000b1a01') ->> 'site_limit') is null, 'an ops override gives no site limit');

-- webhook events (service role), idempotent and ordered
set role service_role;
select pg_temp.check(public.billing_reserve_tier('00000000-0000-0000-0000-0000000b1a01') = 'founding', 'checkout offers the founding price while seats are free');
select pg_temp.check(public.billing_apply_event('paddle', 'evt_1', 'subscription.created', '00000000-0000-0000-0000-0000000b1a01',
  '{"customer_id":"ctm_1","subscription_id":"sub_1","status":"active","price_tier":"founding","quantity":1,"current_period_end":"2026-12-26T00:00:00Z","occurred_at":"2026-11-26T10:00:00Z"}', '{"t":"x"}') = 'applied', 'an event is applied');
select pg_temp.check(public.billing_apply_event('paddle', 'evt_1', 'subscription.created', '00000000-0000-0000-0000-0000000b1a01',
  '{"customer_id":"ctm_1","subscription_id":"sub_1","status":"active","price_tier":"founding","quantity":5,"occurred_at":"2026-11-26T10:00:00Z"}', '{}') = 'duplicate', 'the same event twice is a duplicate');
select pg_temp.check(public.billing_apply_event('paddle', 'evt_0', 'subscription.updated', '00000000-0000-0000-0000-0000000b1a01',
  '{"customer_id":"ctm_1","subscription_id":"sub_1","status":"canceled","price_tier":"founding","quantity":1,"occurred_at":"2026-11-26T09:00:00Z"}', '{}') = 'stale', 'an older event doesn’t overwrite a newer one');
select pg_temp.check(public.billing_apply_event('paddle', 'evt_x', 'transaction.completed', null, null, '{}') = 'ignored', 'an event without a workspace is logged and ignored');
reset role;
select pg_temp.check((select quantity = 1 and status = 'active' from subscriptions where workspace_id = '00000000-0000-0000-0000-0000000b1a01'), 'the duplicate didn’t change the quantity');
select pg_temp.check((select count(*) = 3 from billing_events), 'each event is stored once');
select pg_temp.check((select state = 'active' from founding_seats where workspace_id = '00000000-0000-0000-0000-0000000b1a01'), 'the founding seat is active');
select pg_temp.check((public._workspace_plan('00000000-0000-0000-0000-0000000b1a01') ->> 'source') = 'subscription'
  and (public._workspace_plan('00000000-0000-0000-0000-0000000b1a01') ->> 'site_limit')::int = 1, 'a subscription beats the override: limit = paid sites');

set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000b1103');
select pg_temp.check((select count(*) = 1 from subscriptions), 'a member reads the workspace’s subscription');
select pg_temp.as_user('00000000-0000-0000-0000-0000000b1102');
select pg_temp.check((select count(*) = 0 from subscriptions), 'a stranger reads none');

-- billing on: limits apply
reset role;
update app_settings set value = 'true' where key = 'billing_enabled';
select pg_temp.check(public.site_in_plan('00000000-0000-0000-0000-0000000b1b01') and not public.site_in_plan('00000000-0000-0000-0000-0000000b1b02'), 'billing on: the oldest site is in the plan, the second is not');
select pg_temp.check(pg_temp.fails($$insert into public.threads (project_id, page, anchor, author_name, text) values ('00000000-0000-0000-0000-0000000b1b02', '/', '{"sel":"h1"}', 'R', 'x')$$) like 'site_over_plan%', 'a site beyond the plan collects no new comments');
insert into threads (id, project_id, page, anchor, author_name, text) values ('00000000-0000-0000-0000-0000000b1c01', '00000000-0000-0000-0000-0000000b1b01', '/', '{"sel":"h1"}', 'R', 'x');
select pg_temp.check(true, 'the site within the plan still collects comments');
select pg_temp.check(pg_temp.fails($$insert into public.projects (workspace_id, public_id, name) values ('00000000-0000-0000-0000-0000000b1a01', 'bill-four-v01', 'Four')$$) like 'plan_limit%', 'a new site needs room in the plan');
select pg_temp.check((select count(*) from projects where workspace_id = '00000000-0000-0000-0000-0000000b1a01') = 2, 'nothing was deleted');
set role service_role;
select public.billing_apply_event('paddle', 'evt_2', 'subscription.updated', '00000000-0000-0000-0000-0000000b1a01',
  '{"customer_id":"ctm_1","subscription_id":"sub_1","status":"active","price_tier":"founding","quantity":3,"occurred_at":"2026-11-26T11:00:00Z"}', '{}');
reset role;
select pg_temp.check(public.site_in_plan('00000000-0000-0000-0000-0000000b1b02'), 'more paid sites: the second site collects again');
insert into projects (workspace_id, public_id, name) values ('00000000-0000-0000-0000-0000000b1a01', 'bill-four-v01', 'Four');
select pg_temp.check(true, 'a third site fits in 3 paid sites');

-- cancel: back to Free, the founding seat is released
set role service_role;
select public.billing_apply_event('paddle', 'evt_3', 'subscription.canceled', '00000000-0000-0000-0000-0000000b1a01',
  '{"customer_id":"ctm_1","subscription_id":"sub_1","status":"canceled","price_tier":"founding","quantity":3,"occurred_at":"2026-11-26T12:00:00Z"}', '{}');
reset role;
delete from account_plans where user_id = '00000000-0000-0000-0000-0000000b1101';
select pg_temp.check((public._workspace_plan('00000000-0000-0000-0000-0000000b1a01') ->> 'plan') = 'free', 'canceled: the workspace is Free again');
select pg_temp.check((select state = 'released' from founding_seats where workspace_id = '00000000-0000-0000-0000-0000000b1a01'), 'canceled: the founding seat is released');
select pg_temp.check((select count(*) from threads where project_id = '00000000-0000-0000-0000-0000000b1b01') = 1, 'canceled: comments are kept');
update app_settings set value = 'false' where key = 'billing_enabled';

-- founding cap: 200 seats, holds count, expired holds don't
insert into auth.users (id, email) select ('00000000-0000-00bb-0000-' || lpad(to_hex(i), 12, '0'))::uuid, 'f' || i || '@bill.test' from generate_series(1, 202) i;
insert into workspaces (id, name, created_by) select ('00000000-0000-0000-0001-' || lpad(to_hex(i), 12, '0'))::uuid, 'F' || i, ('00000000-0000-00bb-0000-' || lpad(to_hex(i), 12, '0'))::uuid from generate_series(1, 202) i;
insert into founding_seats (workspace_id, state) select ('00000000-0000-0000-0001-' || lpad(to_hex(i), 12, '0'))::uuid, 'active' from generate_series(1, 198) i;
insert into founding_seats (workspace_id, state, held_until) values ('00000000-0000-0000-0001-0000000000c7', 'held', now() - interval '1 minute');
set role service_role;
select pg_temp.check(public.billing_reserve_tier('00000000-0000-0000-0001-0000000000c8') = 'founding', 'seat 199 is offered');
select pg_temp.check(public.billing_reserve_tier('00000000-0000-0000-0001-0000000000c9') = 'founding', 'seat 200 is offered (an expired hold doesn’t count)');
select pg_temp.check(public.billing_reserve_tier('00000000-0000-0000-0001-0000000000ca') = 'normal', 'seat 201: normal price');
select pg_temp.check(public.billing_reserve_tier('00000000-0000-0000-0001-0000000000c8') = 'founding', 'a workspace holding a seat keeps it on a second checkout');
select pg_temp.check(public._founding_taken() = 200, 'exactly 200 seats taken');
reset role;
select pg_temp.check(pg_get_functiondef('public.billing_reserve_tier(uuid)'::regprocedure) like '%pg_advisory_xact_lock%', 'seats are taken under a lock (concurrency-safe)');

-- ops
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000b1102') on conflict do nothing;
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000b1103');
select pg_temp.check(pg_temp.fails($$select public.ops_billing_overview()$$) = 'not allowed', 'non-admin: ops_billing_overview refused');
select pg_temp.as_user('00000000-0000-0000-0000-0000000b1102');
select pg_temp.check((public.ops_billing_overview() ->> 'founding_active')::int = 198, 'admin: founding count from real seats');
select pg_temp.check((public.ops_billing_for_users(array['00000000-0000-0000-0000-0000000b1101'::uuid]) -> '00000000-0000-0000-0000-0000000b1101' -> 0 ->> 'status') = 'canceled', 'admin: subscription per user');
reset role;
delete from public.platform_admins where user_id = '00000000-0000-0000-0000-0000000b1102';

-- leave nothing behind for the other tests (emails, counts)
delete from workspaces where id = '00000000-0000-0000-0000-0000000b1a01' or name ~ '^F[0-9]+$';
delete from email_outbox where project_id not in (select id from projects);
delete from auth.users where email like '%@bill.test';
\o
select case when bool_and(ok) then 'billing: all ' || count(*) || ' checks passed' else 'billing FAILED: ' || string_agg(what, '; ') filter (where not ok) end from rb;
do $$ begin if exists (select 1 from rb where not ok) then raise exception 'billing tests failed'; end if; end $$;
