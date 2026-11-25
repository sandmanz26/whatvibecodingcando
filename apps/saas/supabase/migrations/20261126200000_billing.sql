-- ourhunch: billing, ready but OFF (docs/BILLING.md).
--
-- * app_settings.billing_enabled (default false). While false nothing changes for anyone: no limits,
--   the panel says "Free during the beta". The owner turns it on by hand (docs/BILLING.md).
-- * subscriptions: one per workspace, written only by the Edge Function `billing` (service role)
--   from the provider's webhooks. Members of the workspace can read it.
-- * billing_events: every webhook once (unique provider + event id), with a minimal payload. Never
--   card data: the provider (merchant of record) keeps that.
-- * founding_seats: the first 200 paying workspaces keep the founding price ($2/site) while their
--   subscription stays active. A seat is held for 1 hour when checkout starts (so two checkouts can't
--   take the last seat), made active by the webhook, released when the subscription ends. Taking a
--   seat runs under a transaction advisory lock: the cap holds under concurrency.
-- * Effective plan of a workspace: an active subscription (pro, quantity = paid sites) > the owner's
--   account_plans override (set in the ops panel: pro / pro_beta / founding = no site limit) > free (1 site).
-- * Enforcement (only while billing_enabled): a new site needs room in the plan; sites beyond the
--   plan (oldest first keep working) stop collecting NEW comments and replies. Nothing is deleted;
--   the team can still read, resolve, export and delete everything.

-- ---------- settings ----------

create table if not exists public.app_settings (
  key        text primary key check (char_length(key) <= 60),
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from public, anon, authenticated;
insert into public.app_settings (key, value) values ('billing_enabled', 'false'::jsonb) on conflict (key) do nothing;

create or replace function public.billing_enabled() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value = 'true'::jsonb from public.app_settings where key = 'billing_enabled'), false)
$$;
revoke all on function public.billing_enabled() from public, anon;
grant execute on function public.billing_enabled() to authenticated, service_role;

-- ---------- subscriptions ----------

