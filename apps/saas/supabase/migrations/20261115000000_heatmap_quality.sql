-- Vibe Collab: what a better heatmap needs from each point.
--
-- heatmap_points now returns, per point, which participant it came from (as a number within this
-- answer, not their id), when (ms into their run), their device and their eye-tracking accuracy.
-- The script uses them to count each person the same, turn gaze into fixations weighted by how
-- long people looked, leave out poorly calibrated eye tracking, and show one device at a time.

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
    'points', coalesce((select json_agg(json_build_object('x', e.x, 'y', e.y, 'vw', e.vw, 'sel', e.sel, 'ex', e.ex, 'ey', e.ey, 'rage', e.rage, 'dead', e.dead,
                                                            'p', e.p, 't', e.t, 'dev', e.device, 'acc', e.gaze_accuracy))
      from (select e.x, e.y, e.vw, e.sel, e.ex, e.ey, e.rage, e.dead, e.t, r.device, r.gaze_accuracy,
                   dense_rank() over (order by e.run_id) as p
            from public.run_events e join public.runs r on r.id = e.run_id
            where e.project_id = pid and e.kind = (case when p_kind = 'gaze' then 'gaze' else 'click' end) and e.page = left(coalesce(p_page, '/'), 300)
              and (p_study is null or r.study_id = p_study)
            order by e.id desc limit 20000) e), '[]'::json)
  );
end $$;
revoke all on function public.heatmap_points(text, text, uuid, text) from public, anon;
grant execute on function public.heatmap_points(text, text, uuid, text) to authenticated;
