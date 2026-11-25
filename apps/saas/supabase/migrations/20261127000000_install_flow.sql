-- Install flow: the script seen on a local dev address that isn't in the project yet.
--
-- report_seen keeps refusing reports from places that aren't the project's own (made-up origins must
-- never add sites to "Where the script runs"). One narrow exception, kept apart from installs: a
-- report from a local dev address (localhost or 127.0.0.1, any port) is remembered in install_strays,
-- so the panel can say "ourhunch saw your script on localhost:3001, which isn't in this project — Add
-- it". Only local addresses, at most 5 per project, never counted as an install (no email, no ops
-- usage), and the row goes as soon as the address is added and reports again.

create table if not exists public.install_strays (
  project_id uuid not null references public.projects (id) on delete cascade,
  host       text not null check (char_length(host) <= 64 and host ~ '^(localhost|127\.0\.0\.1)(:[0-9]{2,5})?$'),
  last_seen  timestamptz not null default now(),
  primary key (project_id, host)
);
alter table public.install_strays enable row level security;
drop policy if exists "members read strays" on public.install_strays;
create policy "members read strays" on public.install_strays for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
drop policy if exists "members clear strays" on public.install_strays;
create policy "members clear strays" on public.install_strays for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
revoke all on public.install_strays from anon;
revoke insert, update, truncate, trigger, references on public.install_strays from authenticated;
grant select, delete on public.install_strays to authenticated;

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
  if not listed then
    -- A local dev address not in the project yet: remembered apart, so the panel can offer to add it.
    if o ~ '^http://(localhost|127\.0\.0\.1)(:[0-9]{2,5})?$'
       and (exists (select 1 from public.install_strays where project_id = pid and host = h)
            or (select count(*) from public.install_strays where project_id = pid) < 5) then
      insert into public.install_strays (project_id, host, last_seen) values (pid, h, now())
      on conflict (project_id, host) do update set last_seen = now();
    end if;
    return;
  end if;
  delete from public.install_strays where project_id = pid and host = h;
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
