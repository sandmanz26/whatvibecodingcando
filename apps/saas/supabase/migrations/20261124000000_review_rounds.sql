-- Vibe Collab: review rounds, managed by the site owner, and "Approve this version".
--
-- 1. Projects choose whether they work in rounds (projects.rounds_on, off by default so existing
--    projects behave as before) and how many rounds their quote includes (rounds_included, 1..20,
--    null = unlimited). ourhunch never bills: the number only labels extra rounds.
-- 2. review_rounds: the owner's rounds (one open at a time per project). Members read and write
--    them under row level security; reviewers only read the current one through current_round().
-- 3. round_approvals: a reviewer's "I've reviewed this version and approve it", with the time, the
--    round, the site version and the open comments at that moment. A record of approval, not a legal
--    signature. Written only by approve_round() (reviewer, project, origin and rate limit checked);
--    members read them; nobody edits them.
-- 4. Every new comment carries the open round (threads.round_id, set by a trigger; null when rounds
--    are off). With rounds on and no round open, reviewers can't add comments (they still read and
--    reply); the team can (reviewers.team: browsers that came in through a member's own one-time link).
-- 5. An approval emails the project's members through the email outbox (a new kind of row).

-- ---------- settings ----------

alter table public.projects
  add column if not exists rounds_on boolean not null default false,
  add column if not exists rounds_included int default 2 check (rounds_included is null or rounds_included between 1 and 20);

-- Browsers that came in through a member's own one-time link (the panel's "Open my site", "Open on site").
alter table public.reviewers add column if not exists team boolean not null default false;

-- ---------- rounds ----------

create table if not exists public.review_rounds (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  n           int not null check (n between 1 and 1000),
  name        text not null check (char_length(name) between 1 and 80),
  note        text not null default '' check (char_length(note) <= 2000),
  due         date,
  status      text not null default 'open' check (status in ('open', 'closed', 'approved')),
  started_at  timestamptz not null default now(),
  closed_at   timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  unique (project_id, n)
);
-- One open round per project; the list is read by project, newest first.
create unique index if not exists review_rounds_one_open_idx on public.review_rounds (project_id) where status = 'open';
create index if not exists review_rounds_project_n_idx on public.review_rounds (project_id, n desc);
alter table public.review_rounds enable row level security;
create policy "members read rounds" on public.review_rounds for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members start rounds" on public.review_rounds for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members edit rounds" on public.review_rounds for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members delete rounds" on public.review_rounds for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
revoke all on public.review_rounds from anon;

-- Members may close and reopen rounds, but "approved" comes only from an approval (approve_round).
create or replace function public._round_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_setting('vc.approving', true) = '1' then return new; end if;
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status <> 'approved') then raise exception 'approved_only_by_reviewer'; end if;
  if tg_op = 'UPDATE' and (new.project_id <> old.project_id or new.n <> old.n) then raise exception 'not_allowed'; end if;
  return new;
end $$;
drop trigger if exists round_guard on public.review_rounds;
create trigger round_guard before insert or update on public.review_rounds for each row execute function public._round_guard();
revoke all on function public._round_guard() from public, anon, authenticated;

-- ---------- approvals ----------

