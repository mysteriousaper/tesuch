-- S-1 codes by default: new orgs start with privacy mode on, employees always get a code where names are hidden.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('f4000000-0000-0000-0000-00000000000a', 'owner@cd.test'),
  ('f4000000-0000-0000-0000-00000000000b', 'owner2@cd.test');

create function pg_temp.as_user(p uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', coalesce(p::text, ''), false) $$;
create function pg_temp.expect_rows(p_sql text, p_expected bigint, p_label text) returns void language plpgsql as $$
declare n bigint;
begin
  execute format('with q as (%s) select count(*) from q', p_sql) into n;
  if n <> p_expected then raise exception 'FAIL %: expected % rows, got %', p_label, p_expected, n; end if;
  raise notice 'ok   %', p_label;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

set role authenticated;
select pg_temp.as_user('f4000000-0000-0000-0000-00000000000a');
select public.create_org('Firm CD') as org_a \gset
select pg_temp.as_user('f4000000-0000-0000-0000-00000000000b');
select public.create_org('Firm CD names') as org_b \gset
reset role;
-- org_b is an "existing" firm that stores names
update public.orgs set privacy_mode = false, codes_notice_dismissed = false where id = :'org_b';

select pg_temp.expect_rows(format($q$select 1 from public.orgs where id = %L and privacy_mode and codes_notice_dismissed$q$, :'org_a'), 1, 'new org: codes on, no notice');
select pg_temp.expect_rows(format($q$select 1 from public.orgs where id = %L and not privacy_mode and not codes_notice_dismissed$q$, :'org_b'), 1, 'names firm keeps names and gets the notice');

insert into public.companies (id, org_id, name) values
  ('f4000000-0000-0000-0000-0000000000c1', :'org_a', 'Co A1'),
  ('f4000000-0000-0000-0000-0000000000c2', :'org_a', 'Co A2'),
  ('f4000000-0000-0000-0000-0000000000c3', :'org_b', 'Co B1');

-- privacy firm: code generated, full_name forced to the code, numbering per company
insert into public.employees (id, org_id, company_id, full_name) values
  ('f4000000-0000-0000-0000-0000000000e1', :'org_a', 'f4000000-0000-0000-0000-0000000000c1', 'Real Name');
insert into public.employees (id, org_id, company_id, full_name, employee_code) values
  ('f4000000-0000-0000-0000-0000000000e2', :'org_a', 'f4000000-0000-0000-0000-0000000000c1', 'x', 'EMP-007');
insert into public.employees (id, org_id, company_id, full_name) values
  ('f4000000-0000-0000-0000-0000000000e3', :'org_a', 'f4000000-0000-0000-0000-0000000000c1', 'Another Name'),
  ('f4000000-0000-0000-0000-0000000000e4', :'org_a', 'f4000000-0000-0000-0000-0000000000c2', 'Third Name');
select pg_temp.expect_rows($q$select 1 from public.employees where id = 'f4000000-0000-0000-0000-0000000000e1' and employee_code = 'EMP-001' and full_name = 'EMP-001'$q$, 1, 'missing code generated, name replaced');
select pg_temp.expect_rows($q$select 1 from public.employees where id = 'f4000000-0000-0000-0000-0000000000e2' and employee_code = 'EMP-007' and full_name = 'EMP-007'$q$, 1, 'given code kept, name replaced');
select pg_temp.expect_rows($q$select 1 from public.employees where id = 'f4000000-0000-0000-0000-0000000000e3' and employee_code = 'EMP-002'$q$, 1, 'generated codes count up per company');
select pg_temp.expect_rows($q$select 1 from public.employees where id = 'f4000000-0000-0000-0000-0000000000e4' and employee_code = 'EMP-001'$q$, 1, 'numbering is per company');
insert into public.employees (org_id, company_id, full_name, employee_code) values
  (:'org_a', 'f4000000-0000-0000-0000-0000000000c2', 'x', 'EMP-002');
insert into public.employees (id, org_id, company_id, full_name) values
  ('f4000000-0000-0000-0000-0000000000e6', :'org_a', 'f4000000-0000-0000-0000-0000000000c2', 'Skip Name');
select pg_temp.expect_rows($q$select 1 from public.employees where id = 'f4000000-0000-0000-0000-0000000000e6' and employee_code = 'EMP-003'$q$, 1, 'generation skips a code already taken by hand');
-- bulk insert: rows of one statement get distinct codes
insert into public.employees (org_id, company_id, full_name)
  select :'org_a', 'f4000000-0000-0000-0000-0000000000c1', 'Bulk ' || g from generate_series(1, 50) g;
select pg_temp.expect_rows($q$select 1 from public.employees where company_id = 'f4000000-0000-0000-0000-0000000000c1' and full_name like 'EMP-%'$q$, 53, 'bulk insert: all rows coded');
select pg_temp.expect_rows($q$select 1 from public.employees where full_name like '%Name%' and org_id = (select id from public.orgs where name = 'Firm CD')$q$, 0, 'no real name is stored in a codes firm');

-- names firm: untouched
insert into public.employees (id, org_id, company_id, full_name) values
  ('f4000000-0000-0000-0000-0000000000e5', :'org_b', 'f4000000-0000-0000-0000-0000000000c3', 'Keep Me');
select pg_temp.expect_rows($q$select 1 from public.employees where id = 'f4000000-0000-0000-0000-0000000000e5' and employee_code is null and full_name = 'Keep Me'$q$, 1, 'names firm: no code, name kept');

-- the owner can still dismiss the notice / switch on through the existing owner-only policy
set role authenticated;
select pg_temp.as_user('f4000000-0000-0000-0000-00000000000b');
select pg_temp.expect_rows(format($q$update public.orgs set privacy_mode = true, codes_notice_dismissed = true where id = %L returning id$q$, :'org_b'), 1, 'owner answers the notice');
select pg_temp.as_user('f4000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows(format($q$update public.orgs set codes_notice_dismissed = false where id = %L returning id$q$, :'org_b'), 0, 'foreign owner cannot touch another firm notice');
reset role;
