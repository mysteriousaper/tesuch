-- Engineering: invitations, accept_invitation(), last-owner guard. Run on a fresh DB after the shim and all migrations.
\set ON_ERROR_STOP on
\set QUIET on

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-00000000000a', 'owner-a@test.am'),  -- owner of firm EA
  ('e0000000-0000-0000-0000-00000000000b', 'owner-b@test.am'),  -- owner of firm EB (attacker)
  ('e0000000-0000-0000-0000-00000000000c', 'viewer-a@test.am'), -- viewer in firm EA
  ('e0000000-0000-0000-0000-00000000000d', 'Invitee@Test.am'),  -- the invited person (mixed case on purpose)
  ('e0000000-0000-0000-0000-00000000000e', 'other@test.am');    -- signed-in stranger holding the link

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
create function pg_temp.expect_eq(p_actual text, p_expected text, p_label text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then raise exception 'FAIL %: expected %, got %', p_label, p_expected, p_actual; end if;
  raise notice 'ok   %', p_label;
end $$;
grant execute on all functions in schema pg_temp to authenticated, anon;

set role authenticated;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
select public.create_org('Firm EA') as org_a \gset
insert into public.memberships (user_id, org_id, role) values ('e0000000-0000-0000-0000-00000000000c', :'org_a', 'viewer');
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
select public.create_org('Firm EB') as org_b \gset

-- ---------- Creating invitations ----------
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
insert into public.invitations (org_id, email, role) values (:'org_a', 'invitee@test.am', 'accountant');
select pg_temp.expect_rows('select * from public.invitations', 1, 'invite: owner sees own org invitation');
select pg_temp.expect_rows($q$select * from public.invitations where invited_by = 'e0000000-0000-0000-0000-00000000000a' and expires_at between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute' and length(token) = 64$q$,
  1, 'invite: inviter, 7-day expiry and 64-char token are server-set');
select pg_temp.expect_error(format($q$insert into public.invitations (org_id, email, role, token) values (%L, 'x@test.am', 'viewer', 'chosen-token')$q$, :'org_a'), 'invite: client cannot choose the token', 'permission denied');
select pg_temp.expect_error(format($q$insert into public.invitations (org_id, email, role, expires_at) values (%L, 'x@test.am', 'viewer', now() + interval '10 years')$q$, :'org_a'), 'invite: client cannot choose expiry', 'permission denied');
select pg_temp.expect_error(format($q$insert into public.invitations (org_id, email, role, accepted_at) values (%L, 'x@test.am', 'viewer', now())$q$, :'org_a'), 'invite: client cannot pre-accept', 'permission denied');
select pg_temp.expect_error($q$update public.invitations set expires_at = now() + interval '1 year'$q$, 'invite: owner cannot update (extend/accept) invitations', 'permission denied');
select pg_temp.expect_error(format($q$insert into public.invitations (org_id, email, role) values (%L, 'invitee@test.am', 'viewer')$q$, :'org_a'), 'invite: one pending invitation per email per org', 'duplicate');
select pg_temp.expect_error(format($q$insert into public.invitations (org_id, email, role) values (%L, 'Not An Email', 'viewer')$q$, :'org_a'), 'invite: email must be normalised and valid', 'check');
select token as tok from public.invitations where org_id = :'org_a' \gset

-- Viewer of the same org cannot invite or read invitations.
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_error(format($q$insert into public.invitations (org_id, email, role) values (%L, 'viewer-pal@test.am', 'owner')$q$, :'org_a'), 'invite: viewer cannot invite', 'row-level security');
select pg_temp.expect_rows('select * from public.invitations', 0, 'invite: viewer cannot read invitations (tokens)');

-- Owner of another org: cannot read, forge into, or delete A's invitations.
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_rows('select * from public.invitations', 0, 'invite: other org owner reads nothing');
select pg_temp.expect_error(format($q$insert into public.invitations (org_id, email, role) values (%L, 'owner-b@test.am', 'owner')$q$, :'org_a'), 'invite: other org owner cannot forge an invitation into A', 'row-level security');
delete from public.invitations;
select pg_temp.expect_error(format('select public.accept_invitation(%L)', :'tok'), 'accept: other org owner cannot accept A''s invitation', 'another email');
select pg_temp.expect_error($q$select public.accept_invitation('0000000000000000000000000000000000000000000000000000000000000000')$q$, 'accept: forged token rejected', 'not found');
select pg_temp.expect_rows(format('select * from public.invitation_preview(%L)', 'nope'), 0, 'preview: unknown token reveals nothing');
reset role;
select pg_temp.expect_rows('select * from public.invitations', 1, 'invite: other org owner''s delete removed nothing');
select pg_temp.expect_rows(format($q$select * from public.memberships where org_id = %L and user_id = 'e0000000-0000-0000-0000-00000000000b'$q$, :'org_a'), 0, 'accept: attacker did not join A');

-- Anonymous callers get nothing.
set role anon;
select pg_temp.as_user(null);
select pg_temp.expect_error('select * from public.invitations', 'invite: anon has no table access', 'permission denied');
select pg_temp.expect_error(format('select public.accept_invitation(%L)', :'tok'), 'accept: anon cannot call', 'permission denied');
select pg_temp.expect_error(format('select * from public.invitation_preview(%L)', :'tok'), 'preview: anon cannot call', 'permission denied');
reset role;

-- ---------- Accepting ----------
set role authenticated;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select pg_temp.expect_eq((select status from public.invitation_preview(:'tok')), 'mismatch', 'preview: stranger sees email mismatch');
select pg_temp.expect_error(format('select public.accept_invitation(%L)', :'tok'), 'accept: mismatched email rejected', 'another email');
select pg_temp.expect_rows('select * from public.invitations', 0, 'invite: invitee-to-be cannot read the table directly');

select pg_temp.as_user('e0000000-0000-0000-0000-00000000000d');
select pg_temp.expect_eq((select status || ':' || org_name || ':' || role from public.invitation_preview(:'tok')), 'ok:Firm EA:accountant', 'preview: invitee sees org and role');
select pg_temp.expect_eq(public.accept_invitation(:'tok')::text, :'org_a', 'accept: invitee (case-insensitive email) joins the org');
select pg_temp.expect_rows(format($q$select * from public.memberships where org_id = %L and user_id = 'e0000000-0000-0000-0000-00000000000d' and role = 'accountant'$q$, :'org_a'), 1, 'accept: membership created with invited role');
select pg_temp.expect_error(format('select public.accept_invitation(%L)', :'tok'), 'accept: invitation is single-use', 'already used');
select pg_temp.expect_eq((select status from public.invitation_preview(:'tok')), 'used', 'preview: shows used');

-- Expired invitation.
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
insert into public.invitations (org_id, email, role) values (:'org_a', 'other@test.am', 'viewer') returning token as tok2 \gset
reset role;
update public.invitations set expires_at = now() - interval '1 minute' where token = :'tok2';
set role authenticated;
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000e');
select pg_temp.expect_eq((select status from public.invitation_preview(:'tok2')), 'expired', 'preview: shows expired');
select pg_temp.expect_error(format('select public.accept_invitation(%L)', :'tok2'), 'accept: expired invitation rejected', 'expired');
-- Owner can revoke (delete) a pending invitation.
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_rows(format('delete from public.invitations where token = %L returning 1', :'tok2'), 1, 'invite: owner can revoke');

-- ---------- Roles and the last owner ----------
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000c');
select pg_temp.expect_rows(format($q$update public.memberships set role = 'owner' where org_id = %L returning 1$q$, :'org_a'), 0, 'roles: viewer cannot change roles');
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
select pg_temp.expect_rows(format($q$delete from public.memberships where org_id = %L returning 1$q$, :'org_a'), 0, 'roles: other org owner cannot remove A''s members');

select pg_temp.as_user('e0000000-0000-0000-0000-00000000000a');
select pg_temp.expect_error(format($q$update public.memberships set role = 'viewer' where org_id = %L and user_id = 'e0000000-0000-0000-0000-00000000000a'$q$, :'org_a'), 'last owner: cannot demote self', 'at least one owner');
select pg_temp.expect_error(format($q$delete from public.memberships where org_id = %L and user_id = 'e0000000-0000-0000-0000-00000000000a'$q$, :'org_a'), 'last owner: cannot remove self', 'at least one owner');
select pg_temp.expect_error(format($q$delete from public.memberships where org_id = %L$q$, :'org_a'), 'last owner: cannot remove everyone', 'at least one owner');
select pg_temp.expect_rows(format($q$delete from public.memberships where org_id = %L and user_id = 'e0000000-0000-0000-0000-00000000000c' returning 1$q$, :'org_a'), 1, 'roles: owner removes viewer');
select pg_temp.expect_rows(format($q$update public.memberships set role = 'owner' where org_id = %L and user_id = 'e0000000-0000-0000-0000-00000000000d' returning 1$q$, :'org_a'), 1, 'roles: owner promotes accountant to owner');
select pg_temp.expect_rows(format($q$update public.memberships set role = 'accountant' where org_id = %L and user_id = 'e0000000-0000-0000-0000-00000000000a' returning 1$q$, :'org_a'), 1, 'roles: owner can step down while another owner remains');
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error(format($q$delete from public.memberships where org_id = %L and user_id = 'e0000000-0000-0000-0000-00000000000d'$q$, :'org_a'), 'last owner: new sole owner cannot leave', 'at least one owner');
reset role;

-- Deleting a whole org (or an account) is not blocked by the guard, even with a user id in the session.
select pg_temp.as_user('e0000000-0000-0000-0000-00000000000b');
delete from public.orgs where id = :'org_b';
select pg_temp.expect_rows(format('select * from public.memberships where org_id = %L', :'org_b'), 0, 'last owner: org deletion still cascades');
select pg_temp.as_user(null);
select pg_temp.expect_rows($q$select * from public.audit_log where table_name = 'invitations' and action = 'insert'$q$, 2, 'invite: invitations are audited');
\echo 'Engineering members tests: all passed'
