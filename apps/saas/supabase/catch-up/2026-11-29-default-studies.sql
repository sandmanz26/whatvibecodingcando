-- One paste in the Supabase SQL editor (after 2026-11-28-demo-origin.sql): one default (★) study per
-- research module, visitors under "Everyone" (all modules, one-click consent, never results).
-- Same as migrations/20261129000000_default_studies.sql. Safe to run again; changes nothing for existing installs
-- except adding a ★ default study for each research module already on.
begin;
-- ourhunch: one default (★) study per research module, and visitors under "Everyone".
--
-- * Every research module the owner turns on (Heatmap, Eye tracking, 5-second test, Usability test)
--   gets one always-open default study, made automatically when a release with that module is
--   published (onboarding's auto-publish, or turning it on later) and, below, for existing projects
--   whose live widget already has it on. One default per (project, module): unique index. Idempotent.
--     heatmap   → "Site heatmap"      (browse, as before)
--     gaze      → "Eye tracking"      (browse with eye tracking)
--     fivesec   → "First impression"  (the page the visitor is on, "What is this page about?")
--     usability → "Usability test"    (one task: "Explore the site and find what you came for")
-- * Many studies per module are allowed. Only the default receives widget traffic (reviewers' clicks,
--   and visitors under "Everyone"); every other study is reached only through its own link.
--   make_default_study moves the ★ to another study of the same module; data stays with each study.
-- * Visitors under "Everyone" (no review link, no study link): visitor_modules says which modules are
--   open to them; start_visitor_run starts a run in that module's default study after they press OK.
--   Checks: audience is Everyone, the widget and the module are on, the origin is allowed, the default
--   study is open (paused = nothing recorded), rate limits per session, per address and per project,
--   and a daily cap per study. runs.source = 'visitor'.
-- * Visitors never read results: reviewers.visitor marks people who only joined an open widget
--   (start_review without a link); heatmap reads, the reviewers' click recording and the invite link
--   refuse them.
-- * Nothing changes for existing installs: the snippet, the audience setting, existing studies, their
--   links and data stay as they are. Additive and safe to run again.

-- ---------- which module a study belongs to ----------

alter table public.studies add column if not exists module text generated always as (
  case kind when 'usability' then 'usability' when 'fivesec' then 'fivesec'
            else case when eye_tracking then 'gaze' else 'heatmap' end end) stored;
create unique index if not exists studies_one_default_module_idx on public.studies (project_id, module) where is_default;
drop index if exists public.studies_one_default_idx;
create index if not exists studies_project_module_idx on public.studies (project_id, module, created_at desc);

alter table public.runs drop constraint if exists runs_source_check;
alter table public.runs add constraint runs_source_check check (source in ('participant', 'reviewer', 'visitor'));
-- visitor caps: a study's visitor runs of the last day
create index if not exists runs_study_source_idx on public.runs (study_id, source, started_at desc);

-- People who joined an open widget without a link: they may comment, never read research results.
alter table public.reviewers add column if not exists visitor boolean not null default false;

-- ---------- the origin check for a study: its own module, or the module it used before ----------

create or replace function public._study_origin_ok(s public.studies) returns boolean
language sql stable security definer set search_path = public as $$
  select public._origin_ok(s.project_id, s.module) or public._origin_ok(s.project_id, public._module_of(s.kind))
$$;
revoke all on function public._study_origin_ok(public.studies) from public, anon, authenticated;

create or replace function public._study_for(p_public_id text, p_token text) returns public.studies
language plpgsql security definer set search_path = public as $$
declare pid uuid; s public.studies;
begin
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  select * into s from public.studies where project_id = pid and link_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if s.id is null or s.link_expires < now() then raise exception 'link_expired'; end if;
  if s.status <> 'open' then raise exception 'study_closed'; end if;
  if not public._study_origin_ok(s) then raise exception 'origin_not_allowed'; end if;
  return s;
end $$;

create or replace function public._run_for(p_run uuid) returns public.runs
language plpgsql security definer set search_path = public as $$
declare r public.runs; s public.studies;
begin
  select * into r from public.runs where id = p_run and user_id = auth.uid();
  if r.id is null then raise exception 'no_run'; end if;
  if r.finished_at is not null and r.finished_at < now() - interval '10 minutes' then raise exception 'run_finished'; end if;
  select * into s from public.studies where id = r.study_id;
  if not public._study_origin_ok(s) then raise exception 'origin_not_allowed'; end if;
  return r;
end $$;
revoke all on function public._study_for(text, text), public._run_for(uuid) from public, anon, authenticated;

-- ---------- default studies ----------

create or replace function public._default_study_seed(p_module text, out kind text, out name text, out config jsonb, out eye boolean)
language sql immutable as $$
  select v.k, v.n, v.c, v.e from (values
    ('heatmap', 'browse', 'Site heatmap', '{"minutes":30,"page":"","prompt":"Look around the site as you normally would."}'::jsonb, false),
    ('gaze', 'browse', 'Eye tracking', '{"minutes":10,"page":"","prompt":"Look around the site as you normally would."}'::jsonb, true),
    ('fivesec', 'fivesec', 'First impression', '{"page":"","seconds":5,"prompt":"","questions":["What is this page about?"]}'::jsonb, false),
    ('usability', 'usability', 'Usability test', '{"tasks":[{"id":"t1","prompt":"Explore the site and find what you came for","startPage":"","limitSec":300,"success":{"kind":"none"}}]}'::jsonb, false)
  ) v (m, k, n, c, e) where v.m = p_module
$$;
revoke all on function public._default_study_seed(text) from public, anon, authenticated;

-- Makes the module's default study if the project has none for it. Returns its id (or null).
create or replace function public._ensure_module_default(p_project uuid, p_module text) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; tok text; seed record;
begin
  select id into sid from public.studies where project_id = p_project and module = p_module and is_default;
  if sid is not null then return sid; end if;
  select * into seed from public._default_study_seed(p_module);
  if seed.kind is null then return null; end if;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.studies (project_id, kind, name, config, status, eye_tracking, max_runs, link_hash, link_expires, is_default)
  values (p_project, seed.kind, seed.name, seed.config, 'open', seed.eye, 1000, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), null, true)
  on conflict do nothing
  returning id into sid;
  if sid is null then select id into sid from public.studies where project_id = p_project and module = p_module and is_default; return sid; end if;
  insert into public.study_invites (study_id, token) values (sid, tok) on conflict (study_id) do update set token = excluded.token;
  return sid;
