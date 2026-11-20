-- F1 inbox: findings.assignee_id. Owner/accountant may assign a colleague of the same org (owner/accountant only),
-- never an outsider, a viewer or a user of another org; viewers cannot assign; users may change nothing but status/assignee_id.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('1a000000-0000-0000-0000-00000000000a', 'owner@inbox.test'),
  ('1a000000-0000-0000-0000-00000000000b', 'acct@inbox.test'),
  ('1a000000-0000-0000-0000-00000000000c', 'viewer@inbox.test'),
  ('1a000000-0000-0000-0000-00000000000d', 'other-owner@inbox.test'),
  ('1a000000-0000-0000-0000-00000000000e', 'outsider@inbox.test');

insert into public.rules (id, version, article, status, definition, source_url)
values ('probation-max', 1, '92', 'needs_lawyer_review', '{}', 'https://www.arlis.am/') on conflict do nothing;

create function pg_temp.as_user(p uuid) returns void language sql as
  $$ select set_config('request.jwt.claim.sub', coalesce(p::text, ''), false) $$;
create function pg_temp.expect_error(p_sql text, p_label text, p_match text default null) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    if p_match is not null and sqlerrm not ilike '%' || p_match || '%' then
      raise exception 'FAIL % (wrong error: %)', p_label, sqlerrm;
    end if;
    raise notice 'ok   % [%]', p_label, sqlerrm; return;
  end;
  raise exception 'FAIL % (statement succeeded): %', p_label, p_sql;
end $$;
create function pg_temp.expect_rows(p_sql text, p_expected bigint, p_label text) returns void language plpgsql as $$
declare n bigint;
begin
  execute format('with q as (%s) select count(*) from q', p_sql) into n;
  if n <> p_expected then raise exception 'FAIL %: expected % rows, got %', p_label, p_expected, n; end if;
  raise notice 'ok   %', p_label;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- ---------- Setup ----------
set role authenticated;
select pg_temp.as_user('1a000000-0000-0000-0000-00000000000a');
select public.create_org('Inbox Firm') as org_a \gset
insert into public.companies (org_id, name) values (:'org_a', 'Inbox Co') returning id as co_a \gset
insert into public.employees (org_id, company_id, full_name) values (:'org_a', :'co_a', 'Inbox Employee') returning id as emp_a \gset
select pg_temp.as_user('1a000000-0000-0000-0000-00000000000d');
select public.create_org('Other Inbox Firm') as org_b \gset
reset role;
insert into public.memberships (user_id, org_id, role) values
  ('1a000000-0000-0000-0000-00000000000b', :'org_a', 'accountant'),
  ('1a000000-0000-0000-0000-00000000000c', :'org_a', 'viewer');
insert into public.findings (org_id, company_id, employee_id, rule_id, rule_version, severity, due_date)
values (:'org_a', :'co_a', :'emp_a', 'probation-max', 1, 'advisory', '2026-12-01') returning id as f_a \gset

-- ---------- Owner assigns ----------
set role authenticated;
select pg_temp.as_user('1a000000-0000-0000-0000-00000000000a');
update public.findings set assignee_id = '1a000000-0000-0000-0000-00000000000b' where id = :'f_a';
select pg_temp.expect_rows(format($q$select 1 from public.findings where id = %L and assignee_id = '1a000000-0000-0000-0000-00000000000b'$q$, :'f_a'), 1, 'owner assigns an accountant');
update public.findings set assignee_id = '1a000000-0000-0000-0000-00000000000a' where id = :'f_a';
select pg_temp.expect_rows(format($q$select 1 from public.findings where id = %L and assignee_id = '1a000000-0000-0000-0000-00000000000a'$q$, :'f_a'), 1, 'owner assigns themselves');
update public.findings set assignee_id = null where id = :'f_a';
select pg_temp.expect_rows(format($q$select 1 from public.findings where id = %L and assignee_id is null$q$, :'f_a'), 1, 'owner unassigns');
select pg_temp.expect_error(format($q$update public.findings set assignee_id = '1a000000-0000-0000-0000-00000000000e' where id = %L$q$, :'f_a'),
  'owner cannot assign a user with no membership', 'assignee_not_member');
select pg_temp.expect_error(format($q$update public.findings set assignee_id = '1a000000-0000-0000-0000-00000000000d' where id = %L$q$, :'f_a'),
  'owner cannot assign a user of another org', 'assignee_not_member');
