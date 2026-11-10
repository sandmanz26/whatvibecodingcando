-- Vibe Collab: reviewers and comments on customers' sites, on the server.
--
-- How a reviewer gets in: the panel makes a review link (create_review_link) and the person opens the
-- customer's site with it (#vibe_t=<token>). The script there signs the browser in anonymously
-- (Supabase anonymous sign-in: no email, a session per browser) and calls start_review, which trades
-- the token for a reviewer row. From then on the script calls only the functions below; reviewers
-- never read or write the tables directly.
--
-- Every function checks, in this order: the project exists, the request comes from one of the
-- project's environments that is switched on (the browser's Origin header, which a page can't fake),
-- the caller is a reviewer of that project, and a per-person rate limit.
--
-- Scale: page views don't reach these functions (the script reads its settings from the CDN file);
-- only reviewers do, and the installation check is sampled and throttled.

-- ---------- origins the hosted demo site uses (always allowed) ----------

create table public.allowed_origins (
  origin text primary key check (origin ~ '^https?://[a-z0-9.:-]+$'),
  note   text not null default ''
);
alter table public.allowed_origins enable row level security;
insert into public.allowed_origins (origin, note) values ('https://whatvibecodingcando.vercel.app', 'hosted demo site');

-- ---------- review links: one-time (2 minutes) or invites (days, a few devices) ----------

alter table public.handoffs
  add column kind          text not null default 'link' check (kind in ('link', 'invite')),
  add column uses          int  not null default 0,
  add column max_uses      int  not null default 1 check (max_uses between 1 and 10),
  add column reviewer_name text check (char_length(reviewer_name) <= 80);

-- ---------- reviewers ----------

create table public.reviewers (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  -- the anonymous Supabase user of the reviewer's browser
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null check (char_length(name) between 1 and 80),
  preview_until timestamptz,
  created_at    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  unique (project_id, user_id)
);
create index on public.reviewers (project_id);
alter table public.reviewers enable row level security;
create policy "members see their projects' reviewers" on public.reviewers for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members remove reviewers" on public.reviewers for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

-- Anonymous browsers (reviewers) are "authenticated" too: they must not create workspaces or invites.
drop policy "anyone signed in creates a workspace they own" on public.workspaces;
create policy "signed-up users create a workspace they own" on public.workspaces for insert to authenticated
  with check (created_by = auth.uid() and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false);

-- ---------- helpers ----------

create or replace function public._request_origin() returns text
language sql stable as $$
  select lower(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'origin', ''))
$$;

-- An environment's host pattern against a host: "*" is any run of letters, digits and dashes in one label.
create or replace function public._host_matches(pattern text, host text) returns boolean
language sql immutable as $$
  select case
    when position('*' in pattern) = 0 then lower(pattern) = lower(host)
    else lower(host) ~ ('^' || replace(regexp_replace(lower(pattern), '([.+?^${}()|\[\]\\])', '\\\1', 'g'), '*', '[a-z0-9-]*') || '$')
      or (left(pattern, 2) = '*.' and lower(host) = lower(substr(pattern, 3)))
  end
$$;

