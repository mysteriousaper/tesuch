-- Quiz attempts: tenancy and write protection. Run on a fresh DB after the shim and all migrations.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id) values
  ('c0000000-0000-0000-0000-00000000000a'), -- owner of firm CA
  ('c0000000-0000-0000-0000-00000000000b'), -- owner of firm CB
  ('c0000000-0000-0000-0000-00000000000c'); -- viewer in firm CA

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

set role authenticated;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');
select public.create_org('Firm CA') as org_a \gset
insert into public.companies (org_id, name) values (:'org_a', 'CA Co') returning id as co_a \gset
-- Clients cannot insert memberships (only create_org / accept_invitation); seed the viewer as setup.
reset role;
insert into public.memberships (user_id, org_id, role) values ('c0000000-0000-0000-0000-00000000000c', :'org_a', 'viewer');
set role authenticated;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000b');
select public.create_org('Firm CB') as org_b \gset
insert into public.companies (org_id, name) values (:'org_b', 'CB Co') returning id as co_b \gset
reset role;

-- The server action (service role) writes the attempt.
insert into public.quiz_attempts (org_id, company_id, user_id, iso_week, answers, score)
values (:'org_a', :'co_a', 'c0000000-0000-0000-0000-00000000000a', '2026-W47', '[]', 80);

set role authenticated;
select pg_temp.as_user('c0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows('select * from public.quiz_attempts', 1, 'quiz: owner reads own org attempts');
select pg_temp.expect_error(format($q$insert into public.quiz_attempts (org_id, company_id, user_id, iso_week, answers, score) values (%L, %L, 'c0000000-0000-0000-0000-00000000000a', '2026-W48', '[]', 100)$q$, :'org_a', :'co_a'), 'quiz: users cannot insert (no forged scores)');
select pg_temp.expect_error($q$update public.quiz_attempts set score = 100$q$, 'quiz: users cannot update scores');
select pg_temp.expect_error($q$delete from public.quiz_attempts$q$, 'quiz: users cannot delete attempts');

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_rows('select * from public.quiz_attempts', 1, 'quiz: viewer reads own org attempts');

select pg_temp.as_user('c0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_rows('select * from public.quiz_attempts', 0, 'quiz: other firm sees nothing');
reset role;

set role anon;
select pg_temp.as_user(null);
select pg_temp.expect_error('select * from public.quiz_attempts', 'quiz: anon has no access');
reset role;

-- Schema guards (service role / superuser).
select pg_temp.expect_error(format($q$insert into public.quiz_attempts (org_id, company_id, user_id, iso_week, answers, score) values (%L, %L, 'c0000000-0000-0000-0000-00000000000b', '2026-W47', '[]', 50)$q$, :'org_b', :'co_a'), 'quiz: composite FK blocks cross-org company');
select pg_temp.expect_error(format($q$insert into public.quiz_attempts (org_id, company_id, user_id, iso_week, answers, score) values (%L, %L, 'c0000000-0000-0000-0000-00000000000a', '2026-W47', '[]', 90)$q$, :'org_a', :'co_a'), 'quiz: one attempt per user per company per week');
select pg_temp.expect_error(format($q$insert into public.quiz_attempts (org_id, company_id, user_id, iso_week, answers, score) values (%L, %L, 'c0000000-0000-0000-0000-00000000000a', '2026-47', '[]', 90)$q$, :'org_a', :'co_a'), 'quiz: iso_week format enforced');
select pg_temp.expect_error(format($q$insert into public.quiz_attempts (org_id, company_id, user_id, iso_week, answers, score) values (%L, %L, 'c0000000-0000-0000-0000-00000000000a', '2026-W49', '[]', 101)$q$, :'org_a', :'co_a'), 'quiz: score range enforced');
select pg_temp.expect_rows($q$select * from public.audit_log where table_name = 'quiz_attempts'$q$, 1, 'quiz: attempts are audited');
\echo 'Lane C quiz tests: all passed'
