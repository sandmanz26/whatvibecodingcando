-- Audit 2026-11: API roles have no TRUNCATE/TRIGGER/REFERENCES, anon has no table grants,
-- trigger functions are not callable, every security definer function pins its search path,
-- every table has row level security, and only the three public functions are open to anon.
do $$ declare n int; begin
  select count(*) into n from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated') and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');
  if n > 0 then raise exception 'FAIL: % truncate/trigger/references grants to API roles', n; end if;
  select count(*) into n from information_schema.role_table_grants where table_schema = 'public' and grantee = 'anon';
  if n > 0 then raise exception 'FAIL: anon has % table grants', n; end if;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prorettype = 'trigger'::regtype
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  if n > 0 then raise exception 'FAIL: % trigger functions callable from the API', n; end if;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  if n > 0 then raise exception 'FAIL: % security definer functions without a pinned search path', n; end if;
  select count(*) into n from pg_class c join pg_namespace s on s.oid = c.relnamespace
   where s.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if n > 0 then raise exception 'FAIL: % tables without row level security', n; end if;
  -- Extension functions (pgcrypto, C language) aside, only these are open to anon.
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
   where s.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     and p.prolang <> (select oid from pg_language where lanname = 'c')
     and p.proname not in ('get_share', 'report_seen', 'study_info', 'gen_random_uuid');
  if n > 0 then raise exception 'FAIL: % unexpected functions open to anon', n; end if;
end $$;
select 'security hardening ok' as result;
