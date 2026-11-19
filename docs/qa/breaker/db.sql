-- Breaker DB probes on throwaway Postgres (run via docs/qa/breaker/db-run.sh). Prints BROKE/HELD lines.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('bbbbbbbb-0000-0000-0000-00000000000a', 'attacker@example.com'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'victim@example.com');

-- ---------- 1. Lead capture lock-out: 30 junk leads block every real lead for an hour ----------
set role service_role;
do $$
declare i int; real_ok boolean := true;
begin
  for i in 1..30 loop
    perform public.submit_lead('junk' || i || '@example.com', 'en', 0, '{}', null, null, true);
  end loop;
  begin
    perform public.submit_lead('real.prospect@example.am', 'hy', 50, '{}', 'firm', 'owner', true);
  exception when sqlstate 'P0429' then real_ok := false;
  end;
  raise notice '% lead cap: after 30 junk leads a real prospect is %', case when real_ok then 'HELD ' else 'BROKE' end,
    case when real_ok then 'accepted' else 'refused with P0429 (UI: "try later") for the rest of the hour' end;
end $$;
reset role;

-- ---------- 2. Owner inserts a membership for any user id, with a backdated created_at ----------
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', false);
select public.create_org('Victim Audit LLC') as victim_org \gset
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000a', false);
select public.create_org('Victim Audit LLC') as attacker_org \gset
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000a', false);
insert into public.memberships (user_id, org_id, role, created_at)
  values ('bbbbbbbb-0000-0000-0000-00000000000b', :'attacker_org', 'owner', '2000-01-01');
-- The app picks the first membership by created_at when no org cookie is set (queries.ts:20, pick-org.ts:10).
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', false);
select case when m.org_id = :'attacker_org' then 'BROKE' else 'HELD ' end
       || ' forced membership: victim''s first org (order by created_at) is the attacker''s look-alike org'
  from public.memberships m where m.user_id = 'bbbbbbbb-0000-0000-0000-00000000000b' order by m.created_at limit 1;
reset role;

-- ---------- 3. Audit log keeps an "erased" employee ----------
set role authenticated;
select set_config('request.jwt.claim.sub', 'bbbbbbbb-0000-0000-0000-00000000000b', false);
insert into public.companies (org_id, name) values (:'victim_org', 'Client') returning id as co \gset
insert into public.employees (org_id, company_id, full_name, birth_date) values (:'victim_org', :'co', 'Anna Erased', '1990-05-05') returning id as emp \gset
delete from public.employees where id = :'emp';
select case when count(*) > 0 then 'BROKE' else 'HELD ' end
       || ' erasure: audit_log rows still holding the deleted employee''s full_name/birth_date: ' || count(*)
  from public.audit_log where org_id = :'victim_org' and (old_row ->> 'full_name' = 'Anna Erased' or new_row ->> 'full_name' = 'Anna Erased');
reset role;
