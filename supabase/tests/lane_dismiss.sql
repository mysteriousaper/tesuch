-- M-14: dismissing a finding needs a reason; the reason is stored, cleared on reopen/fix, and only editors can set it.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('1b000000-0000-0000-0000-00000000000a', 'owner@inbox.test'),
  ('1b000000-0000-0000-0000-00000000000b', 'acct@inbox.test'),
  ('1b000000-0000-0000-0000-00000000000c', 'viewer@inbox.test'),
  ('1b000000-0000-0000-0000-00000000000d', 'other-owner@inbox.test'),
  ('1b000000-0000-0000-0000-00000000000e', 'outsider@inbox.test');

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
select pg_temp.as_user('1b000000-0000-0000-0000-00000000000a');
select public.create_org('Dismiss Firm') as org_a \gset
insert into public.companies (org_id, name) values (:'org_a', 'Dismiss Co') returning id as co_a \gset
insert into public.employees (org_id, company_id, full_name) values (:'org_a', :'co_a', 'Dismiss Employee') returning id as emp_a \gset
reset role;
insert into public.memberships (user_id, org_id, role) values
  ('1b000000-0000-0000-0000-00000000000b', :'org_a', 'accountant'),
  ('1b000000-0000-0000-0000-00000000000c', :'org_a', 'viewer');
insert into public.findings (org_id, company_id, employee_id, rule_id, rule_version, severity, due_date)
values (:'org_a', :'co_a', :'emp_a', 'probation-max', 1, 'advisory', '2026-12-01') returning id as f_a \gset

set role authenticated;
select pg_temp.as_user('1b000000-0000-0000-0000-00000000000b');
-- no reason / blank / too short: refused (check_violation)
select pg_temp.expect_error(format($q$update public.findings set status = 'dismissed' where id = %L$q$, :'f_a'), 'dismiss without a reason is refused', 'needs a reason');
select pg_temp.expect_error(format($q$update public.findings set status = 'dismissed', dismissed_reason = '   ' where id = %L$q$, :'f_a'), 'blank reason is refused');
select pg_temp.expect_error(format($q$update public.findings set status = 'dismissed', dismissed_reason = 'no' where id = %L$q$, :'f_a'), 'two-character reason is refused');
select pg_temp.expect_rows(format($q$select 1 from public.findings where id = %L and status = 'open'$q$, :'f_a'), 1, 'finding is still open after refused dismissals');
-- with a reason: ok, stored, resolver recorded
update public.findings set status = 'dismissed', dismissed_reason = 'Contract signed on paper, copy filed' where id = :'f_a';
select pg_temp.expect_rows(format($q$select 1 from public.findings where id = %L and status = 'dismissed' and dismissed_reason = 'Contract signed on paper, copy filed' and resolved_by = '1b000000-0000-0000-0000-00000000000b'$q$, :'f_a'), 1, 'dismiss with a reason stores it');
-- reopening clears the reason
update public.findings set status = 'open' where id = :'f_a';
select pg_temp.expect_rows(format($q$select 1 from public.findings where id = %L and status = 'open' and dismissed_reason is null$q$, :'f_a'), 1, 'reopen clears the reason');
-- fixing never keeps a reason
update public.findings set status = 'fixed', dismissed_reason = 'sneaky' where id = :'f_a';
select pg_temp.expect_rows(format($q$select 1 from public.findings where id = %L and status = 'fixed' and dismissed_reason is null$q$, :'f_a'), 1, 'fixed finding carries no reason');
update public.findings set status = 'open' where id = :'f_a';
-- over 500 characters: refused
select pg_temp.expect_error(format($q$update public.findings set status = 'dismissed', dismissed_reason = %L where id = %L$q$, repeat('x', 501), :'f_a'), 'reason over 500 characters is refused');
-- viewer cannot dismiss at all
select pg_temp.as_user('1b000000-0000-0000-0000-00000000000c');
select pg_temp.expect_rows(format($q$update public.findings set status = 'dismissed', dismissed_reason = 'viewer tries' where id = %L returning id$q$, :'f_a'), 0, 'viewer cannot dismiss');
reset role;
-- the nightly job (no auth.uid) is unaffected
select pg_temp.as_user(null);
update public.findings set status = 'dismissed' where id = :'f_a';
select pg_temp.expect_rows(format($q$select 1 from public.findings where id = %L and status = 'dismissed'$q$, :'f_a'), 1, 'service role is not forced to give a reason');
