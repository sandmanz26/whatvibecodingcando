-- Vibe Collab: ready for big projects.
--
-- 1. Indexes for the queries that grow with a project: participant paths (runs by project, newest
--    first) and heatmaps (events by project, page and kind, newest first).
-- 2. Housekeeping that doesn't need pg_cron: now and then (about 1 call in 500) take_rate also
--    clears old rate-limit rows and expired one-time links, a bounded batch at a time.
-- 3. list_threads (the widget, polled while a reviewer has the page open) returns at most the
--    1,000 newest comments of a project, instead of every comment ever made.

create index if not exists runs_project_started_idx on public.runs (project_id, started_at desc);
create index if not exists run_events_project_page_kind_idx on public.run_events (project_id, page, kind, id desc);
drop index if exists public.run_events_project_id_page_idx;
create index if not exists rate_hits_minute_idx on public.rate_hits (minute);

create or replace function public.take_rate(b text, max_per_minute int) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.rate_hits (bucket, minute) values (b, date_trunc('minute', now()))
  on conflict (bucket, minute) do update set hits = public.rate_hits.hits + 1
  returning hits into n;
  if random() < 0.002 then
    delete from public.rate_hits where ctid = any (array(select ctid from public.rate_hits where minute < now() - interval '1 hour' limit 5000));
    delete from public.handoffs where ctid = any (array(select ctid from public.handoffs where expires_at < now() - interval '1 day' limit 1000));
  end if;
  return n <= max_per_minute;
end $$;
revoke all on function public.take_rate(text, int) from public, anon, authenticated;

create or replace function public.list_threads(p_public_id text) returns json
language plpgsql security definer set search_path = public as $$
declare r public.reviewers := public._reviewer_for(p_public_id);
begin
  if not public.take_rate('read:' || auth.uid(), 120) then raise exception 'rate_limited'; end if;
  return coalesce((select json_agg(public._thread_json(t, r.id) order by t.created_at)
                   from (select * from public.threads where project_id = r.project_id order by created_at desc limit 1000) t), '[]'::json);
end $$;
revoke all on function public.list_threads(text) from public, anon;
grant execute on function public.list_threads(text) to authenticated;
