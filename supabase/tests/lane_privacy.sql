-- Privacy mode: only owners toggle orgs.privacy_mode; employee_code is unique per company and length-checked.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('f3000000-0000-0000-0000-00000000000a', 'owner@pv.test'),
  ('f3000000-0000-0000-0000-00000000000c', 'accountant@pv.test'),
  ('f3000000-0000-0000-0000-00000000000d', 'viewer@pv.test'),
  ('f3000000-0000-0000-0000-00000000000e', 'other-owner@pv.test');

create function pg_temp.as_user(p uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', coalesce(p::text, ''), false) $$;
create function pg_temp.expect_rows(p_sql text, p_expected bigint, p_label text) returns void language plpgsql as $$
declare n bigint;
begin
  execute format('with q as (%s) select count(*) from q', p_sql) into n;
  if n <> p_expected then raise exception 'FAIL %: expected % rows, got %', p_label, p_expected, n; end if;
  raise notice 'ok   %', p_label;
end $$;
create function pg_temp.expect_error(p_sql text, p_state text, p_label text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'FAIL %: statement succeeded', p_label;
exception when others then
  if sqlstate <> p_state then raise exception 'FAIL %: expected %, got % (%)', p_label, p_state, sqlstate, sqlerrm; end if;
  raise notice 'ok   %', p_label;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

set role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000a');
select public.create_org('Firm PV') as org_a \gset
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000e');
select public.create_org('Firm PE') as org_e \gset
reset role;
insert into public.memberships (user_id, org_id, role) values
  ('f3000000-0000-0000-0000-00000000000c', :'org_a', 'accountant'),
  ('f3000000-0000-0000-0000-00000000000d', :'org_a', 'viewer');
insert into public.companies (id, org_id, name) values
  ('f3000000-0000-0000-0000-0000000000c1', :'org_a', 'Co One'),
  ('f3000000-0000-0000-0000-0000000000c2', :'org_a', 'Co Two');

-- default is off
select pg_temp.expect_rows(format($q$select 1 from public.orgs where id = %L and privacy_mode = false$q$, :'org_a'), 1, 'privacy mode defaults to off');

set role authenticated;
-- accountant, viewer and a foreign owner cannot toggle
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000c');
select pg_temp.expect_rows(format($q$update public.orgs set privacy_mode = true where id = %L returning id$q$, :'org_a'), 0, 'accountant cannot toggle');
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000d');
select pg_temp.expect_rows(format($q$update public.orgs set privacy_mode = true where id = %L returning id$q$, :'org_a'), 0, 'viewer cannot toggle');
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000e');
select pg_temp.expect_rows(format($q$update public.orgs set privacy_mode = true where id = %L returning id$q$, :'org_a'), 0, 'foreign owner cannot toggle');
-- owner can, and an owner cannot touch another firm
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows(format($q$update public.orgs set privacy_mode = true where id = %L returning id$q$, :'org_a'), 1, 'owner can turn privacy mode on');
select pg_temp.expect_rows(format($q$update public.orgs set privacy_mode = true where id = %L returning id$q$, :'org_e'), 0, 'owner cannot toggle another firm');
select pg_temp.expect_rows(format($q$select 1 from public.orgs where id = %L and privacy_mode$q$, :'org_a'), 1, 'owner sees the new value');
reset role;
select pg_temp.expect_rows(format($q$select 1 from public.orgs where id = %L and privacy_mode$q$, :'org_e'), 0, 'other firm unchanged');
select pg_temp.expect_rows(format($q$select 1 from public.audit_log where table_name = 'orgs' and org_id = %L and (new_row ->> 'privacy_mode') = 'true' and (old_row ->> 'privacy_mode') = 'false'$q$, :'org_a'), 1, 'toggle is audited');

-- employee_code: accountant (an editor) may store codes; unique per company; length check
set role authenticated;
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000c');
select pg_temp.expect_rows(format($q$insert into public.employees (org_id, company_id, full_name, employee_code) values (%L, 'f3000000-0000-0000-0000-0000000000c1', 'EMP-014', 'EMP-014') returning id$q$, :'org_a'), 1, 'editor can store an employee code');
select pg_temp.expect_error(format($q$insert into public.employees (org_id, company_id, full_name, employee_code) values (%L, 'f3000000-0000-0000-0000-0000000000c1', 'EMP-014', 'EMP-014')$q$, :'org_a'), '23505', 'same code twice in one company is refused');
select pg_temp.expect_rows(format($q$insert into public.employees (org_id, company_id, full_name, employee_code) values (%L, 'f3000000-0000-0000-0000-0000000000c2', 'EMP-014', 'EMP-014') returning id$q$, :'org_a'), 1, 'same code in another company is allowed');
select pg_temp.expect_rows(format($q$insert into public.employees (org_id, company_id, full_name) values (%L, 'f3000000-0000-0000-0000-0000000000c1', 'Name A') returning id$q$, :'org_a'), 1, 'employees without a code stay valid');
select pg_temp.expect_rows(format($q$insert into public.employees (org_id, company_id, full_name) values (%L, 'f3000000-0000-0000-0000-0000000000c1', 'Name B') returning id$q$, :'org_a'), 1, 'several employees may have no code');
select pg_temp.expect_error(format($q$insert into public.employees (org_id, company_id, full_name, employee_code) values (%L, 'f3000000-0000-0000-0000-0000000000c1', 'X', '   ')$q$, :'org_a'), '23514', 'blank code is refused');
select pg_temp.expect_error(format($q$insert into public.employees (org_id, company_id, full_name, employee_code) values (%L, 'f3000000-0000-0000-0000-0000000000c1', 'X', %L)$q$, :'org_a', repeat('x', 41)), '23514', 'code over 40 characters is refused');
select pg_temp.expect_rows(format($q$insert into public.employees (org_id, company_id, full_name, employee_code) values (%L, 'f3000000-0000-0000-0000-0000000000c1', 'Y', %L) returning id$q$, :'org_a', repeat('y', 40)), 1, 'code of exactly 40 characters is allowed');
-- a viewer cannot add employees with codes; a foreign owner cannot see them
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$insert into public.employees (org_id, company_id, full_name, employee_code) values (%L, 'f3000000-0000-0000-0000-0000000000c1', 'V', 'V-1')$q$, :'org_a'), '42501', 'viewer cannot add an employee with a code');
select pg_temp.as_user('f3000000-0000-0000-0000-00000000000e');
select pg_temp.expect_rows($q$select 1 from public.employees where employee_code is not null$q$, 0, 'foreign owner cannot read codes');
reset role;
