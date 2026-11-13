-- Vibe Collab: more kinds of review on customers' sites, and the site's version on every comment.
--
-- - Versions: a comment carries the version label the project has published (Widget → Version),
--   set by the server from the live settings, so a reviewer can't write another one.
-- - Component review: a comment comparing two elements of the page (A and B), with a verdict.
-- - Narration: a reviewer's voice note on a page. The audio goes to a private bucket, under the
--   project's public id; only that project's reviewers may upload, and members and the project's
--   reviewers may listen. At most 5 MB, audio only.

alter table public.threads
  add column kind    text not null default 'comment' check (kind in ('comment', 'compare', 'voice')),
  add column version text check (char_length(version) <= 20),
  add column audio   text check (audio ~ '^[A-Za-z0-9_-]{1,64}/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4)$'),
  -- the second element of a comparison
  add constraint threads_anchor_b check (anchor -> 'b' is null or (jsonb_typeof(anchor -> 'b') = 'object' and char_length(anchor -> 'b' ->> 'sel') <= 400));
create index on public.threads (project_id, version);

-- ---------- narration: the private bucket ----------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('narrations', 'narrations', false, 5242880, array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'])
on conflict (id) do update set public = false, file_size_limit = 5242880, allowed_mime_types = array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg'];

-- Is `object_name` ("<public id>/<uuid>.<ext>") in a project the caller reviews (reviewer = true) or manages?
create or replace function public.narration_access(object_name text, reviewer boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.projects p
    where p.public_id = split_part(object_name, '/', 1) and p.deleted_at is null
      and (public.has_role(p.workspace_id)
           or (reviewer and exists (select 1 from public.reviewers r where r.project_id = p.id and r.user_id = auth.uid())))
  )
$$;
revoke all on function public.narration_access(text, boolean) from public, anon;
grant execute on function public.narration_access(text, boolean) to authenticated;

create policy "reviewers upload narrations" on storage.objects for insert to authenticated
  with check (bucket_id = 'narrations' and name ~ '^[A-Za-z0-9_-]{1,64}/[0-9a-f-]{36}\.(webm|ogg|m4a|mp4)$' and public.narration_access(name, true));
create policy "members and reviewers listen to narrations" on storage.objects for select to authenticated
  using (bucket_id = 'narrations' and public.narration_access(name, true));
create policy "members and the author delete narrations" on storage.objects for delete to authenticated
  using (bucket_id = 'narrations' and (owner = auth.uid() or public.narration_access(name, false)));

-- ---------- what a thread looks like to the script, now with its kind, version and audio ----------

create or replace function public._thread_json(t public.threads, me uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', t.id, 'page', t.page, 'anchor', t.anchor, 'author', t.author_name, 'text', t.text,
    'createdAt', t.created_at, 'editedAt', t.edited_at, 'kind', t.kind, 'version', t.version, 'audio', t.audio,
    'resolved', case when t.resolved_at is null then null else json_build_object('by', t.resolved_by, 'at', t.resolved_at) end,
    'mine', t.reviewer = me::text,
    'replies', coalesce((select json_agg(json_build_object('id', r.id, 'author', r.author_name, 'text', r.text, 'at', r.created_at, 'mine', r.reviewer = me::text) order by r.created_at)
                         from public.replies r where r.thread_id = t.id), '[]'::json)
  )
$$;

-- post_thread takes a kind and, for a voice note, its uploaded audio. (The old signature goes: one
-- function with defaults serves old and new scripts alike.)
drop function public.post_thread(text, text, jsonb, text, uuid);
create or replace function public.post_thread(p_public_id text, p_page text, p_anchor jsonb, p_text text, p_id uuid default null, p_kind text default 'comment', p_audio text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  r public.reviewers := public._reviewer_for(p_public_id);
  t public.threads;
  body text := left(btrim(coalesce(p_text, '')), 4000);
  k text := coalesce(p_kind, 'comment');
  cfg jsonb := public._live_config(r.project_id);
  ver text;
begin
  if not public.take_rate('write:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  if k not in ('comment', 'compare', 'voice') then raise exception 'bad_kind'; end if;
  if k = 'compare' and (p_anchor -> 'b') is null then raise exception 'bad_anchor'; end if;
  if k = 'voice' then
    if not public._origin_ok(r.project_id, 'narration') then raise exception 'origin_not_allowed'; end if;
    -- The audio must be this reviewer's own upload, in this project.
    if p_audio is null or split_part(p_audio, '/', 1) <> p_public_id
       or not exists (select 1 from storage.objects o where o.bucket_id = 'narrations' and o.name = p_audio and o.owner = auth.uid()) then
      raise exception 'no_audio';
    end if;
    if body = '' then body := 'Voice note'; end if;
  elsif k = 'compare' and not public._origin_ok(r.project_id, 'compare') then raise exception 'origin_not_allowed';
  end if;
  if body = '' then raise exception 'empty'; end if;
  -- The site's version, from the published settings, when Versions is on.
  if coalesce((cfg -> 'modules' ->> 'versions')::boolean, false) then ver := left(nullif(btrim(cfg ->> 'version'), ''), 20); end if;
  insert into public.threads (id, project_id, page, anchor, author_name, reviewer, text, kind, version, audio)
  values (coalesce(p_id, gen_random_uuid()), r.project_id, p_page, p_anchor, r.name, r.id::text, body, k, ver, case when k = 'voice' then p_audio end)
  returning * into t;
  return public._thread_json(t, r.id);
end $$;
revoke all on function public.post_thread(text, text, jsonb, text, uuid, text, text) from public, anon;
grant execute on function public.post_thread(text, text, jsonb, text, uuid, text, text) to authenticated;

-- The dashboard and share links: comments by version.
create or replace function public.versions_of(p_project uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare ws uuid;
begin
  select workspace_id into ws from public.projects where id = p_project and deleted_at is null;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  return coalesce((select json_agg(json_build_object('version', v, 'total', n, 'open', o) order by first desc) from (
    select coalesce(version, '') as v, count(*) as n, count(*) filter (where resolved_at is null) as o, min(created_at) as first
    from public.threads where project_id = p_project group by 1) x), '[]'::json);
end $$;
revoke all on function public.versions_of(uuid) from public, anon;
grant execute on function public.versions_of(uuid) to authenticated;
revoke all on all tables in schema public from anon;
