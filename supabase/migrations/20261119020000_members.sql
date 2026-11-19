-- Engineering: member invitations, last-owner guard.
-- Invitations are visible only to owners of the org. Accepting goes through accept_invitation(),
-- which checks the token, expiry, single use and that the signed-in user's email matches.

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 320),
  role public.member_role not null,
  -- 244 random bits from two v4 UUIDs (core function, no extension schema needed).
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by uuid references auth.users (id) on delete set null default auth.uid(),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.invitations (org_id);
-- One open invitation per address per org; re-inviting replaces it.
create unique index invitations_one_pending on public.invitations (org_id, email) where accepted_at is null;

alter table public.invitations enable row level security;

-- Clients may only choose org, email and role: the token, expiry, inviter and acceptance are server-set.
revoke all on public.invitations from anon, authenticated;
grant select, delete on public.invitations to authenticated;
grant insert (org_id, email, role) on public.invitations to authenticated;

create policy invitations_owner_select on public.invitations for select to authenticated
  using (private.has_role(org_id, array['owner']::public.member_role[]));
create policy invitations_owner_insert on public.invitations for insert to authenticated
  with check (private.has_role(org_id, array['owner']::public.member_role[]) and invited_by = (select auth.uid()));
create policy invitations_owner_delete on public.invitations for delete to authenticated
  using (private.has_role(org_id, array['owner']::public.member_role[]));

create trigger audit after insert or update or delete on public.invitations
  for each row execute function private.audit();

-- The signed-in user's email, lower-cased. Read from auth.users so a client cannot claim another address.
create function private.my_email()
returns text language sql stable security definer set search_path = '' as $$
  select lower(u.email) from auth.users u where u.id = (select auth.uid());
$$;

/** What the invite page shows before accepting. Only the token holder learns anything, and only about that invitation. */
create function public.invitation_preview(p_token text)
returns table (org_name text, role public.member_role, email text, status text)
language sql stable security definer set search_path = '' as $$
  select o.name, i.role, i.email,
    case
      when i.accepted_at is not null then 'used'
      when i.expires_at < now() then 'expired'
      when i.email is distinct from private.my_email() then 'mismatch'
      else 'ok'
    end
  from public.invitations i join public.orgs o on o.id = i.org_id
  where (select auth.uid()) is not null and i.token = p_token;
$$;

/** Accepts an invitation for the signed-in user and returns the org id. Existing memberships keep their role. */
create function public.accept_invitation(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invitations;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select * into v_inv from public.invitations where token = p_token for update;
  if not found then raise exception 'invitation not found'; end if;
  if v_inv.accepted_at is not null then raise exception 'invitation already used'; end if;
  if v_inv.expires_at < now() then raise exception 'invitation expired'; end if;
  if v_inv.email is distinct from private.my_email() then raise exception 'invitation is for another email'; end if;

  insert into public.memberships (user_id, org_id, role) values (v_uid, v_inv.org_id, v_inv.role)
  on conflict (user_id, org_id) do nothing;
  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  return v_inv.org_id;
end;
$$;

revoke all on function public.invitation_preview(text) from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function private.my_email() from public, anon;
grant execute on function public.invitation_preview(text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function private.my_email() to authenticated;

-- ---------- Last owner ----------
-- A user action may never leave an org without an owner. Deleting the org itself, deleting a user account
-- (auth admin) and service-role maintenance (no auth.uid()) are not blocked.
create function private.keep_one_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or old.role <> 'owner' then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.role = 'owner' and new.org_id = old.org_id then return new; end if;
  -- Lock the org row so two owners cannot demote each other at the same time.
  perform 1 from public.orgs where id = old.org_id for update;
  if not found then return coalesce(new, old); end if; -- org is being deleted
  if not exists (
    select 1 from public.memberships m
    where m.org_id = old.org_id and m.role = 'owner' and m.user_id <> old.user_id
  ) then
    raise exception 'an org must keep at least one owner';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger keep_one_owner before update or delete on public.memberships
  for each row execute function private.keep_one_owner();
