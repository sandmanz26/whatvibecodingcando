-- Vibe Collab: email notifications for new feedback.
--
-- How it works:
-- 1. A new comment (threads) or a reviewer's reply (replies) puts one row in email_outbox (trigger).
-- 2. Every few minutes pg_cron calls the Edge Function `send-emails` (supabase/functions), which asks
--    email_due() what to send, sends it with Resend and calls email_done() with the rows it sent.
-- 3. Each project chooses how its members are told (projects.notify): 'instant' (grouped, at most one
--    email per project per run), 'daily' (one summary a day) or 'off'.
--
-- The outbox and both functions are for the service role only: no policy, no grant to anon or
-- authenticated. Recipients are the project's workspace members (their sign-in email); reviewers and
-- participants never get these emails.

alter table public.projects add column if not exists notify text not null default 'instant'
  check (notify in ('instant', 'daily', 'off'));

create table if not exists public.email_outbox (
  id          bigint generated always as identity primary key,
  project_id  uuid not null references public.projects (id) on delete cascade,
  thread_id   uuid references public.threads (id) on delete cascade,
  reply_id    uuid references public.replies (id) on delete cascade,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index if not exists email_outbox_pending_idx on public.email_outbox (project_id, id) where sent_at is null;
create index if not exists email_outbox_sent_idx on public.email_outbox (sent_at) where sent_at is not null;
create index if not exists email_outbox_thread_idx on public.email_outbox (thread_id);
create index if not exists email_outbox_reply_idx on public.email_outbox (reply_id);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public, anon, authenticated;

-- New comments always count; replies only when a reviewer wrote them (not the team, in the panel).
create or replace function public._email_enqueue_thread() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.email_outbox (project_id, thread_id) values (new.project_id, new.id);
  return new;
end $$;
create or replace function public._email_enqueue_reply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reviewer is not null then
    insert into public.email_outbox (project_id, thread_id, reply_id)
    select t.project_id, t.id, new.id from public.threads t where t.id = new.thread_id;
  end if;
  return new;
end $$;
drop trigger if exists email_on_thread on public.threads;
create trigger email_on_thread after insert on public.threads for each row execute function public._email_enqueue_thread();
drop trigger if exists email_on_reply on public.replies;
create trigger email_on_reply after insert on public.replies for each row execute function public._email_enqueue_reply();
revoke all on function public._email_enqueue_thread() from public, anon, authenticated;
revoke all on function public._email_enqueue_reply() from public, anon, authenticated;

-- What to send now: one entry per project with pending feedback ('instant' projects, or 'daily' ones
-- when p_daily), its members' emails, and up to 20 items (newest last). Pending rows of projects set
-- to 'off' are marked as handled so the outbox doesn't grow.
create or replace function public.email_due(p_daily boolean default false) returns json
language plpgsql security definer set search_path = public as $$
begin
  update public.email_outbox o set sent_at = now()
    from public.projects p where p.id = o.project_id and o.sent_at is null and (p.notify = 'off' or p.deleted_at is not null);
  return coalesce((
    select json_agg(x order by x->>'project_name') from (
      select json_build_object(
        'project_id', p.public_id,
        'project_name', p.name,
        'site_url', p.site_url,
        'outbox_ids', (select json_agg(o.id order by o.id) from public.email_outbox o where o.project_id = p.id and o.sent_at is null),
        'total', (select count(*) from public.email_outbox o where o.project_id = p.id and o.sent_at is null),
        'recipients', (select coalesce(json_agg(distinct u.email), '[]'::json) from public.workspace_members m join auth.users u on u.id = m.user_id
                       where m.workspace_id = p.workspace_id and u.email is not null),
        'items', (select coalesce(json_agg(i order by i.at), '[]'::json) from (
          select o.id, o.created_at as at, case when o.reply_id is null then 'comment' else 'reply' end as type,
                 t.kind, t.page, t.id as thread_id,
                 coalesce(r.author_name, t.author_name) as author, left(coalesce(r.text, t.text), 500) as text
            from public.email_outbox o join public.threads t on t.id = o.thread_id
            left join public.replies r on r.id = o.reply_id
           where o.project_id = p.id and o.sent_at is null
           order by o.id desc limit 20) i)
      ) as x
      from public.projects p
      where p.deleted_at is null
        and p.notify = case when p_daily then 'daily' else 'instant' end
        and exists (select 1 from public.email_outbox o where o.project_id = p.id and o.sent_at is null)
      limit 200
    ) q), '[]'::json);
end $$;

-- The rows that were emailed (or given up on). Sent rows older than 30 days are removed.
create or replace function public.email_done(p_ids bigint[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.email_outbox set sent_at = now() where id = any (p_ids) and sent_at is null;
  delete from public.email_outbox where ctid = any (array(select ctid from public.email_outbox where sent_at < now() - interval '30 days' limit 5000));
end $$;

revoke all on function public.email_due(boolean) from public, anon, authenticated;
revoke all on function public.email_done(bigint[]) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.email_due(boolean) to service_role;
    grant execute on function public.email_done(bigint[]) to service_role;
    grant select, update, delete on public.email_outbox to service_role;
  end if;
end $$;
