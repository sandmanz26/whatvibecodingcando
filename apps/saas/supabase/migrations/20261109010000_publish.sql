-- Vibe Collab: publishing widget settings from the panel.
--
-- Publishing writes a release row and the project's public file on Storage,
-- widget-config/<public_id>.json, which the script on customers' sites reads (cached on the CDN, so
-- page views never reach the database). Both are written by the signed-in panel user, guarded here:
-- only members of the project's workspace, only for that project's own file. The file is data
-- only; the script checks every field again before using it.

-- Releases: members of the workspace publish their own projects' versions (never edit or delete them).
create policy "members publish releases" on public.releases for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.projects p where p.id = project_id and p.deleted_at is null and public.has_role(p.workspace_id))
  );

-- The public bucket the script reads from. Small JSON files only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('widget-config', 'widget-config', true, 65536, array['application/json'])
on conflict (id) do update set public = true, file_size_limit = 65536, allowed_mime_types = array['application/json'];

-- Is `object_name` the published file of a project this user may manage?
create or replace function public.can_write_widget_file(object_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.public_id || '.json' = object_name and public.has_role(p.workspace_id)
  )
$$;
revoke all on function public.can_write_widget_file(text) from public, anon;
grant execute on function public.can_write_widget_file(text) to authenticated;

create policy "members write their projects' widget files" on storage.objects for insert to authenticated
  with check (bucket_id = 'widget-config' and public.can_write_widget_file(name));
create policy "members replace their projects' widget files" on storage.objects for update to authenticated
  using (bucket_id = 'widget-config' and public.can_write_widget_file(name))
  with check (bucket_id = 'widget-config' and public.can_write_widget_file(name));
-- Replacing a file (upsert) needs to see it first.
create policy "members see their projects' widget files" on storage.objects for select to authenticated
  using (bucket_id = 'widget-config' and public.can_write_widget_file(name));
