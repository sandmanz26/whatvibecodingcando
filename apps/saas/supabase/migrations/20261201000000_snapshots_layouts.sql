-- ourhunch: eye tracking needs the camera, layout versions per page, and page snapshots.
--
-- * Eye tracking (module 'gaze'): a run without gaze can't count. discard_run deletes a participant's
--   own run (they said no to the camera); finish_run marks a gaze-module run without gaze points
--   excluded, and the results functions leave excluded runs out.
-- * Layout versions: the script sends a structural fingerprint of each page (tags, landmarks, stable
--   attributes and counts, never text). layout_seen matches it to the page's known layouts (weighted
--   similarity >= 0.8) or starts a new one. Events carry the fingerprint's hash (layout_hash); results
--   split by layout. Events without one are "unknown layout".
-- * Snapshots: once per (project, page, layout, device) a reviewer's or participant's browser saves a
--   masked picture of the page in the private bucket 'snapshots'. snapshot_claim reserves the one path
--   (rate limited, only when projects.snapshots is on), storage accepts that one upload, members read it
--   with signed URLs. projects.snapshots: off for existing projects, on for new ones.
-- Additive and safe to run again.

-- ---------- eye tracking: runs that can't count ----------

alter table public.runs add column if not exists excluded boolean not null default false;
alter table public.runs add column if not exists excluded_reason text check (char_length(excluded_reason) <= 40);

