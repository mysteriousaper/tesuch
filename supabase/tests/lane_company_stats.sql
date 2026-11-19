-- C-2: company_stats aggregates in the database, so counts beyond the 1000-row API cap stay exact.
\set ON_ERROR_STOP on
\set QUIET on
insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-00000000000a', 'a@stats.test'),
  ('f1000000-0000-0000-0000-00000000000b', 'b@stats.test');
create function pg_temp.as_user(p uuid) returns void language sql as $$ select set_config('request.jwt.claim.sub', coalesce(p::text, ''), false) $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

set role authenticated;
select pg_temp.as_user('f1000000-0000-0000-0000-00000000000a');
select public.create_org('Stats A') as org_a \gset
select pg_temp.as_user('f1000000-0000-0000-0000-00000000000b');
select public.create_org('Stats B') as org_b \gset
reset role;

insert into public.companies (org_id, name) values (:'org_a', 'Big Co') returning id as co \gset
insert into public.companies (org_id, name) values (:'org_b', 'Other Co') returning id as co_b \gset
insert into public.employees (org_id, company_id, full_name)
  select :'org_a', :'co', 'Emp ' || g from generate_series(1, 1200) g;
insert into public.employees (org_id, company_id, full_name, archived_at)
  select :'org_a', :'co', 'Old ' || g, now() from generate_series(1, 5) g;
insert into public.employees (org_id, company_id, full_name) values (:'org_b', :'co_b', 'B1');
insert into public.rules (id, version, article, status, definition, source_url)
  values ('stats-test', 1, null, 'needs_lawyer_review', '{}', 'https://www.arlis.am/x') on conflict do nothing;
insert into public.findings (org_id, company_id, employee_id, rule_id, rule_version, severity, due_date)
  select e.org_id, e.company_id, e.id, 'stats-test', 1,
         case when n % 2 = 0 then 'info' else 'amber' end::public.finding_severity,
         case when n <= 300 then date '2020-01-01' else date '2099-01-01' end
    from (select *, row_number() over () n from public.employees where company_id = :'co' and archived_at is null) e;

set role authenticated;
select pg_temp.as_user('f1000000-0000-0000-0000-00000000000a');
do $$
declare staff bigint; open_total bigint; amber_over bigint;
begin
  select sum(n) into staff from public.company_stats((select id from public.orgs where name = 'Stats A'), date '2026-11-19') where kind = 'staff';
  select sum(n) into open_total from public.company_stats((select id from public.orgs where name = 'Stats A'), date '2026-11-19') where kind <> 'staff';
  select sum(n) into amber_over from public.company_stats((select id from public.orgs where name = 'Stats A'), date '2026-11-19') where kind = 'amber' and overdue;
  if staff <> 1200 then raise exception 'FAIL staff: expected 1200 (archived excluded), got %', staff; end if;
  if open_total <> 1200 then raise exception 'FAIL open findings: expected 1200, got %', open_total; end if;
  if amber_over <> 150 then raise exception 'FAIL overdue amber: expected 150, got %', amber_over; end if;
  raise notice 'ok   company_stats exact above 1000 rows (staff %, open %, overdue amber %)', staff, open_total, amber_over;
end $$;
-- Cross-tenant: A asks for B's org -> nothing.
do $$
declare n bigint;
begin
  select count(*) into n from public.company_stats((select id from public.orgs where name = 'Stats B'), date '2026-11-19');
  if n <> 0 then raise exception 'FAIL company_stats leaked % rows of another org', n; end if;
  raise notice 'ok   company_stats shows nothing for another org';
end $$;
reset role;
set role anon;
do $$ begin
  begin perform * from public.company_stats(gen_random_uuid(), date '2026-11-19'); raise exception 'FAIL anon could call company_stats';
  exception when insufficient_privilege then raise notice 'ok   anon cannot call company_stats'; end;
end $$;
reset role;
\echo Company stats tests: all passed