end $$;
revoke all on function public._ensure_module_default(uuid, text) from public, anon, authenticated;

-- Every research module on in the project's live widget gets its default. Idempotent.
create or replace function public._ensure_default_studies(p_project uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cfg jsonb; m text;
begin
  if not exists (select 1 from public.projects where id = p_project and deleted_at is null) then return; end if;
  cfg := public._live_config(p_project);
  if cfg is null then return; end if;
  foreach m in array array['heatmap', 'gaze', 'fivesec', 'usability'] loop
    if (cfg -> 'modules' ->> m)::boolean is true then perform public._ensure_module_default(p_project, m); end if;
  end loop;
end $$;
revoke all on function public._ensure_default_studies(uuid) from public, anon, authenticated;

-- The earlier name, kept: ensures every default, returns the heatmap one.
create or replace function public._ensure_default_study(p_project uuid) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  perform public._ensure_default_studies(p_project);
  return (select id from public.studies where project_id = p_project and module = 'heatmap' and is_default);
end $$;
revoke all on function public._ensure_default_study(uuid) from public, anon, authenticated;

create or replace function public._default_study_on_release() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._ensure_default_studies(new.project_id);
  return new;
end $$;
revoke all on function public._default_study_on_release() from public, anon, authenticated;
drop trigger if exists default_study_on_release on public.releases;
create trigger default_study_on_release after insert on public.releases for each row execute function public._default_study_on_release();

-- A study's link: the token is kept (service role only) for every study from now on, so any study can
-- become the default and the widget can hand out its link. Default links never expire.
create or replace function public.create_study_link(p_study uuid, p_days int default 30) returns text
language plpgsql security definer set search_path = public as $$
declare ws uuid; tok text; dflt boolean;
begin
  select p.workspace_id, s.is_default into ws, dflt from public.studies s join public.projects p on p.id = s.project_id where s.id = p_study and p.deleted_at is null;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  if not public.take_rate('slink:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  update public.studies set link_hash = encode(sha256(convert_to(tok, 'UTF8')), 'hex'),
    link_expires = case when dflt then null else now() + make_interval(days => least(greatest(coalesce(p_days, 30), 1), 90)) end where id = p_study;
  insert into public.study_invites (study_id, token) values (p_study, tok) on conflict (study_id) do update set token = excluded.token;
  return tok;
end $$;

-- "Make default": moves the ★ of the study's module to this study. Its link keeps working (and no
-- longer expires); a study without a link gets one. The previous default keeps its data and link.
create or replace function public.make_default_study(p_study uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ws uuid; s public.studies; tok text;
begin
  select p.workspace_id into ws from public.studies x join public.projects p on p.id = x.project_id where x.id = p_study and p.deleted_at is null;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  if not public.take_rate('sdef:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  select * into s from public.studies where id = p_study for update;
  if s.is_default then return; end if;
  update public.studies set is_default = false where project_id = s.project_id and module = s.module and is_default;
  if s.link_hash is null then
    tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
    update public.studies set is_default = true, link_hash = encode(sha256(convert_to(tok, 'UTF8')), 'hex'), link_expires = null where id = s.id;
    insert into public.study_invites (study_id, token) values (s.id, tok) on conflict (study_id) do update set token = excluded.token;
  else
    update public.studies set is_default = true, link_expires = null where id = s.id;
  end if;
end $$;
revoke all on function public.make_default_study(uuid) from public, anon;
grant execute on function public.make_default_study(uuid) to authenticated;

-- ---------- joined visitors never read results ----------

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
  joined boolean := false;
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
  elsif not exists (select 1 from public.reviewers where project_id = pid and user_id = uid) then
    if coalesce(public._live_config(pid) ->> 'audience', 'reviewers') <> 'everyone' then raise exception 'not_invited'; end if;
    joined := true;
  end if;
  insert into public.reviewers (project_id, user_id, name, preview_until, team, visitor)
  values (pid, uid, coalesce(nm, 'Guest'), case when prev then now() + interval '1 hour' end, own, joined)
  on conflict (project_id, user_id) do update
    set name = coalesce(nm, public.reviewers.name),
        preview_until = case when prev then now() + interval '1 hour' else public.reviewers.preview_until end,
        team = public.reviewers.team or excluded.team,
        -- a review link makes a joined visitor a reviewer; joining again never undoes that
        visitor = public.reviewers.visitor and excluded.visitor,
        last_seen = now()
  returning * into r;
  return json_build_object('name', r.name, 'preview', coalesce(r.preview_until > now(), false),
                           'draft', case when r.preview_until > now() then pdraft end);
end $$;
revoke all on function public.start_review(text, text, text) from public, anon;
grant execute on function public.start_review(text, text, text) to authenticated;

-- May this browser read the project's research results in the widget? A reviewer let in by the owner.
create or replace function public._results_reader(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.reviewers where project_id = pid and user_id = auth.uid() and not visitor)
$$;
revoke all on function public._results_reader(uuid) from public, anon, authenticated;

create or replace function public._heat_reviewer(p_public_id text, p_rate text, p_max int) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'not_invited'; end if;
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_ok(pid, 'heatmap') then raise exception 'origin_not_allowed'; end if;
  if not public._results_reader(pid) then raise exception 'not_invited'; end if;
  if not public.take_rate(p_rate || auth.uid(), p_max) then raise exception 'rate_limited'; end if;
  return pid;
end $$;
revoke all on function public._heat_reviewer(text, text, int) from public, anon, authenticated;

create or replace function public.heatmap_summary(p_public_id text, p_page text, p_study uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_ok(pid, 'heatmap') then raise exception 'origin_not_allowed'; end if;
  if not public._results_reader(pid) then raise exception 'not_invited'; end if;
  if not public.take_rate('heat:' || auth.uid(), 30) then raise exception 'rate_limited'; end if;
  if p_study is not null and not exists (select 1 from public.studies where id = p_study and project_id = pid) then raise exception 'no_study'; end if;
  return public._heat_summary(pid, p_page, p_study);
end $$;
revoke all on function public.heatmap_summary(text, text, uuid) from public, anon;
grant execute on function public.heatmap_summary(text, text, uuid) to authenticated;

create or replace function public.heatmap_points(p_public_id text, p_page text, p_study uuid default null, p_kind text default 'click') returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid; k text := case when p_kind = 'gaze' then 'gaze' else 'click' end; pg text := left(coalesce(p_page, '/'), 300);
begin
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_ok(pid, 'heatmap') then raise exception 'origin_not_allowed'; end if;
  if not public._results_reader(pid) then raise exception 'not_invited'; end if;
  if not public.take_rate('heat:' || auth.uid(), 30) then raise exception 'rate_limited'; end if;
  return (
    with pts as (
      select e.id, e.run_id, e.x, e.y, e.vw, e.sel, e.label, e.ex, e.ey, e.rage, e.dead, e.t, e.version, r.device, r.gaze_accuracy,
             row_number() over (partition by e.run_id order by e.t, e.id) as nth
      from public.run_events e join public.runs r on r.id = e.run_id
      where e.project_id = pid and e.kind = k and e.page = pg and (p_study is null or r.study_id = p_study)
    ),
    kept as (select * from pts where nth <= (case when k = 'gaze' then 3000 else 60 end) order by id desc limit 20000),
    rk as (select run_id, dense_rank() over (order by run_id) as p from (select distinct run_id from kept) d)
    select json_build_object(
      'studies', coalesce((select json_agg(json_build_object('id', s.id, 'name', s.name) order by s.created_at desc) from public.studies s where s.project_id = pid), '[]'::json),
      'points', coalesce((select json_agg(json_build_object('x', q.x, 'y', q.y, 'vw', q.vw, 'sel', q.sel, 'label', q.label, 'ex', q.ex, 'ey', q.ey, 'rage', q.rage, 'dead', q.dead,
                                                            'p', rk.p, 't', q.t, 'dev', q.device, 'acc', q.gaze_accuracy, 'ver', coalesce(q.version, '')))
                          from kept q join rk using (run_id)), '[]'::json),
      'anchors', case when k = 'gaze' then coalesce((
        select json_agg(json_build_object('p', rk.p, 't', a.t, 'x', a.x, 'y', a.y))
        from (select e.run_id, e.t, e.x, e.y, row_number() over (partition by e.run_id order by e.t, e.id) as nth
              from public.run_events e where e.project_id = pid and e.kind = 'click' and e.page = pg and e.run_id in (select run_id from rk)) a
        join rk using (run_id) where a.nth <= 60), '[]'::json) else '[]'::json end
    )
  );
end $$;
revoke all on function public.heatmap_points(text, text, uuid, text) from public, anon;
grant execute on function public.heatmap_points(text, text, uuid, text) to authenticated;

-- Reviewers' clicks and the widget's heatmap invite: the Heatmap module's default study.
create or replace function public.start_reviewer_run(p_public_id text, p_vw int, p_vh int) returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid; s public.studies; r public.runs; uid uuid := auth.uid();
begin
  pid := public._heat_reviewer(p_public_id, 'rrun:', 10);
  select * into s from public.studies where project_id = pid and module = 'heatmap' and is_default;
  if s.id is null then raise exception 'no_study'; end if;
  if s.status <> 'open' then raise exception 'study_closed'; end if;
  select * into r from public.runs where study_id = s.id and user_id = uid and source = 'reviewer' and finished_at is null
    and started_at > now() - interval '12 hours' and events < 4800 order by started_at desc limit 1;
  if r.id is null then
    insert into public.runs (study_id, project_id, user_id, vw, vh, device, source)
    values (s.id, pid, uid, least(greatest(coalesce(p_vw, 0), 0), 10000), least(greatest(coalesce(p_vh, 0), 0), 10000),
            case when coalesce(p_vw, 0) < 700 then 'mobile' when p_vw < 1100 then 'tablet' else 'desktop' end, 'reviewer')
    returning * into r;
  end if;
  return json_build_object('run', r.id, 'started', extract(epoch from r.started_at) * 1000);
end $$;

-- The invite link of a module's default study (Heatmap when no module is named), for the team and reviewers.
create or replace function public._module_invite(pid uuid, p_module text) returns json
language plpgsql stable security definer set search_path = public as $$
declare s public.studies;
begin
  select * into s from public.studies where project_id = pid and module = p_module and is_default;
  if s.id is null then return json_build_object('token', null, 'open', false, 'people', 0); end if;
  return json_build_object(
    'token', case when s.status = 'open' then (select token from public.study_invites where study_id = s.id) end,
    'open', s.status = 'open', 'name', s.name,
    'people', (select count(distinct user_id) from public.runs where study_id = s.id));
end $$;
revoke all on function public._module_invite(uuid, text) from public, anon, authenticated;

create or replace function public.default_study_invite(p_public_id text) returns json
language plpgsql security definer set search_path = public as $$
begin
  return public._module_invite(public._heat_reviewer(p_public_id, 'inv:', 30), 'heatmap');
end $$;

create or replace function public.module_study_invite(p_public_id text, p_module text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if p_module not in ('heatmap', 'gaze', 'fivesec', 'usability') then raise exception 'bad_module'; end if;
  return public._module_invite(public._heat_reviewer(p_public_id, 'inv:', 30), p_module);
end $$;

revoke all on function public.start_reviewer_run(text, int, int), public.default_study_invite(text), public.module_study_invite(text, text) from public, anon;
grant execute on function public.start_reviewer_run(text, int, int), public.default_study_invite(text), public.module_study_invite(text, text) to authenticated;

-- ---------- visitors under "Everyone" ----------

-- A rough address key for rate limits (the first x-forwarded-for hop), hashed; '' when unknown.
create or replace function public._request_addr() returns text
language sql stable as $$
  select coalesce(md5(nullif(trim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), '')), '')
$$;
revoke all on function public._request_addr() from public, anon, authenticated;

-- The project, when its widget is open to everyone here (on, audience Everyone, origin allowed for the module).
create or replace function public._visitor_project(p_public_id text, p_module text) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; cfg jsonb;
begin
  if p_module not in ('heatmap', 'gaze', 'fivesec', 'usability') then raise exception 'bad_module'; end if;
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  cfg := public._live_config(pid);
  if coalesce(cfg ->> 'audience', 'reviewers') <> 'everyone' then raise exception 'not_invited'; end if;
  if not public._origin_ok(pid, p_module) then raise exception 'origin_not_allowed'; end if;
  return pid;
end $$;
revoke all on function public._visitor_project(text, text) from public, anon, authenticated;

-- What the widget offers a visitor: each research module that is on, with its default study's state.
-- Names and counts only, never results. No session needed (the consent comes first).
create or replace function public.visitor_modules(p_public_id text) returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid; cfg jsonb; a text := public._request_addr();
begin
  if not public.take_rate('vmod:' || case when a <> '' then a else p_public_id end, case when a <> '' then 60 else 1200 end) then raise exception 'rate_limited'; end if;
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  cfg := public._live_config(pid);
  if coalesce(cfg ->> 'audience', 'reviewers') <> 'everyone' then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object(
      'module', m, 'state', case when s.id is null then 'none' when s.status <> 'open' then 'paused' else 'open' end,
      'kind', s.kind, 'name', s.name,
      'eye', coalesce(s.eye_tracking, false),
      'tasks', case when s.kind = 'usability' then jsonb_array_length(coalesce(s.config -> 'tasks', '[]'::jsonb)) else 1 end) order by o)
    from unnest(array['heatmap', 'gaze', 'fivesec', 'usability']) with ordinality as u (m, o)
    left join public.studies s on s.project_id = pid and s.module = u.m and s.is_default
    where public._origin_ok(pid, u.m)), '[]'::json);
end $$;

-- After the visitor presses OK: a run in the module's default study (reused for 12 hours).
create or replace function public.start_visitor_run(p_public_id text, p_module text, p_vw int, p_vh int) returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid; s public.studies; r public.runs; uid uuid := auth.uid(); a text := public._request_addr(); eye boolean;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  pid := public._visitor_project(p_public_id, p_module);
  select * into s from public.studies where project_id = pid and module = p_module and is_default;
  if s.id is null then raise exception 'no_study'; end if;
  if s.status <> 'open' then raise exception 'study_closed'; end if;
  select * into r from public.runs where study_id = s.id and user_id = uid and source = 'visitor' and finished_at is null
    and started_at > now() - interval '12 hours' and events < 4800 order by started_at desc limit 1;
  if r.id is null then
    if not public.take_rate('vrun:' || uid, 5) then raise exception 'rate_limited'; end if;
    if a <> '' and not public.take_rate('vrunip:' || a, 20) then raise exception 'rate_limited'; end if;
    if not public.take_rate('vrunp:' || pid, 120) then raise exception 'rate_limited'; end if;
    if (select count(*) from public.runs where study_id = s.id and source = 'visitor' and started_at > now() - interval '1 day') >= 2000 then raise exception 'study_full'; end if;
    insert into public.runs (study_id, project_id, user_id, vw, vh, device, source)
    values (s.id, pid, uid, least(greatest(coalesce(p_vw, 0), 0), 10000), least(greatest(coalesce(p_vh, 0), 0), 10000),
            case when coalesce(p_vw, 0) < 700 then 'mobile' when p_vw < 1100 then 'tablet' else 'desktop' end, 'visitor')
    returning * into r;
  end if;
  eye := s.eye_tracking and coalesce((public._live_config(pid) -> 'modules' ->> 'gaze')::boolean, false);
  return json_build_object('run', r.id, 'kind', s.kind, 'name', s.name, 'config', s.config, 'eye', eye);
end $$;

revoke all on function public.visitor_modules(text), public.start_visitor_run(text, text, int, int) from public;
grant execute on function public.visitor_modules(text) to anon, authenticated;
revoke all on function public.start_visitor_run(text, text, int, int) from anon;
grant execute on function public.start_visitor_run(text, text, int, int) to authenticated;

-- Existing projects: a default for every research module already on (Site heatmap stays as it is).
select public._ensure_default_studies(p.id) from public.projects p where p.deleted_at is null;
commit;
