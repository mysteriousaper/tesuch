-- Leads table + submit_lead RPC. Run after the shim and all migrations; any failure raises (ON_ERROR_STOP).
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
grant execute on all functions in schema pg_temp to anon, authenticated;

set role anon;
select pg_temp.expect_ok($q$select public.submit_lead('Owner@Example.am', 'hy', 72, '{"probation-max":"yes"}', 'firm', 'owner', true)$q$, 'anon can submit a lead');
select pg_temp.expect_error('select * from public.leads', 'anon cannot read leads');
select pg_temp.expect_error($q$insert into public.leads (email, locale, consent) values ('x@y.am', 'hy', true)$q$, 'anon cannot insert directly');
select pg_temp.expect_error($q$select public.submit_lead('not-an-email', 'hy', 50, '{}', null, null, true)$q$, 'bad email rejected');
select pg_temp.expect_error($q$select public.submit_lead('a@b.am', 'hy', 50, '{}', null, null, false)$q$, 'consent false rejected');
select pg_temp.expect_error($q$select public.submit_lead('a@b.am', 'hy', 50, '{}', null, null, null)$q$, 'consent null rejected');
select pg_temp.expect_error($q$select public.submit_lead('a@b.am', 'de', 50, '{}', null, null, true)$q$, 'unknown locale rejected');
select pg_temp.expect_error($q$select public.submit_lead('a@b.am', 'hy', 50, '[1,2]', null, null, true)$q$, 'non-object answers rejected');
select pg_temp.expect_error($q$select public.submit_lead('owner@example.am', 'ru', 10, '{}', null, null, true)$q$, 'same email within 10 minutes throttled (case-insensitive)');
select pg_temp.expect_ok($q$select public.submit_lead('second@example.am', 'en', 999, '{}', repeat('x', 500), null, true)$q$, 'out-of-range score and long fields are clamped, not fatal');
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub', 'aaaaaaaa-0000-0000-0000-0000000000dd', false);
select pg_temp.expect_error('select * from public.leads', 'signed-in users cannot read leads');
reset role;

do $$
declare n int; s int; l int;
begin
  select count(*) into n from public.leads;
  if n <> 2 then raise exception 'FAIL expected 2 leads, got %', n; end if;
  select score, length(company_size) into s, l from public.leads where email = 'second@example.am';
  if s is not null or l <> 40 then raise exception 'FAIL clamping: score %, size length %', s, l; end if;
  if not exists (select 1 from public.leads where email = 'owner@example.am') then raise exception 'FAIL email not lowercased'; end if;
  raise notice 'ok   stored rows: lowercased email, clamped score and size';
end $$;
\echo 'Lane D lead tests: all passed'
