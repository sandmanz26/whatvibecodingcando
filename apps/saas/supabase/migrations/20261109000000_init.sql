-- Vibe Collab: first schema.
--
-- Who touches what:
--   * The panel (people signed in with Supabase Auth) reads and writes its own workspace's rows,
--     guarded by row level security below.
--   * The script on customers' sites never talks to these tables. Reviewers go through Edge
--     Functions (redeem, comments, ping) that check the review session, the site's origin and
--     rate limits, and use the service role. Anonymous access is refused everywhere.
--   * Widget settings reach the script as a static JSON file on the CDN, written on publish, so
--     page views of customers' sites never reach the database.

create extension if not exists pgcrypto;

-- ---------- workspaces and members ----------

create table public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 80),
  created_by  uuid not null references auth.users (id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

-- Is the signed-in user a member (or at least `min_role`) of this workspace?
-- security definer so policies can call it without recursing into workspace_members' own policy.
create or replace function public.has_role(ws uuid, min_role text default 'member')
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
      and case min_role when 'owner' then m.role = 'owner'
                        when 'admin' then m.role in ('owner', 'admin')
                        else true end
  )
$$;
revoke all on function public.has_role(uuid, text) from public;
grant execute on function public.has_role(uuid, text) to authenticated;

-- Creating a workspace makes its creator the owner, in the same transaction.
create or replace function public.add_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role) values (new.id, new.created_by, 'owner');
  return new;
end $$;
create trigger workspaces_add_owner after insert on public.workspaces for each row execute function public.add_owner();

-- ---------- projects and widget settings ----------

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- what goes in the snippet (data-project): unique across all customers, never changes
  public_id    text not null unique check (public_id ~ '^[a-z0-9][a-z0-9-]{2,63}$'),
  name         text not null check (char_length(name) between 1 and 60),
  site_url     text not null default '' check (site_url = '' or site_url ~ '^https?://[^/\s]+$'),
  products     text[] not null default '{comments}',
  -- the builder's draft; published versions are in releases
  draft        jsonb,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on public.projects (workspace_id);

create table public.releases (
  id          bigint generated always as identity primary key,
  project_id  uuid not null references public.projects (id) on delete cascade,
  version     int not null check (version > 0),
  config      jsonb not null,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (project_id, version)
);

-- ---------- reviewers ----------

create table public.invites (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  email       text not null check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(email) <= 254),
  role        text not null default 'reviewer' check (role in ('reviewer', 'member', 'admin')),
  invited_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  unique (project_id, email)
);

-- One-time review links. Only a SHA-256 of the token is stored: a leaked table can't open sites.
create table public.handoffs (
  token_hash  text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  project_id  uuid not null references public.projects (id) on delete cascade,
  created_by  uuid references auth.users (id) on delete set null,
  preview     boolean not null default false,
  expires_at  timestamptz not null,
  used_at     timestamptz
);
create index on public.handoffs (expires_at);

-- ---------- comments ----------

create table public.threads (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects (id) on delete cascade,
  page         text not null check (page ~ '^/' and page !~ '^//' and char_length(page) <= 2000),
  anchor       jsonb not null check (jsonb_typeof(anchor) = 'object' and char_length(anchor->>'sel') <= 400),
  author_name  text not null check (char_length(author_name) between 1 and 80),
  -- a panel user, or null for a reviewer who came in through a review link
  author_id    uuid references auth.users (id) on delete set null,
  reviewer     text check (char_length(reviewer) <= 64),
  text         text not null check (char_length(text) between 1 and 4000),
  created_at   timestamptz not null default now(),
  edited_at    timestamptz,
  resolved_at  timestamptz,
  resolved_by  text check (char_length(resolved_by) <= 80)
);
create index on public.threads (project_id, created_at desc);

