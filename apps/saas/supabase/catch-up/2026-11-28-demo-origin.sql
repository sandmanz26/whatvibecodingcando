begin;
-- The hosted demo page (embed-demo.html) moved to the ourhunch.com domain: allow it there too
-- (the old vercel.app address stays, customers' links may still use it).
insert into public.allowed_origins (origin, note)
select v.origin, 'hosted demo site'
from (values ('https://ourhunch.com'), ('https://www.ourhunch.com')) v (origin)
where not exists (select 1 from public.allowed_origins a where a.origin = v.origin);
commit;