create table if not exists public.subscriptions (
  workspace_id             uuid primary key references public.workspaces (id) on delete cascade,
  provider                 text not null check (provider in ('paddle')),
  provider_customer_id     text not null check (char_length(provider_customer_id) <= 100),
  provider_subscription_id text not null unique check (char_length(provider_subscription_id) <= 100),
  status                   text not null check (status in ('trialing', 'active', 'past_due', 'paused', 'canceled')),
  plan                     text not null default 'pro' check (plan = 'pro'),
  price_tier               text not null check (price_tier in ('founding', 'normal')),
  quantity                 int not null check (quantity between 1 and 1000),
  current_period_end       timestamptz,
  cancel_at                timestamptz,
  -- the provider's time of the last event applied: an older event never overwrites a newer one
  provider_updated_at      timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists subscriptions_status_idx on public.subscriptions (status);
alter table public.subscriptions enable row level security;
revoke all on public.subscriptions from public, anon, authenticated;
grant select on public.subscriptions to authenticated;
drop policy if exists "members read their subscription" on public.subscriptions;
create policy "members read their subscription" on public.subscriptions for select to authenticated
  using (public.has_role(workspace_id));

create table if not exists public.billing_events (
  id           bigint generated always as identity primary key,
  provider     text not null check (provider in ('paddle')),
  event_id     text not null check (char_length(event_id) <= 100),
  event_type   text not null check (char_length(event_type) <= 80),
  workspace_id uuid references public.workspaces (id) on delete set null,
  -- ids, status, quantity, price id, dates only (built by the Edge Function); never card or address data
  payload      jsonb not null default '{}'::jsonb check (octet_length(payload::text) <= 4000),
  received_at  timestamptz not null default now(),
  unique (provider, event_id)
);
create index if not exists billing_events_workspace_idx on public.billing_events (workspace_id, received_at desc);
alter table public.billing_events enable row level security;
revoke all on public.billing_events from public, anon, authenticated;

create table if not exists public.founding_seats (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  state        text not null check (state in ('held', 'active', 'released')),
  held_until   timestamptz,
  updated_at   timestamptz not null default now()
);
create index if not exists founding_seats_state_idx on public.founding_seats (state, held_until);
alter table public.founding_seats enable row level security;
revoke all on public.founding_seats from public, anon, authenticated;

create or replace function public._founding_taken() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.founding_seats
  where state = 'active' or (state = 'held' and held_until > now())
$$;
revoke all on function public._founding_taken() from public, anon, authenticated;

-- ---------- effective plan ----------

-- {plan, source, price_tier, status, paid_sites, site_limit (null = no limit), sites_used, billing_enabled}
create or replace function public._workspace_plan(p_ws uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.subscriptions; o text; used int; lim int; on_ boolean := public.billing_enabled();
begin
  select count(*) into used from public.projects where workspace_id = p_ws and deleted_at is null;
  select * into s from public.subscriptions where workspace_id = p_ws and status in ('trialing', 'active', 'past_due');
  if found then
    return jsonb_build_object('plan', 'pro', 'source', 'subscription', 'price_tier', s.price_tier, 'status', s.status,
      'paid_sites', s.quantity, 'site_limit', s.quantity, 'sites_used', used, 'billing_enabled', on_,
      'current_period_end', s.current_period_end, 'cancel_at', s.cancel_at);
  end if;
  select a.plan into o from public.account_plans a join public.workspaces w on w.created_by = a.user_id where w.id = p_ws;
  if o in ('pro', 'pro_beta', 'founding') then
    return jsonb_build_object('plan', o, 'source', 'override', 'price_tier', null, 'status', null,
      'paid_sites', null, 'site_limit', null, 'sites_used', used, 'billing_enabled', on_);
  end if;
  lim := 1;
  return jsonb_build_object('plan', 'free', 'source', 'free', 'price_tier', null,
    'status', (select status from public.subscriptions where workspace_id = p_ws),
    'paid_sites', 0, 'site_limit', lim, 'sites_used', used, 'billing_enabled', on_);
end $$;
revoke all on function public._workspace_plan(uuid) from public, anon, authenticated;

-- What the panel shows (Settings → Billing): for members of the workspace only.
create or replace function public.billing_status(p_ws uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_role(p_ws) then raise exception 'not allowed' using errcode = '42501'; end if;
  return public._workspace_plan(p_ws) || jsonb_build_object(
    'founding_left', greatest(200 - public._founding_taken(), 0),
    'founding_mine', exists (select 1 from public.founding_seats f where f.workspace_id = p_ws and (f.state = 'active' or (f.state = 'held' and f.held_until > now()))),
    'can_manage', public.has_role(p_ws, 'admin'),
    'has_customer', exists (select 1 from public.subscriptions where workspace_id = p_ws));
end $$;
revoke all on function public.billing_status(uuid) from public, anon;
grant execute on function public.billing_status(uuid) to authenticated;

-- ---------- for the Edge Function (service role only) ----------

-- Which price to offer at checkout: founding while a seat is free (held for 1 hour), else normal.
create or replace function public.billing_reserve_tier(p_ws uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare st text;
begin
  perform pg_advisory_xact_lock(hashtext('ourhunch:founding_seats'));
  select state into st from public.founding_seats where workspace_id = p_ws
    and (state = 'active' or (state = 'held' and held_until > now()));
  if st = 'active' then return 'founding'; end if;
  if st = 'held' then
    update public.founding_seats set held_until = now() + interval '1 hour', updated_at = now() where workspace_id = p_ws;
    return 'founding';
  end if;
  if public._founding_taken() >= 200 then return 'normal'; end if;
  insert into public.founding_seats (workspace_id, state, held_until) values (p_ws, 'held', now() + interval '1 hour')
  on conflict (workspace_id) do update set state = 'held', held_until = excluded.held_until, updated_at = now();
  return 'founding';
end $$;

-- Applies one webhook event, once. Returns 'duplicate', 'stale', 'ignored' or 'applied'.
-- p_sub: {customer_id, subscription_id, status, price_tier, quantity, current_period_end, cancel_at, occurred_at}
create or replace function public.billing_apply_event(p_provider text, p_event_id text, p_event_type text, p_ws uuid, p_sub jsonb, p_payload jsonb)
returns text
language plpgsql security definer set search_path = '' as $$
declare cur public.subscriptions; at_ timestamptz := (p_sub ->> 'occurred_at')::timestamptz; st text := p_sub ->> 'status';
  tier text := p_sub ->> 'price_tier';
begin
  insert into public.billing_events (provider, event_id, event_type, workspace_id, payload)
  values (p_provider, p_event_id, p_event_type, p_ws, coalesce(p_payload, '{}'::jsonb))
  on conflict (provider, event_id) do nothing;
  if not found then return 'duplicate'; end if;
  if p_ws is null or p_sub is null or st is null then return 'ignored'; end if;
  if not exists (select 1 from public.workspaces where id = p_ws) then return 'ignored'; end if;

  perform pg_advisory_xact_lock(hashtext('ourhunch:founding_seats'));
  select * into cur from public.subscriptions where workspace_id = p_ws for update;
  if found and cur.provider_subscription_id = p_sub ->> 'subscription_id'
     and cur.provider_updated_at is not null and at_ is not null and at_ < cur.provider_updated_at then
    return 'stale';
  end if;
  -- an older, ended subscription of the same workspace doesn't replace a live one
  if found and cur.provider_subscription_id <> p_sub ->> 'subscription_id'
     and cur.status in ('trialing', 'active', 'past_due') and st = 'canceled' then
    return 'stale';
  end if;

  insert into public.subscriptions as s (workspace_id, provider, provider_customer_id, provider_subscription_id, status,
    price_tier, quantity, current_period_end, cancel_at, provider_updated_at, updated_at)
  values (p_ws, p_provider, p_sub ->> 'customer_id', p_sub ->> 'subscription_id', st, tier,
    greatest(1, least(1000, coalesce((p_sub ->> 'quantity')::int, 1))),
    (p_sub ->> 'current_period_end')::timestamptz, (p_sub ->> 'cancel_at')::timestamptz, at_, now())
  on conflict (workspace_id) do update set
    provider = excluded.provider, provider_customer_id = excluded.provider_customer_id,
    provider_subscription_id = excluded.provider_subscription_id, status = excluded.status,
    price_tier = excluded.price_tier, quantity = excluded.quantity,
    current_period_end = excluded.current_period_end, cancel_at = excluded.cancel_at,
    provider_updated_at = excluded.provider_updated_at, updated_at = now();

  -- founding seats follow the subscription: active while it runs, released when it ends
  if tier = 'founding' and st in ('trialing', 'active', 'past_due') then
    insert into public.founding_seats (workspace_id, state, held_until) values (p_ws, 'active', null)
    on conflict (workspace_id) do update set state = 'active', held_until = null, updated_at = now();
  elsif st = 'canceled' then
    update public.founding_seats set state = 'released', held_until = null, updated_at = now() where workspace_id = p_ws;
  end if;
  return 'applied';
end $$;

-- The workspace a signed-in user may buy for (owner or admin), and how many sites it has.
create or replace function public.billing_checkout_context(p_user uuid, p_ws uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.workspace_members where workspace_id = p_ws and user_id = p_user and role in ('owner', 'admin')) then
    return null;
  end if;
  return jsonb_build_object(
    'sites', (select count(*) from public.projects where workspace_id = p_ws and deleted_at is null),
    'customer_id', (select provider_customer_id from public.subscriptions where workspace_id = p_ws),
    'live', exists (select 1 from public.subscriptions where workspace_id = p_ws and status in ('trialing', 'active', 'past_due', 'paused')),
    'email', (select email from auth.users where id = p_user));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.billing_reserve_tier(uuid)',
    'public.billing_apply_event(text, text, text, uuid, jsonb, jsonb)',
    'public.billing_checkout_context(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- ---------- enforcement (only while billing is on) ----------

-- Is this site within its workspace's plan? The oldest sites fill the plan first.
create or replace function public.site_in_plan(p_project uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare ws uuid; lim int; pos int;
begin
  if not public.billing_enabled() then return true; end if;
  select workspace_id into ws from public.projects where id = p_project;
  if ws is null then return true; end if;
  lim := (public._workspace_plan(ws) ->> 'site_limit')::int;
  if lim is null then return true; end if;
  select n into pos from (
    select id, row_number() over (order by created_at, id) n from public.projects where workspace_id = ws and deleted_at is null
  ) x where x.id = p_project;
  return pos is null or pos <= lim;
end $$;
revoke all on function public.site_in_plan(uuid) from public, anon;
grant execute on function public.site_in_plan(uuid) to authenticated, service_role;

create or replace function public._billing_check_project() returns trigger
language plpgsql security definer set search_path = '' as $$
declare p jsonb;
begin
  if not public.billing_enabled() then return new; end if;
  p := public._workspace_plan(new.workspace_id);
  if (p ->> 'site_limit') is not null and (p ->> 'sites_used')::int >= (p ->> 'site_limit')::int then
    raise exception 'plan_limit: your plan includes % site(s); upgrade in Settings → Billing to add another', p ->> 'site_limit'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists billing_check_project on public.projects;
create trigger billing_check_project before insert on public.projects for each row execute function public._billing_check_project();

create or replace function public._billing_check_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
  if not public.billing_enabled() then return new; end if;
  if tg_table_name = 'threads' then pid := new.project_id;
  else select project_id into pid from public.threads where id = new.thread_id; end if;
  if pid is not null and not public.site_in_plan(pid) then
    raise exception 'site_over_plan: this site is beyond its plan and is not collecting new comments' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists billing_check_thread on public.threads;
create trigger billing_check_thread before insert on public.threads for each row execute function public._billing_check_comment();
drop trigger if exists billing_check_reply on public.replies;
create trigger billing_check_reply before insert on public.replies for each row execute function public._billing_check_comment();

-- ---------- ops panel ----------

create or replace function public.ops_billing_overview() returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._ops_guard();
  return json_build_object(
    'billing_enabled', public.billing_enabled(),
    'founding_active', (select count(*) from public.founding_seats where state = 'active'),
    'founding_held', (select count(*) from public.founding_seats where state = 'held' and held_until > now()),
    'founding_limit', 200,
    'by_status', (select coalesce(json_object_agg(status, n), '{}'::json) from (select status, count(*) n from public.subscriptions group by status) x),
    'paid_sites', (select coalesce(sum(quantity), 0) from public.subscriptions where status in ('trialing', 'active', 'past_due')));
end $$;

-- Subscriptions of the given users' workspaces (at most 200 users), keyed by user id.
create or replace function public.ops_billing_for_users(p_users uuid[]) returns json
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._ops_guard();
  return coalesce((select json_object_agg(u, x) from (
    select m.user_id u, json_agg(json_build_object('workspace_id', s.workspace_id, 'status', s.status, 'price_tier', s.price_tier,
      'quantity', s.quantity, 'current_period_end', s.current_period_end, 'cancel_at', s.cancel_at, 'provider', s.provider) order by s.updated_at desc) x
    from public.workspace_members m join public.subscriptions s on s.workspace_id = m.workspace_id
    where m.user_id = any (p_users[1:200]) and m.role = 'owner'
    group by m.user_id) y), '{}'::json);
end $$;

do $$
declare f text;
begin
  foreach f in array array['public.ops_billing_overview()', 'public.ops_billing_for_users(uuid[])'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