-- The participant's own unfinished run, deleted with its events (nothing is kept).
create or replace function public.discard_run(p_run uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.take_rate('disc:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  delete from public.runs where id = p_run and user_id = auth.uid() and finished_at is null;
end $$;
revoke all on function public.discard_run(uuid) from public, anon;
grant execute on function public.discard_run(uuid) to authenticated;

create or replace function public.finish_run(p_run uuid, p_result jsonb, p_gaze real default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.runs; m text;
begin
  if not public.take_rate('fin:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  r := public._run_for(p_run);
  if jsonb_typeof(p_result) <> 'object' or pg_column_size(p_result) >= 30000 then raise exception 'bad_result'; end if;
  select module into m from public.studies where id = r.study_id;
  update public.runs set result = p_result, finished_at = coalesce(finished_at, now()),
    gaze_accuracy = case when p_gaze between 0 and 5000 then p_gaze else gaze_accuracy end,
    -- An eye-tracking study's run without a single gaze point doesn't count.
    excluded = (m = 'gaze' and not exists (select 1 from public.run_events e where e.run_id = r.id and e.kind = 'gaze')),
    excluded_reason = case when m = 'gaze' and not exists (select 1 from public.run_events e where e.run_id = r.id and e.kind = 'gaze') then 'no_gaze' end
  where id = r.id;
end $$;

-- ---------- layouts ----------

create table if not exists public.page_layouts (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  page       text not null check (page ~ '^/' and char_length(page) <= 300),
  n          int not null check (n between 1 and 1000),
  fp         jsonb not null check (jsonb_typeof(fp) = 'object' and pg_column_size(fp) < 12000),
  created_at timestamptz not null default now(),
  unique (project_id, page, n)
);
create index if not exists page_layouts_project_page_idx on public.page_layouts (project_id, page, n);
alter table public.page_layouts enable row level security;
drop policy if exists "members see layouts" on public.page_layouts;
create policy "members see layouts" on public.page_layouts for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

create table if not exists public.layout_hashes (
  project_id uuid not null references public.projects (id) on delete cascade,
  page       text not null,
  hash       text not null check (hash ~ '^[0-9a-f]{12,16}$'),
  layout_id  uuid not null references public.page_layouts (id) on delete cascade,
  primary key (project_id, page, hash)
);
create index if not exists layout_hashes_layout_idx on public.layout_hashes (layout_id);
alter table public.layout_hashes enable row level security;
drop policy if exists "members see layout hashes" on public.layout_hashes;
create policy "members see layout hashes" on public.layout_hashes for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

alter table public.run_events add column if not exists layout_hash text check (layout_hash ~ '^[0-9a-f]{12,16}$');
create index if not exists run_events_project_page_layout_idx on public.run_events (project_id, page, layout_hash);

-- Weighted Jaccard of two {token: count} objects: sum(min) / sum(max). 1 = the same structure.
create or replace function public._fp_similarity(a jsonb, b jsonb) returns real
language sql immutable set search_path = public as $$
  select coalesce(sum(least(coalesce((a ->> k)::real, 0), coalesce((b ->> k)::real, 0)))
         / nullif(sum(greatest(coalesce((a ->> k)::real, 0), coalesce((b ->> k)::real, 0))), 0), 0)::real
  from (select jsonb_object_keys(a) as k union select jsonb_object_keys(b)) keys
$$;

-- The layout of this page for this fingerprint: a known one (same hash, or similar enough), else a new one.
create or replace function public.layout_seen(p_run uuid, p_page text, p_hash text, p_fp jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare r public.runs; pg text := left(coalesce(p_page, '/'), 300); lid uuid; ln int; best real := 0; cand record; made boolean := false;
begin
  if not public.take_rate('lay:' || auth.uid(), 60) then raise exception 'rate_limited'; end if;
  r := public._run_for(p_run);
  if pg !~ '^/' or pg ~ '^//' then raise exception 'bad_page'; end if;
  if coalesce(p_hash, '') !~ '^[0-9a-f]{12,16}$' then raise exception 'bad_hash'; end if;
  select h.layout_id, l.n into lid, ln from public.layout_hashes h join public.page_layouts l on l.id = h.layout_id
  where h.project_id = r.project_id and h.page = pg and h.hash = p_hash;
  if lid is not null then return json_build_object('layout', lid, 'n', ln, 'new', false); end if;
  if jsonb_typeof(p_fp) <> 'object' or pg_column_size(p_fp) >= 12000 or (select count(*) from jsonb_object_keys(p_fp)) > 300
     or exists (select 1 from jsonb_each(p_fp) e where jsonb_typeof(e.value) <> 'number') then raise exception 'bad_fingerprint'; end if;
  -- the newest layouts first: a page usually changes forward
  for cand in select id, n, fp from public.page_layouts where project_id = r.project_id and page = pg order by n desc limit 30 loop
    if public._fp_similarity(cand.fp, p_fp) > best then best := public._fp_similarity(cand.fp, p_fp); lid := cand.id; ln := cand.n; end if;
  end loop;
  if lid is null or best < 0.8 then
    if (select count(*) from public.page_layouts where project_id = r.project_id and page = pg) >= 50 then raise exception 'too_many_layouts'; end if;
    insert into public.page_layouts (project_id, page, n, fp)
    values (r.project_id, pg, coalesce((select max(n) from public.page_layouts where project_id = r.project_id and page = pg), 0) + 1, p_fp)
    on conflict (project_id, page, n) do nothing
    returning id, n into lid, ln;
    if lid is null then select id, n into lid, ln from public.page_layouts where project_id = r.project_id and page = pg order by n desc limit 1; end if;
    made := true;
  end if;
  insert into public.layout_hashes (project_id, page, hash, layout_id) values (r.project_id, pg, p_hash, lid) on conflict do nothing;
  return json_build_object('layout', lid, 'n', ln, 'new', made);
end $$;
revoke all on function public._fp_similarity(jsonb, jsonb) from public, anon;
revoke all on function public.layout_seen(uuid, text, text, jsonb) from public, anon;
grant execute on function public.layout_seen(uuid, text, text, jsonb) to authenticated;

-- Events carry the layout hash ('lh').
create or replace function public.log_events(p_run uuid, p_events jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare r public.runs; n int;
begin
  if not public.take_rate('ev:' || auth.uid(), 60) then raise exception 'rate_limited'; end if;
  r := public._run_for(p_run);
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 200 then raise exception 'bad_events'; end if;
  if r.events + jsonb_array_length(p_events) > 5000 then raise exception 'run_full'; end if;
  insert into public.run_events (run_id, project_id, t, task, kind, page, x, y, vw, doc_h, sel, label, ex, ey, hit, rage, dead, version, layout_hash)
  select r.id, r.project_id,
         least(greatest((e ->> 't')::int, 0), 86400000),
         left(e ->> 'task', 40), e ->> 'kind', left(e ->> 'page', 300),
         (e ->> 'x')::real, (e ->> 'y')::real, (e ->> 'vw')::int, (e ->> 'doc_h')::int,
         left(e ->> 'sel', 400), case when e ->> 'kind' in ('seen', 'depth') then null else left(e ->> 'label', 80) end,
         least(greatest((e ->> 'ex')::real, 0), 1), least(greatest((e ->> 'ey')::real, 0), 1),
         (e ->> 'hit')::boolean, (e ->> 'rage')::boolean, (e ->> 'dead')::boolean,
         nullif(left(regexp_replace(coalesce(e ->> 'version', ''), '[^\w. -]', '', 'g'), 20), ''),
         case when coalesce(e ->> 'lh', '') ~ '^[0-9a-f]{12,16}$' then e ->> 'lh' end
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

-- ---------- snapshots ----------

-- Existing projects: off (installs already running don't change). New projects: on.
alter table public.projects add column if not exists snapshots boolean;
update public.projects set snapshots = false where snapshots is null;
alter table public.projects alter column snapshots set default true;
alter table public.projects alter column snapshots set not null;

create table if not exists public.page_snapshots (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  page        text not null check (page ~ '^/' and char_length(page) <= 300),
  layout_id   uuid not null references public.page_layouts (id) on delete cascade,
  device      text not null check (device in ('desktop', 'tablet', 'mobile')),
  path        text not null unique check (path ~ '^[0-9a-f-]{36}/[0-9a-f]{16}/[0-9a-f-]{36}/(desktop|tablet|mobile)\.(webp|jpg)$'),
  width       int not null check (width between 200 and 4000),
  height      int not null check (height between 100 and 20000),
  scroll_h    int not null check (scroll_h between 0 and 100000),
  vw          int not null check (vw between 200 and 4000),
  boxes       jsonb not null default '{}' check (jsonb_typeof(boxes) = 'object' and pg_column_size(boxes) < 60000),
  claimed_by  uuid references auth.users (id) on delete set null,
  claimed_at  timestamptz not null default now(),
  taken_at    timestamptz,
  unique (project_id, page, layout_id, device)
);
create index if not exists page_snapshots_project_idx on public.page_snapshots (project_id, page);
alter table public.page_snapshots enable row level security;
drop policy if exists "members see snapshots" on public.page_snapshots;
create policy "members see snapshots" on public.page_snapshots for select to authenticated
  using (taken_at is not null and exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
drop policy if exists "members delete snapshots" on public.page_snapshots;
create policy "members delete snapshots" on public.page_snapshots for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

-- Reserves the one snapshot of (page, layout, device) for this reviewer or participant. Returns the
-- storage path to upload to, or null (taken already, snapshots off, visitor run, unknown layout).
create or replace function public.snapshot_claim(p_run uuid, p_page text, p_hash text, p_device text, p_ext text,
  p_width int, p_height int, p_scroll_h int, p_vw int, p_boxes jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare r public.runs; pg text := left(coalesce(p_page, '/'), 300); lid uuid; pth text; old public.page_snapshots;
begin
  r := public._run_for(p_run);
  if r.source not in ('reviewer', 'participant') then return null; end if;
  if not (select snapshots from public.projects where id = r.project_id) then return null; end if;
  if p_device not in ('desktop', 'tablet', 'mobile') or p_ext not in ('webp', 'jpg') then raise exception 'bad_snapshot'; end if;
  if jsonb_typeof(p_boxes) <> 'object' or pg_column_size(p_boxes) >= 60000 then raise exception 'bad_snapshot'; end if;
  select layout_id into lid from public.layout_hashes where project_id = r.project_id and page = pg and hash = p_hash;
  if lid is null then return null; end if;
  select * into old from public.page_snapshots where project_id = r.project_id and page = pg and layout_id = lid and device = p_device;
  -- taken, or someone else is uploading it right now
  if old.id is not null and (old.taken_at is not null or old.claimed_at > now() - interval '10 minutes') then return null; end if;
  if not public.take_rate('snap:' || auth.uid(), 5) then return null; end if;
  pth := r.project_id || '/' || left(encode(sha256(convert_to(pg, 'UTF8')), 'hex'), 16) || '/' || lid || '/' || p_device || '.' || p_ext;
  delete from public.page_snapshots where id = old.id;
  insert into public.page_snapshots (project_id, page, layout_id, device, path, width, height, scroll_h, vw, boxes, claimed_by)
  values (r.project_id, pg, lid, p_device, pth, p_width, p_height, p_scroll_h, p_vw, p_boxes, auth.uid());
  return pth;
end $$;

-- The upload went through: the snapshot is shown from now on.
create or replace function public.snapshot_done(p_path text) returns boolean
language plpgsql security definer set search_path = public, storage as $$
begin
  update public.page_snapshots s set taken_at = now()
  where s.path = p_path and s.claimed_by = auth.uid() and s.taken_at is null
    and exists (select 1 from storage.objects o where o.bucket_id = 'snapshots' and o.name = p_path);
  return found;
end $$;

-- May this user upload this object? Only the path they claimed, once, within 10 minutes.
create or replace function public.can_write_snapshot(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.page_snapshots s where s.path = object_name and s.claimed_by = auth.uid()
                 and s.taken_at is null and s.claimed_at > now() - interval '10 minutes')
$$;
-- May this user read it? Members of the project.
create or replace function public.can_read_snapshot(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.page_snapshots s join public.projects p on p.id = s.project_id
                 where s.path = object_name and public.has_role(p.workspace_id))
$$;
revoke all on function public.snapshot_claim(uuid, text, text, text, text, int, int, int, int, jsonb), public.snapshot_done(text),
  public.can_write_snapshot(text), public.can_read_snapshot(text) from public, anon;
grant execute on function public.snapshot_claim(uuid, text, text, text, text, int, int, int, int, jsonb), public.snapshot_done(text),
  public.can_write_snapshot(text), public.can_read_snapshot(text) to authenticated;

-- The private bucket: images only, at most 600 KB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('snapshots', 'snapshots', false, 614400, array['image/webp', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = 614400, allowed_mime_types = array['image/webp', 'image/jpeg'];

drop policy if exists "snapshot writers upload their claimed path" on storage.objects;
create policy "snapshot writers upload their claimed path" on storage.objects for insert to authenticated
  with check (bucket_id = 'snapshots' and public.can_write_snapshot(name));
drop policy if exists "members read their projects' snapshots" on storage.objects;
create policy "members read their projects' snapshots" on storage.objects for select to authenticated
  using (bucket_id = 'snapshots' and public.can_read_snapshot(name));
drop policy if exists "members delete their projects' snapshots" on storage.objects;
create policy "members delete their projects' snapshots" on storage.objects for delete to authenticated
  using (bucket_id = 'snapshots' and public.can_read_snapshot(name));

-- ---------- results leave excluded runs out, and carry the layout ----------

create or replace function public._heat_summary(pid uuid, p_page text, p_study uuid) returns json
language sql stable security definer set search_path = public as $$
  with ev as (
    select e.id, e.run_id, e.kind, e.t, e.x, e.y, e.vw, e.doc_h, e.sel, e.label, e.rage, e.dead,
           coalesce(r.device, 'desktop') as dev, coalesce(e.version, '') as ver
    from public.run_events e join public.runs r on r.id = e.run_id
    where e.project_id = pid and e.page = left(coalesce(p_page, '/'), 300) and e.kind in ('click', 'seen', 'depth')
      and (p_study is null or r.study_id = p_study) and not r.excluded
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

-- Points carry their layout number ('lay', 0 = unknown) so the overlay never mixes layouts.
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
      select e.id, e.run_id, e.x, e.y, e.vw, e.sel, e.label, e.ex, e.ey, e.rage, e.dead, e.t, e.version, e.layout_hash, r.device, r.gaze_accuracy,
             row_number() over (partition by e.run_id order by e.t, e.id) as nth
      from public.run_events e join public.runs r on r.id = e.run_id
      where e.project_id = pid and e.kind = k and e.page = pg and (p_study is null or r.study_id = p_study) and not r.excluded
    ),
    kept as (select * from pts where nth <= (case when k = 'gaze' then 3000 else 60 end) order by id desc limit 20000),
    rk as (select run_id, dense_rank() over (order by run_id) as p from (select distinct run_id from kept) d)
    select json_build_object(
      'studies', coalesce((select json_agg(json_build_object('id', s.id, 'name', s.name) order by s.created_at desc) from public.studies s where s.project_id = pid), '[]'::json),
      'points', coalesce((select json_agg(json_build_object('x', q.x, 'y', q.y, 'vw', q.vw, 'sel', q.sel, 'label', q.label, 'ex', q.ex, 'ey', q.ey, 'rage', q.rage, 'dead', q.dead,
                                                            'p', rk.p, 't', q.t, 'dev', q.device, 'acc', q.gaze_accuracy, 'ver', coalesce(q.version, ''),
                                                            'lay', coalesce(l.n, 0)))
                          from kept q join rk using (run_id)
                          left join public.layout_hashes h on h.project_id = pid and h.page = pg and h.hash = q.layout_hash
                          left join public.page_layouts l on l.id = h.layout_id), '[]'::json),
      'layouts', coalesce((select json_agg(json_build_object('n', l.n, 'since', l.created_at) order by l.n) from public.page_layouts l where l.project_id = pid and l.page = pg), '[]'::json),
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