select pg_temp.expect_error(format($q$update public.findings set assignee_id = '1a000000-0000-0000-0000-00000000000c' where id = %L$q$, :'f_a'),
  'owner cannot assign a viewer', 'assignee_not_member');

-- ---------- Other columns stay locked ----------
select pg_temp.expect_error(format($q$update public.findings set due_date = '2030-01-01' where id = %L$q$, :'f_a'), 'cannot change due_date', 'only status and assignee');
select pg_temp.expect_error(format($q$update public.findings set severity = 'red' where id = %L$q$, :'f_a'), 'cannot change severity', 'only status and assignee');
select pg_temp.expect_error(format($q$update public.findings set last_seen_at = now() + interval '1 day' where id = %L$q$, :'f_a'), 'cannot change last_seen_at', 'only status and assignee');
select pg_temp.expect_error(format($q$update public.findings set resolved_by = '1a000000-0000-0000-0000-00000000000a' where id = %L$q$, :'f_a'), 'cannot forge resolved_by without a status change', 'only status and assignee');
select pg_temp.expect_error(format($q$update public.findings set status = 'fixed', due_date = '2030-01-01' where id = %L$q$, :'f_a'), 'status change cannot carry another column', 'only status and assignee');
-- Both allowed columns together.
update public.findings set status = 'dismissed', dismissed_reason = 'test reason', assignee_id = '1a000000-0000-0000-0000-00000000000b' where id = :'f_a';
select pg_temp.expect_rows(format($q$select 1 from public.findings where id = %L and status = 'dismissed' and assignee_id = '1a000000-0000-0000-0000-00000000000b' and resolved_by = '1a000000-0000-0000-0000-00000000000a'$q$, :'f_a'), 1, 'status and assignee change together, resolver recorded');
update public.findings set status = 'open' where id = :'f_a';

-- ---------- Accountant assigns ----------
select pg_temp.as_user('1a000000-0000-0000-0000-00000000000b');
update public.findings set assignee_id = '1a000000-0000-0000-0000-00000000000a' where id = :'f_a';
select pg_temp.expect_rows(format($q$select 1 from public.findings where id = %L and assignee_id = '1a000000-0000-0000-0000-00000000000a'$q$, :'f_a'), 1, 'accountant assigns the owner');
select pg_temp.expect_error(format($q$update public.findings set assignee_id = '1a000000-0000-0000-0000-00000000000e' where id = %L$q$, :'f_a'),
  'accountant cannot assign an outsider', 'assignee_not_member');

-- ---------- Viewer cannot ----------
select pg_temp.as_user('1a000000-0000-0000-0000-00000000000c');
select pg_temp.expect_rows(format('select 1 from public.findings where id = %L', :'f_a'), 1, 'viewer can read the finding');
select pg_temp.expect_rows(format($q$update public.findings set assignee_id = '1a000000-0000-0000-0000-00000000000c' where id = %L returning 1$q$, :'f_a'), 0, 'viewer assign updates no row (RLS)');
select pg_temp.expect_rows(format($q$update public.findings set assignee_id = null where id = %L returning 1$q$, :'f_a'), 0, 'viewer unassign updates no row (RLS)');

-- ---------- Other org's owner cannot touch it ----------
select pg_temp.as_user('1a000000-0000-0000-0000-00000000000d');
select pg_temp.expect_rows(format($q$update public.findings set assignee_id = '1a000000-0000-0000-0000-00000000000d' where id = %L returning 1$q$, :'f_a'), 0, 'other firm owner cannot assign (row invisible)');

-- ---------- Audit and assignee removal ----------
reset role;
select pg_temp.expect_rows(format($q$select 1 from public.audit_log where table_name = 'findings' and action = 'update' and row_id = %L and actor = '1a000000-0000-0000-0000-00000000000b' and new_row ->> 'assignee_id' = '1a000000-0000-0000-0000-00000000000a'$q$, :'f_a'), 1, 'assignment is audited');
select pg_temp.as_user(null);
update public.findings set assignee_id = '1a000000-0000-0000-0000-00000000000b' where id = :'f_a';
delete from auth.users where id = '1a000000-0000-0000-0000-00000000000b';
select pg_temp.expect_rows(format('select 1 from public.findings where id = %L and assignee_id is null', :'f_a'), 1, 'deleting the assignee clears assignee_id (on delete set null)');
