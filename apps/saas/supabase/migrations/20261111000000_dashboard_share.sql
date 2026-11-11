-- Vibe Collab: the project dashboard, clearing data, and sharing the comment list by link.
--
-- Dashboard numbers are counted here, in one call, so the panel never downloads every comment to
-- show a total. Share links give a read-only copy of a project's comments to anyone with the link
-- (a teammate without an account, a client): only a SHA-256 of the token is stored, links can be
-- limited to open or completed comments, expire, and be revoked.

-- ---------- dashboard ----------

create or replace function public.project_stats(p_project uuid) returns json
language plpgsql stable security definer set search_path = public as $$
declare ws uuid;
begin
  select workspace_id into ws from public.projects where id = p_project and deleted_at is null;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  return json_build_object(
    'open',      (select count(*) from public.threads t where t.project_id = p_project and t.resolved_at is null and not exists (select 1 from public.replies r where r.thread_id = t.id)),
    'ongoing',   (select count(*) from public.threads t where t.project_id = p_project and t.resolved_at is null and exists (select 1 from public.replies r where r.thread_id = t.id)),
    'completed', (select count(*) from public.threads t where t.project_id = p_project and t.resolved_at is not null),
    'replies',   (select count(*) from public.replies r join public.threads t on t.id = r.thread_id where t.project_id = p_project),
    'reviewers', (select count(*) from public.reviewers where project_id = p_project),
    'active_reviewers', (select count(*) from public.reviewers where project_id = p_project and last_seen > now() - interval '7 days'),
    'last_comment', (select max(created_at) from public.threads where project_id = p_project),
    -- comments per day, last 14 days (days without comments included, as 0)
    'per_day', (select json_agg(json_build_object('day', d::date, 'n', coalesce(c.n, 0)) order by d)
                from generate_series(current_date - 13, current_date, interval '1 day') d
                left join (select created_at::date as day, count(*) n from public.threads where project_id = p_project and created_at >= current_date - 13 group by 1) c on c.day = d::date),
    'pages', coalesce((select json_agg(x order by x.total desc, x.page) from (
                select page, count(*) as total, count(*) filter (where resolved_at is null) as open
                from public.threads where project_id = p_project group by page order by count(*) desc, page limit 10) x), '[]'::json),
    'sites', coalesce((select json_agg(json_build_object('host', host, 'last_seen', last_seen, 'version', version, 'shown', shown, 'why', why) order by last_seen desc)
                from public.installs where project_id = p_project), '[]'::json)
  );
end $$;

-- ---------- clearing data (members) ----------

create policy "members clear installation reports" on public.installs for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

-- Review links not used up yet stop working (reviewers already in keep their session until removed).
create or replace function public.revoke_review_links(p_project uuid) returns int
language plpgsql security definer set search_path = public as $$
declare ws uuid; n int;
begin
  select workspace_id into ws from public.projects where id = p_project;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  delete from public.handoffs where project_id = p_project;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- share links for the comment list ----------

create table public.shares (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  token_hash    text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label         text check (char_length(label) <= 80),
  status_filter text not null default 'all' check (status_filter in ('all', 'open', 'completed')),
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz,
  revoked_at    timestamptz,
  views         int not null default 0,
  last_viewed   timestamptz
);
create index on public.shares (project_id);
alter table public.shares enable row level security;
create policy "members see their projects' share links" on public.shares for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members revoke share links" on public.shares for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members delete share links" on public.shares for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

-- A share link token (members only). p_days null: no expiry.
create or replace function public.create_share(p_project uuid, p_label text default null, p_status text default 'all', p_days int default 30)
returns text
language plpgsql security definer set search_path = public as $$
declare ws uuid; tok text;
begin
  select workspace_id into ws from public.projects where id = p_project and deleted_at is null;
  if ws is null or not public.has_role(ws) then raise exception 'not_allowed'; end if;
  if not public.take_rate('share:' || auth.uid(), 20) then raise exception 'rate_limited'; end if;
  if coalesce(p_status, 'all') not in ('all', 'open', 'completed') then raise exception 'bad_filter'; end if;
  tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.shares (project_id, token_hash, label, status_filter, created_by, expires_at)
  values (p_project, encode(sha256(convert_to(tok, 'UTF8')), 'hex'), public._clean(p_label, 80), coalesce(p_status, 'all'), auth.uid(),
          case when p_days is null then null else now() + make_interval(days => least(greatest(p_days, 1), 365)) end);
  return tok;
end $$;

-- What a share link shows: read-only, for anyone with the link (no account needed).
create or replace function public.get_share(p_token text) returns json
language plpgsql security definer set search_path = public as $$
declare
  s public.shares;
  pr public.projects;
  h text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
begin
  if not public.take_rate('view:' || h, 60) then raise exception 'rate_limited'; end if;
  select * into s from public.shares where token_hash = h;
  if s.id is null or s.revoked_at is not null or (s.expires_at is not null and s.expires_at < now()) then raise exception 'share_unavailable'; end if;
  select * into pr from public.projects where id = s.project_id and deleted_at is null;
  if pr.id is null then raise exception 'share_unavailable'; end if;
  update public.shares set views = views + 1, last_viewed = now() where id = s.id;
  return json_build_object(
    'project', pr.name, 'site', pr.site_url, 'label', s.label, 'filter', s.status_filter,
    'created_at', s.created_at, 'expires_at', s.expires_at,
    'threads', coalesce((select json_agg(json_build_object(
        'page', t.page, 'author', t.author_name, 'text', t.text, 'createdAt', t.created_at, 'editedAt', t.edited_at,
        'resolved', case when t.resolved_at is null then null else json_build_object('by', t.resolved_by, 'at', t.resolved_at) end,
        'replies', coalesce((select json_agg(json_build_object('author', r.author_name, 'text', r.text, 'at', r.created_at) order by r.created_at)
                             from public.replies r where r.thread_id = t.id), '[]'::json)
      ) order by t.created_at)
      from public.threads t
      where t.project_id = pr.id
        and (s.status_filter = 'all' or (s.status_filter = 'open' and t.resolved_at is null) or (s.status_filter = 'completed' and t.resolved_at is not null))), '[]'::json)
  );
end $$;

revoke all on function public.project_stats(uuid), public.revoke_review_links(uuid), public.create_share(uuid, text, text, int), public.get_share(text) from public, anon;
grant execute on function public.project_stats(uuid), public.revoke_review_links(uuid), public.create_share(uuid, text, text, int) to authenticated;
-- Opening a share link needs no account.
grant execute on function public.get_share(text) to anon, authenticated;
revoke all on all tables in schema public from anon;
