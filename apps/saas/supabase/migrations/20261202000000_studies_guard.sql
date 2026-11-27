-- ourhunch: every research module that is on keeps at least one study.
--
-- * The ★ default study can't be deleted while it is the only study of a module that is on in the
--   live widget ('last_study'): pause it instead. Enforced here (a trigger), whatever the client does.
-- * Deleting a ★ study while the module has others: the ★ moves to the study the owner picked
--   (delete_study's p_new_default), or else to the newest remaining one. Its link then never expires.
-- * Deleting a whole project or workspace is never blocked (the project row is already gone then).
-- * If a module that is on somehow has no default, it is made again: _ensure_default_studies (the
--   idempotent path from 20261129000000_default_studies.sql) runs after every study delete.
-- Additive and safe to run again.

create or replace function public._study_delete_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare cfg jsonb;
begin
  if not old.is_default then return old; end if;
  -- the project is being deleted (cascade) or is already soft-deleted: allowed
  if not exists (select 1 from public.projects where id = old.project_id and deleted_at is null) then return old; end if;
  if exists (select 1 from public.studies where project_id = old.project_id and module = old.module and id <> old.id) then return old; end if;
  cfg := public._live_config(old.project_id);
  if cfg is not null and (cfg -> 'modules' ->> old.module)::boolean is true then raise exception 'last_study'; end if;
  return old;
end $$;
revoke all on function public._study_delete_guard() from public, anon, authenticated;
drop trigger if exists study_delete_guard on public.studies;
create trigger study_delete_guard before delete on public.studies for each row execute function public._study_delete_guard();

-- After a ★ study is deleted: the chosen study (set by delete_study for this transaction), else the newest.
create or replace function public._study_after_delete() returns trigger
language plpgsql security definer set search_path = public as $$
declare pick uuid; tok text;
begin
  if not old.is_default then return null; end if;
  if not exists (select 1 from public.projects where id = old.project_id and deleted_at is null) then return null; end if;
  if exists (select 1 from public.studies where project_id = old.project_id and module = old.module and is_default) then return null; end if;
  pick := nullif(current_setting('ourhunch.next_default', true), '')::uuid;
  if pick is null or not exists (select 1 from public.studies where id = pick and project_id = old.project_id and module = old.module) then
    select id into pick from public.studies where project_id = old.project_id and module = old.module order by created_at desc, id desc limit 1;
  end if;
  if pick is not null then
    update public.studies set is_default = true, link_expires = null where id = pick;
    if (select link_hash from public.studies where id = pick) is null then
      tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
      update public.studies set link_hash = encode(sha256(convert_to(tok, 'UTF8')), 'hex') where id = pick;
      insert into public.study_invites (study_id, token) values (pick, tok) on conflict (study_id) do update set token = excluded.token;
    end if;
  else
    -- none left (the module was off): make it again if it is on now; otherwise nothing to do
    perform public._ensure_default_studies(old.project_id);
  end if;
  return null;
end $$;
revoke all on function public._study_after_delete() from public, anon, authenticated;
drop trigger if exists study_after_delete on public.studies;
create trigger study_after_delete after delete on public.studies for each row execute function public._study_after_delete();

-- The panel's delete: role checked, the guard above applies, and the owner may pick the next ★.
create or replace function public.delete_study(p_study uuid, p_new_default uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare ws uuid;
begin
  select p.workspace_id into ws from public.studies s join public.projects p on p.id = s.project_id where s.id = p_study and p.deleted_at is null;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  perform set_config('ourhunch.next_default', coalesce(p_new_default::text, ''), true);
  delete from public.studies where id = p_study;
  perform set_config('ourhunch.next_default', '', true);
end $$;
revoke all on function public.delete_study(uuid, uuid) from public, anon;
grant execute on function public.delete_study(uuid, uuid) to authenticated;

-- Existing projects: any module that is on but lost its default gets it back (idempotent).
select public._ensure_default_studies(p.id) from public.projects p where p.deleted_at is null;
