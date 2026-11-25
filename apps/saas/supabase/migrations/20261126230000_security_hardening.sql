-- Security hardening (audit 2026-11). Defence in depth, no behaviour change for the app:
-- 1. The API roles never need TRUNCATE, TRIGGER or REFERENCES. TRUNCATE in particular ignores
--    row level security, so it must never be granted to anon or authenticated, even though the
--    REST API does not expose it today.
-- 2. Trigger functions are not callable from the API.
-- 3. Tables and functions created later are not granted to anon by default.
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
