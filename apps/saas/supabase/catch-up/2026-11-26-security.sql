-- One paste in the Supabase SQL editor: security hardening (audit 2026-11,
-- migration 20261126230000_security_hardening.sql). Run it after 2026-11-26-billing.sql.
-- Safe to run more than once.
begin;
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
-- Every trigger function in public (add_owner, projects_fixed, billing checks, …).
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prorettype = 'trigger'::regtype loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;
commit;
