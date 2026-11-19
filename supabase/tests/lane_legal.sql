-- Legal & Compliance: consent_records RLS. Run after the shim and all migrations; any failure raises (ON_ERROR_STOP).
\set ON_ERROR_STOP on
\set QUIET on

create function pg_temp.expect_error(p_sql text, p_label text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then raise notice 'ok   % [%]', p_label, sqlerrm; return; end;
  raise exception 'FAIL % (statement succeeded): %', p_label, p_sql;
end $$;
create function pg_temp.expect_ok(p_sql text, p_label text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise notice 'ok   %', p_label;
end $$;
create function pg_temp.expect_count(p_sql text, p_n int, p_label text) returns void language plpgsql as $$
declare n int;
begin
  execute format('select count(*) from (%s) q', p_sql) into n;
  if n <> p_n then raise exception 'FAIL % (expected %, got %)', p_label, p_n, n; end if;
  raise notice 'ok   %', p_label;
end $$;
grant execute on all functions in schema pg_temp to anon, authenticated, service_role;

insert into auth.users (id, email) values
  ('11111111-0000-0000-0000-00000000a001', 'legal-a@example.am'),
  ('11111111-0000-0000-0000-00000000b002', 'legal-b@example.am');

-- ----- User A records consent -----
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-00000000a001', false);
select pg_temp.expect_ok($q$insert into public.consent_records (document, version) values ('terms', '2026-11-19'), ('privacy', '2026-11-19')$q$, 'user inserts own consent (user_id defaults to auth.uid())');
select pg_temp.expect_ok($q$insert into public.consent_records (user_id, document, version, ip_hash) values ('11111111-0000-0000-0000-00000000a001', 'dpa', '2026-11-19', repeat('ab', 32))$q$, 'user inserts own consent with explicit user_id and ip hash');
select pg_temp.expect_count('select * from public.consent_records', 3, 'user reads own 3 records');
select pg_temp.expect_error($q$insert into public.consent_records (document, version) values ('terms', '2026-11-19')$q$, 'same document+version cannot be recorded twice');
select pg_temp.expect_error($q$insert into public.consent_records (user_id, document, version) values ('11111111-0000-0000-0000-00000000b002', 'terms', '2026-11-19')$q$, 'cannot insert consent for another user');
select pg_temp.expect_error($q$insert into public.consent_records (document, version, accepted_at) values ('terms', 'v-backdated', '2020-01-01')$q$, 'cannot choose accepted_at (no column grant)');
select pg_temp.expect_error($q$insert into public.consent_records (document, version) values ('cookies', '1')$q$, 'unknown document rejected');
select pg_temp.expect_error($q$insert into public.consent_records (document, version) values ('terms', '')$q$, 'empty version rejected');
select pg_temp.expect_error($q$insert into public.consent_records (document, version, ip_hash) values ('terms', 'v2', '203.0.113.7')$q$, 'raw IP rejected as ip_hash');
select pg_temp.expect_error($q$update public.consent_records set version = 'x'$q$, 'user cannot update consent');
select pg_temp.expect_error($q$delete from public.consent_records$q$, 'user cannot delete consent');
reset role;

-- ----- User B sees nothing of A -----
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-0000-0000-0000-00000000b002', false);
select pg_temp.expect_count('select * from public.consent_records', 0, 'other user reads none of A''s consent');
select pg_temp.expect_count($q$select * from public.consent_records where user_id = '11111111-0000-0000-0000-00000000a001'$q$, 0, 'other user cannot read A by id');
reset role;

-- ----- Anonymous: nothing at all -----
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error('select * from public.consent_records', 'anon cannot read consent');
select pg_temp.expect_error($q$insert into public.consent_records (user_id, document, version) values ('11111111-0000-0000-0000-00000000a001', 'terms', 'anon')$q$, 'anon cannot insert consent');
reset role;

-- ----- Signed-in but no uid (broken token) cannot insert -----
set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error($q$insert into public.consent_records (document, version) values ('terms', 'nouid')$q$, 'no auth.uid() cannot insert');
reset role;

do $$
declare n int;
begin
  select count(*) into n from public.consent_records;
  if n <> 3 then raise exception 'FAIL expected 3 consent rows, got %', n; end if;
  if exists (select 1 from public.consent_records where accepted_at < now() - interval '1 minute') then raise exception 'FAIL accepted_at not server time'; end if;
  delete from auth.users where id = '11111111-0000-0000-0000-00000000a001';
  select count(*) into n from public.consent_records;
  if n <> 0 then raise exception 'FAIL consent rows survive account deletion (%), expected cascade', n; end if;
  delete from auth.users where id = '11111111-0000-0000-0000-00000000b002';
  raise notice 'ok   server-time accepted_at; rows deleted with the account';
end $$;
\echo 'Legal consent tests: all passed'
