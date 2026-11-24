\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('1c000000-0000-0000-0000-00000000000a', 'owner@ck.test'),
  ('1c000000-0000-0000-0000-00000000000b', 'acct@ck.test'),
  ('1c000000-0000-0000-0000-00000000000c', 'viewer@ck.test'),
  ('1c000000-0000-0000-0000-00000000000d', 'other-owner@ck.test');

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

set role authenticated;
select pg_temp.as_user('1c000000-0000-0000-0000-00000000000a');
select public.create_org('Checklist Firm') as org_a \gset
insert into public.companies (org_id, name) values (:'org_a', 'Checklist Co') returning id as co_a \gset
select pg_temp.as_user('1c000000-0000-0000-0000-00000000000d');
select public.create_org('Other Firm') as org_b \gset
insert into public.companies (org_id, name) values (:'org_b', 'Other Co') returning id as co_b \gset
reset role;
insert into public.memberships (user_id, org_id, role) values
  ('1c000000-0000-0000-0000-00000000000b', :'org_a', 'accountant'),
  ('1c000000-0000-0000-0000-00000000000c', :'org_a', 'viewer');

set role authenticated;
-- owner ticks; the tick records who
select pg_temp.as_user('1c000000-0000-0000-0000-00000000000a');
insert into public.checklist_ticks (org_id, company_id, question_no) values (:'org_a', :'co_a', '6.1');
select pg_temp.expect_rows($q$select 1 from public.checklist_ticks where question_no = '6.1' and ticked_by = '1c000000-0000-0000-0000-00000000000a'$q$, 1, 'owner can tick and the tick records who');
select pg_temp.expect_error(format($q$insert into public.checklist_ticks (org_id, company_id, question_no) values (%L, %L, '6.1')$q$, :'org_a', :'co_a'), 'same question cannot be ticked twice', 'duplicate');
select pg_temp.expect_error(format($q$insert into public.checklist_ticks (org_id, company_id, question_no) values (%L, %L, 'abc')$q$, :'org_a', :'co_a'), 'question number must look like 12 or 3.4', 'check');
-- accountant can tick and untick
select pg_temp.as_user('1c000000-0000-0000-0000-00000000000b');
insert into public.checklist_ticks (org_id, company_id, question_no) values (:'org_a', :'co_a', '30.6');
delete from public.checklist_ticks where question_no = '30.6';
select pg_temp.expect_rows($q$select 1 from public.checklist_ticks where question_no = '30.6'$q$, 0, 'accountant can untick');
-- viewer reads but cannot write
select pg_temp.as_user('1c000000-0000-0000-0000-00000000000c');
select pg_temp.expect_rows($q$select 1 from public.checklist_ticks$q$, 1, 'viewer can read ticks');
select pg_temp.expect_error(format($q$insert into public.checklist_ticks (org_id, company_id, question_no) values (%L, %L, '7')$q$, :'org_a', :'co_a'), 'viewer cannot tick', 'row-level security');
select pg_temp.expect_rows($q$delete from public.checklist_ticks returning 1$q$, 0, 'viewer cannot untick');
-- another org sees nothing and cannot tick our company
select pg_temp.as_user('1c000000-0000-0000-0000-00000000000d');
select pg_temp.expect_rows($q$select 1 from public.checklist_ticks$q$, 0, 'foreign owner sees no ticks');
select pg_temp.expect_error(format($q$insert into public.checklist_ticks (org_id, company_id, question_no) values (%L, %L, '7')$q$, :'org_a', :'co_a'), 'foreign owner cannot tick our company', 'row-level security');
select pg_temp.expect_error(format($q$insert into public.checklist_ticks (org_id, company_id, question_no) values (%L, %L, '7')$q$, :'org_b', :'co_a'), 'org_id must match the company (composite FK)');
select pg_temp.expect_rows($q$delete from public.checklist_ticks returning 1$q$, 0, 'foreign owner cannot untick');
reset role;
-- no update policy: even the owner cannot edit a tick
set role authenticated;
select pg_temp.as_user('1c000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows($q$update public.checklist_ticks set question_no = '8' returning 1$q$, 0, 'ticks cannot be edited');
reset role;
