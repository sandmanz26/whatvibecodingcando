-- Pins that survive redeploys.
--
-- New comments carry a fingerprint of their element inside the anchor JSON (anchor.fp: no new
-- column). When the site changes, the widget finds the element again or marks the pin "Moved?" or
-- gone; it reports that state, and a reviewer can confirm or re-pick the element. Both go through
-- set_anchor: any reviewer of the project (same checks as replies), its own rate limit, small JSON.
--
-- anchor.st = {s: 'ok'|'moved'|'gone', v: site version, at}: v and at are set here, and kept while
-- the state stays the same, so the panel can say "not found since v2.3".

create or replace function public.set_anchor(p_thread uuid, p_anchor jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare
  x record;
  st text := p_anchor -> 'st' ->> 's';
  old jsonb;
  next jsonb;
begin
  select * into x from public._thread_for(p_thread);
  if not public.take_rate('anchor:' || auth.uid(), 60) then raise exception 'rate_limited'; end if;
  if p_anchor is null or jsonb_typeof(p_anchor) <> 'object' or length(p_anchor::text) > 4000 then raise exception 'bad_anchor'; end if;
  if jsonb_typeof(p_anchor -> 'sel') is distinct from 'string' or char_length(p_anchor ->> 'sel') > 400 then raise exception 'bad_anchor'; end if;
  if p_anchor -> 'fp' is not null and jsonb_typeof(p_anchor -> 'fp') <> 'object' then raise exception 'bad_anchor'; end if;
  if st is not null and st not in ('ok', 'moved', 'gone') then raise exception 'bad_state'; end if;
  old := (x.t).anchor;
  -- The comparison's second element and the commenter's device stay as they were.
  next := (old - 'st') || (p_anchor - 'b' - 'device' - 'st');
  if st is not null then
    next := next || jsonb_build_object('st', case
      when old -> 'st' ->> 's' = st then old -> 'st'
      else jsonb_strip_nulls(jsonb_build_object('s', st, 'v', left(nullif(btrim(public._live_config((x.t).project_id) ->> 'version'), ''), 20), 'at', now()))
    end);
  elsif old -> 'st' is not null then
    next := next || jsonb_build_object('st', old -> 'st');
  end if;
  if length(next::text) > 4000 then raise exception 'bad_anchor'; end if;
  update public.threads set anchor = next where id = p_thread;
  return public._thread_json((select t from public.threads t where t.id = p_thread), (x.r).id);
end $$;
revoke all on function public.set_anchor(uuid, jsonb) from public, anon;
grant execute on function public.set_anchor(uuid, jsonb) to authenticated;
