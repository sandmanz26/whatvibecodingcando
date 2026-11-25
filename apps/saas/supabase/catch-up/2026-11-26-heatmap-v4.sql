-- One paste in the Supabase SQL editor: heatmap accuracy v4 (same as migrations/20261126100000_heatmap_v4.sql).
-- Safe to run again. Needs every earlier migration (catch-up files up to 2026-11-25-heatmap-v3.sql).
begin;
-- Vibe Collab: heatmap accuracy v4.
--
-- * Exposure: the script records which elements a participant actually saw ('seen': the element's
--   selector, once per page visit, when ≥ 50% of it was visible for ≥ 500 ms) and how far down each
--   page they got ('depth': the bottom of the viewport at its lowest, and the page height). No content.
-- * Versions: every event carries the site's version label (the widget configuration's "version",
--   as comments do), so a heatmap never mixes two versions of a page.
-- * Full data for big studies: _heat_summary pre-aggregates ALL of a page's clicks into bins of 1/80
--   of the layout width (16 px at 1280) per device and version, with counts and distinct people, plus
--   per-element clicks, people, first clicks, rage, dead and exposures, and each person's deepest row.
--   Output is bounded (20,000 bins, 400 elements, 5,000 depth rows, 50 groups).
-- * heatmap_summary: the same for the script's Heatmap tool (invited reviewer, allowed origin,
--   rate limit, like heatmap_points); study_heatmap: for project members in the panel.
-- * heatmap_points: returns each point's version, and with gaze also the same people's clicks on the
--   page ('anchors', at most 60 a run), which the script uses to correct eye-tracking drift.

alter table public.run_events drop constraint if exists run_events_kind_check;
alter table public.run_events add constraint run_events_kind_check check (kind in ('click', 'page', 'gaze', 'door', 'seen', 'depth'));
alter table public.run_events add column if not exists version text check (char_length(version) <= 20);
-- The summary groups a page's events by run: (project, page, kind) then run and time.
create index if not exists run_events_page_kind_run_idx on public.run_events (project_id, page, kind, run_id, t);

