-- Vibe Collab: heatmap points, bounded and fair at the source.
--
-- heatmap_points now
--   * keeps at most 60 clicks (3,000 gaze samples) per participant run per page, the first ones,
--     so one person can't dominate the map and a 50k-click study still answers with a bounded list;
--   * returns each click's short label (already redacted when recorded), so the script can rank the
--     most clicked elements by name instead of by selector.
-- The newest 20,000 points are returned, as before. Reads use run_events_project_page_kind_idx.

create or replace function public.heatmap_points(p_public_id text, p_page text, p_study uuid default null, p_kind text default 'click') returns json
language plpgsql security definer set search_path = public as $$
declare pid uuid; k text := case when p_kind = 'gaze' then 'gaze' else 'click' end;
begin
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then raise exception 'no_project'; end if;
  if not public._origin_ok(pid, 'heatmap') then raise exception 'origin_not_allowed'; end if;
  if not exists (select 1 from public.reviewers where project_id = pid and user_id = auth.uid()) then raise exception 'not_invited'; end if;
  if not public.take_rate('heat:' || auth.uid(), 30) then raise exception 'rate_limited'; end if;
  return json_build_object(
    'studies', coalesce((select json_agg(json_build_object('id', s.id, 'name', s.name) order by s.created_at desc) from public.studies s where s.project_id = pid), '[]'::json),
    'points', coalesce((select json_agg(json_build_object('x', e.x, 'y', e.y, 'vw', e.vw, 'sel', e.sel, 'label', e.label, 'ex', e.ex, 'ey', e.ey, 'rage', e.rage, 'dead', e.dead,
                                                            'p', e.p, 't', e.t, 'dev', e.device, 'acc', e.gaze_accuracy))
      from (select * from (
              select e.id, e.x, e.y, e.vw, e.sel, e.label, e.ex, e.ey, e.rage, e.dead, e.t, r.device, r.gaze_accuracy,
                     dense_rank() over (order by e.run_id) as p,
                     row_number() over (partition by e.run_id order by e.t, e.id) as nth
              from public.run_events e join public.runs r on r.id = e.run_id
              where e.project_id = pid and e.kind = k and e.page = left(coalesce(p_page, '/'), 300)
                and (p_study is null or r.study_id = p_study)) q
            where q.nth <= (case when k = 'gaze' then 3000 else 60 end)
            order by q.id desc limit 20000) e), '[]'::json)
  );
end $$;
revoke all on function public.heatmap_points(text, text, uuid, text) from public, anon;
grant execute on function public.heatmap_points(text, text, uuid, text) to authenticated;