create table public.replies (
  id          uuid primary key default gen_random_uuid(),
  thread_id   uuid not null references public.threads (id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  author_id   uuid references auth.users (id) on delete set null,
  reviewer    text check (char_length(reviewer) <= 64),
  text        text not null check (char_length(text) between 1 and 4000),
  created_at  timestamptz not null default now()
);
create index on public.replies (thread_id, created_at);

-- ---------- what the script reports (installation check) ----------

create table public.installs (
  project_id  uuid not null references public.projects (id) on delete cascade,
  host        text not null check (char_length(host) <= 255),
  last_seen   timestamptz not null default now(),
  version     text not null check (char_length(version) <= 20),
  shown       boolean not null,
  why         text not null default '' check (char_length(why) <= 200),
  primary key (project_id, host)
);

-- ---------- rate limits (used by the Edge Functions) ----------

create table public.rate_hits (
  bucket  text not null,
  minute  timestamptz not null,
  hits    int not null default 1,
  primary key (bucket, minute)
);
-- Counts a hit for a bucket (a reviewer, an IP) and says whether it is still under `max` per minute.
create or replace function public.take_rate(b text, max_per_minute int) returns boolean
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into public.rate_hits (bucket, minute) values (b, date_trunc('minute', now()))
  on conflict (bucket, minute) do update set hits = public.rate_hits.hits + 1
  returning hits into n;
  return n <= max_per_minute;
end $$;
revoke all on function public.take_rate(text, int) from public, anon, authenticated;

-- ---------- row level security: the panel's access ----------

alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.projects          enable row level security;
alter table public.releases          enable row level security;
alter table public.invites           enable row level security;
alter table public.handoffs          enable row level security;
alter table public.threads           enable row level security;
alter table public.replies           enable row level security;
alter table public.installs          enable row level security;
alter table public.rate_hits         enable row level security;
-- handoffs and rate_hits have no policies at all: only the Edge Functions (service role) touch them.

-- The creator too: "insert ... returning" reads the row before the owner membership exists.
create policy "members read their workspaces" on public.workspaces for select to authenticated using (public.has_role(id) or created_by = auth.uid());
create policy "anyone signed in creates a workspace they own" on public.workspaces for insert to authenticated with check (created_by = auth.uid());
create policy "admins rename" on public.workspaces for update to authenticated using (public.has_role(id, 'admin')) with check (public.has_role(id, 'admin'));
create policy "owners delete" on public.workspaces for delete to authenticated using (public.has_role(id, 'owner'));

create policy "members see the team" on public.workspace_members for select to authenticated using (public.has_role(workspace_id));
-- Admins add, change and remove members, but never an owner, and never make one: ownership changes only by hand.
create policy "admins add members" on public.workspace_members for insert to authenticated
  with check (public.has_role(workspace_id, 'admin') and role <> 'owner');
create policy "admins change members" on public.workspace_members for update to authenticated
  using (public.has_role(workspace_id, 'admin') and role <> 'owner') with check (public.has_role(workspace_id, 'admin') and role <> 'owner');
create policy "admins remove members, or anyone leaves" on public.workspace_members for delete to authenticated
  using (role <> 'owner' and (public.has_role(workspace_id, 'admin') or user_id = auth.uid()));

create policy "members read projects" on public.projects for select to authenticated using (public.has_role(workspace_id));
create policy "admins create projects" on public.projects for insert to authenticated with check (public.has_role(workspace_id, 'admin'));
create policy "members edit projects" on public.projects for update to authenticated using (public.has_role(workspace_id)) with check (public.has_role(workspace_id));
create policy "admins delete projects" on public.projects for delete to authenticated using (public.has_role(workspace_id, 'admin'));
-- The snippet's id and the workspace never change once a project exists.
create or replace function public.projects_fixed() returns trigger language plpgsql as $$
begin
  if new.public_id <> old.public_id or new.workspace_id <> old.workspace_id then
    raise exception 'public_id and workspace_id cannot change';
  end if;
  return new;
end $$;
create trigger projects_fixed before update on public.projects for each row execute function public.projects_fixed();

-- Releases are written only by the publish function (it also writes the CDN file); the panel reads them.
create policy "members read releases" on public.releases for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

create policy "members read invites" on public.invites for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members invite" on public.invites for insert to authenticated
  with check (invited_by = auth.uid() and exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "admins remove invites" on public.invites for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id, 'admin')));

create policy "members read comments" on public.threads for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members resolve or edit comments" on public.threads for update to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)))
  with check (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));
create policy "members delete comments" on public.threads for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

create policy "members read replies" on public.replies for select to authenticated
  using (exists (select 1 from public.threads t join public.projects p on p.id = t.project_id where t.id = thread_id and public.has_role(p.workspace_id)));
create policy "members reply" on public.replies for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.threads t join public.projects p on p.id = t.project_id where t.id = thread_id and public.has_role(p.workspace_id)));
create policy "members delete replies" on public.replies for delete to authenticated
  using (exists (select 1 from public.threads t join public.projects p on p.id = t.project_id where t.id = thread_id and public.has_role(p.workspace_id)));

create policy "members read installs" on public.installs for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and public.has_role(p.workspace_id)));

-- Nothing for anon: the script and its reviewers go through the Edge Functions.
-- (Supabase grants new tables to anon by default: every later migration that adds a table repeats this.)
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
