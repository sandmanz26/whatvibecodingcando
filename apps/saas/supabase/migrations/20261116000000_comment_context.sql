-- Vibe Collab: comments carry the site version whenever it is set, and their anchor stays small.
--
-- The site version used to need the Versions product; it is now a plain setting of the widget
-- (Widget → Site version), so post_thread records it whenever the published settings have one.
-- The anchor (where the comment sits, and now the reviewer's browser, system and screen size, for
-- bug reports) must be a JSON object of at most 4,000 characters.

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
  -- Where the comment sits, plus the reviewer's browser, system and screen size: small JSON only.
  if p_anchor is null or jsonb_typeof(p_anchor) <> 'object' or length(p_anchor::text) > 4000 then raise exception 'bad_anchor'; end if;
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
  -- The site's version, from the published settings, whenever the owner set one (Widget → Site version).
  ver := left(nullif(btrim(cfg ->> 'version'), ''), 20);
  insert into public.threads (id, project_id, page, anchor, author_name, reviewer, text, kind, version, audio)
  values (coalesce(p_id, gen_random_uuid()), r.project_id, p_page, p_anchor, r.name, r.id::text, body, k, ver, case when k = 'voice' then p_audio end)
  returning * into t;
  return public._thread_json(t, r.id);
end $$;
revoke all on function public.post_thread(text, text, jsonb, text, uuid, text, text) from public, anon;
grant execute on function public.post_thread(text, text, jsonb, text, uuid, text, text) to authenticated;
