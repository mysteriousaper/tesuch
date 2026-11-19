-- Security C-1: memberships lockdown. Clients cannot insert memberships or change who/where a membership is;
-- owners may only change roles and remove members; members may leave. Run on a fresh DB after the shim and all migrations.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-00000000000a', 'owner-a@mem.test'),    -- owner of firm MA (the attacker in C-1)
  ('f0000000-0000-0000-0000-00000000000b', 'victim@mem.test'),     -- owner of firm MV, never invited to MA
  ('f0000000-0000-0000-0000-00000000000c', 'accountant@mem.test'), -- accountant in MA
  ('f0000000-0000-0000-0000-00000000000d', 'viewer@mem.test'),     -- viewer in MA
  ('f0000000-0000-0000-0000-00000000000e', 'invitee@mem.test');    -- invited to MA, joins via accept_invitation

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
  execute format('with q as (%s) select count(*) from q', p_sql) into n; -- CTE so DML ... returning works too
  if n <> p_expected then raise exception 'FAIL %: expected % rows, got %', p_label, p_expected, n; end if;
  raise notice 'ok   %', p_label;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

-- ---------- Setup: create_org (SECURITY DEFINER) still creates the first owner ----------
set role authenticated;
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select public.create_org('Firm MA') as org_a \gset
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select public.create_org('Firm MV') as org_v \gset
select pg_temp.expect_rows(format($q$select * from public.memberships where org_id = %L and user_id = 'f0000000-0000-0000-0000-00000000000b' and role = 'owner'$q$, :'org_v'), 1, 'create_org: still creates the owner membership');
reset role;
-- Accountant and viewer are seeded as setup (no client path inserts them).
insert into public.memberships (user_id, org_id, role) values
  ('f0000000-0000-0000-0000-00000000000c', :'org_a', 'accountant'),
  ('f0000000-0000-0000-0000-00000000000d', :'org_a', 'viewer');
set role authenticated;

-- ---------- C-1 attack: owner inserts a membership for another user ----------
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error(format($q$insert into public.memberships (user_id, org_id, role) values ('f0000000-0000-0000-0000-00000000000b', %L, 'owner')$q$, :'org_a'),
  'C-1: owner cannot insert another user as owner', 'permission denied');
select pg_temp.expect_error(format($q$insert into public.memberships (user_id, org_id, role) values ('f0000000-0000-0000-0000-00000000000b', %L, 'viewer')$q$, :'org_a'),
  'C-1: owner cannot insert another user as viewer', 'permission denied');
select pg_temp.expect_error(format($q$insert into public.memberships (user_id, org_id, role) values ('f0000000-0000-0000-0000-00000000000b', %L, 'accountant')$q$, :'org_a'),
  'C-1: owner cannot insert another user as accountant', 'permission denied');
select pg_temp.expect_error(format($q$insert into public.memberships (user_id, org_id, role, created_at) values ('f0000000-0000-0000-0000-00000000000b', %L, 'owner', '2000-01-01')$q$, :'org_a'),
  'C-1: owner cannot insert another user with a backdated created_at', 'permission denied');
select pg_temp.expect_error(format($q$insert into public.memberships (user_id, org_id, role) values ('f0000000-0000-0000-0000-00000000000a', %L, 'owner')$q$, :'org_v'),
  'C-1: owner cannot insert themselves into another org', 'permission denied');
select pg_temp.expect_error(format($q$insert into public.memberships (user_id, org_id, role) values ('f0000000-0000-0000-0000-00000000000c', %L, 'viewer') on conflict (user_id, org_id) do update set role = 'owner'$q$, :'org_a'),
  'C-1: owner cannot upsert memberships', 'permission denied');

-- ---------- Owner cannot move a membership to another user/org or rewrite its date ----------
select pg_temp.expect_error(format($q$update public.memberships set user_id = 'f0000000-0000-0000-0000-00000000000b' where org_id = %L and user_id = 'f0000000-0000-0000-0000-00000000000d'$q$, :'org_a'),
  'C-1: owner cannot update user_id (hand a seat to another user)', 'permission denied');
select pg_temp.expect_error(format($q$update public.memberships set org_id = %L where org_id = %L and user_id = 'f0000000-0000-0000-0000-00000000000a'$q$, :'org_v', :'org_a'),
  'C-1: owner cannot update org_id', 'permission denied');
select pg_temp.expect_error(format($q$update public.memberships set created_at = '2000-01-01' where org_id = %L$q$, :'org_a'),
  'C-1: owner cannot backdate created_at', 'permission denied');
select pg_temp.expect_rows($q$select * from public.memberships where user_id = 'f0000000-0000-0000-0000-00000000000b'$q$, 0,
  'C-1: victim is visible in no membership of the attacker');
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_rows($q$select * from public.memberships where user_id = 'f0000000-0000-0000-0000-00000000000b'$q$, 1,
  'C-1: victim still belongs only to their own org');

