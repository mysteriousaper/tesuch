-- Cross-tenant attack tests. Any failure raises and stops psql (ON_ERROR_STOP).
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'), -- owner of firm A
  ('bbbbbbbb-0000-0000-0000-000000000001'), -- owner of firm B
  ('aaaaaaaa-0000-0000-0000-000000000002'), -- viewer in firm A
  ('cccccccc-0000-0000-0000-000000000001'); -- no org

insert into public.rules (id, version, article, status, definition, source_url)
values ('probation-max', 1, '92', 'needs_lawyer_review', '{}', 'https://www.arlis.am/');

create function pg_temp.as_user(p uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', coalesce(p::text, ''), false) $$;
create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then raise notice 'ok   % [%]', p_label, sqlerrm; return; end;
  raise exception 'FAIL % (statement succeeded): %', p_label, p_sql;
end $$;
create function pg_temp.expect_rows(p_sql text, p_expected bigint, p_label text) returns void language plpgsql as $$
declare n bigint;
begin
  execute format('select count(*) from (%s) q', p_sql) into n;
  if n <> p_expected then raise exception 'FAIL %: expected % rows, got %', p_label, p_expected, n; end if;
  raise notice 'ok   %', p_label;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- ----- Setup through the public RPC, as real users would -----
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.create_org('Firm A') as org_a \gset
insert into public.companies (org_id, name) values (:'org_a', 'A Co') returning id as co_a \gset
insert into public.employees (org_id, company_id, full_name) values (:'org_a', :'co_a', 'Test Employee A') returning id as emp_a \gset
-- Clients cannot insert memberships (only create_org / accept_invitation); seed the viewer as setup.
reset role;
insert into public.memberships (user_id, org_id, role) values ('aaaaaaaa-0000-0000-0000-000000000002', :'org_a', 'viewer');
set role authenticated;

select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000001');
select public.create_org('Firm B') as org_b \gset
insert into public.companies (org_id, name) values (:'org_b', 'B Co') returning id as co_b \gset
insert into public.employees (org_id, company_id, full_name) values (:'org_b', :'co_b', 'Test Employee B') returning id as emp_b \gset

reset role;
insert into public.findings (org_id, company_id, employee_id, rule_id, rule_version, severity, due_date)
values (:'org_a', :'co_a', :'emp_a', 'probation-max', 1, 'advisory', '2026-02-01') returning id as f_a \gset
set role authenticated;

-- ----- Firm B owner attacks firm A -----
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000001');
select pg_temp.expect_rows('select * from public.orgs', 1, 'B sees only its own org');
select pg_temp.expect_rows(format('select * from public.companies where org_id = %L', :'org_a'), 0, 'B cannot read A companies');
select pg_temp.expect_rows(format('select * from public.employees where org_id = %L', :'org_a'), 0, 'B cannot read A employees');
select pg_temp.expect_rows('select * from public.findings', 0, 'B cannot read A findings');
select pg_temp.expect_rows(format('select * from public.memberships where org_id = %L', :'org_a'), 0, 'B cannot read A memberships');
select pg_temp.expect_error(format('insert into public.companies (org_id, name) values (%L, %L)', :'org_a', 'evil'), 'B cannot insert into A');
select pg_temp.expect_error(format('insert into public.memberships (user_id, org_id, role) values (%L, %L, %L)', 'bbbbbbbb-0000-0000-0000-000000000001', :'org_a', 'owner'), 'B cannot join A');
select pg_temp.expect_error(format('update public.companies set org_id = %L where id = %L', :'org_a', :'co_b'), 'B cannot move its company into A');
select pg_temp.expect_error(format('insert into public.employees (org_id, company_id, full_name) values (%L, %L, %L)', :'org_b', :'co_a', 'x'), 'B cannot attach employee to A company (composite FK)');
-- Silent no-ops: RLS hides the rows, so updates/deletes affect 0 rows.
update public.companies set name = 'pwned' where id = :'co_a';
delete from public.employees where id = :'emp_a';
update public.findings set status = 'fixed' where id = :'f_a';

-- ----- Viewer in firm A is read-only -----
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000002');
select pg_temp.expect_rows('select * from public.companies', 1, 'viewer reads A');
select pg_temp.expect_error(format('insert into public.companies (org_id, name) values (%L, %L)', :'org_a', 'x'), 'viewer cannot insert');
select pg_temp.expect_error(format('insert into public.memberships (user_id, org_id, role) values (%L, %L, %L)', 'cccccccc-0000-0000-0000-000000000001', :'org_a', 'owner'), 'viewer cannot add members');
select pg_temp.expect_rows('select * from public.audit_log', 0, 'viewer cannot read audit log');

-- ----- User with no org sees nothing; anon sees nothing -----
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000001');
select pg_temp.expect_rows('select * from public.orgs', 0, 'outsider sees no orgs');
select pg_temp.expect_rows('select * from public.employees', 0, 'outsider sees no employees');
reset role;
set role anon;
select pg_temp.as_user(null);
select pg_temp.expect_error('select * from public.employees', 'anon has no table access');
select pg_temp.expect_error($q$select public.create_org('x')$q$, 'anon cannot create orgs');
reset role;

-- ----- Firm A owner: data intact, findings guard, audit -----
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.expect_rows($q$select * from public.companies where name = 'A Co'$q$, 1, 'A data untouched by B');
select pg_temp.expect_rows($q$select * from public.findings where status = 'open'$q$, 1, 'A finding still open');
select pg_temp.expect_rows('select * from public.employees', 1, 'A employee not deleted by B');
select pg_temp.expect_error(format('update public.findings set severity = %L where id = %L', 'info', :'f_a'), 'owner cannot rewrite finding severity');
update public.findings set status = 'fixed' where id = :'f_a';
select pg_temp.expect_rows($q$select * from public.findings where status = 'fixed' and resolved_by = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 1, 'owner marks finding fixed, resolver recorded');
select pg_temp.expect_rows($q$select * from public.audit_log where table_name = 'findings' and action = 'update'$q$, 1, 'fix is audited');
select pg_temp.expect_error($q$insert into public.audit_log (action, table_name) values ('x', 'y')$q$, 'users cannot forge audit entries');
select pg_temp.expect_error($q$insert into public.rules (id, version, status, definition, source_url) values ('x', 1, 'verified', '{}', 'https://www.arlis.am/')$q$, 'users cannot write rules');
reset role;

-- ----- Telegram linking -----
set role authenticated;
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.create_telegram_link_token() as tok \gset
select pg_temp.expect_rows('select * from public.telegram_link_tokens', 0, 'users cannot read link tokens');
reset role;
insert into public.telegram_links (user_id, chat_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 111), ('bbbbbbbb-0000-0000-0000-000000000001', 222);
set role authenticated;
select pg_temp.expect_rows('select * from public.telegram_links', 1, 'user sees only own telegram link');
select pg_temp.expect_error($q$insert into public.telegram_links (user_id, chat_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 999)$q$, 'users cannot link a chat directly');
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000001');
delete from public.telegram_links where chat_id = 111;
reset role;
select pg_temp.expect_rows('select * from public.telegram_links where chat_id = 111', 1, 'B cannot unlink A telegram');
select pg_temp.expect_rows(format('select * from public.telegram_link_tokens where token = %L and length(token) = 64', :'tok'), 1, 'token stored, 64 chars');
set role anon;
select pg_temp.expect_error('select public.create_telegram_link_token()', 'anon cannot create link tokens');
reset role;
\echo 'RLS cross-tenant tests: all passed'
