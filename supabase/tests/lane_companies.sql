-- M-10: company update/delete are owner-only; accountants and viewers are refused; cascade + audit rows remain.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('f2000000-0000-0000-0000-00000000000a', 'owner@co.test'),
  ('f2000000-0000-0000-0000-00000000000c', 'accountant@co.test'),
  ('f2000000-0000-0000-0000-00000000000d', 'viewer@co.test'),
  ('f2000000-0000-0000-0000-00000000000e', 'other-owner@co.test');

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
select pg_temp.as_user('f2000000-0000-0000-0000-00000000000a');
select public.create_org('Firm CO') as org_a \gset
select pg_temp.as_user('f2000000-0000-0000-0000-00000000000e');
select public.create_org('Firm CE') as org_e \gset
reset role;
insert into public.memberships (user_id, org_id, role) values
  ('f2000000-0000-0000-0000-00000000000c', :'org_a', 'accountant'),
  ('f2000000-0000-0000-0000-00000000000d', :'org_a', 'viewer');

insert into public.companies (id, org_id, name) values
  ('f2000000-0000-0000-0000-0000000000c1', :'org_a', 'Co One'),
  ('f2000000-0000-0000-0000-0000000000c2', :'org_a', 'Co Two');
insert into public.employees (id, org_id, company_id, full_name) values
  ('f2000000-0000-0000-0000-0000000000e1', :'org_a', 'f2000000-0000-0000-0000-0000000000c2', 'Emp');

set role authenticated;
-- accountant: may insert, may not update or delete
select pg_temp.as_user('f2000000-0000-0000-0000-00000000000c');
select pg_temp.expect_rows(format($q$insert into public.companies (org_id, name) values (%L, 'By accountant') returning id$q$, :'org_a'), 1, 'accountant can still add a company');
select pg_temp.expect_rows($q$update public.companies set name = 'Hacked' where id = 'f2000000-0000-0000-0000-0000000000c1' returning id$q$, 0, 'accountant cannot update a company');
select pg_temp.expect_rows($q$delete from public.companies where id = 'f2000000-0000-0000-0000-0000000000c1' returning id$q$, 0, 'accountant cannot delete a company');
-- viewer
select pg_temp.as_user('f2000000-0000-0000-0000-00000000000d');
select pg_temp.expect_rows($q$update public.companies set name = 'Hacked' where id = 'f2000000-0000-0000-0000-0000000000c1' returning id$q$, 0, 'viewer cannot update a company');
select pg_temp.expect_rows($q$delete from public.companies where id = 'f2000000-0000-0000-0000-0000000000c1' returning id$q$, 0, 'viewer cannot delete a company');
-- owner of another firm
select pg_temp.as_user('f2000000-0000-0000-0000-00000000000e');
select pg_temp.expect_rows($q$update public.companies set name = 'Hacked' where id = 'f2000000-0000-0000-0000-0000000000c1' returning id$q$, 0, 'foreign owner cannot update');
select pg_temp.expect_rows($q$delete from public.companies where id = 'f2000000-0000-0000-0000-0000000000c1' returning id$q$, 0, 'foreign owner cannot delete');
-- owner
select pg_temp.as_user('f2000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows($q$update public.companies set name = 'Renamed', tax_id = '12345678' where id = 'f2000000-0000-0000-0000-0000000000c1' returning id$q$, 1, 'owner can update');
select pg_temp.expect_rows($q$delete from public.companies where id = 'f2000000-0000-0000-0000-0000000000c2' returning id$q$, 1, 'owner can delete');
select pg_temp.expect_rows($q$select 1 from public.employees where id = 'f2000000-0000-0000-0000-0000000000e1'$q$, 0, 'delete cascades to employees');
reset role;
select pg_temp.expect_rows($q$select 1 from public.audit_log where table_name = 'companies' and action = 'delete' and row_id = 'f2000000-0000-0000-0000-0000000000c2'$q$, 1, 'delete is audited');
select pg_temp.expect_rows($q$select 1 from public.audit_log where table_name = 'companies' and action = 'update' and row_id = 'f2000000-0000-0000-0000-0000000000c1'$q$, 1, 'update is audited');
