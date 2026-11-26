-- Vibe Collab: heatmaps by default.
--
-- * Every project whose published widget has the Heatmap product on gets one always-open study,
--   "Site heatmap" (kind 'browse', no end date, all pages), made automatically when such a release is
--   published (onboarding's auto-publish, or turning Heatmap on later) and for existing projects
--   below. Never more than one per project (unique index). It can be renamed, closed (paused) or
--   deleted in Research like any study; deleting it is respected until Heatmap is published again.
-- * Its participant link never expires. Its token is kept (service role only, study_invites) so the
--   team and invited reviewers can copy it from the widget (default_study_invite). Participants who
--   open it still see the consent screen first, as with every study.
-- * Reviewers' and the team's clicks: people the owner already let in (a review link or "Open my
--   site", i.e. a row in reviewers) record into the default study through start_reviewer_run, one run
--   per reviewer session (reused for 12 hours), with the same log_events checks (origin, run owner,
--   rate and size limits). runs.source tells them apart; they never count against max_runs.
-- * Normal visitors are still never recorded.

alter table public.studies add column if not exists is_default boolean not null default false;
create unique index if not exists studies_one_default_idx on public.studies (project_id) where is_default;
alter table public.runs add column if not exists source text not null default 'participant';
alter table public.runs drop constraint if exists runs_source_check;
alter table public.runs add constraint runs_source_check check (source in ('participant', 'reviewer'));
-- start_reviewer_run looks up the caller's open reviewer run in the study.
create index if not exists runs_study_user_idx on public.runs (study_id, user_id, started_at desc);

-- The default study's participant token (the study keeps only its hash). Service role only.
create table if not exists public.study_invites (
  study_id uuid primary key references public.studies (id) on delete cascade,
  token    text not null check (token ~ '^[0-9a-f]{64}$')
);
alter table public.study_invites enable row level security;
revoke all on public.study_invites from public, anon, authenticated;

-- Makes the project's default study if it has none (and Heatmap is on in its live config). Idempotent.
create or replace function public._ensure_default_study(p_project uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid; tok text; cfg jsonb;
begin
  select id into sid from public.studies where project_id = p_project and is_default;
  if sid is not null then return sid; end if;
  cfg := public._live_config(p_project);
  if cfg is null or (cfg -> 'modules' ->> 'heatmap')::boolean is not true then return null; end if;
  if not exists (select 1 from public.projects where id = p_project and deleted_at is null) then return null; end if;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.studies (project_id, kind, name, config, status, max_runs, link_hash, link_expires, is_default)
  values (p_project, 'browse', 'Site heatmap', '{"minutes":30,"page":"","prompt":"Look around the site as you normally would."}', 'open', 1000,
          encode(sha256(convert_to(tok, 'UTF8')), 'hex'), null, true)
  on conflict do nothing
  returning id into sid;
  if sid is null then select id into sid from public.studies where project_id = p_project and is_default; return sid; end if;
  insert into public.study_invites (study_id, token) values (sid, tok) on conflict (study_id) do update set token = excluded.token;
  return sid;
end $$;
revoke all on function public._ensure_default_study(uuid) from public, anon, authenticated;

create or replace function public._default_study_on_release() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (new.config -> 'modules' ->> 'heatmap')::boolean is true then perform public._ensure_default_study(new.project_id); end if;
  return new;
end $$;
revoke all on function public._default_study_on_release() from public, anon, authenticated;
drop trigger if exists default_study_on_release on public.releases;
create trigger default_study_on_release after insert on public.releases for each row execute function public._default_study_on_release();

-- A new link in the panel replaces the kept token too; revoking removes it.
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
  if dflt then insert into public.study_invites (study_id, token) values (p_study, tok) on conflict (study_id) do update set token = excluded.token; end if;
  return tok;
end $$;

create or replace function public.revoke_study_link(p_study uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  select p.workspace_id into ws from public.studies s join public.projects p on p.id = s.project_id where s.id = p_study;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  update public.studies set link_hash = null, link_expires = null where id = p_study;
  delete from public.study_invites where study_id = p_study;
end $$;

-- Participants: as before, but only participants count against max_runs.
create or replace function public.start_run(p_public_id text, p_token text, p_vw int, p_vh int) returns json
language plpgsql security definer set search_path = public as $$
declare s public.studies; r public.runs; uid uuid := auth.uid(); eye boolean;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not public.take_rate('run:' || uid, 10) then raise exception 'rate_limited'; end if;
  s := public._study_for(p_public_id, p_token);
  select * into r from public.runs where study_id = s.id and user_id = uid and finished_at is null and source = 'participant' order by started_at desc limit 1;
  if r.id is null then
    if (select count(*) from public.runs where study_id = s.id and source = 'participant') >= s.max_runs then raise exception 'study_full'; end if;
    insert into public.runs (study_id, project_id, user_id, vw, vh, device)
    values (s.id, s.project_id, uid, least(greatest(coalesce(p_vw, 0), 0), 10000), least(greatest(coalesce(p_vh, 0), 0), 10000),
            case when coalesce(p_vw, 0) < 700 then 'mobile' when p_vw < 1100 then 'tablet' else 'desktop' end)
    returning * into r;
  end if;
  eye := s.eye_tracking and coalesce((public._live_config(s.project_id) -> 'modules' ->> 'gaze')::boolean, false);
  return json_build_object('run', r.id, 'kind', s.kind, 'name', s.name, 'config', s.config, 'eye', eye);
end $$;

-- The reviewer's (or team's) checks for the widget's heatmap calls. Returns the project id.
create or replace function public._heat_reviewer(p_public_id text, p_rate text, p_max int) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception 'not_invited'; end if;
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_ok(pid, 'heatmap') then raise exception 'origin_not_allowed'; end if;
  if not exists (select 1 from public.reviewers where project_id = pid and user_id = auth.uid()) then raise exception 'not_invited'; end if;
  if not public.take_rate(p_rate || auth.uid(), p_max) then raise exception 'rate_limited'; end if;
  return pid;
end $$;
revoke all on function public._heat_reviewer(text, text, int) from public, anon, authenticated;

-- A reviewer's clicks go into the default study: their run for this session (reused for 12 hours).
create or replace function public.start_reviewer_run(p_public_id text, p_vw int, p_vh int) returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid; s public.studies; r public.runs; uid uuid := auth.uid();
begin
  pid := public._heat_reviewer(p_public_id, 'rrun:', 10);
  select * into s from public.studies where project_id = pid and is_default;
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

-- The default study's participant link token and how many people it has, for the widget's heatmap panel.
create or replace function public.default_study_invite(p_public_id text) returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid; s public.studies;
begin
  pid := public._heat_reviewer(p_public_id, 'inv:', 30);
  select * into s from public.studies where project_id = pid and is_default;
  if s.id is null then return json_build_object('token', null, 'open', false, 'people', 0); end if;
  return json_build_object(
    'token', case when s.status = 'open' then (select token from public.study_invites where study_id = s.id) end,
    'open', s.status = 'open', 'name', s.name,
    'people', (select count(distinct user_id) from public.runs where study_id = s.id));
end $$;

revoke all on function public.start_reviewer_run(text, int, int), public.default_study_invite(text) from public, anon;
grant execute on function public.start_reviewer_run(text, int, int), public.default_study_invite(text) to authenticated;

-- Existing projects with Heatmap on.
select public._ensure_default_study(p.id) from public.projects p where p.deleted_at is null;
