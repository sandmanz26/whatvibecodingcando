-- One paste in the Supabase SQL editor: security hardening (audit 2026-11,
-- migration 20261126120000_security_hardening.sql). Safe to run more than once.
begin;
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
revoke execute on function public.add_owner() from public, anon, authenticated;
revoke execute on function public.projects_fixed() from public, anon, authenticated;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated;
commit;
