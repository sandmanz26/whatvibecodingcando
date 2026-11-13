-- Vibe Collab: research on customers' sites, with participants who agreed (usability tests,
-- 5-second tests, heatmap studies; their click paths are the session insights).
--
-- Who is recorded: only people who open a study's participant link (#vibe_r=<token>) on the
-- customer's site and press "I agree". Never other visitors. What is recorded: where they click
-- (page path without its query, position, the element's selector), the pages they open, how long
-- tasks take, and the answers they type into the study's own questions. Never what anyone types
-- into the site, never video.
--
-- Every participant call checks: the project exists, the request's Origin is one of the project's
-- environments that is switched on, the widget and the study's product (module) are on, the link
-- is valid and the study open, the run is the caller's own, and rate and size limits.

-- ---------- where a module may run (generalises _origin_allowed, which stays for Comments) ----------

create or replace function public._origin_ok(p_project uuid, p_module text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  o text := public._request_origin();
  h text;
  cfg jsonb;
  e jsonb;
begin
  if o = '' then return false; end if;
  cfg := public._live_config(p_project);
  if cfg is null or (cfg ->> 'on')::boolean is not true or (cfg -> 'modules' ->> p_module)::boolean is not true then return false; end if;
  if exists (select 1 from public.allowed_origins a where a.origin = o) then return true; end if;
  h := regexp_replace(o, '^https?://', '');
  for e in select * from jsonb_array_elements(coalesce(cfg -> 'envs', '[]'::jsonb)) loop
    if (e ->> 'on')::boolean and (public._host_matches(e ->> 'host', h) or public._host_matches(e ->> 'host', split_part(h, ':', 1))) then
      return true;
    end if;
  end loop;
  return false;
end $$;

-- ---------- studies ----------

create table public.studies (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  kind         text not null check (kind in ('usability', 'fivesec', 'browse')),
  name         text not null check (char_length(name) between 1 and 80),
  -- tasks, questions, pages: checked again by the script and the panel; limited in size here
  config       jsonb not null default '{}' check (jsonb_typeof(config) = 'object' and pg_column_size(config) < 20000),
  status       text not null default 'open' check (status in ('open', 'closed')),
  eye_tracking boolean not null default false,
  max_runs     int not null default 200 check (max_runs between 1 and 1000),
  link_hash    text unique check (link_hash ~ '^[0-9a-f]{64}$'),
  link_expires timestamptz,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on public.studies (project_id, created_at desc);
alter table public.studies enable row level security;
create policy "members see studies" on public.studies for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members add studies" on public.studies for insert to authenticated
  with check (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)) and link_hash is null);
create policy "members change studies" on public.studies for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members delete studies" on public.studies for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
-- The participant link is set only by create_study_link (members can't write a hash of their choice):
-- members may change these columns only.
revoke update on public.studies from authenticated;
grant update (name, config, status, eye_tracking, max_runs) on public.studies to authenticated;

-- ---------- runs (one participant, one study) and their events ----------

create table public.runs (
  id            uuid primary key default gen_random_uuid(),
  study_id      uuid not null references public.studies (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  vw            int check (vw between 0 and 10000),
  vh            int check (vh between 0 and 10000),
  device        text check (device in ('desktop', 'tablet', 'mobile')),
  gaze_accuracy real,
  result        jsonb not null default '{}' check (jsonb_typeof(result) = 'object' and pg_column_size(result) < 30000),
  events        int not null default 0
);
create index on public.runs (study_id, started_at desc);
create index on public.runs (user_id);
alter table public.runs enable row level security;
create policy "members see runs" on public.runs for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members delete runs" on public.runs for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

create table public.run_events (
  id         bigint generated always as identity primary key,
  run_id     uuid not null references public.runs (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  t          int not null check (t between 0 and 86400000),
  task       text check (char_length(task) <= 40),
  kind       text not null check (kind in ('click', 'page', 'gaze', 'door')),
  page       text not null check (page ~ '^/' and page !~ '^//' and char_length(page) <= 300),
  x          real, y real,
  vw         int, doc_h int,
  sel        text check (char_length(sel) <= 400),
  label      text check (char_length(label) <= 80),
  ex         real, ey real,
  hit        boolean, rage boolean, dead boolean
);
create index on public.run_events (run_id, t);
create index on public.run_events (project_id, page);
alter table public.run_events enable row level security;
create policy "members see run events" on public.run_events for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members delete run events" on public.run_events for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

-- ---------- the panel: a participant link per study ----------

-- A new link replaces the old one (which stops working). p_days: 1..90.
create or replace function public.create_study_link(p_study uuid, p_days int default 30) returns text
language plpgsql security definer set search_path = public as $$
declare ws uuid; tok text;
begin
  select p.workspace_id into ws from public.studies s join public.projects p on p.id = s.project_id where s.id = p_study and p.deleted_at is null;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  if not public.take_rate('slink:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  update public.studies set link_hash = encode(sha256(convert_to(tok, 'UTF8')), 'hex'),
    link_expires = now() + make_interval(days => least(greatest(coalesce(p_days, 30), 1), 90)) where id = p_study;
  return tok;
end $$;

create or replace function public.revoke_study_link(p_study uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  select p.workspace_id into ws from public.studies s join public.projects p on p.id = s.project_id where s.id = p_study;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  update public.studies set link_hash = null, link_expires = null where id = p_study;
end $$;

-- ---------- the script: participants ----------

create or replace function public._module_of(p_kind text) returns text
language sql immutable as $$ select case p_kind when 'usability' then 'usability' when 'fivesec' then 'fivesec' else 'heatmap' end $$;

-- The study behind a link, with every check; raises otherwise.
create or replace function public._study_for(p_public_id text, p_token text) returns public.studies
language plpgsql security definer set search_path = public as $$
declare pid uuid; s public.studies;
begin
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  select * into s from public.studies where project_id = pid and link_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if s.id is null or s.link_expires < now() then raise exception 'link_expired'; end if;
  if s.status <> 'open' then raise exception 'study_closed'; end if;
  if not public._origin_ok(pid, public._module_of(s.kind)) then raise exception 'origin_not_allowed'; end if;
  return s;
end $$;

-- What the consent screen shows, before anything is recorded (no session needed).
create or replace function public.study_info(p_public_id text, p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare s public.studies; eye boolean;
begin
  if not public.take_rate('sinfo:' || encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex'), 60) then raise exception 'rate_limited'; end if;
  s := public._study_for(p_public_id, p_token);
  eye := s.eye_tracking and coalesce((public._live_config(s.project_id) -> 'modules' ->> 'gaze')::boolean, false);
  return json_build_object('name', s.name, 'kind', s.kind, 'eye', eye,
    'tasks', case when s.kind = 'usability' then jsonb_array_length(coalesce(s.config -> 'tasks', '[]'::jsonb)) else 1 end);
end $$;

-- After "I agree": a run for this browser's participant session, and the study to run.
create or replace function public.start_run(p_public_id text, p_token text, p_vw int, p_vh int) returns json
language plpgsql security definer set search_path = public as $$
declare s public.studies; r public.runs; uid uuid := auth.uid(); eye boolean;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not public.take_rate('run:' || uid, 10) then raise exception 'rate_limited'; end if;
  s := public._study_for(p_public_id, p_token);
  -- The same participant opening the link again carries on with their run.
  select * into r from public.runs where study_id = s.id and user_id = uid and finished_at is null order by started_at desc limit 1;
  if r.id is null then
    if (select count(*) from public.runs where study_id = s.id) >= s.max_runs then raise exception 'study_full'; end if;
    insert into public.runs (study_id, project_id, user_id, vw, vh, device)
    values (s.id, s.project_id, uid, least(greatest(coalesce(p_vw, 0), 0), 10000), least(greatest(coalesce(p_vh, 0), 0), 10000),
            case when coalesce(p_vw, 0) < 700 then 'mobile' when p_vw < 1100 then 'tablet' else 'desktop' end)
    returning * into r;
  end if;
  eye := s.eye_tracking and coalesce((public._live_config(s.project_id) -> 'modules' ->> 'gaze')::boolean, false);
  return json_build_object('run', r.id, 'kind', s.kind, 'name', s.name, 'config', s.config, 'eye', eye);
end $$;

-- The caller's own run, still open (or finished in the last 10 minutes, for events sent late).
create or replace function public._run_for(p_run uuid) returns public.runs
language plpgsql security definer set search_path = public as $$
declare r public.runs; s public.studies;
begin
  select * into r from public.runs where id = p_run and user_id = auth.uid();
  if r.id is null then raise exception 'no_run'; end if;
  if r.finished_at is not null and r.finished_at < now() - interval '10 minutes' then raise exception 'run_finished'; end if;
  select * into s from public.studies where id = r.study_id;
  if not public._origin_ok(r.project_id, public._module_of(s.kind)) then raise exception 'origin_not_allowed'; end if;
  return r;
end $$;

-- Up to 200 events per call, 5,000 per run. Each value is checked and clipped; a bad one is skipped.
create or replace function public.log_events(p_run uuid, p_events jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare r public.runs; n int;
begin
  if not public.take_rate('ev:' || auth.uid(), 60) then raise exception 'rate_limited'; end if;
  r := public._run_for(p_run);
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 200 then raise exception 'bad_events'; end if;
  if r.events + jsonb_array_length(p_events) > 5000 then raise exception 'run_full'; end if;
  insert into public.run_events (run_id, project_id, t, task, kind, page, x, y, vw, doc_h, sel, label, ex, ey, hit, rage, dead)
  select r.id, r.project_id,
         least(greatest((e ->> 't')::int, 0), 86400000),
         left(e ->> 'task', 40), e ->> 'kind', left(e ->> 'page', 300),
         (e ->> 'x')::real, (e ->> 'y')::real, (e ->> 'vw')::int, (e ->> 'doc_h')::int,
         left(e ->> 'sel', 400), left(e ->> 'label', 80),
         least(greatest((e ->> 'ex')::real, 0), 1), least(greatest((e ->> 'ey')::real, 0), 1),
         (e ->> 'hit')::boolean, (e ->> 'rage')::boolean, (e ->> 'dead')::boolean
  from jsonb_array_elements(p_events) e
  where jsonb_typeof(e) = 'object'
    and e ->> 'kind' in ('click', 'page', 'gaze', 'door')
    and coalesce(e ->> 'page', '') ~ '^/' and coalesce(e ->> 'page', '') !~ '^//'
    and coalesce(e ->> 't', '') ~ '^[0-9]{1,8}$';
  get diagnostics n = row_count;
  update public.runs set events = events + n where id = r.id;
  return n;
end $$;

-- The run's outcome: per-task results, the answers to the study's questions, eye-tracking accuracy.
create or replace function public.finish_run(p_run uuid, p_result jsonb, p_gaze real default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.runs;
begin
  if not public.take_rate('fin:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  r := public._run_for(p_run);
  if jsonb_typeof(p_result) <> 'object' or pg_column_size(p_result) >= 30000 then raise exception 'bad_result'; end if;
  update public.runs set result = p_result, finished_at = coalesce(finished_at, now()),
    gaze_accuracy = case when p_gaze between 0 and 5000 then p_gaze else gaze_accuracy end
  where id = r.id;
end $$;

-- ---------- the script: the heatmap a reviewer sees over the page ----------

-- Clicks (or gaze points) on one page (all studies, or one), for a reviewer of the project, at most 20,000.
create or replace function public.heatmap_points(p_public_id text, p_page text, p_study uuid default null, p_kind text default 'click') returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_ok(pid, 'heatmap') then raise exception 'origin_not_allowed'; end if;
  if not exists (select 1 from public.reviewers where project_id = pid and user_id = auth.uid()) then raise exception 'not_invited'; end if;
  if not public.take_rate('heat:' || auth.uid(), 30) then raise exception 'rate_limited'; end if;
  return json_build_object(
    'studies', coalesce((select json_agg(json_build_object('id', s.id, 'name', s.name) order by s.created_at desc) from public.studies s where s.project_id = pid), '[]'::json),
    'points', coalesce((select json_agg(json_build_object('x', e.x, 'y', e.y, 'vw', e.vw, 'sel', e.sel, 'ex', e.ex, 'ey', e.ey, 'rage', e.rage, 'dead', e.dead))
      from (select e.* from public.run_events e join public.runs r on r.id = e.run_id
            where e.project_id = pid and e.kind = (case when p_kind = 'gaze' then 'gaze' else 'click' end) and e.page = left(coalesce(p_page, '/'), 300)
              and (p_study is null or r.study_id = p_study)
            order by e.id desc limit 20000) e), '[]'::json)
  );
end $$;

-- ---------- who may call what ----------

revoke all on function public._origin_ok(uuid, text), public._module_of(text), public._study_for(text, text), public._run_for(uuid) from public, anon, authenticated;
revoke all on function public.create_study_link(uuid, int), public.revoke_study_link(uuid), public.study_info(text, text), public.start_run(text, text, int, int),
  public.log_events(uuid, jsonb), public.finish_run(uuid, jsonb, real), public.heatmap_points(text, text, uuid, text) from public, anon;
grant execute on function public.create_study_link(uuid, int), public.revoke_study_link(uuid), public.start_run(text, text, int, int),
  public.log_events(uuid, jsonb), public.finish_run(uuid, jsonb, real), public.heatmap_points(text, text, uuid, text) to authenticated;
-- The consent screen shows before any session exists.
grant execute on function public.study_info(text, text) to anon, authenticated;
revoke all on all tables in schema public from anon;
