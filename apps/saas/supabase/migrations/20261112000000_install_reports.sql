-- Vibe Collab: installation reports only from a project's own sites.
--
-- The installation check (report_seen) runs before anyone signs in, so anyone who knows a project's
-- public id could call it. Before this, a call with a made-up Origin (from a tool such as curl, not a
-- browser) added a made-up site to the project's "Where the script runs" list. Now a report counts
-- only when it comes from one of the project's environments (switched on or off) or the hosted demo
-- site, at most 20 sites are kept per project, and a project takes at most 120 reports a minute.

create or replace function public.report_seen(p_public_id text, p_version text, p_shown boolean, p_why text default '') returns void
language plpgsql security definer set search_path = public as $$
declare
  pid uuid;
  o text := public._request_origin();
  h text := regexp_replace(o, '^https?://', '');
  cfg jsonb;
  listed boolean;
begin
  if h = '' or length(h) > 255 then return; end if;
  if not public.take_rate('seen:' || h, 30) then return; end if;
  select id into pid from public.projects where public_id = p_public_id and deleted_at is null;
  if pid is null then return; end if;
  if not public.take_rate('seen-p:' || pid, 120) then return; end if;
  -- One of the project's own places (any environment, on or off), or the hosted demo site.
  cfg := public._live_config(pid);
  listed := exists (select 1 from public.allowed_origins a where a.origin = o)
    or exists (select 1 from jsonb_array_elements(coalesce(cfg -> 'envs', '[]'::jsonb)) e
               where public._host_matches(e ->> 'host', h) or public._host_matches(e ->> 'host', split_part(h, ':', 1)));
  if not listed then return; end if;
  -- At most 20 sites per project.
  if not exists (select 1 from public.installs where project_id = pid and host = h)
     and (select count(*) from public.installs where project_id = pid) >= 20 then return; end if;
  insert into public.installs (project_id, host, last_seen, version, shown, why)
  values (pid, h, now(), left(coalesce(p_version, ''), 20), coalesce(p_shown, false), left(coalesce(p_why, ''), 200))
  on conflict (project_id, host) do update
    set last_seen = now(), version = excluded.version, shown = excluded.shown, why = excluded.why
    where public.installs.last_seen < now() - interval '5 minutes' or public.installs.shown is distinct from excluded.shown;
end $$;

revoke all on function public.report_seen(text, text, boolean, text) from public;
grant execute on function public.report_seen(text, text, boolean, text) to anon, authenticated;

-- Reports already recorded from places that aren't the project's own (made up before this change).
delete from public.installs i
where not exists (select 1 from public.allowed_origins a where regexp_replace(a.origin, '^https?://', '') = i.host)
  and not exists (
    select 1 from jsonb_array_elements(coalesce(public._live_config(i.project_id) -> 'envs', '[]'::jsonb)) e
    where public._host_matches(e ->> 'host', i.host) or public._host_matches(e ->> 'host', split_part(i.host, ':', 1)));