-- ---------- Viewer and accountant cannot manage members ----------
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$insert into public.memberships (user_id, org_id, role) values ('f0000000-0000-0000-0000-00000000000b', %L, 'viewer')$q$, :'org_a'), 'viewer: cannot insert members', 'permission denied');
select pg_temp.expect_rows(format($q$update public.memberships set role = 'owner' where org_id = %L returning 1$q$, :'org_a'), 0, 'viewer: cannot change roles (incl. own)');
select pg_temp.expect_rows(format($q$delete from public.memberships where org_id = %L and user_id <> 'f0000000-0000-0000-0000-00000000000d' returning 1$q$, :'org_a'), 0, 'viewer: cannot remove others');
select pg_temp.expect_error(format($q$update public.memberships set user_id = 'f0000000-0000-0000-0000-00000000000b' where org_id = %L$q$, :'org_a'), 'viewer: cannot update user_id', 'permission denied');
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error(format($q$insert into public.memberships (user_id, org_id, role) values ('f0000000-0000-0000-0000-00000000000b', %L, 'viewer')$q$, :'org_a'), 'accountant: cannot insert members', 'permission denied');
select pg_temp.expect_rows(format($q$update public.memberships set role = 'owner' where org_id = %L returning 1$q$, :'org_a'), 0, 'accountant: cannot change roles (incl. own)');
select pg_temp.expect_rows(format($q$delete from public.memberships where org_id = %L and user_id <> 'f0000000-0000-0000-0000-00000000000c' returning 1$q$, :'org_a'), 0, 'accountant: cannot remove others');
select pg_temp.expect_error(format($q$update public.memberships set org_id = %L where org_id = %L$q$, :'org_v', :'org_a'), 'accountant: cannot update org_id', 'permission denied');
-- An owner of another org cannot touch MA's members.
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_rows(format($q$update public.memberships set role = 'viewer' where org_id = %L returning 1$q$, :'org_a'), 0, 'other owner: cannot change MA roles');
select pg_temp.expect_rows(format($q$delete from public.memberships where org_id = %L returning 1$q$, :'org_a'), 0, 'other owner: cannot remove MA members');
-- anon has no access at all.
reset role;
set role anon;
select pg_temp.expect_error(format($q$insert into public.memberships (user_id, org_id, role) values ('f0000000-0000-0000-0000-00000000000b', %L, 'owner')$q$, :'org_a'), 'anon: cannot insert members', 'permission denied');
reset role;
set role authenticated;

-- ---------- What owners may still do ----------
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows(format($q$update public.memberships set role = 'viewer' where org_id = %L and user_id = 'f0000000-0000-0000-0000-00000000000c' returning 1$q$, :'org_a'), 1, 'owner: can change a member''s role');
select pg_temp.expect_rows(format($q$select * from public.memberships where org_id = %L and user_id = 'f0000000-0000-0000-0000-00000000000c' and role = 'viewer'$q$, :'org_a'), 1, 'owner: role change persisted');
select pg_temp.expect_error(format($q$update public.memberships set role = 'viewer' where org_id = %L and user_id = 'f0000000-0000-0000-0000-00000000000a'$q$, :'org_a'), 'owner: last owner still cannot demote self', 'at least one owner');
select pg_temp.expect_rows(format($q$delete from public.memberships where org_id = %L and user_id = 'f0000000-0000-0000-0000-00000000000c' returning 1$q$, :'org_a'), 1, 'owner: can remove a member');

-- ---------- Members may leave ----------
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000d');
select pg_temp.expect_rows(format($q$delete from public.memberships where org_id = %L and user_id = 'f0000000-0000-0000-0000-00000000000d' returning 1$q$, :'org_a'), 1, 'viewer: can leave (delete own membership)');
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error(format($q$delete from public.memberships where org_id = %L and user_id = 'f0000000-0000-0000-0000-00000000000a'$q$, :'org_a'), 'owner: last owner still cannot leave', 'at least one owner');

-- ---------- accept_invitation (SECURITY DEFINER) still adds members ----------
insert into public.invitations (org_id, email, role) values (:'org_a', 'invitee@mem.test', 'accountant') returning token as tok \gset
select pg_temp.as_user('f0000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error(format($q$insert into public.memberships (user_id, org_id, role) values ('f0000000-0000-0000-0000-00000000000e', %L, 'owner')$q$, :'org_a'), 'invitee: cannot self-insert (must accept)', 'permission denied');
select public.accept_invitation(:'tok') as joined \gset
select pg_temp.expect_rows(format($q$select * from public.memberships where org_id = %L and user_id = 'f0000000-0000-0000-0000-00000000000e' and role = 'accountant'$q$, :'org_a'), 1, 'accept_invitation: membership created with invited role');
select pg_temp.expect_rows(format($q$select 1 where %L::uuid = %L::uuid$q$, :'joined', :'org_a'), 1, 'accept_invitation: returns the org id');
reset role;
\echo 'Memberships lockdown tests: all passed'