create table if not exists public.round_approvals (
  id             uuid primary key default gen_random_uuid(),
  round_id       uuid not null references public.review_rounds (id) on delete cascade,
  project_id     uuid not null references public.projects (id) on delete cascade,
  reviewer_id    uuid references public.reviewers (id) on delete set null,
  name           text not null check (char_length(name) between 1 and 80),
  version        text check (char_length(version) <= 20),
  statement      text not null check (char_length(statement) <= 300),
  origin         text not null default '' check (char_length(origin) <= 255),
  -- the open comments at that moment: up to 200 of them, page, author and the start of the text
  open_comments  int not null default 0,
  open_list      jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists round_approvals_project_idx on public.round_approvals (project_id, created_at desc);
create index if not exists round_approvals_round_idx on public.round_approvals (round_id);
create index if not exists round_approvals_reviewer_idx on public.round_approvals (reviewer_id);
alter table public.round_approvals enable row level security;
create policy "members read approvals" on public.round_approvals for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
revoke all on public.round_approvals from anon;
revoke insert, update, delete on public.round_approvals from authenticated;

-- ---------- comments carry their round ----------

alter table public.threads add column if not exists round_id uuid references public.review_rounds (id) on delete set null;
create index if not exists threads_project_round_idx on public.threads (project_id, round_id);

create or replace function public._thread_round() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rounds boolean;
  rid uuid;
begin
  select rounds_on into rounds from public.projects where id = new.project_id;
  if rounds is not true then new.round_id := null; return new; end if;
  select id into rid from public.review_rounds where project_id = new.project_id and status = 'open';
  new.round_id := rid;
  -- Between rounds the team keeps commenting; reviewers wait for the next round.
  if rid is null and new.reviewer is not null
     and not exists (select 1 from public.reviewers r where r.id::text = new.reviewer and r.team) then
    raise exception 'round_closed';
  end if;
  return new;
end $$;
drop trigger if exists thread_round on public.threads;
create trigger thread_round before insert on public.threads for each row execute function public._thread_round();
revoke all on function public._thread_round() from public, anon, authenticated;

-- ---------- start_review: remembers browsers opened by the team ----------

-- As before (…_reviewers.sql), plus: a one-time link (no days) is what members make for themselves,
-- so the browser that uses it is the team's.
create or replace function public.start_review(p_public_id text, p_token text default null, p_name text default null)
returns json
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  pdraft jsonb;
  uid uuid := auth.uid();
  t public.handoffs;
  nm text := public._clean(p_name, 80);
  prev boolean := false;
  own boolean := false;
  r public.reviewers;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not public.take_rate('start:' || uid, 10) then raise exception 'rate_limited'; end if;
  select id, draft into pid, pdraft from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_allowed(pid) then raise exception 'origin_not_allowed'; end if;
  if p_token is not null then
    select * into t from public.handoffs
      where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex') and project_id = pid for update;
    if t.token_hash is null or t.expires_at < now() or t.uses >= t.max_uses then raise exception 'link_expired'; end if;
    update public.handoffs set uses = uses + 1, used_at = now() where token_hash = t.token_hash;
    nm := coalesce(nm, t.reviewer_name);
    prev := t.preview;
    own := t.kind = 'link';
  elsif not exists (select 1 from public.reviewers where project_id = pid and user_id = uid)
        and coalesce(public._live_config(pid) ->> 'audience', 'reviewers') <> 'everyone' then
    raise exception 'not_invited';
  end if;
  insert into public.reviewers (project_id, user_id, name, preview_until, team)
  values (pid, uid, coalesce(nm, 'Guest'), case when prev then now() + interval '1 hour' end, own)
  on conflict (project_id, user_id) do update
    set name = coalesce(nm, public.reviewers.name),
        preview_until = case when prev then now() + interval '1 hour' else public.reviewers.preview_until end,
        team = public.reviewers.team or excluded.team,
        last_seen = now()
  returning * into r;
  return json_build_object('name', r.name, 'preview', coalesce(r.preview_until > now(), false),
                           'draft', case when r.preview_until > now() then pdraft end);
end $$;
revoke all on function public.start_review(text, text, text) from public, anon;
grant execute on function public.start_review(text, text, text) to authenticated;

-- ---------- the script: the current round, and approving it ----------

create or replace function public._round_json(x public.review_rounds) returns json
language sql stable as $$
  select case when x.id is null then null else json_build_object(
    'id', x.id, 'n', x.n, 'name', x.name, 'note', x.note, 'due', x.due, 'status', x.status,
    'startedAt', x.started_at, 'closedAt', x.closed_at) end
$$;

-- What the widget shows: rounds on or off, the latest round, whether this browser may comment now.
create or replace function public.current_round(p_public_id text) returns json
language plpgsql security definer set search_path = public as $$
declare
  r public.reviewers := public._reviewer_for(p_public_id);
  p public.projects;
  x public.review_rounds;
begin
  if not public.take_rate('read:' || auth.uid(), 120) then raise exception 'rate_limited'; end if;
  select * into p from public.projects where id = r.project_id;
  if not p.rounds_on then return json_build_object('on', false); end if;
  select * into x from public.review_rounds where project_id = p.id order by n desc limit 1;
  return json_build_object(
    'on', true, 'included', p.rounds_included, 'team', r.team,
    'round', public._round_json(x),
    'open', (select count(*) from (select 1 from public.threads t where t.project_id = p.id and t.resolved_at is null limit 1000) c));
end $$;

create or replace function public.approve_round(p_public_id text, p_round uuid, p_name text, p_confirm boolean) returns json
language plpgsql security definer set search_path = public as $$
declare
  r public.reviewers := public._reviewer_for(p_public_id);
  p public.projects;
  x public.review_rounds;
  nm text := coalesce(public._clean(p_name, 80), r.name);
  a public.round_approvals;
begin
  if not public.take_rate('approve:' || auth.uid(), 5) then raise exception 'rate_limited'; end if;
  if p_confirm is not true then raise exception 'not_confirmed'; end if;
  select * into p from public.projects where id = r.project_id;
  if not p.rounds_on then raise exception 'rounds_off'; end if;
  select * into x from public.review_rounds where id = p_round and project_id = p.id for update;
  if x.id is null or x.status <> 'open' then raise exception 'round_not_open'; end if;
  insert into public.round_approvals (round_id, project_id, reviewer_id, name, version, statement, origin, open_comments, open_list)
  values (x.id, p.id, r.id, nm, left(nullif(btrim(public._live_config(p.id) ->> 'version'), ''), 20),
          'I''ve reviewed this version and approve it.', left(public._request_origin(), 255),
          (select count(*) from public.threads t where t.project_id = p.id and t.resolved_at is null),
          coalesce((select json_agg(json_build_object('page', t.page, 'author', t.author_name, 'text', left(t.text, 300), 'at', t.created_at) order by t.created_at)
                    from (select * from public.threads t where t.project_id = p.id and t.resolved_at is null order by t.created_at desc limit 200) t), '[]'::json)::jsonb)
  returning * into a;
  perform set_config('vc.approving', '1', true);
  update public.review_rounds set status = 'approved', closed_at = now() where id = x.id;
  perform set_config('vc.approving', '', true);
  insert into public.email_outbox (project_id, approval_id) values (p.id, a.id);
  return json_build_object('id', a.id, 'name', a.name, 'at', a.created_at, 'version', a.version, 'round', public._round_json((select y from public.review_rounds y where y.id = x.id)));
end $$;

revoke all on function public._round_json(public.review_rounds) from public, anon, authenticated;
revoke all on function public.current_round(text), public.approve_round(text, uuid, text, boolean) from public, anon;
grant execute on function public.current_round(text), public.approve_round(text, uuid, text, boolean) to authenticated;

-- ---------- email: approvals ----------

alter table public.email_outbox add column if not exists approval_id uuid references public.round_approvals (id) on delete cascade;
create index if not exists email_outbox_approval_idx on public.email_outbox (approval_id);

-- As before (…_email.sql), plus approvals: they go out with the next instant run whether the project
-- is on 'instant' or 'daily' (an approval is a milestone, not a comment); 'off' still sends nothing.
create or replace function public.email_due(p_daily boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  update public.email_outbox o set sent_at = now()
    from public.projects p where p.id = o.project_id and o.sent_at is null and (p.notify = 'off' or p.deleted_at is not null);
  return coalesce((
    select json_agg(x order by x->>'project_name') from (
      select json_build_object(
        'project_id', p.public_id,
        'project_name', p.name,
        'site_url', p.site_url,
        'outbox_ids', (select json_agg(o.id order by o.id) from public.email_outbox o where o.project_id = p.id and o.sent_at is null
                         and (p.notify = case when p_daily then 'daily' else 'instant' end or (not p_daily and o.approval_id is not null))),
        'total', (select count(*) from public.email_outbox o where o.project_id = p.id and o.sent_at is null
                    and (p.notify = case when p_daily then 'daily' else 'instant' end or (not p_daily and o.approval_id is not null))),
        'recipients', (select coalesce(json_agg(distinct u.email), '[]'::json) from public.workspace_members m join auth.users u on u.id = m.user_id
                       where m.workspace_id = p.workspace_id and u.email is not null),
        'items', (select coalesce(json_agg(i order by i.at), '[]'::json) from (
          select o.id, o.created_at as at,
                 case when o.approval_id is not null then 'approval' when o.reply_id is null then 'comment' else 'reply' end as type,
                 t.kind, coalesce(t.page, '') as page, t.id as thread_id,
                 coalesce(a.name, r.author_name, t.author_name) as author,
                 left(coalesce(rr.name, r.text, t.text), 500) as text,
                 a.version, a.open_comments, rr.n as round_n
            from public.email_outbox o
            left join public.threads t on t.id = o.thread_id
            left join public.replies r on r.id = o.reply_id
            left join public.round_approvals a on a.id = o.approval_id
            left join public.review_rounds rr on rr.id = a.round_id
           where o.project_id = p.id and o.sent_at is null and (t.id is not null or a.id is not null)
             and (p.notify = case when p_daily then 'daily' else 'instant' end or (not p_daily and o.approval_id is not null))
           order by o.id desc limit 20) i)
      ) as x
      from public.projects p
      where p.deleted_at is null
        and exists (select 1 from public.email_outbox o where o.project_id = p.id and o.sent_at is null
                      and (p.notify = case when p_daily then 'daily' else 'instant' end or (not p_daily and o.approval_id is not null)))
      limit 200
    ) q), '[]'::json);
end $$;
revoke all on function public.email_due(boolean) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.email_due(boolean) to service_role;
  end if;
end $$;

revoke all on all tables in schema public from anon;