-- Up to 200 events per call, 5,000 per run. Each value is checked and clipped; a bad one is skipped.
create or replace function public.log_events(p_run uuid, p_events jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare r public.runs; n int;
begin
  if not public.take_rate('ev:' || auth.uid(), 60) then raise exception 'rate_limited'; end if;
  r := public._run_for(p_run);
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 200 then raise exception 'bad_events'; end if;
  if r.events + jsonb_array_length(p_events) > 5000 then raise exception 'run_full'; end if;
  insert into public.run_events (run_id, project_id, t, task, kind, page, x, y, vw, doc_h, sel, label, ex, ey, hit, rage, dead, version)
  select r.id, r.project_id,
         least(greatest((e ->> 't')::int, 0), 86400000),
         left(e ->> 'task', 40), e ->> 'kind', left(e ->> 'page', 300),
         (e ->> 'x')::real, (e ->> 'y')::real, (e ->> 'vw')::int, (e ->> 'doc_h')::int,
         left(e ->> 'sel', 400), case when e ->> 'kind' in ('seen', 'depth') then null else left(e ->> 'label', 80) end,
         least(greatest((e ->> 'ex')::real, 0), 1), least(greatest((e ->> 'ey')::real, 0), 1),
         (e ->> 'hit')::boolean, (e ->> 'rage')::boolean, (e ->> 'dead')::boolean,
         nullif(left(regexp_replace(coalesce(e ->> 'version', ''), '[^\w. -]', '', 'g'), 20), '')
  from jsonb_array_elements(p_events) e
  where jsonb_typeof(e) = 'object'
    and e ->> 'kind' in ('click', 'page', 'gaze', 'door', 'seen', 'depth')
    and coalesce(e ->> 'page', '') ~ '^/' and coalesce(e ->> 'page', '') !~ '^//'
    and coalesce(e ->> 't', '') ~ '^[0-9]{1,8}$'
    and (e ->> 'kind' <> 'seen' or coalesce(e ->> 'sel', '') <> '');
  get diagnostics n = row_count;
  update public.runs set events = events + n where id = r.id;
  return n;
end $$;

-- The aggregate of one page (all studies, or one), over every event. Internal: callers check access.
create or replace function public._heat_summary(pid uuid, p_page text, p_study uuid) returns json
language sql stable security definer set search_path = public as $$
  with ev as (
    select e.id, e.run_id, e.kind, e.t, e.x, e.y, e.vw, e.doc_h, e.sel, e.label, e.rage, e.dead,
           coalesce(r.device, 'desktop') as dev, coalesce(e.version, '') as ver
    from public.run_events e join public.runs r on r.id = e.run_id
    where e.project_id = pid and e.page = left(coalesce(p_page, '/'), 300) and e.kind in ('click', 'seen', 'depth')
      and (p_study is null or r.study_id = p_study)
  ),
  clicks as (select *, row_number() over (partition by run_id, dev, ver order by t, id) as nth from ev where kind = 'click'),
  binned as (
    select dev, ver, least(79, greatest(0, floor(x / vw * 80)))::int as bx, least(5000, greatest(0, floor(y / (vw / 80.0))))::int as by, run_id
    from clicks where x is not null and y is not null and vw > 0
  ),
  bins as (
    select dev, ver, bx, by, count(*)::int as n, count(distinct run_id)::int as people
    from binned group by dev, ver, bx, by order by n desc, dev, ver, bx, by limit 20000
  ),
  el_clicks as (
    select dev, ver, sel, max(label) as label, count(*)::int as clicks, count(distinct run_id)::int as people,
           count(distinct run_id) filter (where nth = 1)::int as first, count(*) filter (where rage)::int as rage, count(*) filter (where dead)::int as dead
    from clicks where sel is not null group by dev, ver, sel
  ),
  el_seen as (select dev, ver, sel, count(distinct run_id)::int as seen from ev where kind = 'seen' and sel is not null group by dev, ver, sel),
  els as (
    select coalesce(c.dev, s.dev) as dev, coalesce(c.ver, s.ver) as ver, coalesce(c.sel, s.sel) as sel, c.label,
           coalesce(c.clicks, 0) as clicks, coalesce(c.people, 0) as people, coalesce(c.first, 0) as first,
           coalesce(c.rage, 0) as rage, coalesce(c.dead, 0) as dead, coalesce(s.seen, 0) as seen
    from el_clicks c full join el_seen s on s.dev = c.dev and s.ver = c.ver and s.sel = c.sel
    order by coalesce(c.people, 0) desc, coalesce(s.seen, 0) desc, 3 limit 400
  ),
  deep as (
    select dev, ver, run_id, max(least(5000, greatest(0, floor(y / (greatest(vw, 1) / 80.0)))))::int as row,
           max(least(1, greatest(0, y / nullif(doc_h, 0)))) as frac
    from ev where kind = 'depth' and y is not null and vw > 0 group by dev, ver, run_id
  ),
  depth as (
    select dev, ver, row, round(coalesce(frac, 0)::numeric, 2) as frac, count(*)::int as people
    from deep group by dev, ver, row, round(coalesce(frac, 0)::numeric, 2) order by people desc, dev, ver, row limit 5000
  ),
  groups as (
    select dev, ver, count(distinct run_id)::int as people, count(*) filter (where kind = 'click')::int as clicks
    from ev group by dev, ver order by people desc, dev, ver limit 50
  )
  select json_build_object(
    'bin', 80,
    'groups', coalesce((select json_agg(json_build_object('dev', dev, 'ver', ver, 'people', people, 'clicks', clicks)) from groups), '[]'::json),
    'bins', coalesce((select json_agg(json_build_object('dev', dev, 'ver', ver, 'bx', bx, 'by', by, 'n', n, 'people', people)) from bins), '[]'::json),
    'elements', coalesce((select json_agg(json_build_object('dev', dev, 'ver', ver, 'sel', sel, 'label', label, 'clicks', clicks, 'people', people,
                                                            'first', first, 'rage', rage, 'dead', dead, 'seen', seen)) from els), '[]'::json),
    'depth', coalesce((select json_agg(json_build_object('dev', dev, 'ver', ver, 'row', row, 'frac', frac, 'people', people)) from depth), '[]'::json)
  )
$$;
revoke all on function public._heat_summary(uuid, text, uuid) from public, anon, authenticated;

-- The script's Heatmap tool: same access rules as heatmap_points.
create or replace function public.heatmap_summary(p_public_id text, p_page text, p_study uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_ok(pid, 'heatmap') then raise exception 'origin_not_allowed'; end if;
  if not exists (select 1 from public.reviewers where project_id = pid and user_id = auth.uid()) then raise exception 'not_invited'; end if;
  if not public.take_rate('heat:' || auth.uid(), 30) then raise exception 'rate_limited'; end if;
  if p_study is not null and not exists (select 1 from public.studies where id = p_study and project_id = pid) then raise exception 'no_study'; end if;
  return public._heat_summary(pid, p_page, p_study);
end $$;
revoke all on function public.heatmap_summary(text, text, uuid) from public, anon;
grant execute on function public.heatmap_summary(text, text, uuid) to authenticated;

-- The panel's study results: members of the study's project only.
create or replace function public.study_heatmap(p_study uuid, p_page text) returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select s.project_id into pid from public.studies s join public.projects p on p.id = s.project_id
  where s.id = p_study and p.deleted_at is null and public.has_role(p.workspace_id);
  if pid is null then raise exception 'not_allowed'; end if;
  return public._heat_summary(pid, p_page, p_study);
end $$;
revoke all on function public.study_heatmap(uuid, text) from public, anon;
grant execute on function public.study_heatmap(uuid, text) to authenticated;

create or replace function public.heatmap_points(p_public_id text, p_page text, p_study uuid default null, p_kind text default 'click') returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid; k text := case when p_kind = 'gaze' then 'gaze' else 'click' end; pg text := left(coalesce(p_page, '/'), 300);
begin
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_ok(pid, 'heatmap') then raise exception 'origin_not_allowed'; end if;
  if not exists (select 1 from public.reviewers where project_id = pid and user_id = auth.uid()) then raise exception 'not_invited'; end if;
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
commit;
