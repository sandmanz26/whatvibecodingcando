-- Security hardening (audit 2026-11). Defence in depth, no behaviour change for the app:
-- 1. The API roles never need TRUNCATE, TRIGGER or REFERENCES. TRUNCATE in particular ignores
--    row level security, so it must never be granted to anon or authenticated, even though the
--    REST API does not expose it today.
-- 2. Trigger functions are not callable from the API.
-- 3. Tables and functions created later are not granted to anon by default.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
revoke execute on function public.add_owner() from public, anon, authenticated;
revoke execute on function public.projects_fixed() from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;