-- The project's published settings (latest release), or null.
create or replace function public._live_config(p_project uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select config from public.releases where project_id = p_project order by version desc limit 1
$$;

-- Does this request come from a place the project's widget is switched on?
create or replace function public._origin_allowed(p_project uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  o text := public._request_origin();
  h text;
  cfg jsonb;
  e jsonb;
begin
  if o = '' then return false; end if;
  cfg := public._live_config(p_project);
  if cfg is null or (cfg ->> 'on')::boolean is not true or (cfg -> 'modules' ->> 'comments')::boolean is not true then return false; end if;
  if exists (select 1 from public.allowed_origins a where a.origin = o) then return true; end if;
  h := regexp_replace(o, '^https?://', '');
  for e in select * from jsonb_array_elements(coalesce(cfg -> 'envs', '[]'::jsonb)) loop
    if (e ->> 'on')::boolean and (public._host_matches(e ->> 'host', h) or public._host_matches(e ->> 'host', split_part(h, ':', 1))) then
      return true;
    end if;
  end loop;
  return false;
end $$;

create or replace function public._clean(t text, max int) returns text
language sql immutable as $$
  select nullif(left(btrim(regexp_replace(coalesce(t, ''), '[[:cntrl:]]', '', 'g')), max), '')
$$;

-- The caller's reviewer row for a project, after every check; raises otherwise.
create or replace function public._reviewer_for(p_public_id text) returns public.reviewers
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  r public.reviewers;
begin
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_allowed(pid) then raise exception 'origin_not_allowed'; end if;
  select * into r from public.reviewers where project_id = pid and user_id = auth.uid();
  if r.id is null then raise exception 'not_invited'; end if;
  update public.reviewers set last_seen = now() where id = r.id and last_seen < now() - interval '5 minutes';
  return r;
end $$;

-- A thread as the script shows it.
create or replace function public._thread_json(t public.threads, me uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', t.id, 'page', t.page, 'anchor', t.anchor, 'author', t.author_name, 'text', t.text,
    'createdAt', t.created_at, 'editedAt', t.edited_at,
    'resolved', case when t.resolved_at is null then null else json_build_object('by', t.resolved_by, 'at', t.resolved_at) end,
    'mine', t.reviewer = me::text,
    'replies', coalesce((select json_agg(json_build_object('id', r.id, 'author', r.author_name, 'text', r.text, 'at', r.created_at, 'mine', r.reviewer = me::text) order by r.created_at)
                         from public.replies r where r.thread_id = t.id), '[]'::json)
  )
$$;

-- ---------- the panel: review links ----------

-- A review link token for a project. Without days: one use, 2 minutes (opening the site yourself).
-- With days (1..30): an invite for a person, up to 5 devices.
create or replace function public.create_review_link(p_project uuid, p_preview boolean default false, p_name text default null, p_days int default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  ws uuid;
  tok text;
begin
  select workspace_id into ws from public.projects where id = p_project and deleted_at is null;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  if not public.take_rate('link:' || auth.uid(), 30) then raise exception 'rate_limited'; end if;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.handoffs (token_hash, project_id, created_by, preview, expires_at, kind, max_uses, reviewer_name)
  values (
    encode(sha256(convert_to(tok, 'UTF8')), 'hex'), p_project, auth.uid(), coalesce(p_preview, false),
    now() + case when p_days is null then interval '2 minutes' else make_interval(days => least(greatest(p_days, 1), 30)) end,
    case when p_days is null then 'link' else 'invite' end,
    case when p_days is null then 1 else 5 end,
    public._clean(p_name, 80)
  );
  return tok;
end $$;

-- ---------- the script: reviewers and comments ----------

-- Becomes (or stays) a reviewer of the project: with a review link's token, or with none when the
-- widget is open to everyone, or when this browser is already a reviewer.
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
  elsif not exists (select 1 from public.reviewers where project_id = pid and user_id = uid)
        and coalesce(public._live_config(pid) ->> 'audience', 'reviewers') <> 'everyone' then
    raise exception 'not_invited';
  end if;
  insert into public.reviewers (project_id, user_id, name, preview_until)
  values (pid, uid, coalesce(nm, 'Guest'), case when prev then now() + interval '1 hour' end)
  on conflict (project_id, user_id) do update
    set name = coalesce(nm, public.reviewers.name),
        preview_until = case when prev then now() + interval '1 hour' else public.reviewers.preview_until end,
        last_seen = now()
  returning * into r;
  return json_build_object('name', r.name, 'preview', coalesce(r.preview_until > now(), false),
                           'draft', case when r.preview_until > now() then pdraft end);
end $$;

create or replace function public.set_reviewer_name(p_public_id text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare r public.reviewers := public._reviewer_for(p_public_id); nm text := public._clean(p_name, 80);
begin
  if nm is not null then update public.reviewers set name = nm where id = r.id; end if;
end $$;

-- The draft settings, while this reviewer is previewing (opened from the panel's preview).
create or replace function public.get_draft(p_public_id text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.reviewers := public._reviewer_for(p_public_id);
begin
  if r.preview_until is null or r.preview_until < now() then return null; end if;
  return (select draft from public.projects where id = r.project_id);
end $$;

create or replace function public.list_threads(p_public_id text) returns json
language plpgsql security definer set search_path = public as $$
declare r public.reviewers := public._reviewer_for(p_public_id);
begin
  if not public.take_rate('read:' || auth.uid(), 120) then raise exception 'rate_limited'; end if;
  return coalesce((select json_agg(public._thread_json(t, r.id) order by t.created_at)
                   from public.threads t where t.project_id = r.project_id), '[]'::json);
end $$;

-- p_id: the id the script gave the comment (so it keeps it after saving); one is made when absent.
create or replace function public.post_thread(p_public_id text, p_page text, p_anchor jsonb, p_text text, p_id uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare r public.reviewers := public._reviewer_for(p_public_id); t public.threads; body text := left(btrim(coalesce(p_text, '')), 4000);
begin
  if not public.take_rate('write:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  if body = '' then raise exception 'empty'; end if;
  insert into public.threads (id, project_id, page, anchor, author_name, reviewer, text)
  values (coalesce(p_id, gen_random_uuid()), r.project_id, p_page, p_anchor, r.name, r.id::text, body)
  returning * into t;
  return public._thread_json(t, r.id);
end $$;

-- The thread, checked to belong to a project the caller reviews.
create or replace function public._thread_for(p_thread uuid, out t public.threads, out r public.reviewers)
language plpgsql security definer set search_path = public as $$
declare pub text;
begin
  select * into t from public.threads where id = p_thread;
  if t.id is null then raise exception 'no_thread'; end if;
  select public_id into pub from public.projects where id = t.project_id;
  r := public._reviewer_for(pub);
end $$;

create or replace function public.post_reply(p_thread uuid, p_text text, p_id uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare x record; body text := left(btrim(coalesce(p_text, '')), 4000);
begin
  select * into x from public._thread_for(p_thread);
  if not public.take_rate('write:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  if body = '' then raise exception 'empty'; end if;
  insert into public.replies (id, thread_id, author_name, reviewer, text) values (coalesce(p_id, gen_random_uuid()), p_thread, (x.r).name, (x.r).id::text, body);
  return public._thread_json((select t from public.threads t where t.id = p_thread), (x.r).id);
end $$;

-- Only the author edits or deletes a comment; anyone reviewing the project completes or reopens it.
create or replace function public.edit_thread(p_thread uuid, p_text text) returns json
language plpgsql security definer set search_path = public as $$
declare x record; body text := left(btrim(coalesce(p_text, '')), 4000);
begin
  select * into x from public._thread_for(p_thread);
  if (x.t).reviewer is distinct from (x.r).id::text then raise exception 'not_yours'; end if;
  if not public.take_rate('write:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  if body = '' then raise exception 'empty'; end if;
  update public.threads set text = body, edited_at = now() where id = p_thread;
  return public._thread_json((select t from public.threads t where t.id = p_thread), (x.r).id);
end $$;

create or replace function public.set_resolved(p_thread uuid, p_resolved boolean) returns json
language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select * into x from public._thread_for(p_thread);
  if not public.take_rate('write:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  update public.threads
    set resolved_at = case when p_resolved then now() end, resolved_by = case when p_resolved then (x.r).name end
    where id = p_thread;
  return public._thread_json((select t from public.threads t where t.id = p_thread), (x.r).id);
end $$;

create or replace function public.delete_thread(p_thread uuid) returns void
language plpgsql security definer set search_path = public as $$
declare x record;
begin
  select * into x from public._thread_for(p_thread);
  if (x.t).reviewer is distinct from (x.r).id::text then raise exception 'not_yours'; end if;
  delete from public.threads where id = p_thread;
end $$;

create or replace function public.delete_reply(p_reply uuid) returns json
language plpgsql security definer set search_path = public as $$
declare x record; rep public.replies;
begin
  select * into rep from public.replies where id = p_reply;
  if rep.id is null then raise exception 'no_reply'; end if;
  select * into x from public._thread_for(rep.thread_id);
  if rep.reviewer is distinct from (x.r).id::text then raise exception 'not_yours'; end if;
  delete from public.replies where id = p_reply;
  return public._thread_json((select t from public.threads t where t.id = rep.thread_id), (x.r).id);
end $$;

-- ---------- the script: installation check (anyone; sampled by the script, throttled here) ----------

create or replace function public.report_seen(p_public_id text, p_version text, p_shown boolean, p_why text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  h text := regexp_replace(public._request_origin(), '^https?://', '');
begin
  if h = '' then return; end if;
  if not public.take_rate('seen:' || h, 30) then return; end if;
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then return; end if;
  insert into public.installs (project_id, host, last_seen, version, shown, why)
  values (pid, left(h, 255), now(), left(coalesce(p_version, ''), 20), coalesce(p_shown, false), left(coalesce(p_why, ''), 200))
  on conflict (project_id, host) do update
    set last_seen = now(), version = excluded.version, shown = excluded.shown, why = excluded.why
    where public.installs.last_seen < now() - interval '5 minutes' or public.installs.shown is distinct from excluded.shown;
end $$;

-- ---------- the panel: delete my account ----------

-- Deletes the caller's workspaces (where they are the owner), then the login itself.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  delete from public.workspaces w where exists (select 1 from public.workspace_members m where m.workspace_id = w.id and m.user_id = uid and m.role = 'owner');
  delete from auth.users where id = uid;
end $$;

-- ---------- who may call what ----------

revoke all on function public._request_origin(), public._host_matches(text, text), public._live_config(uuid), public._origin_allowed(uuid),
  public._clean(text, int), public._reviewer_for(text), public._thread_json(public.threads, uuid), public._thread_for(uuid) from public, anon, authenticated;
revoke all on function public.create_review_link(uuid, boolean, text, int), public.start_review(text, text, text), public.set_reviewer_name(text, text),
  public.get_draft(text), public.list_threads(text), public.post_thread(text, text, jsonb, text, uuid), public.post_reply(uuid, text, uuid), public.delete_reply(uuid),
  public.edit_thread(uuid, text), public.set_resolved(uuid, boolean), public.delete_thread(uuid), public.report_seen(text, text, boolean, text),
  public.delete_my_account() from public, anon;
grant execute on function public.create_review_link(uuid, boolean, text, int), public.start_review(text, text, text), public.set_reviewer_name(text, text),
  public.get_draft(text), public.list_threads(text), public.post_thread(text, text, jsonb, text, uuid), public.post_reply(uuid, text, uuid), public.delete_reply(uuid),
  public.edit_thread(uuid, text), public.set_resolved(uuid, boolean), public.delete_thread(uuid), public.delete_my_account() to authenticated;
-- The installation check runs before anyone signs in.
grant execute on function public.report_seen(text, text, boolean, text) to anon, authenticated;
revoke all on all tables in schema public from anon;

-- ---------- housekeeping (when pg_cron is available: Supabase → Database → Extensions) ----------

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('vibe-collab-cleanup', '17 * * * *', $job$
      delete from public.rate_hits where minute < now() - interval '1 day';
      delete from public.handoffs where expires_at < now() - interval '1 day';
    $job$);
  end if;
end $$;
